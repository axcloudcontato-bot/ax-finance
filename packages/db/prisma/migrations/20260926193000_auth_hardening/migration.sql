-- Verificação de e-mail, recuperação de senha e limitação persistente de
-- tentativas de login. Usuários existentes são considerados verificados;
-- novos cadastros públicos começam com email_verified_at nulo.
CREATE TYPE "AccountTokenType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');

ALTER TABLE "users" ADD COLUMN "email_verified_at" TIMESTAMP(3);
UPDATE "users" SET "email_verified_at" = CURRENT_TIMESTAMP;

CREATE TABLE "account_tokens" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "type" "AccountTokenType" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "account_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "account_tokens_token_hash_key" ON "account_tokens"("token_hash");
CREATE INDEX "account_tokens_user_id_type_used_at_idx" ON "account_tokens"("user_id", "type", "used_at");
ALTER TABLE "account_tokens"
  ADD CONSTRAINT "account_tokens_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "login_rate_limits" (
  "key_hash" TEXT NOT NULL,
  "failed_attempts" INTEGER NOT NULL DEFAULT 0,
  "window_started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "blocked_until" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "login_rate_limits_pkey" PRIMARY KEY ("key_hash")
);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "account_tokens" TO ax_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "login_rate_limits" TO ax_app;
