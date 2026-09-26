-- AlterTable
ALTER TABLE "titles" ADD COLUMN     "installment_count" INTEGER,
ADD COLUMN     "installment_group_id" TEXT,
ADD COLUMN     "installment_number" INTEGER;

-- CreateIndex
CREATE INDEX "titles_company_id_installment_group_id_idx" ON "titles"("company_id", "installment_group_id");
