import { getAddress } from "viem";
import { config } from "../config.js";
import { logger } from "../lib/logger.js";
import { User } from "../models/User.js";
import { CheckpointSelfComponent } from "../models/CheckpointSelfComponent.js";
import { RewardSettlementCheckpoint } from "../models/RewardSettlementCheckpoint.js";
import { UserClaimState } from "../models/UserClaimState.js";
import { UserRewardCheckpoint } from "../models/UserRewardCheckpoint.js";
import { buildSettlementTree } from "./merkle.js";
import { assertInvariant } from "./policy.js";
import { settlementChainReader, type SettlementChainReader } from "./chain.js";

/**
 * Seeds the settlement that ALREADY EXISTS on chain.
 *
 * Amoy's Withdrawal carries a finalized root from an earlier smoke test: 5 ACF of entitlement,
 * fully claimed, under epoch id 1790792573 (a unix timestamp the smoke test used). The claimer
 * is a real application user, so this cannot be ignored — the contract requires every later
 * cumulative total to be >= 5 ACF, and that user's alreadyClaimed is already 5 ACF.
 *
 * Redeploying for a clean slate is not available: Treasury.setWithdrawal is one-time and
 * already consumed, and ACFToken._treasury has no setter, so a new Withdrawal would cascade
 * into a Treasury redeploy that could never mint.
 *
 * The seed is read-only against the chain, asserts every live value before writing anything,
 * and is idempotent.
 */

export const LEGACY_CHECKPOINT_ID = 1_790_792_573;
export const LEGACY_WALLET = "0x7c2d6b5f65c820c1cb014313ab17419420d3e3a7";
export const LEGACY_ROOT =
  "0x0f5e4a1e0d7971af062097dabe3923616dd4d0efb16ef53a43842fa9c41febb9";
export const LEGACY_SELF_ACF = 5_000_000_000_000_000_000n;
export const LEGACY_TEAM_ACF = 0n;

export interface LegacySeedResult {
  seeded: boolean;
  alreadyPresent: boolean;
  checkpointId: number;
  userId: string;
  root: string;
}

export async function seedLegacySettlement(
  reader: SettlementChainReader = settlementChainReader,
): Promise<LegacySeedResult> {
  const settle = {
    chainId: config.chainId,
    withdrawalAddress: getAddress(config.withdrawalAddress).toLowerCase(),
  };

  // ── 1. every live value must be exactly what we expect ─────────────────
  const live = await reader.liveState();
  assertInvariant(
    live.latestEpochId === LEGACY_CHECKPOINT_ID,
    `Withdrawal.latestEpochId is ${live.latestEpochId}, expected ${LEGACY_CHECKPOINT_ID}.`,
  );
  assertInvariant(
    live.root === LEGACY_ROOT,
    `Withdrawal root is ${live.root}, expected ${LEGACY_ROOT}.`,
  );
  assertInvariant(
    live.cumulativeTotalEntitlementACF === LEGACY_SELF_ACF,
    `Withdrawal cumulative total is ${live.cumulativeTotalEntitlementACF}, expected ${LEGACY_SELF_ACF}.`,
  );
  assertInvariant(
    live.totalClaimedACF === LEGACY_SELF_ACF,
    `Withdrawal totalClaimed is ${live.totalClaimedACF}, expected ${LEGACY_SELF_ACF}.`,
  );
  assertInvariant(
    await reader.epochFinalized(LEGACY_CHECKPOINT_ID),
    `Withdrawal.epochFinalized(${LEGACY_CHECKPOINT_ID}) is false.`,
  );

  const claimed = await reader.alreadyClaimed([LEGACY_WALLET]);
  assertInvariant(
    claimed.get(LEGACY_WALLET) === LEGACY_SELF_ACF,
    `alreadyClaimed(${LEGACY_WALLET}) is ${claimed.get(LEGACY_WALLET)}, expected ${LEGACY_SELF_ACF}.`,
  );

  // ── 2. the application must agree on who owns that wallet ──────────────
  const owner = await User.findOne({ smartWalletAddress: LEGACY_WALLET });
  assertInvariant(
    owner !== null,
    `No application user owns the legacy wallet ${LEGACY_WALLET}.`,
  );

  // ── 3. the root must reproduce from the single leaf ─────────────────────
  const leaf = {
    smartWalletAddress: LEGACY_WALLET,
    cumulativeSelfACF: LEGACY_SELF_ACF,
    cumulativeTeamACF: LEGACY_TEAM_ACF,
  };
  const tree = buildSettlementTree([leaf]);
  assertInvariant(
    tree.root === LEGACY_ROOT,
    `Rebuilt legacy root ${tree.root} does not match the live root ${LEGACY_ROOT}.`,
  );

  // ── 4. idempotent ──────────────────────────────────────────────────────
  const existing = await RewardSettlementCheckpoint.findOne({
    ...settle, checkpointId: LEGACY_CHECKPOINT_ID,
  });
  if (existing) {
    return {
      seeded: false, alreadyPresent: true, checkpointId: LEGACY_CHECKPOINT_ID,
      userId: owner!.userId, root: tree.root,
    };
  }

  // ── 5. write, only now that every assertion has passed ─────────────────
  const k = {
    ...settle,
    stakingContractAddress: getAddress(config.acfStakingAddress).toLowerCase(),
    treasuryAddress: getAddress(config.treasuryAddress).toLowerCase(),
  };
  await RewardSettlementCheckpoint.create({
    ...k,
    checkpointId: LEGACY_CHECKPOINT_ID,
    legacy: true,
    status: "FINALIZED",
    fromRewardEpochId: null,
    throughRewardEpochId: null,
    previousCheckpointId: null,
    root: tree.root,
    publishedCumulativeTotalACF: LEGACY_SELF_ACF.toString(),
    publishedDeltaACF: LEGACY_SELF_ACF.toString(),
    leafCount: 1,
    totalNewSelfACF: LEGACY_SELF_ACF.toString(),
    totalNewTeamACF: "0",
    totalDeferredReleasedSelfACF: "0",
    totalDeferredReleasedTeamACF: "0",
    auditWarning: "Seeded from pre-Phase-3 on-chain smoke-test settlement.",
  });

  await UserRewardCheckpoint.create({
    ...settle,
    checkpointId: LEGACY_CHECKPOINT_ID,
    userId: owner!.userId,
    smartWalletAddress: LEGACY_WALLET,
    newSelfACF: LEGACY_SELF_ACF.toString(),
    newTeamACF: "0",
    deferredReleasedSelfACF: "0",
    deferredReleasedTeamACF: "0",
    cumulativeSelfACF: LEGACY_SELF_ACF.toString(),
    cumulativeTeamACF: "0",
    combinedCumulativeACF: LEGACY_SELF_ACF.toString(),
    leafHash: tree.root,            // single-leaf tree: the root IS the leaf
  });

  await UserClaimState.findOneAndUpdate(
    { ...settle, userId: owner!.userId },
    {
      $set: {
        smartWalletAddress: LEGACY_WALLET,
        alreadyClaimedACF: LEGACY_SELF_ACF.toString(),
        highestClaimedCheckpointId: LEGACY_CHECKPOINT_ID,
        lastReconciledAt: new Date(),
      },
      $setOnInsert: { ...settle, userId: owner!.userId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  // Deliberately NO CheckpointSelfComponent: the legacy 5 ACF came from no Phase 1 staking
  // reward, so there is nothing for a claim to retire from a compound base.
  const components = await CheckpointSelfComponent.countDocuments({
    ...settle, checkpointId: LEGACY_CHECKPOINT_ID,
  });
  assertInvariant(components === 0, "The legacy checkpoint must publish no Self components.");

  logger.info("legacy settlement seeded", {
    checkpointId: LEGACY_CHECKPOINT_ID, userId: owner!.userId, root: tree.root,
  });

  return {
    seeded: true, alreadyPresent: false, checkpointId: LEGACY_CHECKPOINT_ID,
    userId: owner!.userId, root: tree.root,
  };
}
