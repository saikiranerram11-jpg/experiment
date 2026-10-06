import { levelRate, levelReward, LEVEL_MAX_DEPTH, unlockedLevels } from "./policy.js";
import { uplinesOf, type AsOfGraph } from "./graph.js";
import type { NodeAggregate } from "./rank.js";

/**
 * One Level Income credit, before persistence.
 */
export interface LevelCredit {
  beneficiaryUserId: string;
  sourceUserId: string;
  relativeLevel: number;
  rateE6: bigint;
  sourceRegularSelfRewardACF: bigint;
  rewardACF: bigint;
}

export interface LevelOutcome {
  credits: LevelCredit[];
  /** Per beneficiary: total, and the per-level breakdown for the audit record. */
  totals: Map<string, bigint>;
  perLevel: Map<string, Map<number, { baseACF: bigint; amountACF: bigint; sourceCount: number }>>;
}

/**
 * Level Income, propagated UPWARD from each earner.
 *
 * O(earners x 7) rather than walking every leader's whole downline, and entirely in memory —
 * the parent map and direct counts were already built for Rank, so there is no query in the
 * loop.
 *
 * The base is the downline user's DIRECT+BOND staking reward for this epoch. DAO staking
 * reward never propagates. The recipient needs no stake of their own, and ROOT is not special.
 */
export function computeLevelRewards(
  graph: AsOfGraph,
  aggregates: Map<string, NodeAggregate>,
  /** See computeAggregates: the epoch's rule, not today's. */
  useOnboardedDirectRule: boolean,
): LevelOutcome {
  const credits: LevelCredit[] = [];
  const totals = new Map<string, bigint>();
  const perLevel = new Map<
    string,
    Map<number, { baseACF: bigint; amountACF: bigint; sourceCount: number }>
  >();

  for (const [sourceUserId, node] of aggregates) {
    const source = node.ownRegularSelfACF;
    if (source <= 0n) continue;

    for (const { userId: beneficiaryUserId, relativeLevel } of
      uplinesOf(graph, sourceUserId, LEVEL_MAX_DEPTH)) {
      const beneficiary = aggregates.get(beneficiaryUserId);
      if (!beneficiary) continue;                       // outside the as-of graph
      // Unlock has NO stake condition under either rule. What changed is which directs count:
      // from ONBOARDED_DIRECT_RULE_START_EPOCH only those who completed onboarding, before it
      // every registered direct.
      const qualifying = useOnboardedDirectRule
        ? beneficiary.onboardedDirects
        : beneficiary.directCount;
      if (unlockedLevels(qualifying) < relativeLevel) continue;

      const rewardACF = levelReward(source, relativeLevel);
      if (rewardACF <= 0n) continue;

      credits.push({
        beneficiaryUserId,
        sourceUserId,
        relativeLevel,
        rateE6: levelRate(relativeLevel),
        sourceRegularSelfRewardACF: source,
        rewardACF,
      });

      totals.set(beneficiaryUserId, (totals.get(beneficiaryUserId) ?? 0n) + rewardACF);

      const byLevel = perLevel.get(beneficiaryUserId) ?? new Map();
      const bucket = byLevel.get(relativeLevel) ??
        { baseACF: 0n, amountACF: 0n, sourceCount: 0 };
      bucket.baseACF += source;
      bucket.amountACF += rewardACF;
      bucket.sourceCount += 1;
      byLevel.set(relativeLevel, bucket);
      perLevel.set(beneficiaryUserId, byLevel);
    }
  }

  // Deterministic ordering so a rerun inserts identical rows in identical order.
  credits.sort((a, b) =>
    a.beneficiaryUserId.localeCompare(b.beneficiaryUserId) ||
    a.sourceUserId.localeCompare(b.sourceUserId) ||
    a.relativeLevel - b.relativeLevel);

  return { credits, totals, perLevel };
}
