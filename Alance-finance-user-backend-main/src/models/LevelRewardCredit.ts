import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One Level Income credit: this beneficiary earned this much from THAT downline user's
 * staking reward, at this relative level.
 *
 * A fan-out row rather than an array embedded in the beneficiary's record: a leader with a
 * large first level would otherwise push one document toward the 16 MB BSON ceiling, and that
 * failure only appears at scale. Row count is bounded at earners x 7.
 */
const LevelRewardCreditSchema = new Schema(
  {
    chainId: { type: Number, required: true, immutable: true },
    stakingContractAddress: { type: String, required: true, immutable: true, lowercase: true },
    epochId: { type: Number, required: true, immutable: true },

    beneficiaryUserId: { type: String, required: true, immutable: true },
    sourceUserId: { type: String, required: true, immutable: true },
    /** 1-7, relative to the beneficiary. The tree itself is unlimited in depth. */
    relativeLevel: { type: Number, required: true, immutable: true },

    rateE6: { type: String, required: true, immutable: true },
    /** The downline user's DIRECT+BOND reward this epoch. DAO is never a Level source. */
    sourceRegularSelfRewardACF: { type: String, required: true, immutable: true },
    rewardACF: { type: String, required: true, immutable: true },
  },
  { timestamps: true, versionKey: false, strict: true },
);

LevelRewardCreditSchema.index(
  {
    chainId: 1, stakingContractAddress: 1, epochId: 1,
    beneficiaryUserId: 1, sourceUserId: 1, relativeLevel: 1,
  },
  { unique: true },
);
LevelRewardCreditSchema.index({ epochId: 1, beneficiaryUserId: 1 });
LevelRewardCreditSchema.index({ epochId: 1, sourceUserId: 1 });

export type LevelRewardCreditDocument = InferSchemaType<typeof LevelRewardCreditSchema>;
export const LevelRewardCredit = model("LevelRewardCredit", LevelRewardCreditSchema);
