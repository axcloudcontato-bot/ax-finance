-- Chaves de idempotência são isoladas por empresa + operação. A linha nasce
-- e é concluída na mesma transação do recurso financeiro; rollback remove os dois.
CREATE TABLE "idempotency_records" (
  "id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "operation" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "request_hash" TEXT NOT NULL,
  "resource_type" TEXT NOT NULL,
  "resource_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "idempotency_records_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "idempotency_records_company_id_operation_key_key"
  ON "idempotency_records"("company_id", "operation", "key");
CREATE INDEX "idempotency_records_company_id_created_at_idx"
  ON "idempotency_records"("company_id", "created_at");
ALTER TABLE "idempotency_records"
  ADD CONSTRAINT "idempotency_records_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "idempotency_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "idempotency_records" FORCE ROW LEVEL SECURITY;

CREATE POLICY idempotency_records_company_access ON "idempotency_records"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "idempotency_records"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "idempotency_records"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "idempotency_records" TO ax_app;
