import { acfToUsd6, QUALIFIER_THRESHOLDS, REQUIRED_QUALIFIERS, resolveRank } from "./policy.js";
import type { AsOfGraph } from "./graph.js";
import type { UserStakeTotals } from "./inputs.js";

/**
 * Everything the post-order pass derives for one user, for one epoch.
 */
export interface NodeAggregate {
  userId: string;
  ownActiveStakeACF: bigint;
  subtreeActiveStakeACF: bigint;
  ownRegularSelfACF: bigint;
  subtreeRegularSelfACF: bigint;
  /** As-of children, regardless of stake. Level unlock reads this. */
  directCount: number;
  /** As-of children with any active-at-snapshot principal. Kept for audit and Global. */
  activeDirects: number;
  /**
   * As-of children whose smart wallet existed at the snapshot — onboarding complete, no stake
   * required. From ONBOARDED_DIRECT_RULE_START_EPOCH this is what Level unlock and the Rank
   * direct requirement read.
   */
  onboardedDirects: number;
  /** Direct children's own active principal. Global reads this. */
  l1StakeACF: bigint;
  /** Strict descendants at rank >= threshold, capped at REQUIRED_QUALIFIERS. */
  qualifiersAtOrAbove: Map<number, number>;
  maxDescendantRank: number;
  /** subtree - own. Excludes the leader's own principal. */
  teamStakeACF: bigint;
  /** subtree - own. Excludes the leader's own staking reward. */
  teamRewardBaseACF: bigint;
  selfStakeUSD6: bigint;
  teamStakeUSD6: bigint;
  rank: number;
}

const ZERO: UserStakeTotals = {
  ownActiveStakeACF: 0n, ownRegularSelfACF: 0n, ownDAOSelfACF: 0n,
};

/**
 * Computes every user's aggregates and rank in ONE bottom-up pass.
 *
 * This is exact without iteration, and the reason is worth stating:
 *
 *   - ranks 1-6 depend only on the leader's own numbers (self, team, activeDirects), and team
 *     depends on descendants' STAKE, not on their ranks;
 *   - ranks 7-12 additionally depend on {rank(d) : d is a strict descendant};
 *   - nothing depends on an ancestor's or a sibling's rank.
 *
 * So the dependency relation points strictly descendant -> ancestor. The as-of graph is a
 * validated single-rooted acyclic tree, and `bottomUpOrder` places every child before its
 * parent, so when a node is reached every value it needs is already final. The doc's
 * fixed-point resolver is therefore unnecessary here; it exists only as a test oracle.
 *
 * O(n) with constant state per node: four sums, one max, and six counters capped at 2.
 */
export function computeAggregates(
  graph: AsOfGraph,
  totals: Map<string, UserStakeTotals>,
  priceE18: bigint,
  /**
   * Which direct count qualifies a rank, decided by the epoch and passed in rather than read
   * from a clock: an epoch replayed years later must settle under the rule it was settled under.
   * `usesOnboardedDirectRule(epochId)` is the only intended source.
   */
  useOnboardedDirectRule: boolean,
): Map<string, NodeAggregate> {
  const out = new Map<string, NodeAggregate>();

  for (const userId of graph.bottomUpOrder) {
    const own = totals.get(userId) ?? ZERO;
    const children = graph.childrenOf.get(userId) ?? [];

    let subtreeActiveStakeACF = own.ownActiveStakeACF;
    let subtreeRegularSelfACF = own.ownRegularSelfACF;
    let l1StakeACF = 0n;
    let activeDirects = 0;
    let onboardedDirects = 0;
    let maxDescendantRank = 0;
    const qualifiersAtOrAbove = new Map<number, number>(
      QUALIFIER_THRESHOLDS.map((r) => [r, 0]),
    );

    for (const childId of children) {
      // Guaranteed present: bottomUpOrder puts every child before its parent.
      const child = out.get(childId)!;

      subtreeActiveStakeACF += child.subtreeActiveStakeACF;
      subtreeRegularSelfACF += child.subtreeRegularSelfACF;
      l1StakeACF += child.ownActiveStakeACF;
      if (child.ownActiveStakeACF > 0n) activeDirects += 1;
      // Onboarding alone, as-of the snapshot. A pending child still occupies its place in the
      // tree — it simply does not qualify its parent.
      if (graph.onboardedAsOf.has(childId)) onboardedDirects += 1;

      if (child.rank > maxDescendantRank) maxDescendantRank = child.rank;
      if (child.maxDescendantRank > maxDescendantRank) {
        maxDescendantRank = child.maxDescendantRank;
      }

      for (const threshold of QUALIFIER_THRESHOLDS) {
        // The child's own rank plus the qualifiers inside the child's subtree. `>=` so a
        // higher rank satisfies a lower requirement: a Quantum counts toward "at least Master".
        const fromChild = (child.qualifiersAtOrAbove.get(threshold) ?? 0) +
          (child.rank >= threshold ? 1 : 0);
        const running = (qualifiersAtOrAbove.get(threshold) ?? 0) + fromChild;
        // Capped: only ">= 2" is ever asked, so counting further is wasted work.
        qualifiersAtOrAbove.set(threshold, running > REQUIRED_QUALIFIERS ? REQUIRED_QUALIFIERS : running);
      }
    }

    const teamStakeACF = subtreeActiveStakeACF - own.ownActiveStakeACF;
    const teamRewardBaseACF = subtreeRegularSelfACF - own.ownRegularSelfACF;
    const selfStakeUSD6 = acfToUsd6(own.ownActiveStakeACF, priceE18);
    const teamStakeUSD6 = acfToUsd6(teamStakeACF, priceE18);

    const rank = resolveRank({
      selfStakeUSD6,
      teamStakeUSD6,
      qualifyingDirects: useOnboardedDirectRule ? onboardedDirects : activeDirects,
      qualifiersAtOrAbove,
    });

    out.set(userId, {
      userId,
      ownActiveStakeACF: own.ownActiveStakeACF,
      subtreeActiveStakeACF,
      ownRegularSelfACF: own.ownRegularSelfACF,
      subtreeRegularSelfACF,
      directCount: children.length,
      activeDirects,
      onboardedDirects,
      l1StakeACF,
      qualifiersAtOrAbove,
      maxDescendantRank,
      teamStakeACF,
      teamRewardBaseACF,
      selfStakeUSD6,
      teamStakeUSD6,
      rank,
    });
  }

  return out;
}

/**
 * The highest rank anywhere below a leader, all depths, no leg logic.
 *
 * Already accumulated by the pass; exposed separately because the Rank differential reads it
 * and the name is what the specification uses.
 */
export const highestDownlineRank = (node: NodeAggregate): number => node.maxDescendantRank;
