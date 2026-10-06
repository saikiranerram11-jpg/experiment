import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  acfToUsd6, assertInvariant, batchIndexOf, canonicalJson, compareByWallet,
  daoRevenuePoolUSD6, DAORevenueInvariantError, isEligible, membershipLabel,
  memberRevenueUSD6, PERCENTAGE_DENOMINATOR, systemSelfRewardACF, usd6ToAcf,
} from "./policy.ts";

const E18 = 10n ** 18n;
const USD = 1_000_000n;
/** $2.00 per whole ACF, scaled 1e18, matching the spec's worked fixture. */
const P2 = 2n * E18;
const RATE_5 = 50_000n;

describe("denominator", () => {
  it("1. shares ACFDAO's PERCENTAGE_DENOMINATOR, so 50_000 really is 5%", () => {
    assert.equal(PERCENTAGE_DENOMINATOR, 1_000_000n);
    assert.equal((RATE_5 * 100n) / PERCENTAGE_DENOMINATOR, 5n);
  });
});

describe("system revenue", () => {
  it("2. is DIRECT+BOND plus DAO staking reward", () => {
    assert.equal(systemSelfRewardACF(18_000n * E18, 2_000n * E18), 20_000n * E18);
  });

  it("3. is zero when the epoch generated nothing", () => {
    assert.equal(systemSelfRewardACF(0n, 0n), 0n);
  });

  it("4. refuses a negative component rather than netting it off", () => {
    assert.throws(() => systemSelfRewardACF(-1n, 0n), DAORevenueInvariantError);
    assert.throws(() => systemSelfRewardACF(0n, -1n), DAORevenueInvariantError);
  });
});

describe("USD6 conversion", () => {
  it("5. converts 20,000 ACF at $2 to $40,000", () => {
    assert.equal(acfToUsd6(20_000n * E18, P2), 40_000n * USD);
  });

  it("6. inverts exactly for a representable amount", () => {
    assert.equal(usd6ToAcf(40_000n * USD, P2), 20_000n * E18);
  });

  it("7. floors rather than rounding, in both directions", () => {
    // 1 wei at $2 is 2e-18 dollars; far below one USD base unit.
    assert.equal(acfToUsd6(1n, P2), 0n);
    // 1 USD base unit at $2 is 0.5e-6 ACF = 5e11 wei; exact here, so use a prime price.
    const odd = 3n * E18;
    const acf = usd6ToAcf(1n, odd);
    assert.ok(acf * odd <= 1n * 10n ** 30n, "never rounds up past the input");
  });

  it("8. rejects a zero or negative price instead of dividing by it", () => {
    assert.throws(() => acfToUsd6(1n, 0n), DAORevenueInvariantError);
    assert.throws(() => usd6ToAcf(1n, 0n), DAORevenueInvariantError);
    assert.throws(() => acfToUsd6(1n, -1n), DAORevenueInvariantError);
  });

  it("9. uses no floating point anywhere — a huge amount stays exact", () => {
    const huge = 10_000_000n * E18;                 // 1e25, far beyond 2^53
    const usd = acfToUsd6(huge, P2);
    assert.equal(usd, 20_000_000n * USD);
    assert.equal(usd6ToAcf(usd, P2), huge);
  });
});

describe("the 5% shared pool", () => {
  it("10. takes exactly 5% of $40,000", () => {
    assert.equal(daoRevenuePoolUSD6(40_000n * USD, RATE_5), 2_000n * USD);
  });

  it("11. is zero when system revenue is zero", () => {
    assert.equal(daoRevenuePoolUSD6(0n, RATE_5), 0n);
  });

  it("12. honours a DIFFERENT historical rate rather than assuming 5%", () => {
    assert.equal(daoRevenuePoolUSD6(40_000n * USD, 30_000n), 1_200n * USD);  // 3%
    assert.equal(daoRevenuePoolUSD6(40_000n * USD, 100_000n), 4_000n * USD); // 10%
  });

  it("13. floors, so the pool never exceeds its share", () => {
    // 19 USD base units at 5% = 0.95 -> 0
    assert.equal(daoRevenuePoolUSD6(19n, RATE_5), 0n);
    assert.equal(daoRevenuePoolUSD6(20n, RATE_5), 1n);
  });

  it("14. rejects a rate above the denominator", () => {
    assert.throws(
      () => daoRevenuePoolUSD6(USD, PERCENTAGE_DENOMINATOR + 1n), DAORevenueInvariantError,
    );
  });
});

describe("member share", () => {
  it("15. THE SPEC FIXTURE — Alice's $5,000 of $100,000 earns $100", () => {
    const pool = 2_000n * USD;
    const share = memberRevenueUSD6(pool, 5_000n * USD, 100_000n * USD);
    assert.equal(share, 100n * USD);
    // At $2, that is 50 ACF.
    assert.equal(usd6ToAcf(share, P2), 50n * E18);
  });

  it("16. a sole member takes the whole pool", () => {
    assert.equal(memberRevenueUSD6(2_000n * USD, 5_000n * USD, 5_000n * USD), 2_000n * USD);
  });

  it("17. weight is proportional to recorded USDT, not member count", () => {
    const pool = 1_000n * USD;
    const total = 30_000n * USD;
    const big = memberRevenueUSD6(pool, 20_000n * USD, total);
    const small = memberRevenueUSD6(pool, 10_000n * USD, total);
    assert.equal(big, small * 2n, "twice the contribution, twice the share");
    // 2/3 and 1/3 of 1,000 USD are not representable, so flooring keeps 1 base unit back.
    // The sum must never EXCEED the pool; falling short by dust is the designed behaviour.
    assert.ok(big + small <= pool);
    assert.equal(pool - (big + small), 1n);
  });

  it("18. floors each share, so the sum can fall short of the pool", () => {
    const pool = 100n;                      // 100 USD base units
    const total = 3n;
    const shares = [1n, 1n, 1n].map((w) => memberRevenueUSD6(pool, w, total));
    assert.deepEqual(shares, [33n, 33n, 33n]);
    assert.equal(shares.reduce((a, b) => a + b, 0n), 99n);
    assert.equal(pool - 99n, 1n, "1 base unit of dust, never funded");
  });

  it("19. refuses a zero denominator rather than dividing by it", () => {
    assert.throws(() => memberRevenueUSD6(100n, 0n, 0n), DAORevenueInvariantError);
  });

  it("20. refuses a weight above the total", () => {
    assert.throws(() => memberRevenueUSD6(100n, 11n, 10n), DAORevenueInvariantError);
  });
});

describe("eligibility and labels", () => {
  const SILVER = 5_000n * USD;
  const GOLD = 25_000n * USD;

  it("21. exactly the Silver minimum qualifies", () => {
    assert.equal(isEligible(SILVER, SILVER), true);
  });

  it("22. one USDT base unit below does not", () => {
    assert.equal(isEligible(SILVER - 1n, SILVER), false);
  });

  it("23. Gold qualifies through the same single gate", () => {
    assert.equal(isEligible(GOLD, SILVER), true);
  });

  it("24. the label is cosmetic and carries no multiplier", () => {
    assert.equal(membershipLabel(SILVER - 1n, SILVER, GOLD), "NONE");
    assert.equal(membershipLabel(SILVER, SILVER, GOLD), "SILVER");
    assert.equal(membershipLabel(GOLD, SILVER, GOLD), "GOLD");
    // A Gold member with 5x the contribution gets exactly 5x the share — no bonus.
    const pool = 60_000n * USD;
    const total = 30_000n * USD;
    const gold = memberRevenueUSD6(pool, 25_000n * USD, total);
    const silver = memberRevenueUSD6(pool, 5_000n * USD, total);
    assert.equal(gold, silver * 5n);
  });
});

describe("determinism", () => {
  it("25. orders members by lowercase wallet, ascending", () => {
    const members = [
      { smartWalletAddress: "0xCC" }, { smartWalletAddress: "0xaa" },
      { smartWalletAddress: "0xBb" },
    ];
    assert.deepEqual(
      [...members].sort(compareByWallet).map((m) => m.smartWalletAddress),
      ["0xaa", "0xBb", "0xCC"],
    );
  });

  it("26. the order is independent of input order", () => {
    const a = [{ smartWalletAddress: "0x01" }, { smartWalletAddress: "0x02" }];
    assert.deepEqual(
      [...a].sort(compareByWallet), [...a].reverse().sort(compareByWallet),
    );
  });

  it("27. batch index groups by configured size", () => {
    assert.equal(batchIndexOf(0, 50), 0);
    assert.equal(batchIndexOf(49, 50), 0);
    assert.equal(batchIndexOf(50, 50), 1);
    assert.equal(batchIndexOf(100, 50), 2);
  });

  it("28. a non-positive batch size is refused", () => {
    assert.throws(() => batchIndexOf(0, 0), DAORevenueInvariantError);
    assert.throws(() => batchIndexOf(0, -1), DAORevenueInvariantError);
  });
});

describe("manifest canonicalisation", () => {
  it("29. is independent of key order", () => {
    assert.equal(
      canonicalJson({ b: 1, a: 2 }), canonicalJson({ a: 2, b: 1 }),
    );
  });

  it("30. preserves array order, which batches depend on", () => {
    assert.notEqual(canonicalJson({ x: [1, 2] }), canonicalJson({ x: [2, 1] }));
  });

  it("31. serialises integers as decimal strings so no float can appear", () => {
    assert.equal(canonicalJson({ n: 5, b: 7n, s: "5" }), '{"b":"7","n":"5","s":"5"}');
  });

  it("32. refuses a non-integer rather than rounding it", () => {
    assert.throws(() => canonicalJson({ n: 1.5 }), DAORevenueInvariantError);
  });

  it("33. drops mongo bookkeeping fields", () => {
    assert.equal(canonicalJson({ a: 1, _id: "x", __v: 0 }), '{"a":"1"}');
  });

  it("34. assertInvariant reports the financial reason", () => {
    assert.throws(
      () => assertInvariant(false, "because money"),
      (e: unknown) => e instanceof DAORevenueInvariantError && /because money/.test((e as Error).message),
    );
  });
});
