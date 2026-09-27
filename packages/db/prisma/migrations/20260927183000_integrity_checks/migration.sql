ALTER TABLE "attachments" ADD CONSTRAINT "attachments_storage_backend_check"
  CHECK ("storage_backend" IN ('LOCAL', 'S3'));

ALTER TABLE "titles" ADD CONSTRAINT "titles_soft_delete_consistency_check"
  CHECK (
    ("deleted_at" IS NULL AND "deleted_by_user_id" IS NULL AND "delete_reason" IS NULL)
    OR
    ("deleted_at" IS NOT NULL AND "deleted_by_user_id" IS NOT NULL AND length(trim("delete_reason")) > 0)
  );

ALTER TABLE "memberships" ADD CONSTRAINT "memberships_owner_unrestricted_check"
  CHECK ("role" <> 'OWNER' OR "access_scope" = 'ALL');
