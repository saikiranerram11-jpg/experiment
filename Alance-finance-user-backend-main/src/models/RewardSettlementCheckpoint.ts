import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One cumulative settlement checkpoint: the bridge between immutable reward history and the
 * single Merkle root the Withdrawal contract holds.
 *
 * `checkpointId` is an INDEPENDENT monotonic settlement sequence, not a reward epoch id. It is
 * the number passed to Treasury.fundRewardEpoch and Withdrawal.finalizeEpoch, so it must match
 * the on-chain epoch identity exactly. The reward relationship is explicit through
 * fromRewardEpochId / throughRewardEpochId.
 *
 * Everything above the state-machine block is immutable once the checkpoint reaches CALCULATED:
 * the root is published to a contract that keeps no history, so a changed leaf population or
 * total after calculation would silently invalidate every proof already handed out.
 */
const RewardSettlementCheckpointSchema = new Schema(
  {
    chainId: { type: Number, required: true, immutable: true },
    stakingContractAddress: { type: String, required: true, immutable: true, lowercase: true },
    /** Part of the identity: the cumulative ledger lives in THIS contract. */
    withdrawalAddress: { type: String, required: true, immutable: true, lowercase: true },
    treasuryAddress: { type: String, required: true, immutable: true, lowercase: true },

    checkpointId: { type: Number, required: true, immutable: true },
    /** True only for the seeded pre-Phase-3 settlement that already exists on chain. */
    legacy: { type: Boolean, required: true, default: false, immutable: true },

    /** Null on the legacy checkpoint, which corresponds to no reward epoch range. */
    fromRewardEpochId: { type: Number, default: null, immutable: true },
    throughRewardEpochId: { type: Number, default: null, immutable: true },
    previousCheckpointId: { type: Number, default: null, immutable: true },

    root: { type: String, required: true, immutable: true, lowercase: true },

    /** Σ over leaves of (cumulativeSelf + cumulativeTeam). Computed FROM the leaves. */
    publishedCumulativeTotalACF: { type: String, required: true, immutable: true },
    /** newTotal − previousTotal. This, not the earned delta, is what Treasury must fund. */
    publishedDeltaACF: { type: String, required: true, immutable: true },
    leafCount: { type: Number, required: true, immutable: true },

    totalNewSelfACF: { type: String, required: true, immutable: true },
    totalNewTeamACF: { type: String, required: true, immutable: true },
    /** Entitlement earned before a wallet existed and released by this checkpoint. */
    totalDeferredReleasedSelfACF: { type: String, required: true, immutable: true },
    totalDeferredReleasedTeamACF: { type: String, required: true, immutable: true },

    // ── state machine: the only mutable fields ──────────────────────────────
    status: {
      type: String,
      required: true,
      enum: [
        "CALCULATING", "CALCULATED", "FUNDING_SUBMITTED", "FUNDED",
        "FINALIZE_SUBMITTED", "FINALIZED", "FAILED",
      ],
      default: "CALCULATING",
    },
    leaseExpiresAt: { type: Date, default: null },
    attempts: { type: Number, required: true, default: 0 },
    lastError: { type: String, default: null },

    fundingTxHash: { type: String, default: null, lowercase: true },
    fundingBlockNumber: { type: Number, default: null },
    fundingBlockTimestamp: { type: Number, default: null },

    finalizeTxHash: { type: String, default: null, lowercase: true },
    finalizedBlockNumber: { type: Number, default: null },
    finalizedBlockTimestamp: { type: Number, default: null },

    /**
     * Set when the chain proves a step complete but the local transaction hash is unknown —
     * an operator acted out of band. Financially complete, audit-incomplete; never a reason
     * to resend.
     */
    auditWarning: { type: String, default: null },
  },
  { timestamps: true, versionKey: false, strict: true },
);

RewardSettlementCheckpointSchema.index(
  { chainId: 1, withdrawalAddress: 1, checkpointId: 1 },
  { unique: true },
);
RewardSettlementCheckpointSchema.index(
  { chainId: 1, withdrawalAddress: 1, status: 1, checkpointId: -1 },
);

export type RewardSettlementCheckpointDocument =
  InferSchemaType<typeof RewardSettlementCheckpointSchema>;
export const RewardSettlementCheckpoint =
  model("RewardSettlementCheckpoint", RewardSettlementCheckpointSchema);
