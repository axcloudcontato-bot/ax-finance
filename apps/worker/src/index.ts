import { runOutboxWorker } from "./processor";
import { logOperationalError } from "@ax-finance/domain";
import { testAlertWebhook } from "./monitoring";
import { billingReconciliationEnabled, runBillingReconciliation } from "./billing-reconciliation";
import { runBillingCheck } from "./billing-check";

async function main() {
  if (process.argv.includes("--test-alert-webhook")) {
    const result = await testAlertWebhook();
    process.stdout.write(`${JSON.stringify({ event: "operations.alert_webhook_test_completed", result })}\n`);
    return;
  }

  if (process.argv.includes("--check-billing")) {
    const result = await runBillingCheck();
    process.stdout.write(`${JSON.stringify({ event: "worker.billing_check_completed", ...result }, null, 2)}
`);
    process.exitCode = result.ok ? 0 : 1;
    return;
  }

  if (process.argv.includes("--reconcile-billing")) {
    if (!billingReconciliationEnabled()) throw new Error("STRIPE_SECRET_KEY e os dois STRIPE_PRICE_* precisam estar configurados no worker.");
    const summary = await runBillingReconciliation();
    process.stdout.write(`${JSON.stringify({ event: "worker.billing_reconciliation_manual_completed", summary })}
`);
    return;
  }

  if (process.argv.includes("--once")) process.env.WORKER_ONCE = "true";
  await runOutboxWorker();
}

main().catch((error) => {
  logOperationalError("worker.fatal_error", error);
  process.exitCode = 1;
});
