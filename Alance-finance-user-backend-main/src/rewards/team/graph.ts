import { config } from "../../config.js";
import { findRootUser } from "../../lib/bootstrap.js";
import { User } from "../../models/User.js";

/**
 * The referral graph AS IT EXISTED at an epoch boundary.
 *
 * Membership is `User.createdAt <= snapshotAt`. Parent pointers are immutable, so an edge is
 * valid as soon as both endpoints exist — which means a referral registered after the boundary
 * can never retroactively change an older epoch's Level unlock or Rank team.
 *
 * Loaded once per epoch and walked in memory. Nothing here queries per user.
 */

export class GraphIntegrityError extends Error {
  readonly code = "GRAPH_INTEGRITY";
  constructor(message: string) {
    super(message);
    this.name = "GraphIntegrityError";
  }
}

export class GraphTooLargeError extends Error {
  readonly code = "GRAPH_TOO_LARGE";
  constructor(nodes: number, limit: number) {
    super(
      `The as-of referral graph has ${nodes} nodes, over the configured ceiling of ${limit}. ` +
        "Refusing to compute a partial network.",
    );
    this.name = "GraphTooLargeError";
  }
}

export interface AsOfGraph {
  rootUserId: string;
  /** Every member, in no particular order. */
  userIds: string[];
  parentOf: Map<string, string | null>;
  childrenOf: Map<string, string[]>;
  /**
   * Children before parents. Any bottom-up aggregation processed in this order sees final
   * values for every descendant.
   */
  bottomUpOrder: string[];
  /**
   * Users whose smart wallet existed AT OR BEFORE this epoch's snapshot — onboarding complete,
   * as-of. Membership decides who counts as an onboarded direct, and so Level unlock depth and
   * the Rank direct requirement, from ONBOARDED_DIRECT_RULE_START_EPOCH onward.
   *
   * Decided by BLOCK NUMBER against Phase 1's pinned `snapshotBlockNumber` whenever that block
   * is known, and only by timestamp when it is not. The chain orders transactions by block, not
   * by clock: two wallets in the same second can straddle the boundary, and a block's timestamp
   * is the miner's claim rather than a per-transaction fact. Comparing blocks is the same
   * authority Phase 1 already reads every stake at.
   *
   * Deliberately NOT "has a wallet now": a wallet created after the snapshot must never leak
   * backward into this epoch, or a replay would contradict an immutable snapshot. A user whose
   * creation event could not be established is absent, so a missing fact withholds qualification
   * rather than granting it.
   *
   * This does not alter the tree. `parentOf` and `childrenOf` still hold every registered user,
   * so relative level distance is unchanged and nobody is compressed out.
   */
  onboardedAsOf: Set<string>;
  /** Which comparison decided `onboardedAsOf`, recorded for the epoch's audit row. */
  onboardingBasis: "BLOCK" | "TIMESTAMP";
}

/**
 * Loads and validates the graph, or throws.
 *
 * Validation is deliberately strict and total. A silently wrong graph understates someone's
 * team forever, and nothing downstream could detect it.
 */
export async function loadAsOfGraph(
  snapshotAt: number,
  /**
   * Phase 1's pinned snapshot block for this epoch, read from the Phase 2 epoch row rather than
   * looked up again — one canonical value per epoch, or the graph and the stake reads could
   * disagree about where the boundary is. Null only when Phase 1 never recorded one, which is
   * the sole case that falls back to timestamps.
   */
  snapshotBlockNumber: number | null,
): Promise<AsOfGraph> {
  const root = await findRootUser();
  if (!root) {
    throw new GraphIntegrityError(
      `The configured ROOT (${config.rootAdminEoa}) has no user record. Refusing to settle a ` +
        "Team Reward epoch without the application's referral root.",
    );
  }
  const rootCreatedAt = Math.floor(
    (root as unknown as { createdAt: Date }).createdAt.getTime() / 1000,
  );
  if (rootCreatedAt > snapshotAt) {
    throw new GraphIntegrityError(
      `The configured ROOT registered at ${rootCreatedAt}, after this epoch's boundary ` +
        `${snapshotAt}. The epoch predates the referral root.`,
    );
  }

  const limit = config.phase2MaxGraphNodes;
  const rows = await User.find(
    { createdAt: { $lte: new Date(snapshotAt * 1000) } },
    { userId: 1, referredByUserId: 1, smartWalletCreatedAt: 1, smartWalletCreatedBlockNumber: 1 },
  ).lean();

  if (rows.length > limit) throw new GraphTooLargeError(rows.length, limit);

  const parentOf = new Map<string, string | null>();
  const onboardedAsOf = new Set<string>();
  const onboardingBasis: "BLOCK" | "TIMESTAMP" =
    snapshotBlockNumber === null ? "TIMESTAMP" : "BLOCK";
  const snapshotMs = snapshotAt * 1000;
  for (const r of rows) {
    parentOf.set(r.userId, r.referredByUserId ?? null);

    const createdBlock = r.smartWalletCreatedBlockNumber as number | undefined | null;
    const createdAt = r.smartWalletCreatedAt as Date | undefined | null;

    // Block against block, at or before the boundary. `<=` because a wallet created IN the
    // snapshot block exists as of that block.
    if (snapshotBlockNumber !== null && createdBlock != null) {
      if (createdBlock <= snapshotBlockNumber) onboardedAsOf.add(r.userId);
      continue;
    }
    // Fallback: no block to compare on either side. The resolver writes block and timestamp
    // together, so for current data this is reached only when Phase 1 recorded no snapshot
    // block at all.
    if (createdAt && createdAt.getTime() <= snapshotMs) onboardedAsOf.add(r.userId);
  }

  // Exactly one parentless node, and it must be the CONFIGURED root — not merely whichever
  // user happens to have no parent, which would silently accept a second tree.
  const parentless = [...parentOf.entries()].filter(([, p]) => p === null).map(([u]) => u);
  if (parentless.length !== 1 || parentless[0] !== root.userId) {
    throw new GraphIntegrityError(
      `Expected exactly one parentless user, the configured ROOT ${root.userId}; found ` +
        `[${parentless.join(", ")}].`,
    );
  }

  const childrenOf = new Map<string, string[]>();
  for (const userId of parentOf.keys()) childrenOf.set(userId, []);
  for (const [userId, parent] of parentOf) {
    if (parent === null) continue;
    const siblings = childrenOf.get(parent);
    if (!siblings) {
      // The parent exists but registered after the boundary, or does not exist at all. Either
      // way this node's position in the as-of tree is undefined.
      throw new GraphIntegrityError(
        `User ${userId} has parent ${parent}, which is absent from the as-of graph at ` +
          `${snapshotAt}. Refusing to settle on an orphaned node.`,
      );
    }
    siblings.push(userId);
  }
  // Stable order so a rerun produces identical row ordering and identical results.
  for (const list of childrenOf.values()) list.sort();

  // Iterative DFS: a 100k-deep chain would overflow a recursive walk.
  const preOrder: string[] = [];
  const seen = new Set<string>();
  const stack: string[] = [root.userId];
  while (stack.length > 0) {
    const u = stack.pop()!;
    if (seen.has(u)) {
      throw new GraphIntegrityError(`Cycle or duplicate edge detected at user ${u}.`);
    }
    seen.add(u);
    preOrder.push(u);
    for (const c of childrenOf.get(u) ?? []) stack.push(c);
  }

  // Every member must be reachable from ROOT. An unreachable node means a detached component
  // or a cycle among parent pointers, and its stake would be silently missing from every team.
  if (seen.size !== parentOf.size) {
    const unreachable = [...parentOf.keys()].filter((u) => !seen.has(u));
    throw new GraphIntegrityError(
      `${unreachable.length} user(s) are not reachable from ROOT: ` +
        `${unreachable.slice(0, 10).join(", ")}. The referral graph is not a single tree.`,
    );
  }

  // A parent always precedes its children in pre-order, so the reverse puts every child before
  // its parent — exactly what a bottom-up aggregation needs.
  return {
    rootUserId: root.userId,
    userIds: [...parentOf.keys()],
    parentOf,
    childrenOf,
    bottomUpOrder: [...preOrder].reverse(),
    onboardedAsOf,
    onboardingBasis,
  };
}

/** Ancestors of a user, nearest first, at most `maxLevels`. Pure map walk, no queries. */
export function uplinesOf(
  graph: AsOfGraph,
  userId: string,
  maxLevels: number,
): { userId: string; relativeLevel: number }[] {
  const out: { userId: string; relativeLevel: number }[] = [];
  let current: string | null = userId;
  for (let level = 1; level <= maxLevels; level++) {
    const parent: string | null = current === null ? null : graph.parentOf.get(current) ?? null;
    if (parent === null) break;
    out.push({ userId: parent, relativeLevel: level });
    current = parent;
  }
  return out;
}
