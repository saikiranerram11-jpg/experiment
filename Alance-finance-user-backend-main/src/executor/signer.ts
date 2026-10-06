import { createWalletClient, http, type Chain, type WalletClient } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { polygon, polygonAmoy } from "viem/chains";

/**
 * The ONLY module in this repository that can construct a signer.
 *
 * It is deliberately not reachable from `config.ts`, `src/index.ts`, the public API or the
 * reward worker: nothing in those import paths touches this file, so no key material can be
 * pulled into a process that should not have it. The executor entry points import it explicitly.
 *
 * It reads its own environment rather than going through `config`, for the same reason — adding
 * a signer field to the shared config object would make every importer a potential key holder.
 *
 * ONE KEY, BOTH PHASES
 * --------------------
 * The same account signs Phase 3 settlement and Phase 4 DAO revenue, because the contracts gate
 * all four calls behind the same on-chain role:
 *
 *   Treasury.fundRewardEpoch        Withdrawal.finalizeEpoch          (Phase 3)
 *   Treasury.fundDAORevenueEpoch    Distributor.distributeBatch       (Phase 4)
 *
 * so the variable is named after that role rather than after either phase.
 *
 * PRODUCTION KEY CUSTODY
 * ----------------------
 * A raw private key in an environment variable is the WEAKEST acceptable option and is intended
 * for local development only. In production, prefer in order:
 *
 *   1. A cloud KMS/HSM signer, so the key never exists in process memory.
 *   2. A secret manager injecting the key at boot, never written to disk.
 *   3. An encrypted keystore whose password comes from a secret manager.
 *
 * Whichever is used, the executor account should hold EPOCH_EXECUTOR_ROLE and nothing else. The
 * key is never logged, never persisted, and never returned through any API.
 */

export interface EpochExecutorSigner {
  address: string;
  /** Submits a prepared call and returns its hash. Narrow on purpose — see executor.ts. */
  client: WalletClient;
  chain: Chain;
}

const CHAIN_REGISTRY: Record<number, Chain> = {
  [polygonAmoy.id]: polygonAmoy,
  [polygon.id]: polygon,
};

export class SignerUnavailableError extends Error {
  readonly code = "SIGNER_UNAVAILABLE";
  constructor(message: string) {
    super(message);
    this.name = "SignerUnavailableError";
  }
}

/**
 * Builds the executor signer from the environment.
 *
 * Throws rather than falling back to any other key: an executor that silently signed with the
 * admin key would defeat the entire separation this module exists to enforce.
 */
export function loadEpochExecutorSigner(): EpochExecutorSigner {
  // Named executor-only so it can never be confused with the deployer/admin key, and
  // deliberately absent from .env.example so no value is ever committed. The older
  // DAO-specific name is still accepted so an existing deployment keeps working.
  const raw = process.env.EPOCH_EXECUTOR_PRIVATE_KEY
    ?? process.env.DAO_REVENUE_EXECUTOR_PRIVATE_KEY;
  const rpcUrl = process.env.RPC_URL;
  const chainId = Number(process.env.CHAIN_ID);

  if (!raw) {
    throw new SignerUnavailableError(
      "EPOCH_EXECUTOR_PRIVATE_KEY is not set. The executor processes are the only ones that " +
        "sign; they will not fall back to the admin or any other key.",
    );
  }
  if (!/^0x[0-9a-fA-F]{64}$/.test(raw)) {
    throw new SignerUnavailableError(
      "EPOCH_EXECUTOR_PRIVATE_KEY must be a 0x-prefixed 32-byte hex key.",
    );
  }
  if (!rpcUrl) throw new SignerUnavailableError("RPC_URL is not set.");

  const chain = CHAIN_REGISTRY[chainId];
  if (!chain) {
    throw new SignerUnavailableError(`CHAIN_ID=${chainId} is not a supported network.`);
  }

  const account = privateKeyToAccount(raw as `0x${string}`);
  return {
    address: account.address.toLowerCase(),
    client: createWalletClient({ account, chain, transport: http(rpcUrl) }),
    chain,
  };
}

/** True when a signer could be built, without building one. Used by dry-run reporting. */
export function signerConfigured(): boolean {
  return Boolean(
    process.env.EPOCH_EXECUTOR_PRIVATE_KEY ?? process.env.DAO_REVENUE_EXECUTOR_PRIVATE_KEY,
  );
}
