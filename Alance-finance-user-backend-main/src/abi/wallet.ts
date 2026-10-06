/**
 * Minimum ABI for wallet onboarding. Read-only: the backend never signs and never indexes,
 * so there is no `createWallet` and no event here. `walletOf` is the authoritative source of
 * a user's wallet; `owner` is the reverse check.
 */

export const userWalletFactoryReadAbi = [
  {
    type: "function",
    name: "walletOf",
    stateMutability: "view",
    inputs: [{ name: "user", type: "address" }],
    outputs: [{ type: "address" }],
  },
] as const;

export const userSmartWalletReadAbi = [
  {
    type: "function",
    name: "owner",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "address" }],
  },
] as const;
