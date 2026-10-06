import { getAddress } from "viem";
import { config } from "../config.js";
import { publicClient } from "../lib/chain.js";

/**
 * READ-ONLY settlement contract reads.
 *
 * Every function here is an eth_call. This module never signs: fundRewardEpoch and
 * finalizeEpoch move real Treasury assets and finalize a claim root, so they live exclusively in
 * settlement/executor.ts, which is the only settlement module that can reach a wallet client.
 */

const withdrawalViewAbi = [
  { type: "function", name: "latestCumulativeMerkleRoot", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "latestCumulativeTotalEntitlementACF", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalClaimedACF", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "latestEpochId", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "epochFinalized", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "alreadyClaimed", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "EPOCH_EXECUTOR_ROLE", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
] as const;

const treasuryViewAbi = [
  { type: "function", name: "rewardEpochFunded", stateMutability: "view", inputs: [{ type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "withdrawal", stateMutability: "view", inputs: [], outputs: [{ type: "address" }] },
  { type: "function", name: "EPOCH_EXECUTOR_ROLE", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  { type: "function", name: "hasRole", stateMutability: "view", inputs: [{ type: "bytes32" }, { type: "address" }], outputs: [{ type: "bool" }] },
] as const;

/** The RewardClaimed event, for validating a single receipt the frontend reports. */
export const rewardClaimedEventAbi = {
  type: "event",
  name: "RewardClaimed",
  inputs: [
    { name: "beneficiary", type: "address", indexed: true },
    { name: "cumulativeSelfACF", type: "uint256", indexed: false },
    { name: "cumulativeTeamACF", type: "uint256", indexed: false },
    { name: "claimedACF", type: "uint256", indexed: false },
    { name: "usdtFee", type: "uint256", indexed: false },
    { name: "claimFeePercentage", type: "uint256", indexed: false },
    { name: "priceE18", type: "uint256", indexed: false },
  ],
} as const;

/** Swap views the claim fee depends on, and the ERC-20 views the quote needs. */
const swapViewAbi = [
  { type: "function", name: "priceE18", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "claimFeePercentage", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const erc20ViewAbi = [
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "allowance", stateMutability: "view", inputs: [{ type: "address" }, { type: "address" }], outputs: [{ type: "uint256" }] },
] as const;

const WITHDRAWAL = () => getAddress(config.withdrawalAddress);
const SWAP = () => getAddress(config.acfSwapAddress);
const ACF_TOKEN = () => getAddress(config.acfTokenAddress);
const USDT_TOKEN = () => getAddress(config.mockUsdtAddress);
const TREASURY = () => getAddress(config.treasuryAddress);

export interface LiveSettlementState {
  root: string;
  cumulativeTotalEntitlementACF: bigint;
  totalClaimedACF: bigint;
  latestEpochId: number;
}

export interface SettlementChainReader {
  liveState(): Promise<LiveSettlementState>;
  epochFinalized(checkpointId: number): Promise<boolean>;
  rewardEpochFunded(checkpointId: number): Promise<boolean>;
  treasuryWithdrawal(): Promise<string>;
  alreadyClaimed(wallets: string[]): Promise<Map<string, bigint>>;
  blockNumber(): Promise<number>;
  /**
   * Whether an address may fund on the Treasury and finalize on the Withdrawal.
   *
   * Checked before either transaction, so a key lacking one of them cannot fund and then fail to
   * finalize — which would leave the Treasury debited against no published root.
   */
  executorRoles(address: string): Promise<{ treasury: boolean; withdrawal: boolean }>;
  chainId(): Promise<number>;
  /**
   * Everything the claim fee depends on, read in one go.
   *
   * Read together because the contract reads both in the same transaction: quoting a price from
   * one block and a fee band from another could produce a figure the claim never charges.
   */
  claimFeeInputs(): Promise<{ priceE18: bigint; percentageE6: bigint }>;
  /** Decimals of both tokens, which determine the contract's fee scaling. */
  tokenDecimals(): Promise<{ acf: number; usdt: number }>;
  /** The wallet's USDT position with respect to the Withdrawal contract. */
  usdtPosition(wallet: string): Promise<{ balance: bigint; allowance: bigint }>;
}

export const settlementChainReader: SettlementChainReader = {
  async liveState() {
    const [root, total, claimed, epochId] = await Promise.all([
      publicClient.readContract({ address: WITHDRAWAL(), abi: withdrawalViewAbi, functionName: "latestCumulativeMerkleRoot" }),
      publicClient.readContract({ address: WITHDRAWAL(), abi: withdrawalViewAbi, functionName: "latestCumulativeTotalEntitlementACF" }),
      publicClient.readContract({ address: WITHDRAWAL(), abi: withdrawalViewAbi, functionName: "totalClaimedACF" }),
      publicClient.readContract({ address: WITHDRAWAL(), abi: withdrawalViewAbi, functionName: "latestEpochId" }),
    ]);
    return {
      root: (root as string).toLowerCase(),
      cumulativeTotalEntitlementACF: total as bigint,
      totalClaimedACF: claimed as bigint,
      latestEpochId: Number(epochId),
    };
  },

  async epochFinalized(checkpointId) {
    return publicClient.readContract({
      address: WITHDRAWAL(), abi: withdrawalViewAbi, functionName: "epochFinalized",
      args: [BigInt(checkpointId)],
    });
  },

  async rewardEpochFunded(checkpointId) {
    return publicClient.readContract({
      address: TREASURY(), abi: treasuryViewAbi, functionName: "rewardEpochFunded",
      args: [BigInt(checkpointId)],
    });
  },

  async treasuryWithdrawal() {
    const a = await publicClient.readContract({
      address: TREASURY(), abi: treasuryViewAbi, functionName: "withdrawal",
    });
    return (a as string).toLowerCase();
  },

  /** Batched: one multicall rather than a round trip per wallet. */
  async alreadyClaimed(wallets) {
    if (wallets.length === 0) return new Map();
    const results = await publicClient.multicall({
      contracts: wallets.map((w) => ({
        address: WITHDRAWAL(), abi: withdrawalViewAbi,
        functionName: "alreadyClaimed" as const, args: [getAddress(w)] as const,
      })),
      allowFailure: true,
    });
    const out = new Map<string, bigint>();
    for (const [i, r] of results.entries()) {
      // A failed read is NOT zero: treating it as zero would un-retire claimed rewards.
      if (r.status !== "success") {
        throw new Error(`alreadyClaimed(${wallets[i]}) could not be read; refusing to reconcile.`);
      }
      out.set(wallets[i]!.toLowerCase(), r.result as bigint);
    }
    return out;
  },

  async blockNumber() {
    return Number(await publicClient.getBlockNumber());
  },

  async executorRoles(address) {
    const who = getAddress(address);
    const [treasuryRole, withdrawalRole] = await Promise.all([
      publicClient.readContract({ address: TREASURY(), abi: treasuryViewAbi, functionName: "EPOCH_EXECUTOR_ROLE" }),
      publicClient.readContract({ address: WITHDRAWAL(), abi: withdrawalViewAbi, functionName: "EPOCH_EXECUTOR_ROLE" }),
    ]);
    const [onTreasury, onWithdrawal] = await Promise.all([
      publicClient.readContract({
        address: TREASURY(), abi: treasuryViewAbi, functionName: "hasRole",
        args: [treasuryRole as `0x${string}`, who],
      }),
      publicClient.readContract({
        address: WITHDRAWAL(), abi: withdrawalViewAbi, functionName: "hasRole",
        args: [withdrawalRole as `0x${string}`, who],
      }),
    ]);
    return { treasury: onTreasury as boolean, withdrawal: onWithdrawal as boolean };
  },

  async chainId() {
    return publicClient.getChainId();
  },

  async claimFeeInputs() {
    const [priceE18, percentageE6] = await Promise.all([
      publicClient.readContract({ address: SWAP(), abi: swapViewAbi, functionName: "priceE18" }),
      publicClient.readContract({ address: SWAP(), abi: swapViewAbi, functionName: "claimFeePercentage" }),
    ]);
    return { priceE18: priceE18 as bigint, percentageE6: percentageE6 as bigint };
  },

  async tokenDecimals() {
    const [acf, usdt] = await Promise.all([
      publicClient.readContract({ address: ACF_TOKEN(), abi: erc20ViewAbi, functionName: "decimals" }),
      publicClient.readContract({ address: USDT_TOKEN(), abi: erc20ViewAbi, functionName: "decimals" }),
    ]);
    return { acf: Number(acf), usdt: Number(usdt) };
  },

  async usdtPosition(wallet) {
    const who = getAddress(wallet);
    const [balance, allowance] = await Promise.all([
      publicClient.readContract({
        address: USDT_TOKEN(), abi: erc20ViewAbi, functionName: "balanceOf", args: [who],
      }),
      publicClient.readContract({
        address: USDT_TOKEN(), abi: erc20ViewAbi, functionName: "allowance",
        args: [who, WITHDRAWAL()],
      }),
    ]);
    return { balance: balance as bigint, allowance: allowance as bigint };
  },
};
