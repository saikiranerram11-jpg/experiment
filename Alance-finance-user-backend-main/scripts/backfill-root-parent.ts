import mongoose from "mongoose";
import { User } from "../src/models/User.js";

/**
 * Re-parents legacy users who registered before the ROOT rule existed.
 *
 * Before this milestone a registration with no referral code stored `referredByUserId: null`.
 * That now means "I am ROOT", so those records are indistinguishable from the real root by
 * shape alone. The configured ROOT_ADMIN_EOA is what tells them apart: the root is the user
 * owning that wallet, and everyone else parentless is a legacy record.
 *
 *   ROOT_ADMIN_EOA=0x... npx tsx scripts/backfill-root-parent.ts            # dry run
 *   ROOT_ADMIN_EOA=0x... npx tsx scripts/backfill-root-parent.ts --apply    # writes
 *
 * Dry run is the default and prints every candidate for review. Idempotent: a second --apply
 * finds nothing, because the first one gave every candidate a parent.
 */

try {
  process.loadEnvFile(".env");
} catch (error) {
  if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
}

const mongodbUri = process.env.MONGODB_URI?.trim();
const rootAdminEoa = process.env.ROOT_ADMIN_EOA?.trim()?.toLowerCase();
const apply = process.argv.includes("--apply");

if (!mongodbUri) { console.error("MONGODB_URI is required."); process.exit(1); }
if (!rootAdminEoa) { console.error("ROOT_ADMIN_EOA is required."); process.exit(1); }

await mongoose.connect(mongodbUri, { serverSelectionTimeoutMS: 8000 });
try {
  const root = await User.findOne({ externalEOA: rootAdminEoa });
  if (!root) {
    console.error(`No user owns ROOT_ADMIN_EOA ${rootAdminEoa}. The admin must register first. Aborting.`);
    process.exit(1);
  }
  if (root.referredByUserId) {
    console.error(`${root.userId} has a sponsor (${root.referredByUserId}), so it is not the root. Aborting.`);
    process.exit(1);
  }
  const rootUserId = root.userId;

  // ROOT itself is excluded by userId, never by shape: it is the one record that must KEEP a
  // null parent, and matching on null alone would re-parent it into a self-referencing cycle.
  const candidates = await User.find({
    referredByUserId: null,
    userId: { $ne: rootUserId },
  }).sort({ createdAt: 1 });

  console.log(`ROOT        ${rootUserId} (${root.referralCode}) owned by ${rootAdminEoa}`);
  console.log(`Candidates  ${candidates.length} legacy user(s) with no parent\n`);

  if (candidates.length === 0) {
    console.log("Nothing to do.");
  } else {
    for (const u of candidates) {
      console.log(`  ${u.userId}  ${u.referralCode}  ${u.externalEOA}  joined ${(u as unknown as { createdAt: Date }).createdAt.toISOString()}`);
    }

    if (!apply) {
      console.log(`\nDRY RUN — nothing was written. Re-run with --apply to re-parent these ${candidates.length} user(s) to ${rootUserId}.`);
    } else {
      // referredByUserId is `immutable: true`, so Mongoose strips it from ordinary updates and
      // the write would silently do nothing. Going through the raw collection is deliberate:
      // this is the one sanctioned exception, and it is why the script is operator-run.
      const result = await User.collection.updateMany(
        { referredByUserId: null, userId: { $ne: rootUserId } },
        { $set: { referredByUserId: rootUserId, updatedAt: new Date() } },
      );
      console.log(`\nAPPLIED — ${result.modifiedCount} user(s) re-parented to ${rootUserId}.`);

      const remaining = await User.countDocuments({ referredByUserId: null, userId: { $ne: rootUserId } });
      if (remaining !== 0) {
        console.error(`WARNING: ${remaining} parentless user(s) remain. Re-run and investigate.`);
        process.exitCode = 1;
      } else {
        console.log("Verified: ROOT is now the only user without a parent.");
      }
    }
  }
} finally {
  await mongoose.disconnect().catch(() => {});
}
