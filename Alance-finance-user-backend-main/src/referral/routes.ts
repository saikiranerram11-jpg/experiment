import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import {
  getDirectReferralStanding, getDirectReferrals,
  getDownlineCountsByDepth, getDownlineTree,
  getReferralSummary,
} from "./service.js";
import { DIRECT_PAGE_DEFAULT, LEVEL_INCOME_MAX_DEPTH } from "./policy.js";

export const referralRouter = Router();

/** The authenticated user's own code, sponsor and direct count. */
referralRouter.get("/referral/me", requireAuth, async (req, res, next) => {
  try {
    res.json(await getReferralSummary(req.session!.sub));
  } catch (error) {
    next(error);
  }
});

/** Paginated direct referrals. Never unbounded, however many children a leader has. */
referralRouter.get("/referral/direct", requireAuth, async (req, res, next) => {
  try {
    const rawLimit = Number(req.query.limit);
    res.json(
      await getDirectReferrals(req.session!.sub, {
        limit: Number.isInteger(rawLimit) ? rawLimit : DIRECT_PAGE_DEFAULT,
        cursor: typeof req.query.cursor === "string" ? req.query.cursor : undefined,
      }),
    );
  } catch (error) {
    next(error);
  }
});

/**
 * Real counts only.
 *
 * Deliberately carries no income, volume or rank figures: the reward engine does not exist, so
 * any such number would be invented rather than reported.
 */
referralRouter.get("/referral/stats", requireAuth, async (req, res, next) => {
  try {
    const userId = req.session!.sub;
    const [standing, countsByLevel] = await Promise.all([
      getDirectReferralStanding(userId),
      getDownlineCountsByDepth(userId, LEVEL_INCOME_MAX_DEPTH),
    ]);
    res.json({
      // Every registered direct. Kept under its existing name so nothing silently changes
      // meaning; it is no longer the qualification figure.
      directReferralCount: standing.total,
      // What actually qualifies a referrer: directs who created their smart wallet. Pending
      // directs are reported alongside rather than hidden, and never folded in.
      onboardedDirectCount: standing.onboarded,
      pendingDirectCount: standing.pending,
      // Explicitly RELATIVE depths from this user, not absolute positions in the tree.
      countsByRelativeLevel: countsByLevel,
      maxLevelsReported: LEVEL_INCOME_MAX_DEPTH,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * The viewer's downline as a bounded tree, for the network view.
 *
 * Depth and node count are both capped, and `truncated` reports when more exists below — a
 * display must never imply the tree ends where the response does.
 */
referralRouter.get("/referral/tree", requireAuth, async (req, res, next) => {
  try {
    const depth = Number(req.query.depth);
    res.json(
      await getDownlineTree(req.session!.sub, {
        maxDepth: Number.isInteger(depth) ? depth : 3,
      }),
    );
  } catch (error) {
    next(error);
  }
});
