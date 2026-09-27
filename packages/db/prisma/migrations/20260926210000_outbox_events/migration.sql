-- Fila transacional durável. O payload é cifrado pela aplicação porque pode
-- conter links de confirmação/redefinição que concedem acesso temporário.
CREATE TYPE "OutboxEventType" AS ENUM ('EMAIL_VERIFICATION', 'PASSWORD_RESET');
CREATE TYPE "OutboxEventStatus" AS ENUM ('PENDING', 'PROCESSING', 'PROCESSED', 'DEAD_LETTER');

CREATE TABLE "outbox_events" (
  "id" TEXT NOT NULL,
  "type" "OutboxEventType" NOT NULL,
  "status" "OutboxEventStatus" NOT NULL DEFAULT 'PENDING',
  "dedup_key" TEXT NOT NULL,
  "payload_encrypted" TEXT NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "processed_at" TIMESTAMP(3),
  "last_error" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "outbox_events_dedup_key_key" ON "outbox_events"("dedup_key");
CREATE INDEX "outbox_events_status_available_at_created_at_idx"
  ON "outbox_events"("status", "available_at", "created_at");

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "outbox_events" TO ax_app;
