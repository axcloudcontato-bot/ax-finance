import { runOutboxWorker } from "./processor";

if (process.argv.includes("--once")) process.env.WORKER_ONCE = "true";

runOutboxWorker().catch((error) => {
  console.error("Worker encerrado por erro fatal", error);
  process.exitCode = 1;
});
