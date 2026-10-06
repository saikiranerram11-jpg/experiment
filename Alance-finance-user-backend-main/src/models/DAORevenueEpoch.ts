import { Schema, model, type InferSchemaType } from "mongoose";

/**
 * One 12-hour DAO Member Revenue epoch.
 *
 * Aligned 1:1 with the Phase 1 reward epoch — same epochId, window, snapshot and price — so the
 * economics are defined at the reward boundary and cannot drift. DAO revenue is a DIRECT push
 * paid in ACF to UserSmartWallets; it is not part of the Withdrawal Merkle claim, does not
 * compound, and generates no Level, Rank or Global reward.
 *
 * Identity includes the distributor address because `paid[epochId][user]`, `funded` and
 * `distributed` all live in that contract: a different deployment is a different payment
 * history, and reusing an epochId across them must not collide.
 *
 * Financial fields are immutable once written. Execution fields are deliberately separate and
 * mutable, so retrying a funding or a batch can never touch a calculated obligation.
 */
const DAORevenueEpochSchema = new Schema(
  {
    // ── identity ──────────────────────────────────────────────────────────
    chainId: { type: Number, required: true, immutable: true },
    daoContractAddress: { type: String, required: true, immutable: true, lowercase: true },
    distributorAddress: { type: String, required: true, immutable: true, lowercase: true },
    epochId: { type: Number, required: true, immutable: true },

    /** Recorded so a later audit can prove which deployments produced these numbers. */
    stakingContractAddress: { type: String, required: true, immutable: true, lowercase: true },
    treasuryAddress: { type: String, required: true, immutable: true, lowercase: true },
    walletFactoryAddress: { type: String, required: true, immutable: true, lowercase: true },

    // ── inherited Phase 1 boundary (never recomputed here) ────────────────
    windowStart: { type: Number, required: true, immutable: true },
    snapshotAt: { type: Number, required: true, immutable: true },
    snapshotBlockNumber: { type: Number, required: true, immutable: true },
    /** The epoch's frozen ACF/USDT price. Both conversions use this one value. */
    priceE18: { type: String, required: true, immutable: true },

    // ── system revenue (Self-type staking reward only) ────────────────────
    /** DIRECT + BOND. */
    systemRegularSelfACF: { type: String, required: true, immutable: true },
    /** source = DAO. */
    systemDAOStakeRewardACF: { type: String, required: true, immutable: true },
    /** The sum of the two above; the DAO revenue base. */
    systemSelfRewardACF: { type: String, required: true, immutable: true },
    /** systemSelfRewardACF converted at priceE18, in USDT base units. */
    systemRevenueUSD6: { type: String, required: true, immutable: true },

    // ── DAO configuration AS OF snapshotBlockNumber ───────────────────────
    revenueEnabledAtSnapshot: { type: Boolean, required: true, immutable: true },
    silverMinimumUSDT6: { type: String, required: true, immutable: true },
    goldMinimumUSDT6: { type: String, required: true, immutable: true },
    memberRevenueRateE6: { type: String, required: true, immutable: true },
    /** Which config row was resolved, so the as-of decision is reproducible. */
    configBlockNumber: { type: Number, required: true, immutable: true },
    configLogIndex: { type: Number, required: true, immutable: true },

    // ── the pool and what was actually owed ───────────────────────────────
    daoRevenuePoolUSD6: { type: String, required: true, immutable: true },
    totalEligibleContributionUSDT6: { type: String, required: true, immutable: true },
    totalMemberRevenueUSD6: { type: String, required: true, immutable: true },
    /**
     * The EXACT amount to fund and distribute: the sum of per-member floored ACF.
     *
     * Never the theoretical pool. The distributor has no sweep function, so anything funded
     * beyond the sum of payouts is stranded in it permanently.
     */
    totalMemberRevenueACF: { type: String, required: true, immutable: true },
    /** daoRevenuePoolUSD6 - Σ memberRevenueUSD6. Audit only; never funded. */
    roundingDustUSD6: { type: String, required: true, immutable: true },
    eligibleMembers: { type: Number, required: true, immutable: true },
    batchCount: { type: Number, required: true, immutable: true },
    /** Canonical hash of the execution manifest the executor must verify before signing. */
    manifestHash: { type: String, required: true, immutable: true },

    // ── mutable execution state ───────────────────────────────────────────
    status: {
      type: String, required: true,
      enum: [
        "CALCULATING", "CALCULATED", "FUNDING_SUBMITTED", "FUNDED",
        "DISTRIBUTING", "COMPLETED", "FAILED", "NOTHING_TO_DISTRIBUTE",
      ],
      default: "CALCULATING",
    },
    /**
     * Why nothing is owed. Recorded rather than skipped, so a historical epoch cannot be
     * silently reconsidered later under different configuration.
     */
    reason: {
      type: String, default: null,
      enum: [
        "PROGRAM_DISABLED", "NO_SYSTEM_REVENUE", "EMPTY_POOL",
        "NO_ELIGIBLE_MEMBERS", "ALL_SHARES_ROUNDED_TO_ZERO", null,
      ],
    },
    leaseExpiresAt: { type: Date, default: null },
    attempts: { type: Number, required: true, default: 0 },
    lastError: { type: String, default: null },

    fundingTxHash: { type: String, default: null, lowercase: true },
    fundingBlockNumber: { type: Number, default: null },
    fundingBlockTimestamp: { type: Number, default: null },
    /** What the chain says was funded, read back after the receipt. */
    fundedACF: { type: String, default: null },

    paidMembers: { type: Number, required: true, default: 0 },

    calculatedAt: { type: Date, default: null },
    fundedAt: { type: Date, default: null },
    completedAt: { type: Date, default: null },
  },
  { timestamps: true, versionKey: false, strict: true },
);

DAORevenueEpochSchema.index(
  { chainId: 1, daoContractAddress: 1, distributorAddress: 1, epochId: 1 },
  { unique: true },
);
// Catch-up and executor sweeps: oldest actionable epoch first.
DAORevenueEpochSchema.index({ chainId: 1, distributorAddress: 1, status: 1, epochId: 1 });

export type DAORevenueEpochDocument = InferSchemaType<typeof DAORevenueEpochSchema>;
export const DAORevenueEpoch = model("DAORevenueEpoch", DAORevenueEpochSchema);
