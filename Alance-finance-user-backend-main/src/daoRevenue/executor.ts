import { getAddress, parseEventLogs, type Log } from "viem";
import { config } from "../config.js";
import { publicClient } from "../lib/chain.js";
import { logger } from "../lib/logger.js";
import { DAORevenueEpoch } from "../models/DAORevenueEpoch.js";
import { DAORevenueMemberEntry } from "../models/DAORevenueMemberEntry.js";
import { assertInvariant, DAORevenueInvariantError } from "./policy.js";
import { rebuildManifest, type DAORevenueManifest } from "./manifest.js";
import { standardRewardLiability } from "./liability.js";
import { daoRevenueChainReader, daoRevenuePaidEventAbi, type DAORevenueChainReader } from "./chain.js";
import { recordPayments, reconcileDAORevenueEpoch } from "./reconcile.js";
import {
  loadEpochExecutorSigner, signerConfigured, type EpochExecutorSigner,
} from "../executor/signer.js";

/**
 * The DAO Revenue Executor: the only code path that signs a transaction.
 *
 * It can construct exactly TWO calls and no others:
 *
 *   Treasury.fundDAORevenueEpoch(epochId, amount)
 *   DAORevenueDistributor.distributeBatch(epochId, users[], amounts[])
 *
 * There is deliberately no generic send, no arbitrary contract write, no grantRole, no
 * adjustReserve and no upgrade path. Even though the on-chain EPOCH_EXECUTOR_ROLE is broader
 * than these two functions, this process cannot reach the rest of it.
 *
 * It never decides an amount. Every figure comes from the immutable manifest the calculation
 * service produced, whose hash is recomputed here and compared before anything is signed.
 */

// Only the two state-changing functions. Nothing else is encodable from this module.
const treasuryFundAbi = [{
  type: "function", name: "fundDAORevenueEpoch", stateMutability: "nonpayable",
  inputs: [{ type: "uint256" }, { type: "uint256" }], outputs: [],
}] as const;

const distributeBatchAbi = [{
  type: "function", name: "distributeBatch", stateMutability: "nonpayable",
  inputs: [{ type: "uint256" }, { type: "address[]" }, { type: "uint256[]" }], outputs: [],
}] as const;

const key = () => ({
  chainId: config.chainId,
  daoContractAddress: getAddress(config.acfDaoAddress).toLowerCase(),
  distributorAddress: getAddress(config.daoRevenueDistributorAddress).toLowerCase(),
});

/** Statuses the executor may act on. */
export const EXECUTABLE = ["CALCULATED", "FUNDING_SUBMITTED", "FUNDED", "DISTRIBUTING"];

export interface PreflightReport {
  epochId: number;
  manifestHash: string;
  manifestVerified: boolean;
  chainId: number;
  signerAddress: string | null;
  signerHasTreasuryRole: boolean | null;
  signerHasDistributorRole: boolean | null;
  obligationACF: string;
  fundedACF: string;
  distributedACF: string;
  treasuryBalanceACF: string;
  requiredReserveACF: string;
  /** ACF that must stay behind for Phase 3 checkpoints the operator has not yet funded. */
  pendingStandardObligationACF: string;
  /** requiredReserve + pendingStandardObligation: the floor the balance must clear. */
  requiredHeadroomACF: string;
  postFundingBalanceACF: string;
  headroomOk: boolean;
  memberCount: number;
  batchCount: number;
  unpaidMembers: number;
  plannedCalls: string[];
  blockers: string[];
}

/**
 * Every precondition, with no transaction sent. This is also the dry run.
 *
 * `signer` is optional so a dry run can validate everything else without unlocking a production
 * key; the role checks are then reported as unknown rather than assumed.
 */
export async function preflight(
  epochId: number,
  reader: DAORevenueChainReader = daoRevenueChainReader,
  signerAddress?: string,
): Promise<PreflightReport> {
  const k = key();
  const blockers: string[] = [];
  const epoch = await DAORevenueEpoch.findOne({ ...k, epochId }).lean();
  if (!epoch) throw new DAORevenueInvariantError(`No DAO revenue epoch ${epochId}.`);

  if (!EXECUTABLE.includes(epoch.status)) {
    blockers.push(`Epoch status is ${epoch.status}; executable statuses are ${EXECUTABLE.join(", ")}.`);
  }

  // ── manifest integrity ────────────────────────────────────────────────
  const { manifest, hash, recordedHash } = await rebuildManifest(epochId);
  const manifestVerified = hash.toLowerCase() === recordedHash.toLowerCase();
  if (!manifestVerified) {
    blockers.push(
      `Manifest hash mismatch: rows hash to ${hash} but the epoch recorded ${recordedHash}. ` +
        "A financial field has changed since calculation.",
    );
  }

  // ── deployment identity ───────────────────────────────────────────────
  const chainId = await reader.chainId();
  if (chainId !== config.chainId) {
    blockers.push(`RPC reports chain ${chainId}, configured ${config.chainId}.`);
  }
  if (manifest.distributorAddress !== k.distributorAddress) {
    blockers.push(`Manifest distributor ${manifest.distributorAddress} is not the configured one.`);
  }
  if (manifest.epochId !== epochId) {
    blockers.push(`Manifest epoch ${manifest.epochId} does not match ${epochId}.`);
  }

  const [wiring, payoutDestination, treasuryAcf] = await Promise.all([
    reader.distributorWiring(),
    reader.treasuryDaoPayoutDestination(),
    reader.treasuryAcf(),
  ]);
  if (payoutDestination !== k.distributorAddress) {
    blockers.push(
      `Treasury.daoPayoutDestination is ${payoutDestination}, not the configured distributor.`,
    );
  }
  if (wiring.treasury !== getAddress(config.treasuryAddress).toLowerCase()) {
    blockers.push(`distributor.treasury is ${wiring.treasury}, not the configured Treasury.`);
  }
  if (wiring.acf !== getAddress(config.acfTokenAddress).toLowerCase()) {
    blockers.push(`distributor.acf is ${wiring.acf}, not the configured ACF token.`);
  }
  if (treasuryAcf !== getAddress(config.acfTokenAddress).toLowerCase()) {
    blockers.push(`Treasury.acf is ${treasuryAcf}, not the configured ACF token.`);
  }
  if (wiring.walletRegistry !== getAddress(config.userWalletFactoryAddress).toLowerCase()) {
    blockers.push(
      `distributor.walletRegistry is ${wiring.walletRegistry}, not the configured factory.`,
    );
  }
  if (config.daoRevenueBatchSize > wiring.maxBatchSize) {
    blockers.push(
      `DAO_REVENUE_BATCH_SIZE ${config.daoRevenueBatchSize} exceeds the distributor's ` +
        `MAX_BATCH_SIZE ${wiring.maxBatchSize}; distributeBatch would revert InvalidBatch.`,
    );
  }
  for (const batch of manifest.batches) {
    if (batch.externalEOAs.length > wiring.maxBatchSize) {
      blockers.push(`Batch ${batch.batchIndex} has ${batch.externalEOAs.length} members.`);
    }
  }

  // ── funding state ─────────────────────────────────────────────────────
  const obligation = BigInt(epoch.totalMemberRevenueACF);
  const [funded, distributed, balance, requiredReserve] = await Promise.all([
    reader.epochFundedAmount(epochId),
    reader.epochDistributedAmount(epochId),
    reader.treasuryBalanceACF(),
    reader.requiredReserve(),
  ]);
  if (obligation <= 0n) {
    blockers.push(`Obligation is ${obligation}; fundDAORevenueEpoch would revert InvalidAmount.`);
  }
  if (funded !== 0n && funded !== obligation) {
    blockers.push(
      `Epoch already funded with ${funded} ACF, not the obligation ${obligation}. ` +
        "The distributor has no sweep; this needs an operator decision.",
    );
  }

  // ── Treasury headroom ─────────────────────────────────────────────────
  // Nothing on chain enforces requiredReserve, and DAO funding competes with Phase 3 standard
  // reward funding for the SAME balance. So the floor is the reserve PLUS any checkpoint the
  // operator has calculated but not yet funded: DAO revenue is automated and Phase 3 funding is
  // a manual step, so the automated side must yield to the manual one.
  //
  // adjustReserve() is deliberately never called. Minting to replace what was paid out is a
  // monetary decision, not an automation one.
  const liability = await standardRewardLiability(reader);
  const needsFunding = funded === 0n;
  const postFunding = needsFunding ? balance - obligation : balance;
  const requiredHeadroom = requiredReserve + liability.reservedACF;
  const headroomOk = liability.undetermined === null && postFunding >= requiredHeadroom;

  if (liability.undetermined !== null) {
    // Never guess zero: an unknown Phase 3 liability means DAO funding could spend ACF the
    // operator is about to need.
    blockers.push(`Pending standard-reward obligation is undetermined. ${liability.undetermined}`);
  }
  if (needsFunding && balance < obligation) {
    blockers.push(`Treasury holds ${balance} ACF, less than the obligation ${obligation}.`);
  }
  if (liability.undetermined === null && postFunding < requiredHeadroom) {
    blockers.push(
      `Funding would leave the Treasury at ${postFunding} ACF against a required headroom of ` +
        `${requiredHeadroom} (reserve ${requiredReserve} + pending standard-reward obligation ` +
        `${liability.reservedACF}). Refusing to erode reward backing or a pending settlement; ` +
        "escalate rather than minting.",
    );
  }

  // ── signer roles ──────────────────────────────────────────────────────
  let treasuryRole: boolean | null = null;
  let distributorRole: boolean | null = null;
  if (signerAddress) {
    const roles = await reader.executorRoles(signerAddress);
    treasuryRole = roles.treasury;
    distributorRole = roles.distributor;
    if (!roles.treasury && needsFunding) {
      blockers.push(`${signerAddress} lacks EPOCH_EXECUTOR_ROLE on the Treasury.`);
    }
    if (!roles.distributor) {
      blockers.push(`${signerAddress} lacks EPOCH_EXECUTOR_ROLE on the distributor.`);
    }
  }

  // ── what remains to pay ───────────────────────────────────────────────
  const entries = await DAORevenueMemberEntry.find({
    chainId: k.chainId, distributorAddress: k.distributorAddress, epochId,
  }).lean();
  const paid = await reader.isPaid(epochId, entries.map((e) => e.externalEOA));
  const unpaid = entries.filter((e) => paid.get(e.externalEOA.toLowerCase()) !== true);

  const plannedCalls: string[] = [];
  if (needsFunding) {
    plannedCalls.push(`Treasury.fundDAORevenueEpoch(${epochId}, ${obligation})`);
  }
  for (const batch of manifest.batches) {
    const remaining = batch.externalEOAs.filter(
      (eoa) => paid.get(eoa.toLowerCase()) !== true,
    );
    if (remaining.length > 0) {
      plannedCalls.push(
        `distributor.distributeBatch(${epochId}, [${remaining.length} users], [...])`,
      );
    }
  }

  return {
    epochId,
    manifestHash: hash,
    manifestVerified,
    chainId,
    signerAddress: signerAddress ?? null,
    signerHasTreasuryRole: treasuryRole,
    signerHasDistributorRole: distributorRole,
    obligationACF: obligation.toString(),
    fundedACF: funded.toString(),
    distributedACF: distributed.toString(),
    treasuryBalanceACF: balance.toString(),
    requiredReserveACF: requiredReserve.toString(),
    pendingStandardObligationACF: liability.reservedACF.toString(),
    requiredHeadroomACF: requiredHeadroom.toString(),
    postFundingBalanceACF: postFunding.toString(),
    headroomOk,
    memberCount: entries.length,
    batchCount: manifest.batchCount,
    unpaidMembers: unpaid.length,
    plannedCalls,
    blockers,
  };
}

export interface ExecutionResult {
  epochId: number;
  funded: boolean;
  fundingTxHash: string | null;
  batchesSubmitted: number;
  membersPaid: number;
  status: string;
}

/**
 * Funds and distributes one epoch, resuming from chain state after any crash.
 *
 * Deliberately sequential: funding must be confirmed and registered before any transfer, and
 * each batch is reconciled before the next, so a partial run leaves a state the next attempt can
 * read rather than guess.
 */
export async function executeDAORevenueEpoch(
  epochId: number,
  options: { reader?: DAORevenueChainReader; signer?: EpochExecutorSigner } = {},
): Promise<ExecutionResult> {
  const reader = options.reader ?? daoRevenueChainReader;
  const signer = options.signer ?? loadEpochExecutorSigner();
  const k = key();

  const report = await preflight(epochId, reader, signer.address);
  if (report.blockers.length > 0) {
    throw new DAORevenueInvariantError(
      `Refusing to execute DAO revenue epoch ${epochId}:\n  - ${report.blockers.join("\n  - ")}`,
    );
  }
  assertInvariant(report.manifestVerified, `Epoch ${epochId} manifest is not verified.`);

  // Taken BEFORE anything is signed. Losing the race is not an error: another executor owns
  // this epoch, and the two must never submit for it concurrently.
  if (!(await claimExecutorLease(epochId))) {
    throw new DAORevenueInvariantError(
      `DAO revenue epoch ${epochId} is already leased by another executor. Refusing to ` +
        "submit concurrently; the lease expires on its own if that process died.",
    );
  }

  const obligation = BigInt(report.obligationACF);
  let fundingTxHash: string | null = null;

  // ── 1. funding, skipped when the chain already records it ─────────────
  if (BigInt(report.fundedACF) === 0n) {
    await DAORevenueEpoch.updateOne(
      { ...k, epochId }, { $set: { status: "FUNDING_SUBMITTED" } },
    );
    logger.info("dao revenue funding submitted", { epochId, amount: obligation.toString() });

    const hash = await signer.client.writeContract({
      address: getAddress(config.treasuryAddress),
      abi: treasuryFundAbi,
      functionName: "fundDAORevenueEpoch",
      args: [BigInt(epochId), obligation],
      chain: signer.chain,
      account: signer.client.account!,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new DAORevenueInvariantError(`Funding reverted for epoch ${epochId}: ${hash}`);
    }
    fundingTxHash = hash;

    // Read back from BOTH contracts: the Treasury's replay mark and the distributor's recorded
    // amount. A receipt alone does not prove the callback registered the right figure.
    const [treasuryFunded, registered] = await Promise.all([
      reader.treasuryFunded(epochId),
      reader.epochFundedAmount(epochId),
    ]);
    assertInvariant(treasuryFunded, `Treasury does not record epoch ${epochId} as funded.`);
    assertInvariant(
      registered === obligation,
      `Distributor registered ${registered} ACF for epoch ${epochId}, expected ${obligation}.`,
    );

    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    await DAORevenueEpoch.updateOne({ ...k, epochId }, {
      $set: {
        status: "FUNDED",
        fundingTxHash: hash.toLowerCase(),
        fundingBlockNumber: Number(receipt.blockNumber),
        fundingBlockTimestamp: Number(block.timestamp),
        fundedACF: registered.toString(),
        fundedAt: new Date(),
      },
    });
    logger.info("dao revenue epoch funded", { epochId, txHash: hash });
  }

  // ── 2. distribution, batch by batch, resuming from chain ──────────────
  const { manifest } = await rebuildManifest(epochId);
  await DAORevenueEpoch.updateOne({ ...k, epochId }, { $set: { status: "DISTRIBUTING" } });

  let batchesSubmitted = 0;
  let membersPaid = 0;

  for (const batch of manifest.batches) {
    const paid = await reader.isPaid(epochId, batch.externalEOAs);
    const remaining = batch.externalEOAs
      .map((eoa, index) => ({ eoa, amount: BigInt(batch.amountsACF[index]!) }))
      .filter(({ eoa }) => paid.get(eoa.toLowerCase()) !== true);

    if (remaining.length === 0) continue;

    const hash = await signer.client.writeContract({
      address: getAddress(config.daoRevenueDistributorAddress),
      abi: distributeBatchAbi,
      functionName: "distributeBatch",
      args: [
        BigInt(epochId),
        remaining.map((r) => getAddress(r.eoa)),
        remaining.map((r) => r.amount),
      ],
      chain: signer.chain,
      account: signer.client.account!,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status !== "success") {
      throw new DAORevenueInvariantError(
        `Batch ${batch.batchIndex} reverted for epoch ${epochId}: ${hash}`,
      );
    }
    batchesSubmitted += 1;

    // Verify against the events, not the receipt status: each DAORevenuePaid must match an
    // immutable obligation in user, wallet and amount.
    const events = parseEventLogs({
      abi: [daoRevenuePaidEventAbi],
      logs: receipt.logs as Log[],
    }).filter((event) => Number(event.args.epochId) === epochId);

    const block = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
    await recordPayments(epochId, events.map((event) => ({
      user: String(event.args.user),
      wallet: String(event.args.wallet),
      amount: event.args.amount as bigint,
      txHash: hash,
      logIndex: Number(event.logIndex),
      blockNumber: Number(receipt.blockNumber),
      blockTimestamp: Number(block.timestamp),
    })));
    membersPaid += events.length;

    logger.info("dao revenue batch distributed", {
      epochId, batchIndex: batch.batchIndex, members: events.length, txHash: hash,
    });
  }

  // ── 3. completion is decided by chain state, never by this loop ───────
  const reconciliation = await reconcileDAORevenueEpoch(epochId, reader);
  await DAORevenueEpoch.updateOne({ ...k, epochId }, { $set: { leaseExpiresAt: null } });

  return {
    epochId,
    funded: true,
    fundingTxHash,
    batchesSubmitted,
    membersPaid,
    status: reconciliation?.statusAfter ?? "UNKNOWN",
  };
}

/** Next epoch the executor should act on: oldest actionable first, one at a time. */
export async function nextExecutableEpoch(): Promise<number | null> {
  const k = key();
  const now = new Date();
  const row = await DAORevenueEpoch.findOne({
    ...k,
    status: { $in: EXECUTABLE },
    $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lt: now } }],
  }).sort({ epochId: 1 }).lean();
  return row?.epochId ?? null;
}

/**
 * Takes the execution lease ATOMICALLY, or returns false.
 *
 * The filter requires the lease to be absent or expired, so of two executors selecting the same
 * epoch exactly one update matches — a read-then-write pair would let both through, and the
 * loser would then spend gas on a transaction the chain rejects.
 *
 * The chain guards (`daoRevenueEpochFunded`, `paid[epochId][user]`) remain the last defence
 * against double payment; this is the local coordination that should stop it reaching them.
 */
async function claimExecutorLease(epochId: number): Promise<boolean> {
  const now = new Date();
  const expires = new Date(now.getTime() + config.daoRevenueExecutorLeaseMs);
  const result = await DAORevenueEpoch.updateOne(
    {
      ...key(), epochId,
      $or: [{ leaseExpiresAt: null }, { leaseExpiresAt: { $lt: now } }],
    },
    { $set: { leaseExpiresAt: expires }, $inc: { attempts: 1 } },
  );
  return result.modifiedCount === 1;
}

export { signerConfigured };
export { rebuildManifest };
