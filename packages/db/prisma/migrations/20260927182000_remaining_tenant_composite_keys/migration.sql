ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_parent_id_fkey";
ALTER TABLE "categories" ADD CONSTRAINT "categories_parent_company_fkey"
  FOREIGN KEY ("parent_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurrence_rules" DROP CONSTRAINT IF EXISTS "recurrence_rules_category_id_fkey";
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_category_company_fkey"
  FOREIGN KEY ("category_id", "company_id") REFERENCES "categories"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "recurrence_rules" DROP CONSTRAINT IF EXISTS "recurrence_rules_party_id_fkey";
ALTER TABLE "recurrence_rules" ADD CONSTRAINT "recurrence_rules_party_company_fkey"
  FOREIGN KEY ("party_id", "company_id") REFERENCES "parties"("id", "company_id") ON DELETE RESTRICT ON UPDATE CASCADE;
