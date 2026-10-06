import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import mongoose from "mongoose";
import type { WalletReader } from "../lib/chain.js";

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

// Only to satisfy config validation; never connected to. The chain is faked below, so no
// RPC endpoint is contacted either.
process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/unused-by-tests";
process.env.PORT ??= "3001";
process.env.DAO_REVENUE_DISTRIBUTOR_ADDRESS ??= "0xc152dF6448FB68702B661C4aE210E41f5E76931E";
process.env.WITHDRAWAL_ADDRESS ??= "0x882db912586869315C2720dE72224d79B9D99Ea1";
process.env.TREASURY_ADDRESS ??= "0x114fe8e3414bc49A24C6efd9E702cD66B9A80251";
process.env.JWT_SECRET ??= "test-secret-at-least-thirty-two-characters-long";
process.env.JWT_EXPIRES_IN_SECONDS ??= "86400";
process.env.CHAIN_ID ??= "80002";
process.env.CHALLENGE_TTL_SECONDS ??= "300";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.RPC_URL ??= "http://127.0.0.1:8545";
process.env.USER_WALLET_FACTORY_ADDRESS ??= "0xC7ea9304a56833f0FBAa98bf8Cc78B0ccb7D6Be8";
process.env.ROOT_ADMIN_EOA ??= "0x9999999999999999999999999999999999999999";

const { syncWallet } = await import("./service.js");
const { User } = await import("../models/User.js");
const { HttpError } = await import("../lib/errors.js");
const { ZERO_ADDRESS } = await import("../lib/chain.js");

const EOA = "0xd0b78357bf0c537ecb5b5ce7814b5a1689ee81a8";
const WALLET = "0x7c2d6b5f65c820c1cb014313ab17419420d3e3a7";
const OTHER_WALLET = "0x1111111111111111111111111111111111111111";

/** Fake chain. Keeps these tests offline and lets each case state the exact chain state. */
function reader(walletOf: string, ownerOf = EOA): WalletReader {
  return {
    async walletOf() {
      return walletOf;
    },
    async ownerOf() {
      return ownerOf;
    },
  };
}

const failing: WalletReader = {
  async walletOf() {
    throw new Error("ECONNREFUSED");
  },
  async ownerOf() {
    throw new Error("ECONNREFUSED");
  },
};

const codeIs = (code: string) => (error: unknown) =>
  error instanceof HttpError && error.code === code;

let connected = false;

before(async () => {
  if (!TEST_URI) {
    console.log("SKIP: MONGODB_TEST_URI not set — wallet integration tests skipped");
    return;
  }
  await mongoose.connect(assertDisposable(TEST_URI), { serverSelectionTimeoutMS: 8000 });
  await User.init();
  connected = true;
});

after(async () => {
  if (connected) await mongoose.disconnect();
});

beforeEach(async () => {
  if (connected) await User.deleteMany({});
});

const makeUser = (extra: Record<string, unknown> = {}) =>
  User.create({ userId: "usr_1", externalEOA: EOA, referralCode: "ACF-AAAAAAAA", ...extra });

describe("syncWallet", () => {
  it("1. no wallet on chain -> hasWallet false, nothing persisted", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser();

    const result = await syncWallet("usr_1", reader(ZERO_ADDRESS));

    assert.equal(result.hasWallet, false);
    assert.equal(result.user.smartWalletAddress, null);
    const raw = await mongoose.connection.collection("users").findOne({ userId: "usr_1" });
    assert.ok(!("smartWalletAddress" in raw!), "field must stay absent, not become null");
  });

  it("2. DB absent + wallet on chain -> persisted", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser();

    const result = await syncWallet("usr_1", reader(WALLET));

    assert.equal(result.hasWallet, true);
    assert.equal(result.user.smartWalletAddress, WALLET);
    assert.equal((await User.findOne({ userId: "usr_1" }))!.smartWalletAddress, WALLET);
  });

  it("3. already persisted -> idempotent", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser({ smartWalletAddress: WALLET });

    const first = await syncWallet("usr_1", reader(WALLET));
    const second = await syncWallet("usr_1", reader(WALLET));

    assert.equal(first.user.smartWalletAddress, WALLET);
    assert.equal(second.user.smartWalletAddress, WALLET);
    assert.equal(await User.countDocuments({ smartWalletAddress: WALLET }), 1);
  });

  it("4. owner() mismatch -> not persisted", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser();

    // Wallet resolves, but it is owned by someone else: wrong factory or wrong chain.
    await assert.rejects(
      syncWallet("usr_1", reader(WALLET, OTHER_WALLET)),
      codeIs("WALLET_OWNER_MISMATCH"),
    );

    const raw = await mongoose.connection.collection("users").findOne({ userId: "usr_1" });
    assert.ok(!("smartWalletAddress" in raw!), "must not bind a wallet it cannot control");
  });

  it("5. DB has a wallet but chain reports zero -> conflict, never cleared", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser({ smartWalletAddress: WALLET });

    await assert.rejects(
      syncWallet("usr_1", reader(ZERO_ADDRESS)),
      codeIs("WALLET_STATE_CONFLICT"),
    );

    assert.equal((await User.findOne({ userId: "usr_1" }))!.smartWalletAddress, WALLET);
  });

  it("6. DB wallet differs from chain wallet -> conflict, never overwritten", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser({ smartWalletAddress: OTHER_WALLET });

    await assert.rejects(
      syncWallet("usr_1", reader(WALLET)),
      codeIs("WALLET_ADDRESS_CONFLICT"),
    );

    assert.equal((await User.findOne({ userId: "usr_1" }))!.smartWalletAddress, OTHER_WALLET);
  });

  it("resolves the EOA from the database record, never from input", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser();

    // syncWallet's only input is a userId; the EOA it queries comes from the stored record.
    let queried: string | undefined;
    await syncWallet("usr_1", {
      async walletOf(eoa) {
        queried = eoa;
        return ZERO_ADDRESS;
      },
      async ownerOf() {
        return EOA;
      },
    });

    assert.equal(queried, EOA);
  });

  it("an unreachable RPC never writes a conclusion", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await makeUser();

    await assert.rejects(syncWallet("usr_1", failing), codeIs("CHAIN_UNAVAILABLE"));

    const raw = await mongoose.connection.collection("users").findOne({ userId: "usr_1" });
    assert.ok(!("smartWalletAddress" in raw!));
  });

  it("rejects a userId with no user", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await assert.rejects(syncWallet("usr_missing", reader(WALLET)), codeIs("UNAUTHORIZED"));
  });
});
