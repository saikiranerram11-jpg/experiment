import { getAddress } from "viem";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { DAORevenueEpoch } from "../models/DAORevenueEpoch.js";
import { DAORevenueMemberEntry } from "../models/DAORevenueMemberEntry.js";
import { DAORevenuePayment } from "../models/DAORevenuePayment.js";
import { assertInvariant, DAORevenueInvariantError } from "./policy.js";
import { daoRevenueChainReader, type DAORevenueChainReader } from "./chain.js";

/**
 * Reconciles a DAO revenue epoch against chain state.
 *
 * The chain is the authority throughout. `isPaid(epochId, eoa)`, `epochFundedAmount` and
 * `epochDistributedAmount` decide what has happened — never a local flag — so a crash between a
 * confirmed transaction and a database write costs nothing but a re-read.
 *
 * COMPLETED is only reachable when the chain proves BOTH that every calculated member is paid
 * and that the distributed total equals the calculated obligation. Either alone is insufficient:
 * all-paid with a larger distributed total would mean someone was paid who has no obligation.
 */

const key = () => ({
  chainId: config.chainId,
  daoContractAddress: getAddress(config.acfDaoAddress).toLowerCase(),
  distributorAddress: getAddress(config.daoRevenueDistributorAddress).toLowerCase(),
});

export interface DAORevenueReconciliation {
  epochId: number;
  statusBefore: string;
  statusAfter: string;
  fundedACF: string;
  distributedACF: string;
  obligationACF: string;
  paidMembers: number;
  totalMembers: number;
  warnings: string[];
}

export async function reconcileDAORevenueEpoch(
  epochId: number,
  reader: DAORevenueChainReader = daoRevenueChainReader,
): Promise<DAORevenueReconciliation | null> {
  const k = key();
  const epoch = await DAORevenueEpoch.findOne({ ...k, epochId }).lean();
  if (!epoch) return null;

  const statusBefore = epoch.status;
  const warnings: string[] = [];

  if (statusBefore === "NOTHING_TO_DISTRIBUTE") {
    // Nothing was ever owed, so nothing may have been funded against this epoch id.
    const funded = await reader.epochFundedAmount(epochId);
    if (funded !== 0n) {
      throw new DAORevenueInvariantError(
        `Epoch ${epochId} is terminal with nothing owed, but the distributor reports ${funded} ` +
          "ACF funded against it. That ACF cannot be distributed and cannot be swept.",
      );
    }
    return {
      epochId, statusBefore, statusAfter: statusBefore,
      fundedACF: "0", distributedACF: "0", obligationACF: "0",
      paidMembers: 0, totalMembers: 0, warnings,
    };
  }

  const entries = await DAORevenueMemberEntry.find({
    chainId: k.chainId, distributorAddress: k.distributorAddress, epochId,
  }).lean();
  const obligation = BigInt(epoch.totalMemberRevenueACF);

  const [treasuryFunded, funded, distributed] = await Promise.all([
    reader.treasuryFunded(epochId),
    reader.epochFundedAmount(epochId),
    reader.epochDistributedAmount(epochId),
  ]);

  // ── funding agreement ─────────────────────────────────────────────────
  if (funded !== 0n && funded !== obligation) {
    throw new DAORevenueInvariantError(
      `Epoch ${epochId} was funded with ${funded} ACF but the calculated obligation is ` +
        `${obligation}. The distributor has no sweep, so a mismatch cannot be corrected by ` +
        "distributing; this needs an operator decision.",
    );
  }
  if (treasuryFunded && funded === 0n) {
    warnings.push(
      "Treasury records this epoch as funded but the distributor registered no amount.",
    );
  }

  // ── per-member payment state, from chain ──────────────────────────────
  const paidMap = await reader.isPaid(epochId, entries.map((e) => e.externalEOA));
  const paidEntries = entries.filter((e) => paidMap.get(e.externalEOA.toLowerCase()) === true);

  assertInvariant(
    distributed <= funded,
    `Epoch ${epochId} distributed ${distributed} ACF against ${funded} funded.`,
  );

  const expectedPaidTotal = paidEntries.reduce((sum, e) => sum + BigInt(e.memberRevenueACF), 0n);
  if (distributed !== expectedPaidTotal) {
    throw new DAORevenueInvariantError(
      `Epoch ${epochId} distributed ${distributed} ACF, but the members the chain reports as ` +
        `paid account for ${expectedPaidTotal}. Either someone was paid without a calculated ` +
        "obligation, or an amount differs from what was calculated.",
    );
  }

  // ── status ────────────────────────────────────────────────────────────
  let statusAfter = statusBefore;
  const allPaid = entries.length > 0 && paidEntries.length === entries.length;

  if (allPaid && distributed === obligation) {
    statusAfter = "COMPLETED";
  } else if (funded === obligation && funded > 0n) {
    statusAfter = paidEntries.length > 0 ? "DISTRIBUTING" : "FUNDED";
  } else if (statusBefore === "FUNDING_SUBMITTED" && funded === 0n) {
    // Submitted but never landed; safe to retry funding from CALCULATED.
    statusAfter = "CALCULATED";
  }

  const update: Record<string, unknown> = {
    status: statusAfter,
    paidMembers: paidEntries.length,
    fundedACF: funded.toString(),
  };
  if (statusAfter === "COMPLETED" && !epoch.completedAt) update.completedAt = new Date();
  if ((statusAfter === "FUNDED" || statusAfter === "DISTRIBUTING") && !epoch.fundedAt) {
    update.fundedAt = new Date();
  }
  if (statusAfter !== statusBefore) update.leaseExpiresAt = null;
  await DAORevenueEpoch.updateOne({ ...k, epochId }, { $set: update });

  if (statusAfter !== statusBefore) {
    logger.info("dao revenue epoch reconciled", {
      epochId, statusBefore, statusAfter,
      paid: paidEntries.length, total: entries.length,
    });
  }

  return {
    epochId, statusBefore, statusAfter,
    fundedACF: funded.toString(),
    distributedACF: distributed.toString(),
    obligationACF: obligation.toString(),
    paidMembers: paidEntries.length,
    totalMembers: entries.length,
    warnings,
  };
}

/**
 * Records confirmed DAORevenuePaid events against their calculated obligations.
 *
 * Every field is verified: the EOA, the destination wallet and the amount must all match the
 * immutable member entry. A payment the calculation did not authorise, or one that landed on a
 * different wallet, fails rather than being recorded as a fact.
 */
export async function recordPayments(
  epochId: number,
  events: Array<{
    user: string; wallet: string; amount: bigint;
    txHash: string; logIndex: number; blockNumber: number; blockTimestamp: number;
  }>,
): Promise<{ recorded: number; alreadyPresent: number }> {
  const k = key();
  const entries = await DAORevenueMemberEntry.find({
    chainId: k.chainId, distributorAddress: k.distributorAddress, epochId,
  }).lean();
  const byEOA = new Map(entries.map((e) => [e.externalEOA.toLowerCase(), e]));

  let recorded = 0;
  let alreadyPresent = 0;

  for (const event of events) {
    const eoa = event.user.toLowerCase();
    const entry = byEOA.get(eoa);
    if (!entry) {
      throw new DAORevenueInvariantError(
        `Epoch ${epochId} paid ${eoa}, which has no calculated obligation. Refusing to record ` +
          "a payment the calculation never authorised.",
      );
    }
    if (event.wallet.toLowerCase() !== entry.smartWalletAddress.toLowerCase()) {
      throw new DAORevenueInvariantError(
        `Epoch ${epochId} paid ${eoa} at wallet ${event.wallet}, but the obligation names ` +
          `${entry.smartWalletAddress}.`,
      );
    }
    if (event.amount !== BigInt(entry.memberRevenueACF)) {
      throw new DAORevenueInvariantError(
        `Epoch ${epochId} paid ${eoa} ${event.amount} ACF, but the obligation is ` +
          `${entry.memberRevenueACF}.`,
      );
    }

    const result = await DAORevenuePayment.updateOne(
      { chainId: k.chainId, distributorAddress: k.distributorAddress, epochId, userId: entry.userId },
      {
        $setOnInsert: {
          chainId: k.chainId,
          distributorAddress: k.distributorAddress,
          epochId,
          userId: entry.userId,
          externalEOA: eoa,
          smartWalletAddress: entry.smartWalletAddress.toLowerCase(),
          expectedAmountACF: entry.memberRevenueACF,
          amountPaidACF: event.amount.toString(),
          txHash: event.txHash.toLowerCase(),
          logIndex: event.logIndex,
          blockNumber: event.blockNumber,
          blockTimestamp: event.blockTimestamp,
        },
      },
      { upsert: true },
    );
    if (result.upsertedCount > 0) recorded += 1;
    else alreadyPresent += 1;
  }

  return { recorded, alreadyPresent };
}
