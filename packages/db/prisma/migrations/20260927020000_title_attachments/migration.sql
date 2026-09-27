CREATE TABLE "attachments" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "title_id" TEXT NOT NULL,
  "uploaded_by_user_id" TEXT NOT NULL,
  "original_name" TEXT NOT NULL,
  "mime_type" TEXT NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "sha256" TEXT NOT NULL,
  "storage_key" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "attachments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "attachments_size_check" CHECK ("size_bytes" > 0 AND "size_bytes" <= 10485760),
  CONSTRAINT "attachments_sha256_check" CHECK ("sha256" ~ '^[a-f0-9]{64}$')
);

CREATE UNIQUE INDEX "attachments_storage_key_key" ON "attachments"("storage_key");
CREATE INDEX "attachments_company_id_title_id_created_at_idx" ON "attachments"("company_id", "title_id", "created_at");

ALTER TABLE "attachments" ADD CONSTRAINT "attachments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_title_id_fkey"
  FOREIGN KEY ("title_id") REFERENCES "titles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "attachments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "attachments" FORCE ROW LEVEL SECURITY;

CREATE POLICY "attachments_company_select" ON "attachments"
  FOR SELECT USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "attachments"."company_id"
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY "attachments_company_insert" ON "attachments"
  FOR INSERT WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND "uploaded_by_user_id" = current_setting('app.current_user_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "attachments"."company_id"
        AND m."status" = 'ACTIVE'
    )
  );

CREATE POLICY "attachments_company_delete" ON "attachments"
  FOR DELETE USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."user_id" = current_setting('app.current_user_id', true)
        AND m."company_id" = "attachments"."company_id"
        AND m."status" = 'ACTIVE'
    )
  );

GRANT SELECT, INSERT, DELETE ON TABLE "attachments" TO ax_app;
