/**
 * Backfills on-chain wallet onboarding facts for users recorded before they were captured.
 *
 * Phase 2 counts a user as an onboarded direct from `smartWalletCreatedAt`, which sets their
 * referrer's Level unlock depth and Rank direct requirement. So the value is taken only from
 * `UserWalletFactory.WalletCreated` — never registration time, never the time this script runs.
 * A user whose event cannot be established is reported and left alone rather than dated by guess.
 *
 * Idempotent: writes only where the field is absent, and each write is guarded on that absence,
 * so a second run is a no-op and concurrent runs cannot disagree.
 *
 *   npm run backfill:wallet-creation          # report only
 *   npm run backfill:wallet-creation -- --write
 */
import mongoose from "mongoose";
import { createPublicClient, http, getAddress } from "viem";
import { config } from "../src/config.js";
import { connectDatabase } from "../src/db.js";
import { User } from "../src/models/User.js";
import {
  resolveWalletCreation,
  WalletCreationUnverifiedError,
} from "../src/wallet/onboarding.js";

const write = process.argv.includes("--write");

async function main(): Promise<void> {
  await connectDatabase();
  const client = createPublicClient({ transport: http(config.rpcUrl) });
  const factory = getAddress(config.userWalletFactoryAddress);
  const head = Number(await client.getBlockNumber());

  // Only wallets that exist but are undated. Users with no wallet have nothing to backfill, and
  // users already dated are immutable.
  const pending = await User.find(
    {
      smartWalletAddress: { $type: "string" },
      smartWalletCreatedAt: { $exists: false },
    },
    { userId: 1, externalEOA: 1, smartWalletAddress: 1 },
  ).lean();

  console.log(`factory    ${factory}`);
  console.log(`head block ${head}`);
  console.log(`undated    ${pending.length} wallet(s)`);
  console.log(write ? "mode       WRITE\n" : "mode       REPORT ONLY (pass --write to persist)\n");

  let resolved = 0;
  let unverified = 0;

  for (const user of pending) {
    const eoa = getAddress(user.externalEOA);
    const wallet = getAddress(user.smartWalletAddress as string);
    try {
      const creation = await resolveWalletCreation({
        client: client as never,
        factoryAddress: factory,
        eoa,
        wallet,
        headBlock: head,
      });
      const at = new Date(creation.timestamp * 1000);
      console.log(`${user.userId}  block ${creation.blockNumber}  ${at.toISOString()}`);
      console.log(`  tx ${creation.txHash}`);

      if (write) {
        const result = await User.updateOne(
          { userId: user.userId, smartWalletCreatedAt: { $exists: false } },
          {
            $set: {
              smartWalletCreatedAt: at,
              smartWalletCreatedBlockNumber: creation.blockNumber,
              smartWalletCreatedTxHash: creation.txHash.toLowerCase(),
            },
          },
        );
        console.log(`  ${result.modifiedCount === 1 ? "written" : "already dated by another run"}`);
      }
      resolved += 1;
    } catch (error) {
      unverified += 1;
      const why =
        error instanceof WalletCreationUnverifiedError
          ? error.message
          : `unexpected: ${String((error as Error).message)}`;
      console.error(`${user.userId}  UNVERIFIED — left undated`);
      console.error(`  ${why.slice(0, 220)}`);
    }
  }

  console.log(`\nresolved ${resolved}, unverified ${unverified}`);
  if (unverified > 0) {
    console.log(
      "Unverified users are NOT counted as onboarded directs. Investigate before settling an " +
        "epoch that depends on them.",
    );
  }
  await mongoose.disconnect();
  process.exitCode = unverified > 0 ? 1 : 0;
}

await main();
