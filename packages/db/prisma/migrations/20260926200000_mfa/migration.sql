-- MFA TOTP: o segredo fica cifrado pela aplicação, os códigos de recuperação
-- ficam somente como hashes e cada login usa um desafio curto e descartável.
ALTER TABLE "users"
  ADD COLUMN "mfa_secret_encrypted" TEXT,
  ADD COLUMN "mfa_enabled_at" TIMESTAMP(3),
  ADD COLUMN "mfa_recovery_code_hashes" JSONB,
  ADD COLUMN "mfa_last_used_counter" BIGINT;

CREATE TABLE "mfa_setups" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "secret_encrypted" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_setups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_setups_user_id_key" ON "mfa_setups"("user_id");
ALTER TABLE "mfa_setups"
  ADD CONSTRAINT "mfa_setups_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "mfa_challenges" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "token_hash" TEXT NOT NULL,
  "remember_session" BOOLEAN NOT NULL DEFAULT false,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "consumed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "mfa_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "mfa_challenges_token_hash_key" ON "mfa_challenges"("token_hash");
CREATE INDEX "mfa_challenges_user_id_consumed_at_idx" ON "mfa_challenges"("user_id", "consumed_at");
ALTER TABLE "mfa_challenges"
  ADD CONSTRAINT "mfa_challenges_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "mfa_setups" TO ax_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "mfa_challenges" TO ax_app;
