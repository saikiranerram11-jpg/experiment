import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One user's rank and every input that produced it, for one epoch.
 *
 * Rank is recomputed from scratch each epoch and may FALL, so the inputs matter as much as the
 * answer: "why did I drop a rank?" is unanswerable from the rank alone. `previousRank` is
 * support metadata and is never an input to qualification.
 *
 * USD amounts are USDT base units (1e6), the same unit the rank cap uses, so one conversion
 * serves qualification, caps and audit.
 */
const UserRankSnapshotSchema = new Schema(
  {
    chainId: { type: Number, required: true, immutable: true },
    stakingContractAddress: { type: String, required: true, immutable: true, lowercase: true },
    epochId: { type: Number, required: true, immutable: true },
    userId: { type: String, required: true, immutable: true },

    /** 0 = unranked. Never implicitly promoted to Nova. */
    rank: { type: Number, required: true, immutable: true },
    rankName: { type: String, default: null, immutable: true },
    rateE6: { type: String, required: true, immutable: true },
    epochCapUSD6: { type: String, required: true, immutable: true },
    previousRank: { type: Number, default: null, immutable: true },

    selfStakeACF: { type: String, required: true, immutable: true },
    selfStakeUSD6: { type: String, required: true, immutable: true },
    teamStakeACF: { type: String, required: true, immutable: true },
    teamStakeUSD6: { type: String, required: true, immutable: true },
    activeDirects: { type: Number, required: true, immutable: true },
    directCount: { type: Number, required: true, immutable: true },

    /**
     * Directs who had completed onboarding at this epoch's snapshot — a smart wallet existed on
     * chain, with no stake condition.
     *
     * Not `required`: rows written before ONBOARDED_DIRECT_RULE_START_EPOCH predate the field and
     * are left exactly as they were settled. Absent means "not recorded", never zero.
     */
    onboardedDirects: { type: Number, min: 0, immutable: true },

    /**
     * Which count qualified this rank. ACTIVE_STAKE for epochs settled before the rule changed,
     * ONBOARDED from ONBOARDED_DIRECT_RULE_START_EPOCH. Stored so historical rows state their
     * own semantics instead of depending on today's constant.
     */
    directRule: { type: String, enum: ["ACTIVE_STAKE", "ONBOARDED"], immutable: true },

    /**
     * Whether onboarding was decided against Phase 1's pinned snapshot BLOCK or, only when no
     * such block existed, against the boundary timestamp. Absent on pre-rule rows.
     */
    onboardingBasis: { type: String, enum: ["BLOCK", "TIMESTAMP"], immutable: true },
    l1StakeACF: { type: String, required: true, immutable: true },
    maxDownlineRank: { type: Number, required: true, immutable: true },
    downlineQualifiers: { type: Number, required: true, immutable: true },
    priceE18: { type: String, required: true, immutable: true },
  },
  { timestamps: true, versionKey: false, strict: true },
);

UserRankSnapshotSchema.index(
  { chainId: 1, stakingContractAddress: 1, epochId: 1, userId: 1 },
  { unique: true },
);
UserRankSnapshotSchema.index({ userId: 1, epochId: -1 });
UserRankSnapshotSchema.index({ epochId: 1, rank: -1 });

export type UserRankSnapshotDocument = InferSchemaType<typeof UserRankSnapshotSchema>;
export const UserRankSnapshot = model("UserRankSnapshot", UserRankSnapshotSchema);
