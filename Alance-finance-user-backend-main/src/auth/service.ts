import { randomBytes } from "node:crypto";
import { recoverMessageAddress } from "viem";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";
import { normalizeEOA } from "../lib/address.js";
import { generateReferralCode } from "../lib/referralCode.js";
import { AuthChallenge } from "../models/AuthChallenge.js";
import { User, type UserDocument } from "../models/User.js";
import { signSession } from "./jwt.js";
import { findRootUser, isRootAdminEoa } from "../lib/bootstrap.js";

/** Shape returned for a user by every endpoint. A missing wallet serialises as null. */
export interface UserResponse {
  userId: string;
  externalEOA: string;
  smartWalletAddress: string | null;
  referralCode: string;
  referredByUserId: string | null;
}

export function toUserResponse(user: UserDocument): UserResponse {
  return {
    userId: user.userId,
    externalEOA: user.externalEOA,
    // The path is absent until Milestone 2 creates a wallet; the API still reports null.
    smartWalletAddress: user.smartWalletAddress ?? null,
    referralCode: user.referralCode,
    referredByUserId: user.referredByUserId ?? null,
  };
}

function buildMessage(externalEOA: string, nonce: string, issuedAt: Date): string {
  // Chain ID is included so a signature cannot be replayed against another network.
  return [
    "ACF Finance wants you to sign in.",
    "",
    `Address: ${externalEOA}`,
    `Chain ID: ${config.chainId}`,
    `Nonce: ${nonce}`,
    `Issued At: ${issuedAt.toISOString()}`,
    "",
    "Signing this message costs no gas and does not authorise any transaction.",
  ].join("\n");
}

export async function createChallenge(rawEOA: unknown): Promise<{ message: string; expiresAt: string }> {
  const externalEOA = normalizeEOA(rawEOA);
  const nonce = randomBytes(32).toString("hex");
  const issuedAt = new Date();
  const expiresAt = new Date(issuedAt.getTime() + config.challengeTtlSeconds * 1000);
  const message = buildMessage(externalEOA, nonce, issuedAt);

  // One pending challenge per address: requesting again replaces the previous one.
  await AuthChallenge.findOneAndUpdate(
    { externalEOA },
    { externalEOA, nonce, message, expiresAt },
    { upsert: true },
  );

  return { message, expiresAt: expiresAt.toISOString() };
}

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: number }).code === 11000;
}

const newUserId = () => `usr_${randomBytes(12).toString("hex")}`;

/**
 * Decides the parent for a FIRST registration.
 *
 * The root is whoever owns ROOT_ADMIN_EOA. Until that wallet registers there is no root, so
 * nobody else may register — a user created then could only have a null parent, which would
 * fork the referral tree permanently.
 *
 * The check happens BEFORE any write, so a rejected caller never leaves a record behind. A
 * referral code supplied alongside the admin wallet is ignored rather than honoured: the root
 * cannot have a sponsor.
 */
async function resolveParentForNewUser(
  referralCode: unknown,
  externalEOA: string,
): Promise<string | null> {
  const root = await findRootUser();

  if (!root) {
    if (isRootAdminEoa(externalEOA)) return null;   // this IS the root being created
    throw new HttpError(
      503,
      "REFERRAL_ROOT_UNAVAILABLE",
      "Registration is not open yet. The platform is still being set up.",
    );
  }

  // The admin returning is handled by the existing-user path long before here, so reaching
  // this point with the admin wallet would mean a duplicate; the normal rules apply regardless.
  return resolveReferrer(referralCode, externalEOA);
}

/**
 * Resolves the parent for a FIRST registration only. Never called for an existing user:
 * a returning login must be able to succeed while carrying any referral code, valid or not.
 *
 * Always returns a parent. A registration without a code attaches to the configured ROOT, so
 * ROOT stays the only user in the graph with no parent. It never returns null — a second
 * parentless normal user would be indistinguishable from ROOT and would silently fork the tree.
 */
async function resolveReferrer(referralCode: unknown, externalEOA: string): Promise<string> {
  if (referralCode === undefined || referralCode === null || referralCode === "") {
    const root = await findRootUser();
    if (!root) {
      throw new HttpError(
        503,
        "REFERRAL_ROOT_UNAVAILABLE",
        "Registration is not open yet. The platform is still being set up.",
      );
    }
    return root.userId;
  }
  if (typeof referralCode !== "string") {
    throw new HttpError(400, "UNKNOWN_REFERRAL_CODE", "Referral code is not valid.");
  }

  const referrer = await User.findOne({ referralCode: referralCode.trim() });
  if (!referrer) {
    throw new HttpError(400, "UNKNOWN_REFERRAL_CODE", "Referral code is not valid.");
  }

  // Defensive only: unreachable in this flow, because a code resolving to this EOA would mean
  // the user already exists and the caller would have taken the existing-user path. Kept so
  // any future path (administrative repair, data import) cannot create a self-referral.
  if (referrer.externalEOA === externalEOA) {
    throw new HttpError(400, "SELF_REFERRAL", "A user cannot refer themselves.");
  }

  return referrer.userId;
}

export interface VerifyInput {
  externalEOA: unknown;
  signature: unknown;
  referralCode?: unknown;
}

export interface VerifyResult {
  token: string;
  expiresIn: number;
  isNewUser: boolean;
  user: UserResponse;
}

export async function verifyAndAuthenticate(input: VerifyInput): Promise<VerifyResult> {
  const externalEOA = normalizeEOA(input.externalEOA);

  if (typeof input.signature !== "string" || !/^0x[0-9a-fA-F]+$/.test(input.signature)) {
    throw new HttpError(401, "SIGNATURE_MISMATCH", "Signature is missing or malformed.");
  }

  const challenge = await AuthChallenge.findOne({ externalEOA });
  if (!challenge) {
    throw new HttpError(410, "NO_CHALLENGE", "No pending challenge for this address.");
  }
  if (challenge.expiresAt.getTime() <= Date.now()) {
    throw new HttpError(410, "CHALLENGE_EXPIRED", "Challenge has expired. Request a new one.");
  }

  // Verify BEFORE consuming, so an invalid signature does not burn a legitimate challenge.
  let recovered: string;
  try {
    recovered = (
      await recoverMessageAddress({
        message: challenge.message,
        signature: input.signature as `0x${string}`,
      })
    ).toLowerCase();
  } catch {
    throw new HttpError(401, "SIGNATURE_MISMATCH", "Signature could not be verified.");
  }
  if (recovered !== externalEOA) {
    throw new HttpError(401, "SIGNATURE_MISMATCH", "Signature does not match the address.");
  }

  // Signature is valid: consume atomically. Matching on the exact nonce means only one of
  // several concurrent valid requests succeeds; the others see null and are rejected.
  const consumed = await AuthChallenge.findOneAndDelete({ externalEOA, nonce: challenge.nonce });
  if (!consumed) {
    throw new HttpError(410, "CHALLENGE_ALREADY_USED", "Challenge has already been used.");
  }

  const existing = await User.findOne({ externalEOA });

  // EXISTING USER: any referralCode received is ignored outright — never resolved, never
  // validated, never written. An established referrer is permanent, and arriving through
  // someone else's link must not prevent logging in.
  if (existing) {
    return {
      token: signSession({ sub: existing.userId, eoa: existing.externalEOA }),
      expiresIn: config.jwtExpiresInSeconds,
      isNewUser: false,
      user: toUserResponse(existing),
    };
  }

  // FIRST REGISTRATION: this is the only point at which a referral code is honoured.
  const referredByUserId = await resolveParentForNewUser(input.referralCode, externalEOA);

  let created: UserDocument | null = null;
  for (let attempt = 0; attempt < 3 && !created; attempt++) {
    try {
      created = await User.findOneAndUpdate(
        { externalEOA },
        {
          // $setOnInsert ONLY. A concurrent request that created the user first leaves these
          // untouched, which is what makes referredByUserId permanent.
          $setOnInsert: {
            userId: newUserId(),
            externalEOA,
            referralCode: generateReferralCode(),
            referredByUserId,
          },
        },
        { upsert: true, new: true },
      );
    } catch (error) {
      // A referralCode collision is the only expected duplicate here; retry with a new code.
      if (isDuplicateKeyError(error) && attempt < 2) continue;
      throw error;
    }
  }

  if (!created) {
    throw new HttpError(500, "INTERNAL_ERROR", "Could not create user.");
  }

  return {
    token: signSession({ sub: created.userId, eoa: created.externalEOA }),
    expiresIn: config.jwtExpiresInSeconds,
    isNewUser: true,
    user: toUserResponse(created),
  };
}

export async function getUserById(userId: string): Promise<UserResponse> {
  const user = await User.findOne({ userId });
  if (!user) throw new HttpError(401, "UNAUTHORIZED", "User no longer exists.");
  return toUserResponse(user);
}
