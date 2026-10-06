import { getAddress } from "viem";
import { config } from "../config.js";
import { User } from "../models/User.js";
import { claimFee, feeScaleFor, percentageLabel } from "./fee.js";
import { getRewardSummary } from "./summary.js";
import { settlementChainReader, type SettlementChainReader } from "./chain.js";

/**
 * Everything the UI needs BEFORE the approve/claim flow — read only.
 *
 * It does not re-derive who may claim what: the published figures and status come from the same
 * `getRewardSummary` the summary endpoint serves, so the two can never disagree about whether a
 * user is claimable.
 *
 * The fee is an ESTIMATE by construction. `claim()` re-reads the Swap price and fee band at
 * execution, and the band is a tiered function of buy share, so a quote taken now can be charged
 * differently a block later. The response says so explicitly rather than leaving the UI to
 * promise a fixed number.
 */

export type ClaimQuoteStatus = "PENDING_WALLET" | "CLAIMABLE" | "NOTHING_TO_CLAIM";

export interface ClaimQuote {
  status: ClaimQuoteStatus;
  claimable: boolean;
  reason: string | null;
  checkpointId: number | null;

  publishedSelfACF: string;
  publishedTeamACF: string;
  /** One combined figure, as Withdrawal.alreadyClaimed stores it. Never split per component. */
  alreadyClaimedACF: string;
  availableACF: string;

  /** Null when there is nothing to quote, so the UI shows no fee rather than a fabricated zero. */
  feePercentageE6: string | null;
  feePercentageLabel: string | null;
  priceE18: string | null;
  estimatedUsdtFee: string | null;
  /** True whenever a fee was quoted: execution re-reads the live rate and may charge differently. */
  feeIsEstimate: boolean;

  smartWalletAddress: string | null;
  walletUsdtBalance: string | null;
  withdrawalAllowance: string | null;
  /** Whether an approval is needed before the claim can succeed at the quoted fee. */
  approvalRequired: boolean | null;
  usdtShortfall: string | null;
}

const empty = (
  status: ClaimQuoteStatus,
  reason: string | null,
  summary: Awaited<ReturnType<typeof getRewardSummary>>,
  smartWalletAddress: string | null,
): ClaimQuote => ({
  status,
  claimable: false,
  reason,
  checkpointId: summary.checkpointId,
  publishedSelfACF: summary.publishedSelfACF,
  publishedTeamACF: summary.publishedTeamACF,
  alreadyClaimedACF: summary.claimedACF,
  availableACF: "0",
  feePercentageE6: null,
  feePercentageLabel: null,
  priceE18: null,
  estimatedUsdtFee: null,
  feeIsEstimate: false,
  smartWalletAddress,
  walletUsdtBalance: null,
  withdrawalAllowance: null,
  approvalRequired: null,
  usdtShortfall: null,
});

export async function getClaimQuote(
  userId: string,
  reader: SettlementChainReader = settlementChainReader,
): Promise<ClaimQuote> {
  const user = await User.findOne({ userId }, { smartWalletAddress: 1 }).lean();
  const summary = await getRewardSummary(userId);

  // No wallet means no leaf and no wallet reads to make. The summary still reports what was
  // earned, because deferred reward is never forfeited.
  if (!user?.smartWalletAddress) {
    return empty("PENDING_WALLET", "CREATE_WALLET_TO_CLAIM", summary, null);
  }
  const wallet = getAddress(user.smartWalletAddress).toLowerCase();

  const published = BigInt(summary.publishedSelfACF) + BigInt(summary.publishedTeamACF);
  const claimed = BigInt(summary.claimedACF);
  // Deliberately NOT earnedSelf + earnedTeam: earned reward that is not yet in a finalized root
  // has no proof and cannot be claimed.
  const available = published > claimed ? published - claimed : 0n;

  if (available === 0n) {
    return empty(
      "NOTHING_TO_CLAIM",
      summary.checkpointId === null ? "NOT_YET_PUBLISHED" : "FULLY_CLAIMED",
      summary,
      wallet,
    );
  }

  const [{ priceE18, percentageE6 }, decimals, position] = await Promise.all([
    reader.claimFeeInputs(),
    reader.tokenDecimals(),
    reader.usdtPosition(wallet),
  ]);
  const fee = claimFee(available, priceE18, percentageE6, feeScaleFor(decimals.acf, decimals.usdt));

  return {
    status: "CLAIMABLE",
    claimable: true,
    reason: null,
    checkpointId: summary.checkpointId,
    publishedSelfACF: summary.publishedSelfACF,
    publishedTeamACF: summary.publishedTeamACF,
    alreadyClaimedACF: summary.claimedACF,
    availableACF: available.toString(),
    feePercentageE6: percentageE6.toString(),
    feePercentageLabel: percentageLabel(percentageE6),
    priceE18: priceE18.toString(),
    estimatedUsdtFee: fee.toString(),
    feeIsEstimate: true,
    smartWalletAddress: wallet,
    walletUsdtBalance: position.balance.toString(),
    withdrawalAllowance: position.allowance.toString(),
    approvalRequired: position.allowance < fee,
    usdtShortfall: position.balance < fee ? (fee - position.balance).toString() : "0",
  };
}
