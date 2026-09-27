import { runOutboxWorker } from "./processor";
import { logOperationalError } from "@ax-finance/domain";

if (process.argv.includes("--once")) process.env.WORKER_ONCE = "true";

runOutboxWorker().catch((error) => {
  logOperationalError("worker.fatal_error", error);
  process.exitCode = 1;
});
