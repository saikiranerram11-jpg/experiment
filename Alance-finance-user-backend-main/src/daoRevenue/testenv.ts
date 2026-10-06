/**
 * Environment bootstrap for the DAO revenue suites.
 *
 * config.ts reads process.env once at import time, so every value must be set before any module
 * that imports it loads. Kept beside the Phase 3 equivalent so the two cannot drift.
 */
export const TEST_ROOT_EOA = "0x9999999999999999999999999999999999999999";
export const TEST_STAKING = "0x9eDbbf53f784450CC8Fd50730984Cb7D8DDF743d";
export const TEST_DAO = "0x9cf32271E052Cbbc1D6C564B6fE6a86B6ED08E45";
export const TEST_DISTRIBUTOR = "0xc152dF6448FB68702B661C4aE210E41f5E76931E";
export const TEST_TREASURY = "0x114fe8e3414bc49A24C6efd9E702cD66B9A80251";
export const TEST_FACTORY = "0xC7ea9304a56833f0FBAa98bf8Cc78B0ccb7D6Be8";
export const TEST_ACF = "0x7AEB95CaE1e5442Fe1170555ae81280B763D3BF1";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/unused-by-tests";
process.env.PORT ??= "3001";
process.env.JWT_SECRET ??= "test-secret-at-least-thirty-two-characters-long";
process.env.JWT_EXPIRES_IN_SECONDS ??= "86400";
process.env.CHAIN_ID ??= "80002";
process.env.CHALLENGE_TTL_SECONDS ??= "300";
process.env.CORS_ORIGIN ??= "http://localhost:5173";
process.env.RPC_URL ??= "http://127.0.0.1:8545";
process.env.USER_WALLET_FACTORY_ADDRESS ??= TEST_FACTORY;
process.env.ACF_SWAP_ADDRESS ??= "0x16F2d748A5a4359d1948F261662dD9f0d5fEadDD";
process.env.ACF_STAKING_ADDRESS ??= TEST_STAKING;
process.env.ACF_TOKEN_ADDRESS ??= TEST_ACF;
process.env.ACF_BOND_ADDRESS ??= "0x3a97D05a088aDBB79936914F245c2E0bf7F511f2";
process.env.ACF_DAO_ADDRESS ??= TEST_DAO;
process.env.MOCK_USDT_ADDRESS ??= "0x21ff9e803fc496e4db1c1a6c354690636b9fc330";
process.env.SWAP_CONFIRMATIONS ??= "1";
process.env.ROOT_ADMIN_EOA ??= TEST_ROOT_EOA;
process.env.REWARD_ENGINE_ACTIVATION_EPOCH ??= "41000";
process.env.WITHDRAWAL_ADDRESS ??= "0x882db912586869315C2720dE72224d79B9D99Ea1";
process.env.TREASURY_ADDRESS ??= TEST_TREASURY;
process.env.DAO_REVENUE_DISTRIBUTOR_ADDRESS ??= TEST_DISTRIBUTOR;

export function assertDisposable(uri: string): string {
  const name = new URL(uri).pathname.replace(/^\//, "");
  if (!name || !/test/i.test(name)) {
    throw new Error(`MONGODB_TEST_URI must name a test database (got "${name}").`);
  }
  return uri;
}

const ZERO = "0x0000000000000000000000000000000000000000";

export interface FakeDAOChainOptions {
  /** Phase 3 checkpoints the chain reports as already funded. */
  standardFunded?: Set<number>;
  wallets?: Map<string, string>;
  funded?: Map<number, bigint>;
  distributed?: Map<number, bigint>;
  paid?: Map<string, boolean>;
  treasuryFunded?: Set<number>;
  treasuryBalance?: bigint;
  requiredReserve?: bigint;
  maxBatchSize?: number;
  payoutDestination?: string;
  roles?: { treasury: boolean; distributor: boolean };
  chainId?: number;
}

/** A fully controllable stand-in for every DAO revenue chain read. */
export function fakeDAOChain(o: FakeDAOChainOptions = {}) {
  const state = {
    wallets: o.wallets ?? new Map<string, string>(),
    funded: o.funded ?? new Map<number, bigint>(),
    distributed: o.distributed ?? new Map<number, bigint>(),
    paid: o.paid ?? new Map<string, boolean>(),
    treasuryFunded: o.treasuryFunded ?? new Set<number>(),
    treasuryBalance: o.treasuryBalance ?? 499_995n * 10n ** 18n,
    requiredReserve: o.requiredReserve ?? 10_783n * 10n ** 18n,
    maxBatchSize: o.maxBatchSize ?? 50,
    payoutDestination: (o.payoutDestination ?? TEST_DISTRIBUTOR).toLowerCase(),
    roles: o.roles ?? { treasury: true, distributor: true },
    standardFunded: o.standardFunded ?? new Set<number>(),
    chainId: o.chainId ?? 80002,
  };
  const paidKey = (epochId: number, eoa: string) => `${epochId}:${eoa.toLowerCase()}`;

  return {
    state,
    reader: {
      async distributorWiring() {
        return {
          acf: TEST_ACF.toLowerCase(),
          treasury: TEST_TREASURY.toLowerCase(),
          walletRegistry: TEST_FACTORY.toLowerCase(),
          maxBatchSize: state.maxBatchSize,
        };
      },
      async treasuryDaoPayoutDestination() { return state.payoutDestination; },
      async treasuryAcf() { return TEST_ACF.toLowerCase(); },
      async treasuryFunded(epochId: number) { return state.treasuryFunded.has(epochId); },
      async standardRewardEpochFunded(checkpointId: number) {
        return state.standardFunded.has(checkpointId);
      },
      async epochFundedAmount(epochId: number) { return state.funded.get(epochId) ?? 0n; },
      async epochDistributedAmount(epochId: number) { return state.distributed.get(epochId) ?? 0n; },
      async isPaid(epochId: number, eoas: string[]) {
        return new Map(eoas.map((e) => [
          e.toLowerCase(), state.paid.get(paidKey(epochId, e)) === true,
        ]));
      },
      async walletOf(eoas: string[]) {
        return new Map(eoas.map((e) => [
          e.toLowerCase(), state.wallets.get(e.toLowerCase()) ?? ZERO,
        ]));
      },
      async treasuryBalanceACF() { return state.treasuryBalance; },
      async requiredReserve() { return state.requiredReserve; },
      async executorRoles() { return state.roles; },
      async chainId() { return state.chainId; },
      async blockNumber() { return 1_000_000; },
      daoAddress() { return TEST_DAO.toLowerCase(); },
      distributorAddress() { return TEST_DISTRIBUTOR.toLowerCase(); },
    },
    /** Applies what a successful funding would do on chain. */
    fund(epochId: number, amount: bigint) {
      state.funded.set(epochId, amount);
      state.treasuryFunded.add(epochId);
      state.treasuryBalance -= amount;
    },
    /** Applies what a successful distributeBatch would do. */
    pay(epochId: number, eoa: string, amount: bigint) {
      state.paid.set(paidKey(epochId, eoa), true);
      state.distributed.set(epochId, (state.distributed.get(epochId) ?? 0n) + amount);
    },
  };
}
