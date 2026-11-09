import { isDbConfigured, requireDb } from "../../../lib/db";
import { reconcileExpiredSales } from "./sale-checkout.service";

// The existing deployment runs a persistent Express process. Stripe expiration
// webhooks are primary; this bounded sweep recovers missed/abandoned sessions.
// Database transitions and Stripe expiration checks are safe across instances.
export function startSaleReconciliation() {
  let running = false;
  const timer = setInterval(async () => {
    if (running || !isDbConfigured || !process.env.STRIPE_SECRET_KEY) return;
    running = true;
    try {
      await reconcileExpiredSales(requireDb());
    } catch (error) {
      console.error(
        "[Sales reconciliation]",
        error instanceof Error ? error.message : "Failed",
      );
    } finally {
      running = false;
    }
  }, 60_000);
  timer.unref();
  return () => clearInterval(timer);
}
