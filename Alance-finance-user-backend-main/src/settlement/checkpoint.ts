import { getAddress } from "viem";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { User } from "../models/User.js";
import { CheckpointSelfComponent } from "../models/CheckpointSelfComponent.js";
import { RewardSettlementCheckpoint } from "../models/RewardSettlementCheckpoint.js";
import { UserRewardCheckpoint } from "../models/UserRewardCheckpoint.js";
import { earnedByUser, selfComponents, settledEpochRange, type SelfComponent } from "./earned.js";
import { buildSettlementTree } from "./merkle.js";
import {
  assertInvariant, AWAITING_OPERATOR, leafHash, type SettlementLeaf,
} from "./policy.js";
import { settlementChainReader, type SettlementChainReader } from "./chain.js";
import { persistAndVerify } from "./verify.js";

/**
 * Builds one cumulative settlement checkpoint.
 *
 * This module calculates and verifies; it never signs. Funding and root finalization move real
 * Treasury assets and are submitted by the separate settlement executor, after which this
 * module reconciles from chain state.
 */

const keys = () => ({
  chainId: config.chainId,
  stakingContractAddress: getAddress(config.acfStakingAddress).toLowerCase(),
  withdrawalAddress: getAddress(config.withdrawalAddress).toLowerCase(),
  treasuryAddress: getAddress(config.treasuryAddress).toLowerCase(),
});
const stakeKey = () => ({
  chainId: config.chainId,
  stakingContractAddress: getAddress(config.acfStakingAddress).toLowerCase(),
});
const settlementKey = () => ({
  chainId: config.chainId,
  withdrawalAddress: getAddress(config.withdrawalAddress).toLowerCase(),
});

export class SettlementStateError extends Error {
  readonly code = "SETTLEMENT_STATE";
  constructor(message: string) {
    super(message);
    this.name = "SettlementStateError";
  }
}

export type CalculateOutcome =
  | { outcome: "NOTHING_TO_SETTLE"; reason: string }
  | { outcome: "AWAITING_OPERATOR"; checkpointId: number; status: string }
  | {
      outcome: "CALCULATED";
      checkpointId: number;
      root: string;
      leafCount: number;
      publishedCumulativeTotalACF: string;
      publishedDeltaACF: string;
      fromRewardEpochId: number;
      throughRewardEpochId: number;
    };

/**
 * The single canonical calculation path. Scripts and the worker both call this.
 *
 * NOTHING_TO_SETTLE consumes no reward-epoch range and allocates no checkpoint id, because a
 * pending-wallet user may become publishable later with no new reward epoch at all — so the
 * same range must stay reconsiderable.
 */
export async function calculateSettlementCheckpoint(
  reader: SettlementChainReader = settlementChainReader,
): Promise<CalculateOutcome> {
  const k = keys();
  const sk = stakeKey();
  const settle = settlementKey();

  // ── only one unfinalized checkpoint at a time ──────────────────────────
  // The cumulative chain is linear: each checkpoint's previous root and total come from the one
  // before it, so building ahead of an unsigned checkpoint would fork that chain.
  const latest = await RewardSettlementCheckpoint.findOne({ ...settle })
    .sort({ checkpointId: -1 });
  if (latest && AWAITING_OPERATOR.includes(latest.status as never)) {
    return { outcome: "AWAITING_OPERATOR", checkpointId: latest.checkpointId, status: latest.status };
  }

  const previous = await RewardSettlementCheckpoint.findOne({ ...settle, status: "FINALIZED" })
    .sort({ checkpointId: -1 });
  if (!previous) {
    throw new SettlementStateError(
      "No FINALIZED settlement checkpoint exists. Seed the legacy on-chain settlement first " +
        "(npm run settlement:seed-legacy); the cumulative chain has no starting point without it.",
    );
  }

  // ── live-chain guard: the contract must still agree with our last checkpoint ──
  const live = await reader.liveState();
  assertInvariant(
    live.latestEpochId === previous.checkpointId,
    `Withdrawal.latestEpochId is ${live.latestEpochId}, expected ${previous.checkpointId}. ` +
      "Out-of-band settlement detected.",
  );
  assertInvariant(
    live.root === previous.root,
    `Withdrawal root is ${live.root}, expected ${previous.root}. Out-of-band root publication.`,
  );
  assertInvariant(
    live.cumulativeTotalEntitlementACF === BigInt(previous.publishedCumulativeTotalACF),
    `Withdrawal cumulative total is ${live.cumulativeTotalEntitlementACF}, expected ` +
      `${previous.publishedCumulativeTotalACF}.`,
  );
  assertInvariant(
    (await reader.treasuryWithdrawal()) === k.withdrawalAddress,
    "Treasury's configured Withdrawal address does not match this backend's configuration.",
  );

  const candidate = previous.checkpointId + 1;
  assertInvariant(
    !(await reader.epochFinalized(candidate)),
    `Withdrawal.epochFinalized(${candidate}) is already true. Investigate before settling; ` +
      "never skip to another id.",
  );
  assertInvariant(
    !(await reader.rewardEpochFunded(candidate)),
    `Treasury.rewardEpochFunded(${candidate}) is already true. Investigate before settling.`,
  );

  // ── the reward-epoch range ─────────────────────────────────────────────
  const range = await settledEpochRange(sk, previous.throughRewardEpochId ?? null);

  // ── previously published population, carried forward unconditionally ───
  const priorLeaves = await UserRewardCheckpoint.find({
    ...settle, checkpointId: previous.checkpointId,
  }).lean();
  const prior = new Map(priorLeaves.map((r) => [r.userId, r]));

  // ── earned inside the new range ────────────────────────────────────────
  const inRange = range
    ? await earnedByUser(sk, { epochId: { $in: range.epochIds } })
    : new Map<string, { selfACF: bigint; teamACF: bigint }>();

  // Candidate population: everyone already published, plus anyone who earned in the range,
  // plus anyone with earned history who may now have a wallet.
  const candidateUserIds = new Set<string>([...prior.keys(), ...inRange.keys()]);
  const everEarned = range
    ? await earnedByUser(sk, { epochId: { $lte: range.through } })
    : new Map<string, { selfACF: bigint; teamACF: bigint }>();
  for (const [userId, t] of everEarned) {
    if (t.selfACF > 0n || t.teamACF > 0n) candidateUserIds.add(userId);
  }

  const users = await User.find(
    { userId: { $in: [...candidateUserIds] } },
    { userId: 1, smartWalletAddress: 1 },
  ).lean();
  const walletOf = new Map(users.map((u) => [u.userId, u.smartWalletAddress ?? null]));

  // ── build the leaf set ─────────────────────────────────────────────────
  const leaves: SettlementLeaf[] = [];
  const userRows: Record<string, unknown>[] = [];
  const newlyPublished: string[] = [];
  let totalNewSelf = 0n;
  let totalNewTeam = 0n;
  let totalDeferredSelf = 0n;
  let totalDeferredTeam = 0n;
  const seenWallets = new Map<string, string>();

  for (const userId of [...candidateUserIds].sort()) {
    const previousRow = prior.get(userId);
    const wallet = walletOf.get(userId) ?? null;
    const ranged = inRange.get(userId) ?? { selfACF: 0n, teamACF: 0n };

    if (previousRow) {
      // Wallet identity is immutable once published: migrating entitlement to a different
      // address would hand one user's money to another.
      assertInvariant(
        wallet !== null,
        `User ${userId} was published at checkpoint ${previous.checkpointId} with wallet ` +
          `${previousRow.smartWalletAddress} but now has none.`,
      );
      assertInvariant(
        wallet === previousRow.smartWalletAddress,
        `User ${userId} wallet changed from ${previousRow.smartWalletAddress} to ${wallet}.`,
      );
    } else if (wallet === null) {
      // PENDING_WALLET: earned, never forfeited, simply not publishable yet.
      continue;
    }

    const prevSelf = previousRow ? BigInt(previousRow.cumulativeSelfACF) : 0n;
    const prevTeam = previousRow ? BigInt(previousRow.cumulativeTeamACF) : 0n;

    let cumSelf: bigint;
    let cumTeam: bigint;
    let deferredSelf = 0n;
    let deferredTeam = 0n;

    if (previousRow) {
      cumSelf = prevSelf + ranged.selfACF;
      cumTeam = prevTeam + ranged.teamACF;
    } else {
      // First publication: release EVERYTHING earned through the range end, including Team
      // accrued before this user had a wallet.
      const lifetime = everEarned.get(userId) ?? { selfACF: 0n, teamACF: 0n };
      cumSelf = lifetime.selfACF;
      cumTeam = lifetime.teamACF;
      deferredSelf = cumSelf - ranged.selfACF;
      deferredTeam = cumTeam - ranged.teamACF;
      assertInvariant(
        deferredSelf >= 0n && deferredTeam >= 0n,
        `User ${userId} has negative deferred entitlement; lifetime is below range earnings.`,
      );
      if (cumSelf + cumTeam === 0n) continue;          // nothing to publish
      newlyPublished.push(userId);
    }

    const walletLower = wallet!.toLowerCase();
    const clash = seenWallets.get(walletLower);
    assertInvariant(
      clash === undefined,
      `Users ${clash} and ${userId} both resolve to wallet ${walletLower}.`,
    );
    seenWallets.set(walletLower, userId);

    const leaf: SettlementLeaf = {
      smartWalletAddress: walletLower,
      cumulativeSelfACF: cumSelf,
      cumulativeTeamACF: cumTeam,
    };
    leaves.push(leaf);

    totalNewSelf += ranged.selfACF;
    totalNewTeam += ranged.teamACF;
    totalDeferredSelf += deferredSelf;
    totalDeferredTeam += deferredTeam;

    userRows.push({
      ...settle, checkpointId: candidate, userId, smartWalletAddress: walletLower,
      newSelfACF: ranged.selfACF.toString(),
      newTeamACF: ranged.teamACF.toString(),
      deferredReleasedSelfACF: deferredSelf.toString(),
      deferredReleasedTeamACF: deferredTeam.toString(),
      cumulativeSelfACF: cumSelf.toString(),
      cumulativeTeamACF: cumTeam.toString(),
      combinedCumulativeACF: (cumSelf + cumTeam).toString(),
      leafHash: leafHash(leaf).toLowerCase(),
    });
  }

  if (leaves.length === 0) {
    return { outcome: "NOTHING_TO_SETTLE", reason: "No publishable leaf." };
  }

  // ── tree, totals and the two independent delta computations ───────────
  const tree = buildSettlementTree(leaves);
  const previousTotal = BigInt(previous.publishedCumulativeTotalACF);
  const newTotal = tree.publishedCumulativeTotalACF;
  const delta = newTotal - previousTotal;

  assertInvariant(
    newTotal >= previousTotal,
    `Published total would decrease from ${previousTotal} to ${newTotal}; the contract forbids it.`,
  );

  // Cross-check: the aggregate delta must equal the sum of per-user increases.
  let perUserDelta = 0n;
  for (const row of userRows) {
    const userId = row.userId as string;
    const previousRow = prior.get(userId);
    const was = previousRow
      ? BigInt(previousRow.cumulativeSelfACF) + BigInt(previousRow.cumulativeTeamACF)
      : 0n;
    perUserDelta += BigInt(row.combinedCumulativeACF as string) - was;
  }
  assertInvariant(
    delta === perUserDelta,
    `Delta disagreement: total difference ${delta} vs per-user sum ${perUserDelta}.`,
  );
  assertInvariant(
    tree.leafCount === userRows.length,
    `Leaf count ${tree.leafCount} does not match ${userRows.length} user rows.`,
  );

  if (delta === 0n) {
    // fundRewardEpoch rejects a zero amount, so a checkpoint here could never be finalized
    // on chain — and persisting one would be a permanent lie about settled state.
    return {
      outcome: "NOTHING_TO_SETTLE",
      reason: "Published delta is zero; no on-chain checkpoint is needed.",
    };
  }

  // ── Self components: published exactly once, at first representation ───
  const componentScope = range
    ? (newlyPublished.length > 0
        ? { epochId: { $lte: range.through } }       // newcomers need their whole history
        : { epochId: { $in: range.epochIds } })
    : null;
  let components: SelfComponent[] = [];
  if (componentScope) {
    const published = new Set(leaves.map((l) => l.smartWalletAddress));
    const publishedUserIds = userRows.map((r) => r.userId as string);
    const all = await selfComponents(sk, componentScope, publishedUserIds);
    const existing = await CheckpointSelfComponent.find(
      { chainId: k.chainId, stakingContractAddress: k.stakingContractAddress,
        withdrawalAddress: k.withdrawalAddress },
      { stakeId: 1, rewardEpochId: 1 },
    ).lean();
    const already = new Set(existing.map((e) => `${e.stakeId}:${e.rewardEpochId}`));
    components = all.filter(
      (c) => !already.has(`${c.stakeId}:${c.rewardEpochId}`)
        && published.has((walletOf.get(c.userId) ?? "").toLowerCase()),
    );
  }

  // ── persist: checkpoint first (so a crash leaves a CALCULATING record) ─
  await RewardSettlementCheckpoint.findOneAndUpdate(
    { ...settle, checkpointId: candidate },
    {
      $set: {
        status: "CALCULATING",
        leaseExpiresAt: new Date(Date.now() + config.settlementLeaseMs),
      },
      $setOnInsert: {
        ...k, checkpointId: candidate, legacy: false,
        fromRewardEpochId: range?.from ?? null,
        throughRewardEpochId: range?.through ?? previous.throughRewardEpochId ?? null,
        previousCheckpointId: previous.checkpointId,
        root: tree.root,
        publishedCumulativeTotalACF: newTotal.toString(),
        publishedDeltaACF: delta.toString(),
        leafCount: tree.leafCount,
        totalNewSelfACF: totalNewSelf.toString(),
        totalNewTeamACF: totalNewTeam.toString(),
        totalDeferredReleasedSelfACF: totalDeferredSelf.toString(),
        totalDeferredReleasedTeamACF: totalDeferredTeam.toString(),
      },
      $inc: { attempts: 1 },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  await persistAndVerify(
    "UserRewardCheckpoint", UserRewardCheckpoint, { ...settle, checkpointId: candidate },
    userRows,
    (row) => (row as { userId: string }).userId,
    [
      "smartWalletAddress", "newSelfACF", "newTeamACF",
      "deferredReleasedSelfACF", "deferredReleasedTeamACF",
      "cumulativeSelfACF", "cumulativeTeamACF", "combinedCumulativeACF", "leafHash",
    ],
  );

  if (components.length > 0) {
    const componentRows = components.map((c) => ({
      chainId: k.chainId,
      stakingContractAddress: k.stakingContractAddress,
      withdrawalAddress: k.withdrawalAddress,
      checkpointId: candidate,
      userId: c.userId,
      smartWalletAddress: (walletOf.get(c.userId) ?? "").toLowerCase(),
      stakeId: c.stakeId,
      source: c.source,
      rewardEpochId: c.rewardEpochId,
      rewardACF: c.rewardACF.toString(),
    }));
    await persistAndVerify(
      "CheckpointSelfComponent", CheckpointSelfComponent,
      { chainId: k.chainId, stakingContractAddress: k.stakingContractAddress,
        withdrawalAddress: k.withdrawalAddress, checkpointId: candidate },
      componentRows,
      (row) => {
        const r = row as { stakeId: string; rewardEpochId: number };
        return `${r.stakeId}:${r.rewardEpochId}`;
      },
      ["userId", "smartWalletAddress", "source", "rewardACF"],
    );
  }

  // Re-verify the stored checkpoint matches what we just computed, then publish the status.
  const stored = await RewardSettlementCheckpoint.findOne({ ...settle, checkpointId: candidate });
  assertInvariant(
    stored!.root === tree.root
      && stored!.publishedCumulativeTotalACF === newTotal.toString()
      && stored!.publishedDeltaACF === delta.toString()
      && stored!.leafCount === tree.leafCount,
    `Stored checkpoint ${candidate} diverges from the recomputed values; refusing to publish it.`,
  );

  await RewardSettlementCheckpoint.updateOne(
    { ...settle, checkpointId: candidate },
    { $set: { status: "CALCULATED", leaseExpiresAt: null, lastError: null } },
  );

  logger.info("settlement checkpoint calculated", {
    checkpointId: candidate, leafCount: tree.leafCount,
    publishedDeltaACF: delta.toString(), components: components.length,
  });

  return {
    outcome: "CALCULATED",
    checkpointId: candidate,
    root: tree.root,
    leafCount: tree.leafCount,
    publishedCumulativeTotalACF: newTotal.toString(),
    publishedDeltaACF: delta.toString(),
    fromRewardEpochId: range?.from ?? 0,
    throughRewardEpochId: range?.through ?? 0,
  };
}
