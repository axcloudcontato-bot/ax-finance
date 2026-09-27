-- Convites de acesso por empresa (FIN-014). O token bruto nunca é persistido:
-- somente seu SHA-256 é gravado, seguindo o mesmo princípio das sessões.
CREATE TYPE "CompanyInvitationStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REVOKED');

CREATE TABLE "company_invitations" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "company_name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "role" "MembershipRole" NOT NULL,
  "token_hash" TEXT NOT NULL,
  "status" "CompanyInvitationStatus" NOT NULL DEFAULT 'PENDING',
  "invited_by_user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "accepted_at" TIMESTAMP(3),
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "company_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "company_invitations_token_hash_key" ON "company_invitations"("token_hash");
CREATE UNIQUE INDEX "company_invitations_company_id_email_key" ON "company_invitations"("company_id", "email");
CREATE INDEX "company_invitations_company_id_status_idx" ON "company_invitations"("company_id", "status");

ALTER TABLE "company_invitations"
  ADD CONSTRAINT "company_invitations_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "company_invitations"
  ADD CONSTRAINT "company_invitations_invited_by_user_id_fkey"
  FOREIGN KEY ("invited_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "company_invitations" TO ax_app;
