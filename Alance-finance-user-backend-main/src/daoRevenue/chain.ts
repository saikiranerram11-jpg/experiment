import { getAddress } from "viem";
import { config } from "../config.js";
import { publicClient } from "../lib/chain.js";

/**
 * READ-ONLY DAO revenue contract reads.
 *
 * Every function here is an eth_call. The calculation worker and the public API import this
 * module; neither can sign. The two state-changing calls — Treasury.fundDAORevenueEpoch and
 * distributor.distributeBatch — live exclusively in executor.ts, which is the only module that
 * ever constructs a wallet client.
 */

const distributorViewAbi = [
  { type: "function", name: "acf", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "treasury", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "walletRegistry", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "MAX_BATCH_SIZE", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalReservedUndistributed", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "epochFundedAmount", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "epochDistributedAmount", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "isPaid", stateMutability: "view", inputs: [{ type: "uint256" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "EPOCH_EXECUTOR_ROLE", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

const treasuryViewAbi = [
  { type: "function", name: "daoRevenueEpochFunded", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] },
  // Phase 3's standard-reward funding mark. Read ONLY to size the liability DAO funding must
  // leave behind; Phase 4 never calls fundRewardEpoch.
  { type: "function", name: "rewardEpochFunded", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "daoPayoutDestination", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "requiredReserve", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "acf", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "EPOCH_EXECUTOR_ROLE", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
] as const;

const factoryViewAbi = [
  { type: "function", name: "walletOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "address" }] },
] as const;

const erc20ViewAbi = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

/** The two ACFDAO configuration events, the sole source of historical revenue config. */
export const revenueConfigUpdatedEventAbi = {
  type: "event",
  name: "RevenueConfigUpdated",
  inputs: [
    { name: "silverMinimumUSDT", type: "uint256", indexed: false },
    { name: "goldMinimumUSDT", type: "uint256", indexed: false },
    { name: "memberRevenuePercentage", type: "uint256", indexed: false },
    { name: "marketingPercentage", type: "uint256", indexed: false },
    { name: "executor", type: "address", indexed: true },
  ],
} as const;

export const revenueEnabledUpdatedEventAbi = {
  type: "event",
  name: "RevenueEnabledUpdated",
  inputs: [
    { name: "enabled", type: "bool", indexed: false },
    { name: "executor", type: "address", indexed: true },
  ],
} as const;

/** DAORevenuePaid, for reconciling what the distributor actually transferred. */
export const daoRevenuePaidEventAbi = {
  type: "event",
  name: "DAORevenuePaid",
  inputs: [
    { name: "epochId", type: "uint256", indexed: true },
    { name: "user", type: "address", indexed: true },
    { name: "wallet", type: "address", indexed: true },
    { name: "amount", type: "uint256", indexed: false },
    { name: "executor", type: "address", indexed: false },
  ],
} as const;

const dao = () => getAddress(config.acfDaoAddress);
const distributor = () => getAddress(config.daoRevenueDistributorAddress);
const treasury = () => getAddress(config.treasuryAddress);
const factory = () => getAddress(config.userWalletFactoryAddress);

export interface DistributorWiring {
  acf: string;
  treasury: string;
  walletRegistry: string;
  maxBatchSize: number;
}

export interface DAORevenueChainReader {
  /** Everything initialize() fixed, so a stale deployment is caught before any signing. */
  distributorWiring(): Promise<DistributorWiring>;
  treasuryDaoPayoutDestination(): Promise<string>;
  treasuryAcf(): Promise<string>;
  /** Treasury's own replay mark, independent of the distributor's. */
  treasuryFunded(epochId: number): Promise<boolean>;
  /**
   * Whether Phase 3 has already funded a standard-reward checkpoint.
   *
   * Read-only, and only to decide whether that checkpoint's obligation still has to be left in
   * the Treasury. Phase 4 has no code path that funds or finalizes a standard reward epoch.
   */
  standardRewardEpochFunded(checkpointId: number): Promise<boolean>;
  /** The exact amount the distributor recorded, or 0n if the epoch was never funded. */
  epochFundedAmount(epochId: number): Promise<bigint>;
  epochDistributedAmount(epochId: number): Promise<bigint>;
  /** Keyed by EXTERNAL EOA, matching distributeBatch's users[] argument. */
  isPaid(epochId: number, externalEOAs: string[]): Promise<Map<string, boolean>>;
  /** Registry resolution, EOA -> smart wallet. Zero address when none exists. */
  walletOf(externalEOAs: string[]): Promise<Map<string, string>>;
  treasuryBalanceACF(): Promise<bigint>;
  requiredReserve(): Promise<bigint>;
  /** Whether an address may fund (Treasury) and distribute (distributor). */
  executorRoles(address: string): Promise<{ treasury: boolean; distributor: boolean }>;
  chainId(): Promise<number>;
  blockNumber(): Promise<number>;
  daoAddress(): string;
  distributorAddress(): string;
}

export const daoRevenueChainReader: DAORevenueChainReader = {
  async distributorWiring() {
    const [acf, treasuryAddr, walletRegistry, maxBatchSize] = await Promise.all([
      publicClient.readContract({ address: distributor(), abi: distributorViewAbi, functionName: "acf" }),
      publicClient.readContract({ address: distributor(), abi: distributorViewAbi, functionName: "treasury" }),
      publicClient.readContract({ address: distributor(), abi: distributorViewAbi, functionName: "walletRegistry" }),
      publicClient.readContract({ address: distributor(), abi: distributorViewAbi, functionName: "MAX_BATCH_SIZE" }),
    ]);
    return {
      acf: String(acf).toLowerCase(),
      treasury: String(treasuryAddr).toLowerCase(),
      walletRegistry: String(walletRegistry).toLowerCase(),
      maxBatchSize: Number(maxBatchSize),
    };
  },

  async treasuryDaoPayoutDestination() {
    const value = await publicClient.readContract({
      address: treasury(), abi: treasuryViewAbi, functionName: "daoPayoutDestination",
    });
    return String(value).toLowerCase();
  },

  async treasuryAcf() {
    const value = await publicClient.readContract({
      address: treasury(), abi: treasuryViewAbi, functionName: "acf",
    });
    return String(value).toLowerCase();
  },

  async treasuryFunded(epochId) {
    return (await publicClient.readContract({
      address: treasury(), abi: treasuryViewAbi, functionName: "daoRevenueEpochFunded",
      args: [BigInt(epochId)],
    })) as boolean;
  },

  async standardRewardEpochFunded(checkpointId) {
    return (await publicClient.readContract({
      address: treasury(), abi: treasuryViewAbi, functionName: "rewardEpochFunded",
      args: [BigInt(checkpointId)],
    })) as boolean;
  },

  async epochFundedAmount(epochId) {
    return (await publicClient.readContract({
      address: distributor(), abi: distributorViewAbi, functionName: "epochFundedAmount",
      args: [BigInt(epochId)],
    })) as bigint;
  },

  async epochDistributedAmount(epochId) {
    return (await publicClient.readContract({
      address: distributor(), abi: distributorViewAbi, functionName: "epochDistributedAmount",
      args: [BigInt(epochId)],
    })) as bigint;
  },

  async isPaid(epochId, externalEOAs) {
    const entries = await Promise.all(
      externalEOAs.map(async (eoa) => {
        const paid = await publicClient.readContract({
          address: distributor(), abi: distributorViewAbi, functionName: "isPaid",
          args: [BigInt(epochId), getAddress(eoa)],
        });
        return [eoa.toLowerCase(), paid as boolean] as const;
      }),
    );
    return new Map(entries);
  },

  async walletOf(externalEOAs) {
    const entries = await Promise.all(
      externalEOAs.map(async (eoa) => {
        const wallet = await publicClient.readContract({
          address: factory(), abi: factoryViewAbi, functionName: "walletOf",
          args: [getAddress(eoa)],
        });
        return [eoa.toLowerCase(), String(wallet).toLowerCase()] as const;
      }),
    );
    return new Map(entries);
  },

  async treasuryBalanceACF() {
    return (await publicClient.readContract({
      address: getAddress(config.acfTokenAddress), abi: erc20ViewAbi, functionName: "balanceOf",
      args: [treasury()],
    })) as bigint;
  },

  async requiredReserve() {
    return (await publicClient.readContract({
      address: treasury(), abi: treasuryViewAbi, functionName: "requiredReserve",
    })) as bigint;
  },

  async executorRoles(address) {
    const who = getAddress(address);
    const [treasuryRole, distributorRole] = await Promise.all([
      publicClient.readContract({ address: treasury(), abi: treasuryViewAbi, functionName: "EPOCH_EXECUTOR_ROLE" }),
      publicClient.readContract({ address: distributor(), abi: distributorViewAbi, functionName: "EPOCH_EXECUTOR_ROLE" }),
    ]);
    const [onTreasury, onDistributor] = await Promise.all([
      publicClient.readContract({
        address: treasury(), abi: treasuryViewAbi, functionName: "hasRole",
        args: [treasuryRole as `0x${string}`, who],
      }),
      publicClient.readContract({
        address: distributor(), abi: distributorViewAbi, functionName: "hasRole",
        args: [distributorRole as `0x${string}`, who],
      }),
    ]);
    return { treasury: onTreasury as boolean, distributor: onDistributor as boolean };
  },

  async chainId() {
    return publicClient.getChainId();
  },

  async blockNumber() {
    return Number(await publicClient.getBlockNumber());
  },

  daoAddress() {
    return dao().toLowerCase();
  },

  distributorAddress() {
    return distributor().toLowerCase();
  },
};
