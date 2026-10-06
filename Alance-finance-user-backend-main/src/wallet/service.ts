import { HttpError } from "../lib/errors.js";
import { normalizeEOA } from "../lib/address.js";
import { ZERO_ADDRESS, chainReader, type WalletReader } from "../lib/chain.js";
import type { WalletCreation } from "./onboarding.js";
import { User, type UserDocument } from "../models/User.js";
import { toUserResponse, type UserResponse } from "../auth/service.js";

export interface SyncResult {
  hasWallet: boolean;
  user: UserResponse;
}

/**
 * Resolves and stores a wallet's on-chain creation facts, returning the updated user.
 *
 * Returns null when the creation event cannot be established, leaving the fields absent. Phase 2
 * then withholds onboarded-direct qualification from this user, which is the conservative
 * outcome: an invented timestamp would change Level unlock depth and Rank for their referrer.
 */
async function recordCreationMetadata(
  userId: string,
  externalEOA: string,
  wallet: string,
  reader: WalletReader,
): Promise<UserDocument | null> {
  let creation: WalletCreation;
  try {
    creation = await reader.creationOf(externalEOA, wallet);
  } catch (error) {
    console.warn(
      `[wallet] creation event unresolved for ${userId} (${wallet}): ` +
        `${String((error as Error).message).slice(0, 200)}`,
    );
    return null;
  }

  // Only ever fills an absent value: these facts are immutable once known, and a second write
  // could only disagree with the first by being wrong.
  return User.findOneAndUpdate(
    { userId, smartWalletCreatedAt: { $exists: false } },
    {
      $set: {
        smartWalletCreatedAt: new Date(creation.timestamp * 1000),
        smartWalletCreatedBlockNumber: creation.blockNumber,
        smartWalletCreatedTxHash: creation.txHash.toLowerCase(),
      },
    },
    { new: true },
  );
}

/**
 * Resolves the authenticated user's UserSmartWallet from the chain and persists it.
 *
 * Nothing here reads the request body: the EOA comes from the database record the JWT
 * identifies, so a caller cannot nominate an address. The chain is the only source of truth —
 * a stored value is never overwritten or cleared on the strength of a disagreeing read.
 */
export async function syncWallet(
  userId: string,
  reader: WalletReader = chainReader,
): Promise<SyncResult> {
  const user = await User.findOne({ userId });
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "User no longer exists.");

  const externalEOA = normalizeEOA(user.externalEOA);
  const stored = user.smartWalletAddress ?? null;

  let onChain: string;
  try {
    onChain = await reader.walletOf(externalEOA);
  } catch {
    // A failed read is not evidence of absence; never write a conclusion from it.
    throw new HttpError(503, "CHAIN_UNAVAILABLE", "Could not reach the network. Try again.");
  }

  // ── No wallet on chain ────────────────────────────────────────────────────
  if (onChain === ZERO_ADDRESS) {
    if (stored) {
      // The chain is authoritative, but a stored address disappearing means the RPC is on the
      // wrong network or the record is corrupt. Report it; never clear the field.
      throw new HttpError(
        409,
        "WALLET_STATE_CONFLICT",
        "A wallet is recorded for this account but the network reports none.",
      );
    }
    return { hasWallet: false, user: toUserResponse(user) };
  }

  // ── Wallet exists: confirm it really belongs to this EOA ──────────────────
  let owner: string;
  try {
    owner = await reader.ownerOf(onChain);
  } catch {
    throw new HttpError(503, "CHAIN_UNAVAILABLE", "Could not reach the network. Try again.");
  }

  if (owner !== externalEOA) {
    // Reachable only through a wrong factory address or a wrong chain. Storing it would bind
    // this account to a wallet it cannot control.
    throw new HttpError(
      500,
      "WALLET_OWNER_MISMATCH",
      "The resolved wallet is not owned by this account.",
    );
  }

  if (stored && stored !== onChain) {
    throw new HttpError(
      409,
      "WALLET_ADDRESS_CONFLICT",
      "A different wallet is already recorded for this account.",
    );
  }

  if (stored === onChain) {
    // Idempotent for the wallet itself, but a row recorded before the onboarding metadata
    // existed — or one whose resolution failed at the time — is repaired here, from the chain.
    // Until it is, Phase 2 does not count this user as an onboarded direct.
    if (!user.smartWalletCreatedAt) {
      const repaired = await recordCreationMetadata(userId, externalEOA, onChain, reader);
      if (repaired) return { hasWallet: true, user: toUserResponse(repaired) };
    }
    return { hasWallet: true, user: toUserResponse(user) };
  }

  // Establish WHEN the wallet was created before recording that it exists. Phase 2 counts this
  // user as an onboarded direct from that moment, which sets their referrer's Level unlock depth
  // and Rank direct requirement, so the value has to be the chain's own.
  //
  // A failure here does not block the wallet: the user needs it to transact. It does withhold the
  // onboarding metadata, and without it they are not counted as an onboarded direct — a missing
  // fact stays missing. `scripts/backfillWalletCreation.ts` repairs such rows from the chain.
  let creation: WalletCreation | null = null;
  try {
    creation = await reader.creationOf(externalEOA, onChain);
  } catch (error) {
    // Not fatal: see recordCreationMetadata. The wallet is still recorded; qualification waits.
    console.warn(
      `[wallet] creation event unresolved for ${userId} (${onChain}): ` +
        `${String((error as Error).message).slice(0, 200)}`,
    );
  }

  // First time: record it. The filter requires the field to still be absent, so two concurrent
  // syncs cannot race into different values.
  const updated = await User.findOneAndUpdate(
    { userId, smartWalletAddress: { $exists: false } },
    {
      $set: {
        smartWalletAddress: onChain,
        ...(creation
          ? {
              smartWalletCreatedAt: new Date(creation.timestamp * 1000),
              smartWalletCreatedBlockNumber: creation.blockNumber,
              smartWalletCreatedTxHash: creation.txHash.toLowerCase(),
            }
          : {}),
      },
    },
    { new: true },
  );

  // Null means another request persisted first; re-read and return that.
  const result = updated ?? (await User.findOne({ userId }));
  if (!result) throw new HttpError(401, "UNAUTHORIZED", "User no longer exists.");

  return { hasWallet: true, user: toUserResponse(result) };
}
