import { Schema, model, type InferSchemaType } from "mongoose";

const ADDRESS_PATTERN = /^0x[0-9a-f]{40}$/; // lowercase only — see lib/address.ts

const UserSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true, immutable: true },

    externalEOA: {
      type: String,
      required: true,
      unique: true,
      immutable: true,
      lowercase: true,
      trim: true,
      match: ADDRESS_PATTERN,
    },

    /**
     * Absent until a UserSmartWallet exists (Milestone 2). Deliberately NOT `default: null`:
     * the path is simply missing, so the partial index below never sees wallet-less users and
     * any number of them coexist.
     */
    smartWalletAddress: {
      type: String,
      lowercase: true,
      trim: true,
      match: ADDRESS_PATTERN,
    },

    /**
     * When the UserSmartWallet was created ON CHAIN, from the factory's own
     * `WalletCreated(user, wallet)` event — never registration time and never backend sync time.
     *
     * Phase 2 qualification reads this as-of an epoch's `snapshotAt`, so it decides Level unlock
     * depth and the Rank direct requirement. A wallet created after a snapshot must never leak
     * backward into that epoch, which is only possible because the value is the chain's.
     *
     * Absent when the creation event could not be established. Such a user is NOT counted as an
     * onboarded direct: a missing fact stays missing rather than being invented.
     */
    smartWalletCreatedAt: { type: Date },
    smartWalletCreatedBlockNumber: { type: Number, min: 0 },
    smartWalletCreatedTxHash: { type: String, lowercase: true, trim: true, match: /^0x[0-9a-f]{64}$/ },

    referralCode: { type: String, required: true, unique: true, immutable: true },

    /**
     * null means the user registered without a referral code — a valid root of the referral
     * forest, not an incomplete record. `immutable` plus `$setOnInsert` at the only write site
     * are two independent guards: changing this would retroactively rewrite who earned
     * Level and Rank rewards.
     */
    referredByUserId: { type: String, default: null, immutable: true },
  },
  { timestamps: true, versionKey: false, strict: true },
);

// Unique only across documents where the field is actually a string.
UserSchema.index(
  { smartWalletAddress: 1 },
  { unique: true, partialFilterExpression: { smartWalletAddress: { $type: "string" } } },
);

UserSchema.index({ referredByUserId: 1 }); // direct referrals
UserSchema.index({ smartWalletCreatedAt: 1 }); // as-of onboarding, read once per Phase 2 epoch

export type UserDocument = InferSchemaType<typeof UserSchema>;
export const User = model("User", UserSchema);
