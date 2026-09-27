ALTER TYPE "NotificationType" ADD VALUE 'IMPORT_COMPLETED';
ALTER TYPE "NotificationType" ADD VALUE 'IMPORT_FAILED';

CREATE TYPE "ImportFileFormat" AS ENUM ('CSV', 'OFX');
CREATE TYPE "ImportBatchStatus" AS ENUM ('PREVIEW', 'QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');
CREATE TYPE "ImportJobStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

ALTER TABLE "import_batches"
  ADD COLUMN "file_format" "ImportFileFormat" NOT NULL DEFAULT 'CSV',
  ADD COLUMN "status" "ImportBatchStatus" NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN "file_size_bytes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "storage_key" TEXT,
  ADD COLUMN "column_mapping" JSONB,
  ADD COLUMN "requested_by_user_id" TEXT,
  ADD COLUMN "started_at" TIMESTAMP(3),
  ADD COLUMN "completed_at" TIMESTAMP(3),
  ADD COLUMN "failure_code" TEXT,
  ADD COLUMN "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "import_batches"
  ALTER COLUMN "row_count" SET DEFAULT 0,
  ALTER COLUMN "imported_count" SET DEFAULT 0,
  ALTER COLUMN "duplicate_count" SET DEFAULT 0,
  ALTER COLUMN "invalid_count" SET DEFAULT 0;

UPDATE "import_batches"
SET "completed_at" = "created_at", "updated_at" = "created_at"
WHERE "status" = 'COMPLETED';

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_file_size_check"
  CHECK ("file_size_bytes" >= 0 AND "file_size_bytes" <= 20971520);

CREATE UNIQUE INDEX "import_batches_storage_key_key" ON "import_batches"("storage_key");
CREATE INDEX "import_batches_company_id_status_created_at_idx"
  ON "import_batches"("company_id", "status", "created_at");

ALTER TABLE "import_batches"
  ADD CONSTRAINT "import_batches_requested_by_user_id_fkey"
  FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "import_jobs" (
  "id" TEXT NOT NULL,
  "import_batch_id" TEXT NOT NULL,
  "company_id" TEXT NOT NULL,
  "run_as_user_id" TEXT NOT NULL,
  "status" "ImportJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "available_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "locked_at" TIMESTAMP(3),
  "locked_by" TEXT,
  "last_error" TEXT,
  "completed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "import_jobs_import_batch_id_key" ON "import_jobs"("import_batch_id");
CREATE INDEX "import_jobs_status_available_at_created_at_idx"
  ON "import_jobs"("status", "available_at", "created_at");
CREATE INDEX "import_jobs_company_id_idx" ON "import_jobs"("company_id");

ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_import_batch_id_fkey"
  FOREIGN KEY ("import_batch_id") REFERENCES "import_batches"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "import_jobs" ADD CONSTRAINT "import_jobs_run_as_user_id_fkey"
  FOREIGN KEY ("run_as_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A fila contém apenas IDs técnicos. O conteúdo bancário continua protegido
-- pelo RLS de import_batches/bank_statement_lines e pelo volume privado.
GRANT SELECT, INSERT, UPDATE, DELETE ON "import_jobs" TO ax_app;
