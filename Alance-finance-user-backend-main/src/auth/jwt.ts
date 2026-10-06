import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { HttpError } from "../lib/errors.js";

/**
 * Session payload. Deliberately minimal: `smartWalletAddress` is omitted because it changes
 * from absent to an address during the session's life, and `referralCode` because nothing
 * authorises on it. Both are read fresh from the database by GET /me.
 */
export interface SessionPayload {
  sub: string; // userId
  eoa: string; // externalEOA, normalized
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresInSeconds });
}

export function verifySession(token: string): SessionPayload {
  let decoded: unknown;
  try {
    decoded = jwt.verify(token, config.jwtSecret);
  } catch {
    throw new HttpError(401, "UNAUTHORIZED", "Session is invalid or has expired.");
  }

  if (
    typeof decoded !== "object" || decoded === null ||
    typeof (decoded as SessionPayload).sub !== "string" ||
    typeof (decoded as SessionPayload).eoa !== "string"
  ) {
    throw new HttpError(401, "UNAUTHORIZED", "Session payload is malformed.");
  }

  const { sub, eoa } = decoded as SessionPayload;
  return { sub, eoa };
}
