import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import mongoose from "mongoose";
import {
  assertDisposable, fakeChain, TEST_ROOT_EOA, TEST_STAKING, TEST_WITHDRAWAL, TEST_TREASURY,
} from "./testenv.ts";

const TEST_URI = process.env.MONGODB_TEST_URI;

const { calculateSettlementCheckpoint, SettlementStateError } = await import("./checkpoint.js");
const { seedLegacySettlement, LEGACY_CHECKPOINT_ID, LEGACY_WALLET, LEGACY_ROOT, LEGACY_SELF_ACF } =
  await import("./legacy.js");
const { reconcileClaimStates, reconcileSettlementCheckpoint, ClaimReconciliationError } =
  await import("./reconcile.js");
const { claimedSelfACFForStake } = await import("./claims.js");
const { buildClaimProof, __clearProofCache } = await import("./proof.js");
const { getRewardSummary } = await import("./summary.js");
const { buildManifest } = await import("./manifest.js");
const { SettlementInvariantError } = await import("./policy.js");
const { User } = await import("../models/User.js");
const { Stake } = await import("../models/Stake.js");
const { StakeRewardEntry } = await import("../models/StakeRewardEntry.js");
const { TeamRewardEntry } = await import("../models/TeamRewardEntry.js");
const { RewardEpoch } = await import("../models/RewardEpoch.js");
const { RewardPhase2Epoch } = await import("../models/RewardPhase2Epoch.js");
const { RewardSettlementCheckpoint } = await import("../models/RewardSettlementCheckpoint.js");
const { UserRewardCheckpoint } = await import("../models/UserRewardCheckpoint.js");
const { CheckpointSelfComponent } = await import("../models/CheckpointSelfComponent.js");
const { UserClaimState } = await import("../models/UserClaimState.js");
const { RewardClaim } = await import("../models/RewardClaim.js");

const E18 = 10n ** 18n;
const LOW = TEST_STAKING.toLowerCase();
const WD = TEST_WITHDRAWAL.toLowerCase();
const SK = { chainId: 80002, stakingContractAddress: LOW };
const SETTLE = { chainId: 80002, withdrawalAddress: WD };
const NEXT = LEGACY_CHECKPOINT_ID + 1;

let connected = false;
before(async () => {
  if (!TEST_URI) { console.log("SKIP: MONGODB_TEST_URI not set"); return; }
  await mongoose.connect(assertDisposable(TEST_URI), { serverSelectionTimeoutMS: 8000 });
  await Promise.all([
    User.init(), Stake.init(), StakeRewardEntry.init(), TeamRewardEntry.init(),
    RewardEpoch.init(), RewardPhase2Epoch.init(), RewardSettlementCheckpoint.init(),
    UserRewardCheckpoint.init(), CheckpointSelfComponent.init(), UserClaimState.init(),
    RewardClaim.init(),
  ]);
  connected = true;
});
after(async () => { if (connected) await mongoose.disconnect(); });
beforeEach(async () => {
  if (connected) await Promise.all([
    User.deleteMany({}), Stake.deleteMany({}), StakeRewardEntry.deleteMany({}),
    TeamRewardEntry.deleteMany({}), RewardEpoch.deleteMany({}), RewardPhase2Epoch.deleteMany({}),
    RewardSettlementCheckpoint.deleteMany({}), UserRewardCheckpoint.deleteMany({}),
    CheckpointSelfComponent.deleteMany({}), UserClaimState.deleteMany({}),
    RewardClaim.deleteMany({}),
  ]);
  seq = 0;
  __clearProofCache();
});

let seq = 0;
const wallet = (n: number) => `0x${n.toString(16).padStart(40, "0")}`;

const mkUser = async (userId: string, parent: string | null, walletAddr?: string) => {
  seq += 1;
  await User.collection.insertOne({
    userId,
    externalEOA: userId === "root" ? TEST_ROOT_EOA : `0x${seq.toString(16).padStart(40, "a")}`,
    referralCode: `ACF-${userId.toUpperCase()}`,
    referredByUserId: parent,
    ...(walletAddr ? { smartWalletAddress: walletAddr.toLowerCase() } : {}),
    createdAt: new Date(1), updatedAt: new Date(1),
  } as never);
};

/** Marks a reward epoch settled by both upstream phases. */
const settleEpoch = async (epochId: number) => {
  await RewardEpoch.collection.insertOne({
    ...SK, epochId, windowStart: epochId * 43200 - 43200, snapshotAt: epochId * 43200,
    status: "CALCULATED", attempts: 1, snapshotBlockNumber: epochId * 43200,
    priceE18: E18.toString(), poolROISnapshot: [],
    stakesProcessed: 0, stakesRewarded: 0, totalRegularSelfACF: "0", totalDAOStakeACF: "0",
  } as never);
  await RewardPhase2Epoch.collection.insertOne({
    ...SK, epochId, status: "CALCULATED", attempts: 1,
    snapshotAt: epochId * 43200, priceE18: E18.toString(),
  } as never);
};

/** A Phase 1 Self reward for one stake in one epoch. */
const mkSelf = async (
  userId: string, walletAddr: string, stakeId: string, epochId: number, amount: bigint,
) => {
  await StakeRewardEntry.collection.insertOne({
    ...SK, stakeId, epochId, userId, smartWalletAddress: walletAddr.toLowerCase(),
    source: "DIRECT", poolId: 1, principalACF: (1000n * E18).toString(),
    compoundBaseACF: (1000n * E18).toString(), rewardACF: amount.toString(),
    cumulativeEarnedACF: "0", rateApplied: "2500", rateDenominator: "1000000",
    rewardEligible: true, ineligibleReason: null, snapshotAt: epochId * 43200,
  } as never);
};

/** A Phase 2 Team reward. */
const mkTeam = async (userId: string, epochId: number, amount: bigint) => {
  await TeamRewardEntry.collection.insertOne({
    ...SK, epochId, userId,
    levelRewardACF: amount.toString(), rankRewardACF: "0", globalRewardACF: "0",
    teamRewardACF: amount.toString(),
    levelAudit: { unlockedLevels: 1, directCount: 1, perLevel: [] },
    rankAudit: {
      leaderRank: 0, leaderRateE6: "0", highestDownlineRank: 0, highestDownlineRateE6: "0",
      differentialRateE6: "0", teamRewardBaseACF: "0", grossACF: "0", epochCapUSD6: "0",
      capped: false,
    },
    globalAudit: {
      rankNumber: 0, selfStakeACF: "0", selfStakeUSD6: "0", l1StakeACF: "0", l1StakeUSD6: "0",
      networkContributionACF: "0", networkContributionUSD6: "0", priceE18: E18.toString(),
    },
  } as never);
};

/** Seeds the legacy checkpoint against a fake chain in the expected live state. */
const seedLegacy = async () => {
  await mkUser("legacy", null, LEGACY_WALLET);
  await User.collection.updateOne({ userId: "legacy" }, { $set: { externalEOA: TEST_ROOT_EOA } });
  const chain = fakeChain({
    root: LEGACY_ROOT, cumulativeTotal: LEGACY_SELF_ACF, totalClaimed: LEGACY_SELF_ACF,
    latestEpochId: LEGACY_CHECKPOINT_ID, finalized: new Set([LEGACY_CHECKPOINT_ID]),
    claimed: new Map([[LEGACY_WALLET, LEGACY_SELF_ACF]]),
  });
  const r = await seedLegacySettlement(chain.reader);
  return { chain, result: r };
};

// ══════════════════════════════════════════════════════════ LEGACY ════

describe("legacy settlement seed", () => {
  it("1. seeds from exactly the live on-chain values and rebuilds the root", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { result } = await seedLegacy();
    assert.equal(result.seeded, true);
    assert.equal(result.checkpointId, LEGACY_CHECKPOINT_ID);
    assert.equal(result.root, LEGACY_ROOT);

    const cp = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: LEGACY_CHECKPOINT_ID }))!;
    assert.equal(cp.legacy, true);
    assert.equal(cp.status, "FINALIZED");
    assert.equal(cp.publishedCumulativeTotalACF, LEGACY_SELF_ACF.toString());
    assert.equal(cp.throughRewardEpochId, null);
    assert.equal(cp.leafCount, 1);
  });

  it("2. the legacy user's claim watermark matches the chain", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await seedLegacy();
    const cs = (await UserClaimState.findOne({ ...SETTLE, userId: "legacy" }))!;
    assert.equal(cs.alreadyClaimedACF, LEGACY_SELF_ACF.toString());
    assert.equal(cs.highestClaimedCheckpointId, LEGACY_CHECKPOINT_ID);
  });

  it("3. it writes NO Self components — the 5 ACF came from no staking reward", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await seedLegacy();
    assert.equal(await CheckpointSelfComponent.countDocuments({}), 0);
  });

  it("4. it is idempotent", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    const again = await seedLegacySettlement(chain.reader);
    assert.equal(again.seeded, false);
    assert.equal(again.alreadyPresent, true);
    assert.equal(await RewardSettlementCheckpoint.countDocuments({}), 1);
    assert.equal(await UserRewardCheckpoint.countDocuments({}), 1);
  });

  for (const [label, patch] of [
    ["wrong root", { root: `0x${"b".repeat(64)}` }],
    ["wrong cumulative total", { cumulativeTotal: 4n * E18 }],
    ["wrong totalClaimed", { totalClaimed: 0n }],
    ["wrong epoch id", { latestEpochId: 999 }],
    ["not finalized", { finalized: new Set<number>() }],
    ["wrong alreadyClaimed", { claimed: new Map([[LEGACY_WALLET, 1n]]) }],
  ] as const) {
    it(`5-${label}. aborts and writes nothing`, async (t) => {
      if (!connected) return t.skip("no MONGODB_TEST_URI");
      await mkUser("legacy", null, LEGACY_WALLET);
      const chain = fakeChain({
        root: LEGACY_ROOT, cumulativeTotal: LEGACY_SELF_ACF, totalClaimed: LEGACY_SELF_ACF,
        latestEpochId: LEGACY_CHECKPOINT_ID, finalized: new Set([LEGACY_CHECKPOINT_ID]),
        claimed: new Map([[LEGACY_WALLET, LEGACY_SELF_ACF]]),
        ...patch,
      });
      await assert.rejects(seedLegacySettlement(chain.reader), SettlementInvariantError);
      assert.equal(await RewardSettlementCheckpoint.countDocuments({}), 0);
      assert.equal(await UserRewardCheckpoint.countDocuments({}), 0);
    });
  }

  it("6. aborts when no application user owns the legacy wallet", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const chain = fakeChain({
      root: LEGACY_ROOT, cumulativeTotal: LEGACY_SELF_ACF, totalClaimed: LEGACY_SELF_ACF,
      latestEpochId: LEGACY_CHECKPOINT_ID, finalized: new Set([LEGACY_CHECKPOINT_ID]),
      claimed: new Map([[LEGACY_WALLET, LEGACY_SELF_ACF]]),
    });
    await assert.rejects(seedLegacySettlement(chain.reader), /No application user owns/);
  });

  it("7. calculation refuses to run before the legacy seed exists", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await mkUser("root", null, wallet(1));
    await assert.rejects(
      calculateSettlementCheckpoint(fakeChain().reader),
      (e: unknown) => e instanceof SettlementStateError && /seed the legacy/i.test((e as Error).message),
    );
  });
});

// ════════════════════════════════════════════ DEFERRED WALLET ════

describe("deferred wallet entitlement", () => {
  /** Legacy seeded, then a Team-earning user with no wallet. */
  const scenario = async () => {
    const { chain } = await seedLegacy();
    await mkUser("alice", "legacy");                      // NO WALLET
    return chain;
  };

  it("8. a wallet-less earner is NOT published, and nothing is forfeited", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const chain = await scenario();
    await settleEpoch(41010);
    await mkTeam("alice", 41010, 10n * E18);

    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "NOTHING_TO_SETTLE", "no publishable leaf, so no checkpoint");
    assert.equal(await UserRewardCheckpoint.countDocuments({ ...SETTLE, checkpointId: NEXT }), 0);

    // The reward is visible and attributed, not zeroed.
    const summary = await getRewardSummary("alice");
    assert.equal(summary.status, "PENDING_WALLET");
    assert.equal(summary.reason, "CREATE_WALLET_TO_CLAIM");
    assert.equal(summary.earnedTeamACF, (10n * E18).toString());
    assert.equal(summary.publishedTeamACF, "0");
    assert.equal(summary.claimable, false);
  });

  /**
   * Epochs 41010-41011 are consumed by a REAL checkpoint driven by a walleted user, so when
   * Alice's wallet appears only 41012 remains in range — which is what makes the earlier 30 ACF
   * genuinely deferred rather than merely late.
   */
  const deferredFixture = async () => {
    const chain = await scenario();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("alice", 41010, 10n * E18); await mkTeam("bob", 41010, 1n * E18);
    await settleEpoch(41011); await mkTeam("alice", 41011, 20n * E18);

    // Checkpoint 1: Bob is publishable, Alice is not.
    const first = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(first.outcome, "CALCULATED");
    assert.equal(await UserRewardCheckpoint.countDocuments({
      ...SETTLE, checkpointId: NEXT, userId: "alice",
    }), 0, "Alice has no wallet, so no leaf");
    const cp1 = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    chain.settle(NEXT, cp1.root, BigInt(cp1.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);

    // Alice's wallet appears, and one more epoch earns 5.
    await User.collection.updateOne({ userId: "alice" },
      { $set: { smartWalletAddress: wallet(0xa11ce) } });
    await settleEpoch(41012); await mkTeam("alice", 41012, 5n * E18);
    return { chain, previousTotal: BigInt(cp1.publishedCumulativeTotalACF) };
  };

  it("9. THE FIXTURE — 10 + 20 deferred, then 5 with a wallet publishes 35", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await deferredFixture();

    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "CALCULATED");

    const row = (await UserRewardCheckpoint.findOne({
      ...SETTLE, checkpointId: NEXT + 1, userId: "alice",
    }))!;
    assert.equal(row.cumulativeTeamACF, (35n * E18).toString(), "ALL earned, not just 5");
    assert.equal(row.newTeamACF, (5n * E18).toString(), "earned inside this range");
    assert.equal(row.deferredReleasedTeamACF, (30n * E18).toString(), "released from before the wallet");
    assert.equal(row.deferredReleasedSelfACF, "0", "Self cannot be deferred: stakes need a wallet");
    assert.equal(row.combinedCumulativeACF, (35n * E18).toString());
  });

  it("10. the funding delta is the PUBLISHED delta, including the deferred 30", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain, previousTotal } = await deferredFixture();

    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "CALCULATED");
    // Earned inside the range is 5. Published liability rises by 35, because Alice's first
    // leaf carries her whole history. Funding the EARNED delta would under-fund by 30 and
    // finalizeEpoch would revert on backing.
    assert.equal(r.publishedDeltaACF, (35n * E18).toString());
    assert.equal(
      BigInt(r.publishedCumulativeTotalACF) - previousTotal, 35n * E18,
      "the published total rises by exactly the published delta",
    );
  });

  it("11. a pending user does not block settlement for anyone else", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const chain = await scenario();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010);
    await mkTeam("alice", 41010, 10n * E18);              // pending
    await mkTeam("bob", 41010, 7n * E18);                 // publishable

    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "CALCULATED");
    assert.ok(await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }));
    assert.equal(await UserRewardCheckpoint.countDocuments({
      ...SETTLE, checkpointId: NEXT, userId: "alice",
    }), 0);
    assert.equal((await getRewardSummary("alice")).status, "PENDING_WALLET");
  });
});

// ════════════════════════════════════════════ CARRY-FORWARD ════

describe("root membership carry-forward", () => {
  /** Legacy + one published user, with the chain advanced as the operator would. */
  const published = async () => {
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010);
    await mkTeam("bob", 41010, 7n * E18);
    const first = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(first.outcome, "CALCULATED");
    const cp = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);
    return chain;
  };

  it("12. a user with zero new reward is still carried into the next root", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const chain = await published();
    // A second settlement driven only by a different user's reward.
    await mkUser("carol", "legacy", wallet(0xca201));
    await settleEpoch(41011);
    await mkTeam("carol", 41011, 3n * E18);

    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "CALCULATED");
    const bob = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT + 1, userId: "bob" }))!;
    assert.equal(bob.newTeamACF, "0", "earned nothing this time");
    assert.equal(bob.cumulativeTeamACF, (7n * E18).toString(), "but keeps his cumulative");
    // The fully-claimed legacy user is carried too.
    assert.ok(await UserRewardCheckpoint.findOne({
      ...SETTLE, checkpointId: NEXT + 1, userId: "legacy",
    }));
    assert.equal(r.leafCount, 3);
  });

  it("13. sum of leaves equals the published cumulative total", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const chain = await published();
    const rows = await UserRewardCheckpoint.find({ ...SETTLE, checkpointId: NEXT }).lean();
    const sum = rows.reduce((s, r) => s + BigInt(r.combinedCumulativeACF), 0n);
    const cp = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    assert.equal(sum, BigInt(cp.publishedCumulativeTotalACF));
    void chain;
  });

  it("14. a changed wallet after publication FAILS the settlement", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const chain = await published();
    await User.collection.updateOne({ userId: "bob" }, { $set: { smartWalletAddress: wallet(0xdead) } });
    await settleEpoch(41011);
    await mkTeam("bob", 41011, 1n * E18);
    await assert.rejects(calculateSettlementCheckpoint(chain.reader),
      (e: unknown) => /wallet changed/.test((e as Error).message));
  });

  it("15. a wallet that becomes null after publication FAILS", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const chain = await published();
    await User.collection.updateOne({ userId: "bob" }, { $unset: { smartWalletAddress: "" } });
    await settleEpoch(41011);
    await mkTeam("bob", 41011, 1n * E18);
    await assert.rejects(calculateSettlementCheckpoint(chain.reader),
      (e: unknown) => /now has none/.test((e as Error).message));
  });

  it("16. two users resolving to one wallet FAILS", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("x", "legacy", wallet(0xd0b1e));

    // User.smartWalletAddress is uniquely indexed, so this is unreachable through normal
    // registration — the index has to be dropped to produce it. The settlement check is
    // defence in depth for corrupt data.
    await User.collection.dropIndex("smartWalletAddress_1").catch(() => {});
    await User.collection.insertOne({
      userId: "y", externalEOA: `0x${"c".repeat(40)}`, referralCode: "ACF-Y",
      referredByUserId: "legacy", smartWalletAddress: wallet(0xd0b1e),
      createdAt: new Date(1), updatedAt: new Date(1),
    } as never);
    await settleEpoch(41010);
    await mkTeam("x", 41010, 1n * E18);
    await mkTeam("y", 41010, 1n * E18);

    await assert.rejects(calculateSettlementCheckpoint(chain.reader),
      (e: unknown) => /both resolve to wallet/.test((e as Error).message));
    await User.init();                       // restore the index for later cases
  });
});

// ══════════════════════════════════════ CLAIM RECONCILIATION ════

describe("claim state reconciliation", () => {
  /** Legacy + bob published and finalized, with components for his staking reward. */
  const settled = async (selfPerEpoch: Array<[number, bigint]> = []) => {
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    for (const [epochId, amount] of selfPerEpoch) {
      await settleEpoch(epochId);
      await mkSelf("bob", wallet(0xb0b), "1", epochId, amount);
    }
    if (selfPerEpoch.length === 0) {
      await settleEpoch(41010);
      await mkTeam("bob", 41010, 7n * E18);
    }
    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "CALCULATED");
    const cp = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);
    return { chain, cp };
  };

  it("17. alreadyClaimed of zero means nothing is claimed", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await settled();
    const r = await reconcileClaimStates(chain.reader);
    assert.ok(r.reconciled >= 1);
    const bob = (await UserClaimState.findOne({ ...SETTLE, userId: "bob" }))!;
    assert.equal(bob.alreadyClaimedACF, "0");
    assert.equal(bob.highestClaimedCheckpointId, null);
  });

  it("18. an EXACT combined match resolves the claimed checkpoint", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await settled();
    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row.combinedCumulativeACF));

    await reconcileClaimStates(chain.reader);
    const bob = (await UserClaimState.findOne({ ...SETTLE, userId: "bob" }))!;
    assert.equal(bob.alreadyClaimedACF, row.combinedCumulativeACF);
    assert.equal(bob.highestClaimedCheckpointId, NEXT);
  });

  it("19. an amount between two published totals FAILS loudly, never <=", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await settled();
    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    // One wei off: unreachable through claim(), so it means corrupt or unknown state.
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row.combinedCumulativeACF) - 1n);

    await assert.rejects(reconcileClaimStates(chain.reader),
      (e: unknown) => e instanceof ClaimReconciliationError
        && /matches no finalized published cumulative total/.test((e as Error).message));
  });

  it("20. a direct claim with no receipt still advances the watermark", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await settled();
    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row.combinedCumulativeACF));

    await reconcileClaimStates(chain.reader);
    // No RewardClaim row exists, yet the financial watermark is correct.
    assert.equal(await RewardClaim.countDocuments({}), 0);
    assert.equal(
      (await UserClaimState.findOne({ ...SETTLE, userId: "bob" }))!.highestClaimedCheckpointId,
      NEXT,
    );
  });

  it("21. equal combined totals across checkpoints resolve identically", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await settled();
    // A second checkpoint where Bob earns nothing: his combined total is unchanged, so his
    // component coverage is identical and either checkpoint is a correct answer.
    await mkUser("carol", "legacy", wallet(0xca201));
    await settleEpoch(41011);
    await mkTeam("carol", 41011, 3n * E18);
    const second = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(second.outcome, "CALCULATED");
    const cp2 = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT + 1 }))!;
    chain.settle(NEXT + 1, cp2.root, BigInt(cp2.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);

    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT + 1, userId: "bob" }))!;
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row.combinedCumulativeACF));
    await reconcileClaimStates(chain.reader);
    // The latest matching checkpoint is taken; coverage is the same either way.
    assert.equal(
      (await UserClaimState.findOne({ ...SETTLE, userId: "bob" }))!.highestClaimedCheckpointId,
      NEXT + 1,
    );
  });
});

// ══════════════════════════════════════════ COMPOUND RESET ════

describe("compound reset composition", () => {
  it("22. THE MANDATORY SCENARIO — epochs 10+11 claimed, epoch 12 still compounds", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));

    // Phase 1 rewards on one stake: 100 at epoch 41010, 105 at 41011.
    await settleEpoch(41010); await mkSelf("bob", wallet(0xb0b), "1", 41010, 100n * E18);
    await settleEpoch(41011); await mkSelf("bob", wallet(0xb0b), "1", 41011, 105n * E18);

    // Checkpoint C covers through 41011.
    const c = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(c.outcome, "CALCULATED");
    assert.equal((c as { throughRewardEpochId: number }).throughRewardEpochId, 41011);
    const cp = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);

    // Components for epochs 10 and 11 exist; nothing yet for 12.
    assert.equal(await CheckpointSelfComponent.countDocuments({ stakeId: "1" }), 2);

    // Epoch 12 earns 110 AFTER the checkpoint was built.
    await settleEpoch(41012); await mkSelf("bob", wallet(0xb0b), "1", 41012, 110n * E18);

    // Bob claims checkpoint C.
    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row.combinedCumulativeACF));
    await reconcileClaimStates(chain.reader);

    // The claim covers epochs 10 and 11 only.
    const claimed = await claimedSelfACFForStake(SK, "bob", "1", 41013);
    assert.equal(claimed, 205n * E18, "100 + 105, NOT 315 and NOT 0");

    // So for epoch 13, earned(315) − claimed(205) = 110 keeps compounding.
    const earned = 100n * E18 + 105n * E18 + 110n * E18;
    assert.equal(earned - claimed, 110n * E18);
  });

  it("23. an UNCONFIRMED claim retires nothing", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkSelf("bob", wallet(0xb0b), "1", 41010, 100n * E18);
    const c = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(c.outcome, "CALCULATED");
    // Published but never claimed: alreadyClaimed stays zero.
    assert.equal(await claimedSelfACFForStake(SK, "bob", "1", 41011), 0n);
    void chain;
  });

  it("24. a component published AFTER the claimed checkpoint stays unclaimed", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkSelf("bob", wallet(0xb0b), "1", 41010, 100n * E18);
    const first = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(first.outcome, "CALCULATED");
    const cp1 = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    chain.settle(NEXT, cp1.root, BigInt(cp1.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);

    const row1 = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row1.combinedCumulativeACF));
    await reconcileClaimStates(chain.reader);

    // A second checkpoint publishes epoch 41011's reward, but Bob has not claimed it.
    await settleEpoch(41011); await mkSelf("bob", wallet(0xb0b), "1", 41011, 50n * E18);
    const second = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(second.outcome, "CALCULATED");
    const cp2 = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT + 1 }))!;
    chain.settle(NEXT + 1, cp2.root, BigInt(cp2.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);

    // Still only the first checkpoint is claimed, so only its component is retired.
    assert.equal(await claimedSelfACFForStake(SK, "bob", "1", 41012), 100n * E18);
  });

  it("25. Team rewards never enter the compound composition", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010);
    await mkTeam("bob", 41010, 500n * E18);              // Team only, no Self
    const c = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(c.outcome, "CALCULATED");
    const cp = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);
    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row.combinedCumulativeACF));
    await reconcileClaimStates(chain.reader);

    assert.equal(await CheckpointSelfComponent.countDocuments({ userId: "bob" }), 0);
    assert.equal(await claimedSelfACFForStake(SK, "bob", "1", 41011), 0n);
  });

  it("26. the legacy checkpoint retires no component", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await seedLegacy();
    // The legacy user is already fully claimed through checkpoint 1790792573.
    const cs = (await UserClaimState.findOne({ ...SETTLE, userId: "legacy" }))!;
    assert.equal(cs.highestClaimedCheckpointId, LEGACY_CHECKPOINT_ID);
    assert.equal(await claimedSelfACFForStake(SK, "legacy", "1", 99_999), 0n);
  });

  it("27. each staking reward is published exactly once, never recopied", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkSelf("bob", wallet(0xb0b), "1", 41010, 100n * E18);
    const first = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(first.outcome, "CALCULATED");
    const cp1 = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    chain.settle(NEXT, cp1.root, BigInt(cp1.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);

    await settleEpoch(41011); await mkSelf("bob", wallet(0xb0b), "1", 41011, 50n * E18);
    await calculateSettlementCheckpoint(chain.reader);

    // Two components, one per reward epoch — the first is NOT duplicated into checkpoint 2.
    const all = await CheckpointSelfComponent.find({ stakeId: "1" }).lean();
    assert.equal(all.length, 2);
    assert.deepEqual(all.map((c) => c.rewardEpochId).sort(), [41010, 41011]);
    assert.deepEqual(all.map((c) => c.checkpointId).sort(), [NEXT, NEXT + 1]);
  });
});

// ══════════════════════════════════ CHECKPOINT GUARDS ════

describe("checkpoint guards", () => {
  it("28. a zero published delta creates NO on-chain checkpoint", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010);
    await mkTeam("bob", 41010, 0n);                     // settled, but nothing earned

    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "NOTHING_TO_SETTLE");
    // The range stays reconsiderable: a pending-wallet user may become publishable later with
    // no new reward epoch at all.
    assert.equal(await RewardSettlementCheckpoint.countDocuments({ ...SETTLE, checkpointId: NEXT }), 0);
    assert.equal(await UserRewardCheckpoint.countDocuments({ ...SETTLE, checkpointId: NEXT }), 0);
  });

  it("29. an OCCUPIED candidate id fails loudly instead of skipping", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("bob", 41010, 7n * E18);

    chain.state.finalized.add(NEXT);                   // out-of-band settlement
    await assert.rejects(calculateSettlementCheckpoint(chain.reader),
      (e: unknown) => /epochFinalized\(1790792574\) is already true/.test((e as Error).message));
  });

  it("30. an already-funded candidate id fails loudly", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("bob", 41010, 7n * E18);

    chain.state.funded.add(NEXT);
    await assert.rejects(calculateSettlementCheckpoint(chain.reader),
      (e: unknown) => /rewardEpochFunded\(1790792574\) is already true/.test((e as Error).message));
  });

  for (const [label, mutate] of [
    ["root", (c: { state: { root: string } }) => { c.state.root = `0x${"e".repeat(64)}`; }],
    ["epoch id", (c: { state: { latestEpochId: number } }) => { c.state.latestEpochId = 42; }],
    ["total", (c: { state: { cumulativeTotal: bigint } }) => { c.state.cumulativeTotal = 99n; }],
  ] as const) {
    it(`31-${label}. out-of-band live ${label} blocks the next checkpoint`, async (t) => {
      if (!connected) return t.skip("no MONGODB_TEST_URI");
      const { chain } = await seedLegacy();
      await mkUser("bob", "legacy", wallet(0xb0b));
      await settleEpoch(41010); await mkTeam("bob", 41010, 7n * E18);
      mutate(chain as never);
      await assert.rejects(calculateSettlementCheckpoint(chain.reader), SettlementInvariantError);
    });
  }

  it("32. Treasury pointing at a different Withdrawal blocks settlement", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("bob", 41010, 7n * E18);
    chain.state.treasuryWithdrawal = `0x${"f".repeat(40)}`;
    await assert.rejects(calculateSettlementCheckpoint(chain.reader),
      (e: unknown) => /Treasury's configured Withdrawal/.test((e as Error).message));
  });

  it("33. only ONE unfinalized checkpoint may exist at a time", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("bob", 41010, 7n * E18);
    const first = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(first.outcome, "CALCULATED");

    // Another reward epoch settles, but the operator has not acted yet.
    await settleEpoch(41011); await mkTeam("bob", 41011, 1n * E18);
    const second = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(second.outcome, "AWAITING_OPERATOR");
    assert.equal((second as { checkpointId: number }).checkpointId, NEXT);
    assert.equal(await RewardSettlementCheckpoint.countDocuments({ ...SETTLE }), 2,
      "legacy plus the one awaiting the operator; no third");
  });

  it("34. the range stops at the first gap", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("bob", 41010, 1n * E18);
    await settleEpoch(41011); await mkTeam("bob", 41011, 1n * E18);
    // 41012 Phase 1 only — Phase 2 has not settled it, so the range must end at 41011.
    await RewardEpoch.collection.insertOne({
      ...SK, epochId: 41012, windowStart: 0, snapshotAt: 41012 * 43200,
      status: "CALCULATED", attempts: 1, priceE18: E18.toString(), poolROISnapshot: [],
      stakesProcessed: 0, stakesRewarded: 0, totalRegularSelfACF: "0", totalDAOStakeACF: "0",
    } as never);
    await mkTeam("bob", 41012, 99n * E18);

    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "CALCULATED");
    assert.equal((r as { throughRewardEpochId: number }).throughRewardEpochId, 41011);
    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    assert.equal(row.newTeamACF, (2n * E18).toString(), "41012's 99 is excluded");
  });

  it("35. a divergent persisted immutable row fails and is never overwritten", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("bob", 41010, 7n * E18);
    await calculateSettlementCheckpoint(chain.reader);

    // Tamper, then force a recalculation of the same checkpoint.
    await UserRewardCheckpoint.collection.updateOne(
      { ...SETTLE, checkpointId: NEXT, userId: "bob" },
      { $set: { cumulativeTeamACF: "1" } },
    );
    await RewardSettlementCheckpoint.updateOne(
      { ...SETTLE, checkpointId: NEXT }, { $set: { status: "FAILED" } },
    );
    await assert.rejects(calculateSettlementCheckpoint(chain.reader),
      (e: unknown) => /cumulativeTeamACF expected/.test((e as Error).message));
    assert.equal(
      (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!.cumulativeTeamACF,
      "1", "reported, never repaired",
    );
  });
});

// ════════════════════════════════════════ PROOF / MANIFEST ════

describe("proof and manifest", () => {
  const finalized = async () => {
    const { chain } = await seedLegacy();
    await mkUser("bob", "legacy", wallet(0xb0b));
    await settleEpoch(41010); await mkTeam("bob", 41010, 7n * E18);
    const r = await calculateSettlementCheckpoint(chain.reader);
    assert.equal(r.outcome, "CALCULATED");
    const cp = (await RewardSettlementCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT }))!;
    return { chain, cp };
  };

  it("36. a wallet-less user gets PENDING_WALLET, never a dropped reward", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain, cp } = await finalized();
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);
    await mkUser("alice", "legacy");                   // no wallet
    await settleEpoch(41011); await mkTeam("alice", 41011, 4n * E18);

    const proof = await buildClaimProof("alice", chain.reader);
    assert.equal(proof.status, "PENDING_WALLET");
    assert.equal(proof.claimable, false);
    const summary = await getRewardSummary("alice");
    assert.equal(summary.earnedTeamACF, (4n * E18).toString(), "earned is still reported");
  });

  it("37. a valid proof is issued against the LIVE root", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain, cp } = await finalized();
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);

    const proof = await buildClaimProof("bob", chain.reader);
    assert.equal(proof.status, "CLAIMABLE");
    if (proof.status !== "CLAIMABLE") return;
    assert.equal(proof.root, cp.root);
    assert.equal(proof.liveRoot, cp.root);
    assert.equal(proof.cumulativeTeamACF, (7n * E18).toString());
    assert.ok(proof.proof.length >= 1, "a two-leaf tree gives a one-element proof");
  });

  it("38. a STALE on-chain root refuses to issue a proof", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain, cp } = await finalized();
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);
    // Someone finalized a different root out of band.
    chain.state.root = `0x${"9".repeat(64)}`;
    await assert.rejects(buildClaimProof("bob", chain.reader),
      (e: unknown) => (e as { code?: string }).code === "SETTLEMENT_STALE");
  });

  it("39. a fully claimed user gets NOTHING_TO_CLAIM", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { chain, cp } = await finalized();
    chain.settle(NEXT, cp.root, BigInt(cp.publishedCumulativeTotalACF));
    await reconcileSettlementCheckpoint(chain.reader);
    const row = (await UserRewardCheckpoint.findOne({ ...SETTLE, checkpointId: NEXT, userId: "bob" }))!;
    chain.state.claimed.set(wallet(0xb0b).toLowerCase(), BigInt(row.combinedCumulativeACF));

    const proof = await buildClaimProof("bob", chain.reader);
    assert.equal(proof.status, "NOTHING_TO_CLAIM");
    assert.equal((proof as { reason: string }).reason, "FULLY_CLAIMED");
  });

  it("40. the manifest is deterministic and detects tampering", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await finalized();
    const a = await buildManifest(NEXT);
    const b = await buildManifest(NEXT);
    assert.equal(a.manifestHash, b.manifestHash);
    assert.equal(a.manifest.checkpointId, NEXT);
    assert.equal(a.manifest.previousCheckpointId, LEGACY_CHECKPOINT_ID);
    assert.equal(a.manifest.previousRoot, LEGACY_ROOT);
    assert.equal(a.manifest.previousPublishedCumulativeTotalACF, LEGACY_SELF_ACF.toString());

    // Any altered field changes the hash, which is what the operator script checks.
    const { manifestHash: hashOf } = await import("./policy.js");
    assert.notEqual(
      hashOf({ ...a.manifest, publishedDeltaACF: "1" }), a.manifestHash,
    );
  });
});
