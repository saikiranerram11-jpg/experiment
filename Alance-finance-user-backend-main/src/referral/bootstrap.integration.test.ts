import assert from "node:assert/strict";
import { after, before, beforeEach, describe, it } from "node:test";
import mongoose from "mongoose";
import { privateKeyToAccount } from "viem/accounts";

const TEST_URI = process.env.MONGODB_TEST_URI;
function assertDisposable(uri: string): string {
  const name = new URL(uri).pathname.replace(/^\//, "");
  if (!name || !/test/i.test(name)) throw new Error(`MONGODB_TEST_URI must name a test database (got "${name}").`);
  return uri;
}

// Well-known Hardhat keys. Never used for anything holding value.
const ADMIN = privateKeyToAccount("0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80");
const STRANGER = privateKeyToAccount("0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d");

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/unused-by-tests";
process.env.PORT ??= "3001";
process.env.DAO_REVENUE_DISTRIBUTOR_ADDRESS ??= "0xc152dF6448FB68702B661C4aE210E41f5E76931E";
process.env.JWT_SECRET ??= "test-secret-at-least-thirty-two-characters-long";
process.env.JWT_EXPIRES_IN_SECONDS ??= "86400";
process.env.CHAIN_ID ??= "80002";
process.env.CHALLENGE_TTL_SECONDS ??= "300";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.RPC_URL ??= "http://127.0.0.1:8545";
process.env.USER_WALLET_FACTORY_ADDRESS ??= "0xC7ea9304a56833f0FBAa98bf8Cc78B0ccb7D6Be8";
process.env.ACF_SWAP_ADDRESS ??= "0x16F2d748A5a4359d1948F261662dD9f0d5fEadDD";
process.env.ACF_STAKING_ADDRESS ??= "0x9eDbbf53f784450CC8Fd50730984Cb7D8DDF743d";
process.env.WITHDRAWAL_ADDRESS ??= "0x882db912586869315C2720dE72224d79B9D99Ea1";
process.env.TREASURY_ADDRESS ??= "0x114fe8e3414bc49A24C6efd9E702cD66B9A80251";
process.env.ACF_TOKEN_ADDRESS ??= "0x7AEB95CaE1e5442Fe1170555ae81280B763D3BF1";
process.env.ACF_BOND_ADDRESS ??= "0x3a97D05a088aDBB79936914F245c2E0bf7F511f2";
process.env.ACF_DAO_ADDRESS ??= "0x9cf32271E052Cbbc1D6C564B6fE6a86B6ED08E45";
process.env.MOCK_USDT_ADDRESS ??= "0x21ff9e803fc496e4db1c1a6c354690636b9fc330";
process.env.SWAP_CONFIRMATIONS ??= "1";
process.env.ROOT_ADMIN_EOA = ADMIN.address;   // the root is identified by WALLET
delete process.env.ROOT_REFERRER_USER_ID;

const { createChallenge, verifyAndAuthenticate } = await import("../auth/service.js");
const { assertReferralRoot, findRootUser, isRootAdminEoa, referralRootStatus } =
  await import("../lib/bootstrap.js");
const { User } = await import("../models/User.js");
const { HttpError } = await import("../lib/errors.js");

const codeIs = (c: string) => (e: unknown) => e instanceof HttpError && e.code === c;

type Account = typeof ADMIN;
async function challengeAndSign(account: Account) {
  const { message } = await createChallenge(account.address);
  return { externalEOA: account.address, signature: await account.signMessage({ message }) };
}

let connected = false;
before(async () => {
  if (!TEST_URI) { console.log("SKIP: MONGODB_TEST_URI not set — root tests skipped"); return; }
  await mongoose.connect(assertDisposable(TEST_URI), { serverSelectionTimeoutMS: 8000 });
  await User.init();
  connected = true;
});
after(async () => { if (connected) await mongoose.disconnect(); });
beforeEach(async () => {
  if (connected) {
    await Promise.all([
      User.deleteMany({}),
      mongoose.connection.collection("authchallenges").deleteMany({}),
    ]);
  }
});

describe("before the admin has registered", () => {
  it("1. the backend STARTS on an empty database", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    // The whole point of identifying the root by wallet: no chicken-and-egg, no restart.
    await assertReferralRoot();
    assert.equal(await referralRootStatus(), "awaiting-admin");
    assert.equal(await findRootUser(), null);
  });

  it("2. only the configured wallet is recognised as the admin", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    assert.equal(isRootAdminEoa(ADMIN.address.toLowerCase()), true);
    assert.equal(isRootAdminEoa(STRANGER.address.toLowerCase()), false);
  });

  it("3. any other wallet is refused, and no user is created", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await assert.rejects(
      verifyAndAuthenticate(await challengeAndSign(STRANGER)),
      codeIs("REFERRAL_ROOT_UNAVAILABLE"),
    );
    // Refused BEFORE any write: a half-created user is exactly the parentless record this prevents.
    assert.equal(await User.countDocuments({}), 0);
  });
});

describe("the admin registers through the normal flow", () => {
  it("4. becomes the root, with a normal userId, code and no wallet", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const result = await verifyAndAuthenticate(await challengeAndSign(ADMIN));

    assert.equal(result.isNewUser, true);
    assert.ok(result.user.userId.startsWith("usr_"));
    assert.equal(result.user.externalEOA, ADMIN.address.toLowerCase());
    assert.equal(result.user.referredByUserId, null);        // the one parentless user
    assert.ok(result.user.referralCode.startsWith("ACF-"));
    assert.equal(result.user.smartWalletAddress, null);      // a wallet is not needed to be root
  });

  it("5. registration opens IMMEDIATELY — no restart, no config change", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const admin = await verifyAndAuthenticate(await challengeAndSign(ADMIN));
    assert.equal(await referralRootStatus(), "registered");

    // The same stranger refused moments ago now registers and attaches to the admin.
    const stranger = await verifyAndAuthenticate(await challengeAndSign(STRANGER));
    assert.equal(stranger.user.referredByUserId, admin.user.userId);
  });

  it("6. a referral code supplied by the admin cannot give the root a sponsor", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    // A plausible accident: the admin opens the app through someone's invite link. The root
    // must still be parentless, or the tree has no top.
    const decoy = await User.create({
      userId: "usr_decoy", externalEOA: "0x3333333333333333333333333333333333333333",
      referralCode: "ACF-DECOY001", referredByUserId: "usr_decoy_parent",
    });

    const admin = await verifyAndAuthenticate({
      ...(await challengeAndSign(ADMIN)),
      referralCode: decoy.referralCode,
    });

    assert.equal(admin.user.referredByUserId, null);   // ignored, not honoured
    assert.equal((await findRootUser())!.userId, admin.user.userId);
  });

  it("7. the admin logging in again reuses the SAME user", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const first = await verifyAndAuthenticate(await challengeAndSign(ADMIN));
    const second = await verifyAndAuthenticate(await challengeAndSign(ADMIN));

    assert.equal(second.isNewUser, false);
    assert.equal(second.user.userId, first.user.userId);
    assert.equal(second.user.referralCode, first.user.referralCode);
    assert.equal(second.user.referredByUserId, null);
    assert.equal(await User.countDocuments({}), 1);
  });
});

describe("configuration safety", () => {
  it("8. changing ROOT_ADMIN_EOA after the tree exists refuses to start", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    // A root owned by some OTHER wallet: re-rooting would orphan every relationship.
    await User.create({
      userId: "usr_old_root", externalEOA: "0x4444444444444444444444444444444444444444",
      referralCode: "ACF-OLDROOT1", referredByUserId: null,
    });
    await assert.rejects(assertReferralRoot(), /would re-root the referral tree/);
  });

  it("9. several parentless users are reported as a forked tree", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    await verifyAndAuthenticate(await challengeAndSign(ADMIN));
    await User.create({
      userId: "usr_legacy", externalEOA: "0x5555555555555555555555555555555555555555",
      referralCode: "ACF-LEGACY01", referredByUserId: null,
    });
    await assert.rejects(assertReferralRoot(), /backfill-root-parent/);
  });
});

describe("normal operation", () => {
  it("10. no code attaches to root; a code selects its owner; returning users never move", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const admin = await verifyAndAuthenticate(await challengeAndSign(ADMIN));
    const stranger = await verifyAndAuthenticate(await challengeAndSign(STRANGER));
    assert.equal(stranger.user.referredByUserId, admin.user.userId);

    const third = privateKeyToAccount("0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a");
    const invited = await verifyAndAuthenticate({
      ...(await challengeAndSign(third)), referralCode: stranger.user.referralCode,
    });
    assert.equal(invited.user.referredByUserId, stranger.user.userId);

    const again = await verifyAndAuthenticate({
      ...(await challengeAndSign(third)), referralCode: admin.user.referralCode,
    });
    assert.equal(again.isNewUser, false);
    assert.equal(again.user.referredByUserId, stranger.user.userId);

    assert.equal(await User.countDocuments({ referredByUserId: null }), 1);
  });

  it("11. a later wallet sync does not touch the root's referral identity", async (t) => {
    if (!connected) return t.skip("no MONGODB_TEST_URI");
    const admin = await verifyAndAuthenticate(await challengeAndSign(ADMIN));

    await User.findOneAndUpdate(
      { userId: admin.user.userId, smartWalletAddress: { $exists: false } },
      { $set: { smartWalletAddress: "0x8888888888888888888888888888888888888888" } },
    );

    const after = await User.findOne({ userId: admin.user.userId });
    assert.equal(after!.smartWalletAddress, "0x8888888888888888888888888888888888888888");
    assert.equal(after!.referralCode, admin.user.referralCode);
    assert.equal(after!.referredByUserId, null);
    await assertReferralRoot();                 // still the valid root
    assert.equal((await findRootUser())!.userId, admin.user.userId);
  });
});
