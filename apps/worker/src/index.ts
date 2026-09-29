import { runOutboxWorker } from "./processor";
import { logOperationalError } from "@ax-finance/domain";
import { testAlertWebhook } from "./monitoring";

async function main() {
  if (process.argv.includes("--test-alert-webhook")) {
    const result = await testAlertWebhook();
    process.stdout.write(`${JSON.stringify({ event: "operations.alert_webhook_test_completed", result })}\n`);
    return;
  }

  if (process.argv.includes("--once")) process.env.WORKER_ONCE = "true";
  await runOutboxWorker();
}

main().catch((error) => {
  logOperationalError("worker.fatal_error", error);
  process.exitCode = 1;
});
