import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One Merkle leaf: a user's cumulative entitlement as published by one checkpoint.
 *
 * Every field is immutable. These rows ARE the tree — a proof is rebuilt from them on demand
 * and never stored, because the Withdrawal contract keeps only the latest root and the next
 * finalization invalidates every proof issued against the previous one.
 *
 * Identity is the UserSmartWallet, because Withdrawal.claim hashes msg.sender and users act
 * through their wallet's execute(). The external EOA is an authentication identity and would
 * produce a leaf nobody can claim.
 */
const UserRewardCheckpointSchema = new Schema(
  {
    chainId: { type: Number, required: true, immutable: true },
    withdrawalAddress: { type: String, required: true, immutable: true, lowercase: true },
    checkpointId: { type: Number, required: true, immutable: true },

    userId: { type: String, required: true, immutable: true },
    smartWalletAddress: { type: String, required: true, immutable: true, lowercase: true },

    /** Earned inside this checkpoint's reward-epoch range. */
    newSelfACF: { type: String, required: true, immutable: true },
    newTeamACF: { type: String, required: true, immutable: true },

    /**
     * Earned BEFORE this user had a wallet and released by this checkpoint. Deferred Self
     * should always be zero under current rules — a stake maps through the wallet — but it is
     * stored separately so a violation is visible rather than hidden inside a sum.
     */
    deferredReleasedSelfACF: { type: String, required: true, immutable: true },
    deferredReleasedTeamACF: { type: String, required: true, immutable: true },

    cumulativeSelfACF: { type: String, required: true, immutable: true },
    cumulativeTeamACF: { type: String, required: true, immutable: true },
    /** self + team. The value the contract compares against alreadyClaimed. */
    combinedCumulativeACF: { type: String, required: true, immutable: true },

    leafHash: { type: String, required: true, immutable: true, lowercase: true },
  },
  { timestamps: true, versionKey: false, strict: true },
);

UserRewardCheckpointSchema.index(
  { chainId: 1, withdrawalAddress: 1, checkpointId: 1, userId: 1 },
  { unique: true },
);
// One leaf per wallet per checkpoint, enforced by the database rather than only in code.
UserRewardCheckpointSchema.index(
  { chainId: 1, withdrawalAddress: 1, checkpointId: 1, smartWalletAddress: 1 },
  { unique: true },
);
UserRewardCheckpointSchema.index({ chainId: 1, withdrawalAddress: 1, userId: 1, checkpointId: -1 });
// Claim reconciliation matches alreadyClaimed against this exact combined value.
UserRewardCheckpointSchema.index(
  { chainId: 1, withdrawalAddress: 1, smartWalletAddress: 1, combinedCumulativeACF: 1 },
);

export type UserRewardCheckpointDocument = InferSchemaType<typeof UserRewardCheckpointSchema>;
export const UserRewardCheckpoint = model("UserRewardCheckpoint", UserRewardCheckpointSchema);
