import { config } from "../config.js";
import { normalizeEOA } from "./address.js";
import { User } from "../models/User.js";
import { DAOReconciliationState } from "../models/DAOReconciliationState.js";

/**
 * The root of the referral tree.
 *
 * Identified by WALLET, not by User.userId. The admin's wallet is known before any database
 * exists, so ROOT_ADMIN_EOA is correct from the very first start and never changes — there is
 * no second variable, no operator restart, and no mode flag. The root's userId is resolved at
 * runtime from the wallet.
 *
 * Before that wallet registers there simply is no root. Registration by anyone else is refused
 * for exactly as long as that is true, so a user can never be created with a null parent.
 * The instant the admin signs in, the system is complete.
 */

/** The root user, or null while the admin has not registered yet. */
export async function findRootUser() {
  return User.findOne({ externalEOA: normalizeEOA(config.rootAdminEoa) });
}

/** True for the one wallet permitted to create the root account. */
export function isRootAdminEoa(externalEOA: string): boolean {
  return normalizeEOA(config.rootAdminEoa) === externalEOA;
}

/**
 * Startup check.
 *
 * Deliberately permissive: the backend STARTS whether or not the admin has registered, because
 * refusing would make the first registration impossible. The only fatal condition is a database
 * that contradicts the configuration — a parentless user who is not the configured admin means
 * the referral tree already has a different root, and continuing would silently build a second.
 */
/**
 * Fails fast on an index the application no longer declares.
 *
 * Mongoose adds new indexes but never drops old ones — deliberately, since dropping an index
 * automatically is destructive. So a schema whose uniqueness changed leaves the previous index
 * in place, where it keeps enforcing a rule the code has abandoned. That surfaces as a 500 on
 * every affected request rather than anything pointing at the cause, so it is checked here
 * instead, once, with the command to fix it.
 */
export async function assertNoStaleIndexes(): Promise<void> {
  const stale: { collection: string; index: string; reason: string }[] = [];

  const cursors = DAOReconciliationState.collection;
  const existing = await cursors.indexes().catch(() => []);
  if (existing.some((i) => i.name === "chainId_1_daoContractAddress_1")) {
    stale.push({
      collection: cursors.collectionName,
      index: "chainId_1_daoContractAddress_1",
      reason:
        "reconciliation cursors are per wallet now, so several documents per DAO are expected; " +
        "the old unique index rejects every wallet after the first",
    });
  }

  if (stale.length > 0) {
    throw new Error(
      "Stale database index(es) from an earlier schema:\n" +
        stale.map((s) => `  ${s.collection}.${s.index} — ${s.reason}`).join("\n") +
        "\n\nDrop them with:\n" +
        stale.map((s) => `  db.${s.collection}.dropIndex("${s.index}")`).join("\n") +
        `\n\nOr drop the whole ${stale[0]!.collection} collection: it is a rebuildable cache, ` +
        "not business data.",
    );
  }
}

export async function assertReferralRoot(): Promise<void> {
  const expected = normalizeEOA(config.rootAdminEoa);

  const parentless = await User.find({ referredByUserId: null });
  if (parentless.length === 0) return;   // nobody has registered yet; the admin still can

  if (parentless.length > 1) {
    throw new Error(
      `Found ${parentless.length} users without a parent: ` +
        `${parentless.map((u) => `${u.userId} (${u.externalEOA})`).join(", ")}. ` +
        "A referral tree has exactly one root. Refusing to start against a forked tree — " +
        "run scripts/backfill-root-parent.ts to attach the legacy ones to the real root.",
    );
  }

  const [root] = parentless;
  if (root!.externalEOA !== expected) {
    throw new Error(
      `The existing root is ${root!.userId} (${root!.externalEOA}), but ROOT_ADMIN_EOA is ` +
        `${expected}. Changing the configured admin would re-root the referral tree and orphan ` +
        "every existing relationship. Refusing to start.",
    );
  }
}

/** Reports whether registration is currently open, for the startup log. */
export async function referralRootStatus(): Promise<"registered" | "awaiting-admin"> {
  return (await findRootUser()) ? "registered" : "awaiting-admin";
}
