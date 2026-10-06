import { assertDisposable, TEST_ROOT_EOA } from "./testenv.ts";

import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";

import { computeAggregates } from "./rank.js";
import { computeLevelRewards } from "./level.js";
import {
  ONBOARDED_DIRECT_RULE_START_EPOCH,
  usesOnboardedDirectRule,
  unlockedLevels,
  LEVEL_RATES,
  RANK_TIERS,
} from "./policy.js";
import type { AsOfGraph } from "./graph.js";
import type { UserStakeTotals } from "./inputs.js";

/**
 * The onboarded-direct rule.
 *
 * A referral qualifies its referrer only once that user has completed onboarding by creating
 * their smart wallet, established from the chain as-of the epoch's snapshot. No stake is
 * required. This governs Level unlock depth and the Rank direct requirement from
 * ONBOARDED_DIRECT_RULE_START_EPOCH; earlier epochs keep the semantics they were settled under.
 *
 * The tree is untouched by the rule: a pending user keeps its parent and its relative distance,
 * and nobody is compressed out.
 */

const PRICE_E18 = 10n ** 18n; // 1 ACF = $1, so ACF and USD6 differ only by scale
const USD = 1_000_000n;
const NOVA = RANK_TIERS.find((t) => t.n === 1)!;

/** A graph built by hand, so a test states exactly who is onboarded and who merely registered. */
function graphOf(
  edges: Record<string, string[]>,
  onboarded: string[],
  rootUserId = "root",
): AsOfGraph {
  const parentOf = new Map<string, string | null>([[rootUserId, null]]);
  const childrenOf = new Map<string, string[]>();
  for (const [parent, children] of Object.entries(edges)) {
    childrenOf.set(parent, children);
    for (const child of children) parentOf.set(child, parent);
  }
  // Children before parents: deepest first by distance to the root.
  const depth = (u: string): number => {
    let d = 0;
    let cur: string | null = u;
    while (cur && parentOf.get(cur)) { cur = parentOf.get(cur)!; d += 1; }
    return d;
  };
  const bottomUpOrder = [...parentOf.keys()].sort((a, b) => depth(b) - depth(a));
  return {
    rootUserId,
    userIds: [...parentOf.keys()],
    parentOf,
    childrenOf,
    bottomUpOrder,
    onboardedAsOf: new Set(onboarded),
  };
}

const stake = (acf: bigint): UserStakeTotals => ({
  ownActiveStakeACF: acf,
  ownRegularSelfACF: 0n,
  ownDAOSelfACF: 0n,
});

/** Own stake plus a self reward, so this user is a Level Income source. */
const earning = (acf: bigint, reward: bigint): UserStakeTotals => ({
  ownActiveStakeACF: acf,
  ownRegularSelfACF: reward,
  ownDAOSelfACF: 0n,
});

describe("onboarded-direct rule — Level unlock", () => {
  it("1. a registered direct with no wallet does not count", () => {
    // One direct, registered only. Under the rule the leader has zero qualifying directs, so no
    // level is unlocked and the direct's own reward pays nobody above.
    const graph = graphOf({ root: ["a"] }, []);
    const totals = new Map([["a", earning(1_000n * 10n ** 18n, 10n ** 18n)]]);
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);

    assert.equal(aggregates.get("root")!.onboardedDirects, 0);
    assert.equal(aggregates.get("root")!.directCount, 1, "still a direct in the tree");
    assert.equal(unlockedLevels(0), 0);

    const { credits } = computeLevelRewards(graph, aggregates, true);
    assert.equal(credits.length, 0, "nothing unlocked, so nothing credited");
  });

  it("2. a direct onboarded before the snapshot counts, with no stake of its own", () => {
    // The direct holds NO active stake. Onboarding alone qualifies the leader.
    const graph = graphOf({ root: ["a"] }, ["a"]);
    const totals = new Map([["a", earning(0n, 10n ** 18n)]]);
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);

    const root = aggregates.get("root")!;
    assert.equal(root.onboardedDirects, 1);
    assert.equal(root.activeDirects, 0, "no stake — and it does not matter");
    assert.equal(unlockedLevels(root.onboardedDirects), 1);

    const { credits } = computeLevelRewards(graph, aggregates, true);
    assert.equal(credits.length, 1);
    assert.equal(credits[0]!.beneficiaryUserId, "root");
    assert.equal(credits[0]!.relativeLevel, 1);
  });

  it("8. four registered directs, two onboarded: the unlock count is 2", () => {
    // The cliff: four directs would unlock all seven levels, two unlocks two.
    const graph = graphOf({ root: ["a", "b", "c", "d"] }, ["a", "b"]);
    const totals = new Map(
      ["a", "b", "c", "d"].map((u) => [u, earning(100n * 10n ** 18n, 10n ** 18n)] as const),
    );
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);

    const root = aggregates.get("root")!;
    assert.equal(root.directCount, 4);
    assert.equal(root.onboardedDirects, 2);
    assert.equal(unlockedLevels(root.directCount), 7, "what the old rule would have given");
    assert.equal(unlockedLevels(root.onboardedDirects), 2, "what the rule gives");
  });
});

describe("onboarded-direct rule — Rank qualification", () => {
  it("9. two onboarded directs qualify Nova with NO active stake among them", () => {
    // The decisive case: rank no longer depends on directs holding stake. Nova needs 2 directs,
    // $100 self and $5,000 team; the leader supplies self and team from its own and the
    // subtree's principal, while the two directs hold none.
    const graph = graphOf({ root: ["a", "b"], a: ["deep"] }, ["a", "b"]);
    const totals = new Map([
      ["root", stake(200n * 10n ** 18n)],
      ["a", stake(0n)],
      ["b", stake(0n)],
      // Team volume sits below a direct, not in it.
      ["deep", stake(6_000n * 10n ** 18n)],
    ]);
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);
    const root = aggregates.get("root")!;

    assert.equal(root.activeDirects, 0, "neither direct stakes");
    assert.equal(root.onboardedDirects, 2);
    assert.ok(root.selfStakeUSD6 >= NOVA.selfUSD6, "self met");
    assert.ok(root.teamStakeUSD6 >= NOVA.teamUSD6!, "team met");
    assert.equal(root.rank, 1, "Nova, qualified by onboarded directs alone");

    // And under the old rule the same inputs give rank 0, which is what changed.
    const old = computeAggregates(graph, totals, PRICE_E18, false);
    assert.equal(old.get("root")!.rank, 0, "the old rule needed staked directs");
  });

  it("3. an onboarded, unstaked direct counts toward the Rank direct requirement", () => {
    const graph = graphOf({ root: ["a"] }, ["a"]);
    const totals = new Map([["a", stake(0n)]]);
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);
    assert.equal(aggregates.get("root")!.onboardedDirects, 1);
    assert.equal(aggregates.get("root")!.activeDirects, 0);
  });
});

describe("the tree is not restructured", () => {
  it("7. a pending parent is skipped as a direct, and its child stays at relative level 2", () => {
    //   root
    //   └── a      registered, NOT onboarded
    //       └── e  onboarded, and earning
    //
    // `a` does not qualify root. `e` remains root's level 2 — no compression, no re-parenting.
    const graph = graphOf({ root: ["a"], a: ["e"] }, ["e"]);
    const totals = new Map([["e", earning(100n * 10n ** 18n, 10n ** 18n)]]);
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);

    assert.equal(aggregates.get("root")!.onboardedDirects, 0, "a is pending");
    assert.equal(aggregates.get("a")!.onboardedDirects, 1, "e qualifies a");
    assert.equal(graph.parentOf.get("e"), "a", "parent unchanged");

    // Root unlocked nothing, so it earns nothing — but the distance is still 2, not 1.
    const { credits } = computeLevelRewards(graph, aggregates, true);
    assert.equal(credits.filter((c) => c.beneficiaryUserId === "root").length, 0);
    const toA = credits.filter((c) => c.beneficiaryUserId === "a");
    assert.equal(toA.length, 1, "a unlocked L1 through e");
    assert.equal(toA[0]!.relativeLevel, 1);

    // Had the tree been compressed, root would have seen e at level 1 and been paid.
    const uplinesOfE = [...graph.parentOf.keys()].filter((u) => u === "a" || u === "root");
    assert.deepEqual(uplinesOfE.sort(), ["a", "root"], "both ancestors still present");
  });
});

describe("a pending ancestor does not block its descendants", () => {
  /**
   * The fixture that separates qualification from traversal:
   *
   *   Leader
   *   ├── B   onboarded
   *   ├── C   onboarded
   *   └── A   registered, NO wallet
   *       └── E   onboarded, and earning a DIRECT/BOND self reward
   *
   * Leader has two onboarded directs, so two levels are unlocked. E sits at relative level 2.
   * Leader must therefore be paid the level-2 rate on E's reward — A being pending removes A
   * from Leader's qualifying COUNT and nothing else.
   */
  const REWARD = 1_000n * 10n ** 18n;

  const fixture = () => {
    const graph = graphOf(
      { Leader: ["B", "C", "A"], A: ["E"] },
      ["B", "C", "E"], // A is absent: registered, never onboarded
      "Leader",
    );
    const totals = new Map([
      ["B", stake(10n * 10n ** 18n)],
      ["C", stake(10n * 10n ** 18n)],
      ["A", stake(0n)],
      ["E", earning(100n * 10n ** 18n, REWARD)],
    ]);
    return { graph, totals };
  };

  it("Leader counts 2 onboarded directs and unlocks 2 levels", () => {
    const { graph, totals } = fixture();
    const leader = computeAggregates(graph, totals, PRICE_E18, true).get("Leader")!;
    assert.equal(leader.directCount, 3, "B, C and A are all still directs");
    assert.equal(leader.onboardedDirects, 2, "A does not qualify");
    assert.equal(unlockedLevels(leader.onboardedDirects), 2);
  });

  it("E stays at relative level 2 — no compression, not removed", () => {
    const { graph, totals } = fixture();
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);
    const { credits } = computeLevelRewards(graph, aggregates, true);

    // Traversal is the immutable parent graph: E's uplines are A then Leader.
    assert.equal(graph.parentOf.get("E"), "A", "parent unchanged");
    assert.equal(graph.parentOf.get("A"), "Leader", "pending node still in the chain");

    const toLeader = credits.filter((c) => c.beneficiaryUserId === "Leader" && c.sourceUserId === "E");
    assert.equal(toLeader.length, 1, "Leader is paid on E");
    assert.equal(toLeader[0]!.relativeLevel, 2, "at level 2, NOT compressed to 1");
  });

  it("Leader receives the normal level-2 rate on E's reward", () => {
    const { graph, totals } = fixture();
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);
    const { credits } = computeLevelRewards(graph, aggregates, true);

    const credit = credits.find((c) => c.beneficiaryUserId === "Leader" && c.sourceUserId === "E")!;
    const expectedRate = LEVEL_RATES[1]!; // level 2
    assert.equal(credit.rateE6, expectedRate, "the published level-2 rate, not a reduced one");
    assert.equal(credit.sourceRegularSelfRewardACF, REWARD);
    assert.equal(credit.rewardACF, (REWARD * expectedRate) / 1_000_000n);
    assert.ok(credit.rewardACF > 0n, "a pending ancestor did not zero it");
  });

  it("A itself still earns level 1 from E, despite being pending", () => {
    // Being pending withholds qualification FROM A's referrer. It does not disqualify A as a
    // beneficiary of its own downline, which is governed by A's own direct count.
    const { graph, totals } = fixture();
    const aggregates = computeAggregates(graph, totals, PRICE_E18, true);
    assert.equal(aggregates.get("A")!.onboardedDirects, 1, "E qualifies A");

    const { credits } = computeLevelRewards(graph, aggregates, true);
    const toA = credits.filter((c) => c.beneficiaryUserId === "A");
    assert.equal(toA.length, 1);
    assert.equal(toA[0]!.relativeLevel, 1);
    assert.equal(toA[0]!.rateE6, LEVEL_RATES[0]!);
  });

  it("the graph passed to level rewards still contains the pending node", () => {
    // The rule must filter the COUNT, never the graph. If A were filtered out of the tree,
    // E would become Leader's level 1 and be paid 10% instead of 8%.
    const { graph } = fixture();
    assert.ok(graph.userIds.includes("A"), "A is a member of the as-of graph");
    assert.ok(!graph.onboardedAsOf.has("A"), "A is merely absent from the onboarded set");
    assert.deepEqual([...graph.childrenOf.get("Leader")!].sort(), ["A", "B", "C"]);
  });
});

describe("policy versioning", () => {
  it("10-11. the rule is selected by epoch, not by a clock", () => {
    assert.equal(usesOnboardedDirectRule(ONBOARDED_DIRECT_RULE_START_EPOCH), true);
    assert.equal(usesOnboardedDirectRule(ONBOARDED_DIRECT_RULE_START_EPOCH - 1), false);
    assert.equal(usesOnboardedDirectRule(ONBOARDED_DIRECT_RULE_START_EPOCH + 1_000), true);
  });

  it("12. the settled epochs 41459-41461 fall before the rule", () => {
    // They hold finalized settlement checkpoints and claims, so they must keep their semantics.
    for (const settled of [41459, 41460, 41461]) {
      assert.equal(usesOnboardedDirectRule(settled), false, `epoch ${settled}`);
    }
    assert.ok(
      ONBOARDED_DIRECT_RULE_START_EPOCH > 41461,
      "the rule must start after every already-settled epoch",
    );
  });

  it("10. a pre-rule epoch replays on active-stake directs", () => {
    // Same graph, same stakes, both rules. One onboarded direct without stake, one staked direct
    // that never onboarded: the two rules disagree, and each must give its own answer.
    const graph = graphOf({ root: ["onboardedNoStake", "stakedNotOnboarded"] }, ["onboardedNoStake"]);
    const totals = new Map([
      ["onboardedNoStake", stake(0n)],
      ["stakedNotOnboarded", stake(500n * 10n ** 18n)],
    ]);

    const before = computeAggregates(graph, totals, PRICE_E18, false);
    assert.equal(before.get("root")!.activeDirects, 1);
    assert.equal(unlockedLevels(before.get("root")!.directCount), 2, "old unlock: every direct");

    const after = computeAggregates(graph, totals, PRICE_E18, true);
    assert.equal(after.get("root")!.onboardedDirects, 1);
    assert.equal(unlockedLevels(after.get("root")!.onboardedDirects), 1, "new unlock: onboarded");
  });

  it("the audit counts are all retained, so a row explains itself", () => {
    const graph = graphOf({ root: ["a", "b", "c"] }, ["a", "b"]);
    const totals = new Map([
      ["a", stake(10n * 10n ** 18n)],
      ["b", stake(0n)],
      ["c", stake(10n * 10n ** 18n)],
    ]);
    const root = computeAggregates(graph, totals, PRICE_E18, true).get("root")!;
    assert.equal(root.directCount, 3, "registered");
    assert.equal(root.onboardedDirects, 2, "onboarded");
    assert.equal(root.activeDirects, 2, "holding stake");
    // All three differ here, which is why all three are stored.
    assert.notEqual(root.directCount, root.onboardedDirects);
  });
});

describe("as-of semantics", () => {
  it("4-6. onboarding is read as-of the snapshot, so it cannot leak backward", () => {
    // `onboardedAsOf` is what loadAsOfGraph derives by comparing the chain's creation timestamp
    // to the boundary. A wallet created after an epoch is simply absent from that epoch's set,
    // and present in a later one. Proven here by the two sets the loader would produce.
    const edges = { root: ["a"] };
    const beforeWalletExisted = graphOf(edges, []);
    const afterWalletExisted = graphOf(edges, ["a"]);
    const totals = new Map([["a", earning(100n * 10n ** 18n, 10n ** 18n)]]);

    const earlier = computeAggregates(beforeWalletExisted, totals, PRICE_E18, true);
    assert.equal(earlier.get("root")!.onboardedDirects, 0, "the earlier epoch sees no wallet");
    assert.equal(computeLevelRewards(beforeWalletExisted, earlier, true).credits.length, 0);

    const later = computeAggregates(afterWalletExisted, totals, PRICE_E18, true);
    assert.equal(later.get("root")!.onboardedDirects, 1, "the later epoch sees it");
    assert.equal(computeLevelRewards(afterWalletExisted, later, true).credits.length, 1);
  });
});

/**
 * The loader's own as-of comparison, against a database.
 *
 * The unit tests above take `onboardedAsOf` as given. These prove loadAsOfGraph builds it by
 * comparing the chain's creation timestamp to the epoch boundary — the step that makes a settled
 * epoch impossible to move.
 */
describe("loadAsOfGraph: the timestamp fallback, used only when no snapshot block exists", () => {
  const TEST_URI = process.env.MONGODB_TEST_URI;
  let connected = false;

  before(async () => {
    if (!TEST_URI) { console.log("SKIP: MONGODB_TEST_URI not set"); return; }
    const { default: mongoose } = await import("mongoose");
    await mongoose.connect(assertDisposable(TEST_URI), { serverSelectionTimeoutMS: 8000 });
    connected = true;
  });
  after(async () => {
    if (!connected) return;
    const { default: mongoose } = await import("mongoose");
    await mongoose.disconnect();
  });

  const BOUNDARY = 41_462 * 43_200; // the first epoch under the rule
  let seq = 0;

  async function seed(
    userId: string,
    parent: string | null,
    walletCreatedAtSec: number | null,
  ): Promise<void> {
    const { User } = await import("../../models/User.js");
    seq += 1;
    await User.collection.insertOne({
      userId,
      externalEOA: `0x${seq.toString(16).padStart(40, "0")}`,
      referralCode: `ACF-ONB-${seq}`,
      referredByUserId: parent,
      // Registered well before the boundary in every case, so only the WALLET date varies.
      createdAt: new Date((BOUNDARY - 500_000) * 1000),
      updatedAt: new Date((BOUNDARY - 500_000) * 1000),
      ...(walletCreatedAtSec === null
        ? {}
        : {
            smartWalletAddress: `0x${(seq + 0x2000).toString(16).padStart(40, "0")}`,
            smartWalletCreatedAt: new Date(walletCreatedAtSec * 1000),
            smartWalletCreatedBlockNumber: 49_000_000 + seq,
            smartWalletCreatedTxHash: `0x${seq.toString(16).padStart(64, "0")}`,
          }),
    } as never);
  }

  it("4-6. a wallet created after the boundary is absent from that epoch and present later", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { User } = await import("../../models/User.js");
    const { loadAsOfGraph } = await import("./graph.js");
    await User.deleteMany({});

    // ROOT must be the configured root EOA, or the loader refuses the graph.
    seq = 0;
    const { User: U } = await import("../../models/User.js");
    await U.collection.insertOne({
      userId: "onb_root",
      externalEOA: TEST_ROOT_EOA.toLowerCase(),
      referralCode: "ACF-ONB-ROOT",
      referredByUserId: null,
      createdAt: new Date((BOUNDARY - 600_000) * 1000),
      updatedAt: new Date((BOUNDARY - 600_000) * 1000),
    } as never);

    await seed("onb_before", "onb_root", BOUNDARY - 60);   // one minute before
    await seed("onb_exactly", "onb_root", BOUNDARY);        // exactly on it
    await seed("onb_after", "onb_root", BOUNDARY + 60);     // one minute after
    await seed("onb_never", "onb_root", null);              // no wallet at all

    const atBoundary = await loadAsOfGraph(BOUNDARY, null);
    assert.ok(atBoundary.onboardedAsOf.has("onb_before"), "created before: counts");
    assert.ok(atBoundary.onboardedAsOf.has("onb_exactly"), "created exactly at: counts (<=)");
    assert.ok(!atBoundary.onboardedAsOf.has("onb_after"), "created after: must NOT leak backward");
    assert.ok(!atBoundary.onboardedAsOf.has("onb_never"), "no wallet: never counts");

    // 5. The same user counts in a later epoch.
    const later = await loadAsOfGraph(BOUNDARY + 43_200, null);
    assert.ok(later.onboardedAsOf.has("onb_after"), "the next epoch sees it");
    assert.ok(!later.onboardedAsOf.has("onb_never"), "still no wallet");

    // The tree is identical under both snapshots: onboarding never moves anyone.
    assert.deepEqual(
      [...atBoundary.childrenOf.get("onb_root")!].sort(),
      [...later.childrenOf.get("onb_root")!].sort(),
      "same children regardless of onboarding",
    );
    assert.equal(atBoundary.parentOf.get("onb_after"), "onb_root");
  });
});

/**
 * The authoritative as-of comparison: BLOCK against Phase 1's pinned snapshot block.
 *
 * The chain orders transactions by block, not by clock. A block's timestamp is the proposer's
 * claim about the whole block, so two wallets created in the same second can sit on opposite
 * sides of a boundary — and a timestamp comparison would then admit one that came after it.
 * These tests pin that down, including the case where the timestamps are identical and only the
 * blocks differ.
 */
describe("loadAsOfGraph decides onboarding by BLOCK when the snapshot block is known", () => {
  const TEST_URI = process.env.MONGODB_TEST_URI;
  let connected = false;

  before(async () => {
    if (!TEST_URI) { console.log("SKIP: MONGODB_TEST_URI not set"); return; }
    const { default: mongoose } = await import("mongoose");
    await mongoose.connect(assertDisposable(TEST_URI), { serverSelectionTimeoutMS: 8000 });
    connected = true;
  });
  after(async () => {
    if (!connected) return;
    const { default: mongoose } = await import("mongoose");
    await mongoose.disconnect();
  });

  const BOUNDARY = 41_462 * 43_200;
  const SNAPSHOT_BLOCK = 49_300_000;

  let seq = 0;
  async function seedWallet(
    userId: string,
    createdBlock: number | null,
    createdAtSec: number,
  ): Promise<void> {
    const { User } = await import("../../models/User.js");
    seq += 1;
    await User.collection.insertOne({
      userId,
      externalEOA: `0x${(seq + 0x500).toString(16).padStart(40, "0")}`,
      referralCode: `ACF-BLK-${seq}`,
      referredByUserId: "blk_root",
      createdAt: new Date((BOUNDARY - 500_000) * 1000),
      updatedAt: new Date((BOUNDARY - 500_000) * 1000),
      smartWalletAddress: `0x${(seq + 0x6000).toString(16).padStart(40, "0")}`,
      smartWalletCreatedAt: new Date(createdAtSec * 1000),
      ...(createdBlock === null ? {} : { smartWalletCreatedBlockNumber: createdBlock }),
      smartWalletCreatedTxHash: `0x${(seq + 0x90).toString(16).padStart(64, "0")}`,
    } as never);
  }

  async function seedRoot(): Promise<void> {
    const { User } = await import("../../models/User.js");
    await User.collection.insertOne({
      userId: "blk_root",
      externalEOA: TEST_ROOT_EOA.toLowerCase(),
      referralCode: "ACF-BLK-ROOT",
      referredByUserId: null,
      createdAt: new Date((BOUNDARY - 600_000) * 1000),
      updatedAt: new Date((BOUNDARY - 600_000) * 1000),
    } as never);
  }

  it("block < snapshot counts, block == snapshot counts, block > snapshot does not", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { User } = await import("../../models/User.js");
    const { loadAsOfGraph } = await import("./graph.js");
    await User.deleteMany({});
    seq = 0;
    await seedRoot();

    // Every timestamp here is comfortably before the boundary, so only the BLOCK can decide.
    await seedWallet("blk_before", SNAPSHOT_BLOCK - 1, BOUNDARY - 10_000);
    await seedWallet("blk_equal", SNAPSHOT_BLOCK, BOUNDARY - 10_000);
    await seedWallet("blk_after", SNAPSHOT_BLOCK + 1, BOUNDARY - 10_000);

    const g = await loadAsOfGraph(BOUNDARY, SNAPSHOT_BLOCK);
    assert.equal(g.onboardingBasis, "BLOCK");
    assert.ok(g.onboardedAsOf.has("blk_before"), "block < snapshot: counts");
    assert.ok(g.onboardedAsOf.has("blk_equal"), "block == snapshot: counts (<=)");
    assert.ok(
      !g.onboardedAsOf.has("blk_after"),
      "block > snapshot: must NOT count, though its timestamp precedes the boundary",
    );
  });

  it("identical timestamps, different blocks: only the block decides", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { User } = await import("../../models/User.js");
    const { loadAsOfGraph } = await import("./graph.js");
    await User.deleteMany({});
    seq = 0;
    await seedRoot();

    // The same instant for both, well before the boundary — a timestamp rule would admit both.
    const SAME_SECOND = BOUNDARY - 1;
    await seedWallet("same_ts_in", SNAPSHOT_BLOCK - 5, SAME_SECOND);
    await seedWallet("same_ts_out", SNAPSHOT_BLOCK + 5, SAME_SECOND);

    const byBlock = await loadAsOfGraph(BOUNDARY, SNAPSHOT_BLOCK);
    assert.ok(byBlock.onboardedAsOf.has("same_ts_in"));
    assert.ok(
      !byBlock.onboardedAsOf.has("same_ts_out"),
      "the later BLOCK is excluded despite an identical, earlier timestamp",
    );

    // The same data under the fallback admits both — which is exactly why the block is used.
    const byTimestamp = await loadAsOfGraph(BOUNDARY, null);
    assert.equal(byTimestamp.onboardingBasis, "TIMESTAMP");
    assert.ok(byTimestamp.onboardedAsOf.has("same_ts_in"));
    assert.ok(
      byTimestamp.onboardedAsOf.has("same_ts_out"),
      "timestamp alone cannot separate them — the defect the block rule removes",
    );
  });

  it("a user with no creation block falls back to its timestamp", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { User } = await import("../../models/User.js");
    const { loadAsOfGraph } = await import("./graph.js");
    await User.deleteMany({});
    seq = 0;
    await seedRoot();

    // The resolver always writes both, so this is defensive: a row dated but not blocked.
    await seedWallet("no_block_before", null, BOUNDARY - 60);
    await seedWallet("no_block_after", null, BOUNDARY + 60);

    const g = await loadAsOfGraph(BOUNDARY, SNAPSHOT_BLOCK);
    assert.equal(g.onboardingBasis, "BLOCK", "the epoch still reports its basis");
    assert.ok(g.onboardedAsOf.has("no_block_before"), "dated before: counts on the fallback");
    assert.ok(!g.onboardedAsOf.has("no_block_after"), "dated after: still excluded");
  });

  it("the tree is identical under either basis", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const { User } = await import("../../models/User.js");
    const { loadAsOfGraph } = await import("./graph.js");
    await User.deleteMany({});
    seq = 0;
    await seedRoot();
    await seedWallet("t_in", SNAPSHOT_BLOCK - 1, BOUNDARY - 100);
    await seedWallet("t_out", SNAPSHOT_BLOCK + 1, BOUNDARY - 100);

    const byBlock = await loadAsOfGraph(BOUNDARY, SNAPSHOT_BLOCK);
    const byTimestamp = await loadAsOfGraph(BOUNDARY, null);
    assert.deepEqual(
      [...byBlock.childrenOf.get("blk_root")!].sort(),
      [...byTimestamp.childrenOf.get("blk_root")!].sort(),
      "onboarding never changes who is in the tree",
    );
    assert.equal(byBlock.parentOf.get("t_out"), "blk_root", "the excluded user keeps its parent");
  });
});
