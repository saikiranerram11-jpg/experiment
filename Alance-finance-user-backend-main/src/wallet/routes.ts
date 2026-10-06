import { Router } from "express";
import { requireAuth } from "../auth/middleware.js";
import { syncWallet } from "./service.js";

export const walletRouter = Router();

/**
 * Resolves and stores the caller's UserSmartWallet.
 *
 * Takes no input. Any address in the body is ignored: the identity comes from the JWT, and
 * the wallet from the chain.
 */
walletRouter.post("/wallet/sync", requireAuth, async (req, res, next) => {
  try {
    res.json(await syncWallet(req.session!.sub));
  } catch (error) {
    next(error);
  }
});
