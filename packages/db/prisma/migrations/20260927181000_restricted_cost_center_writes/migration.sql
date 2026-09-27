DROP POLICY IF EXISTS cost_centers_all ON "cost_centers";
CREATE POLICY cost_centers_all ON "cost_centers" FOR ALL
  USING (
    "company_id" = current_setting('app.current_company_id', true)
    AND app_can_access_cost_center("company_id", "id")
  )
  WITH CHECK (
    "company_id" = current_setting('app.current_company_id', true)
    AND app_can_access_cost_center("company_id", "id")
  );
