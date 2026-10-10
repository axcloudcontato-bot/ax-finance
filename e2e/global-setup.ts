import { execSync } from "node:child_process";
import { E2E_APP_DATABASE_URL, E2E_DATABASE_URL } from "./env";

/** Recria o estado do banco de E2E: cria se faltar, aplica as migrations, zera as tabelas e semeia. */
export default function globalSetup() {
  const env = { ...process.env, DATABASE_URL: E2E_DATABASE_URL, APP_DATABASE_URL: E2E_APP_DATABASE_URL };
  execSync("pnpm exec tsx e2e/prepare-db.ts create", { env, stdio: "inherit" });
  execSync("pnpm db:migrate:deploy", { env, stdio: "inherit" });
  execSync("pnpm exec tsx e2e/prepare-db.ts reset", { env, stdio: "inherit" });
  execSync("pnpm exec tsx e2e/seed.ts", { env, stdio: "inherit" });
}
