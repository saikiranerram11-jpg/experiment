import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assertInvariant, canonicalJson, canonicalOrder, combined, leafHash, manifestHash,
  publishedTotal, SettlementInvariantError,
} from "./policy.ts";
import { buildSettlementTree } from "./merkle.ts";

const E18 = 10n ** 18n;
/** The settlement that is already finalized on Amoy, used as a fixture. */
const LEGACY = {
  smartWalletAddress: "0x7c2d6b5f65c820c1cb014313ab17419420d3e3a7",
  cumulativeSelfACF: 5n * E18,
  cumulativeTeamACF: 0n,
};
const LEGACY_ROOT = "0x0f5e4a1e0d7971af062097dabe3923616dd4d0efb16ef53a43842fa9c41febb9";

const leaf = (n: number, self: bigint, team: bigint) => ({
  smartWalletAddress: `0x${String(n).repeat(40)}`,
  cumulativeSelfACF: self,
  cumulativeTeamACF: team,
});

describe("leaf format mirrors the deployed contract", () => {
  it("1. reproduces the LIVE legacy root from its single leaf", () => {
    // ACFWithdrawal.claim hashes keccak256(bytes.concat(keccak256(abi.encode(...)))).
    assert.equal(leafHash(LEGACY).toLowerCase(), LEGACY_ROOT);
  });

  it("2. a single-leaf tree's root IS the leaf, with an empty proof", () => {
    const t = buildSettlementTree([LEGACY]);
    assert.equal(t.root, LEGACY_ROOT);
    assert.deepEqual(t.proofFor(LEGACY.smartWalletAddress), []);
  });

  it("3. the leaf identity is the smart wallet, not an EOA", () => {
    const wallet = leafHash(LEGACY);
    const eoa = leafHash({ ...LEGACY, smartWalletAddress: `0x${"a".repeat(40)}` });
    assert.notEqual(wallet, eoa);
    assert.equal(wallet.toLowerCase(), LEGACY_ROOT, "only the wallet reproduces the live root");
  });

  it("4. changing Self changes the leaf", () => {
    assert.notEqual(leafHash({ ...LEGACY, cumulativeSelfACF: 5n * E18 + 1n }), leafHash(LEGACY));
  });

  it("5. changing Team changes the leaf", () => {
    assert.notEqual(leafHash({ ...LEGACY, cumulativeTeamACF: 1n }), leafHash(LEGACY));
  });

  it("6. case in the address does not change the leaf", () => {
    assert.equal(
      leafHash({ ...LEGACY, smartWalletAddress: LEGACY.smartWalletAddress.toUpperCase().replace("0X", "0x") }),
      leafHash(LEGACY),
    );
  });
});

describe("tree construction", () => {
  const many = [leaf(1, 1n * E18, 0n), leaf(2, 2n * E18, 1n * E18), leaf(3, 0n, 5n * E18)];

  it("7. the root is independent of input order", () => {
    assert.equal(buildSettlementTree(many).root, buildSettlementTree([...many].reverse()).root);
  });

  it("8. canonical order sorts by lowercase wallet", () => {
    const sorted = canonicalOrder([...many].reverse());
    assert.deepEqual(
      sorted.map((l) => l.smartWalletAddress),
      [...many].map((l) => l.smartWalletAddress),
    );
  });

  it("9. the published total is the sum over leaves", () => {
    assert.equal(publishedTotal(many), 9n * E18);
    assert.equal(buildSettlementTree(many).publishedCumulativeTotalACF, 9n * E18);
    assert.equal(combined(many[1]!), 3n * E18);
  });

  it("10. every leaf gets a verifiable proof of the expected depth", () => {
    const t = buildSettlementTree(many);
    assert.equal(t.leafCount, 3);
    for (const l of many) assert.ok(t.proofFor(l.smartWalletAddress).length >= 1);
  });

  it("11. a duplicate wallet is rejected", () => {
    assert.throws(() => buildSettlementTree([leaf(1, 1n, 0n), leaf(1, 2n, 0n)]),
      (e: unknown) => e instanceof SettlementInvariantError && /Duplicate wallet/.test((e as Error).message));
  });

  it("12. an empty leaf set is rejected", () => {
    assert.throws(() => buildSettlementTree([]), /no leaves/);
  });

  it("13. an unknown wallet has no proof", () => {
    assert.throws(() => buildSettlementTree(many).proofFor(`0x${"9".repeat(40)}`), /no leaf/);
  });
});

describe("manifest canonicalisation", () => {
  it("14. the hash is independent of key order and whitespace", () => {
    const a = { chainId: 80002, checkpointId: 5, root: "0xab" };
    const b = { root: "0xab", checkpointId: 5, chainId: 80002 };
    assert.equal(manifestHash(a), manifestHash(b));
  });

  it("15. integers serialise as decimal strings, so no float can creep in", () => {
    assert.equal(canonicalJson({ n: 5, s: "5", b: 7n }), '{"b":"7","n":"5","s":"5"}');
  });

  it("16. a changed value changes the hash", () => {
    assert.notEqual(manifestHash({ a: 1 }), manifestHash({ a: 2 }));
  });

  it("17. a non-integer number is refused rather than silently rounded", () => {
    assert.throws(() => canonicalJson({ n: 1.5 }), /non-integer/);
  });

  it("18. assertInvariant reports the financial reason", () => {
    assert.throws(() => assertInvariant(false, "because money"),
      (e: unknown) => e instanceof SettlementInvariantError && /because money/.test((e as Error).message));
  });
});
