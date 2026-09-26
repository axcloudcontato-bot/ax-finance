-- CreateTable
CREATE TABLE "audit_events" (
    "id" TEXT NOT NULL,
    "company_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "resource_type" TEXT NOT NULL,
    "resource_id" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_events_company_id_resource_type_resource_id_idx" ON "audit_events"("company_id", "resource_type", "resource_id");

-- CreateIndex
CREATE INDEX "audit_events_company_id_created_at_idx" ON "audit_events"("company_id", "created_at");

-- AddForeignKey
ALTER TABLE "audit_events" ADD CONSTRAINT "audit_events_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Isolamento multiempresa: mesmo padrão reforçado de bank_statement_lines_all
-- (migration 20260926062009) — confere membership ATIVA por conta própria,
-- não só o app.current_company_id do contexto. Evento de auditoria é
-- imutável (Seção 18: "eventos financeiros gravam entradas imutáveis") —
-- por isso não existe policy de UPDATE, só INSERT/SELECT no GRANT.
GRANT SELECT, INSERT ON "audit_events" TO ax_app;

ALTER TABLE "audit_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "audit_events" FORCE ROW LEVEL SECURITY;

CREATE POLICY audit_events_all ON "audit_events"
  FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "audit_events"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND EXISTS (
      SELECT 1 FROM "memberships" m
      WHERE m."company_id" = "audit_events"."company_id"
        AND m."user_id" = current_setting('app.current_user_id', true)
        AND m."status" = 'ACTIVE'
    )
  );
