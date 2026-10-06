import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import mongoose from "mongoose";

process.env.PORT ??= "3001";
process.env.DAO_REVENUE_DISTRIBUTOR_ADDRESS ??= "0xc152dF6448FB68702B661C4aE210E41f5E76931E";
/**
 * Integration tests connect ONLY to MONGODB_TEST_URI, never to MONGODB_URI. They call
 * deleteMany({}) between cases, so running them against the development or production
 * database would erase it. Unset => these tests skip.
 */
const TEST_URI = process.env.MONGODB_TEST_URI;

function assertDisposable(uri: string): string {
  const name = new URL(uri).pathname.replace(/^\//, "");
  if (!name || !/test/i.test(name)) {
    throw new Error(
      `MONGODB_TEST_URI must point at a database whose name contains "test" (got "${name || "<none>"}"). ` +
        "These tests delete all documents in it.",
    );
  }
  return uri;
}

// Only to satisfy config validation when a module imports config.ts; never connected to.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/unused-by-tests";
process.env.JWT_SECRET ??= "test-secret-at-least-thirty-two-characters-long";
process.env.JWT_EXPIRES_IN_SECONDS ??= "86400";
process.env.CHAIN_ID ??= "80002";
process.env.CHALLENGE_TTL_SECONDS ??= "300";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.ROOT_ADMIN_EOA ??= "0x9999999999999999999999999999999999999999";

const { User } = await import("./User.js");
const { AuthChallenge } = await import("./AuthChallenge.js");

const A = "0xd0b78357bf0c537ecb5b5ce7814b5a1689ee81a8";
const B = "0x20a1bdf492501959c353ec973448c541110a2631";
const WALLET = "0xc7ea9304a56833f0fbaa98bf8cc78b0ccb7d6be8";

let connected = false;

before(async () => {
  if (!TEST_URI) {
    console.log("SKIP: MONGODB_TEST_URI not set — model integration tests skipped");
    return;
  }
  await mongoose.connect(assertDisposable(TEST_URI), { serverSelectionTimeoutMS: 8000 });
  await Promise.all([User.init(), AuthChallenge.init()]); // build declared indexes
  connected = true;
});

after(async () => {
  if (connected) await mongoose.disconnect();
});

beforeEach(async () => {
  if (connected) await Promise.all([User.deleteMany({}), AuthChallenge.deleteMany({})]);
});

describe("User model", () => {
  it("allows MANY users without a smartWalletAddress (partial unique index)", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await User.create({ userId: "usr_1", externalEOA: A, referralCode: "ACF-AAAAAAAA" });
    await User.create({ userId: "usr_2", externalEOA: B, referralCode: "ACF-BBBBBBBB" });
    assert.equal(await User.countDocuments({}), 2);
    // The path must be genuinely absent, not null, so the partial index never sees it.
    const raw = await mongoose.connection.collection("users").findOne({ userId: "usr_1" });
    assert.ok(!("smartWalletAddress" in raw!), "smartWalletAddress must be absent, not null");
  });

  it("rejects two users sharing the same smartWalletAddress", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await User.create({ userId: "usr_1", externalEOA: A, referralCode: "ACF-AAAAAAAA", smartWalletAddress: WALLET });
    await assert.rejects(
      User.create({ userId: "usr_2", externalEOA: B, referralCode: "ACF-BBBBBBBB", smartWalletAddress: WALLET }),
      (error: unknown) => (error as { code?: number }).code === 11000,
    );
  });

  it("accepts referredByUserId null as a valid root user", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const user = await User.create({ userId: "usr_1", externalEOA: A, referralCode: "ACF-AAAAAAAA" });
    assert.equal(user.referredByUserId, null);
  });

  it("refuses to change referredByUserId, externalEOA or referralCode after creation", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await User.create({ userId: "usr_1", externalEOA: A, referralCode: "ACF-AAAAAAAA", referredByUserId: "usr_root" });

    await User.findOneAndUpdate(
      { userId: "usr_1" },
      { $set: { referredByUserId: "usr_attacker", externalEOA: B, referralCode: "ACF-ZZZZZZZZ" } },
    );

    const after = await User.findOne({ userId: "usr_1" });
    assert.equal(after!.referredByUserId, "usr_root", "referredByUserId must be immutable");
    assert.equal(after!.externalEOA, A, "externalEOA must be immutable");
    assert.equal(after!.referralCode, "ACF-AAAAAAAA", "referralCode must be immutable");
  });

  it("enforces uniqueness on externalEOA and referralCode", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await User.create({ userId: "usr_1", externalEOA: A, referralCode: "ACF-AAAAAAAA" });
    await assert.rejects(User.create({ userId: "usr_2", externalEOA: A, referralCode: "ACF-BBBBBBBB" }));
    await assert.rejects(User.create({ userId: "usr_3", externalEOA: B, referralCode: "ACF-AAAAAAAA" }));
  });
});

describe("AuthChallenge model", () => {
  it("is strictly single-use: a second consume of the same nonce finds nothing", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await AuthChallenge.create({ externalEOA: A, nonce: "n1", message: "m", expiresAt: new Date(Date.now() + 60_000) });
    assert.ok(await AuthChallenge.findOneAndDelete({ externalEOA: A, nonce: "n1" }));
    assert.equal(await AuthChallenge.findOneAndDelete({ externalEOA: A, nonce: "n1" }), null);
  });

  it("keeps one pending challenge per address", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await AuthChallenge.create({ externalEOA: A, nonce: "n1", message: "m1", expiresAt: new Date(Date.now() + 60_000) });
    await AuthChallenge.findOneAndUpdate(
      { externalEOA: A },
      { externalEOA: A, nonce: "n2", message: "m2", expiresAt: new Date(Date.now() + 60_000) },
      { upsert: true },
    );
    assert.equal(await AuthChallenge.countDocuments({ externalEOA: A }), 1);
    assert.equal((await AuthChallenge.findOne({ externalEOA: A }))!.nonce, "n2");
  });
});
