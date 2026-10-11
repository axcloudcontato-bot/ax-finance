-- O banco concede privilégios padrão ao papel da aplicação; versões não permitem edição ou exclusão.
REVOKE UPDATE, DELETE, TRUNCATE ON report_snapshots FROM ax_app;
CREATE FUNCTION prevent_report_snapshot_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Versões preservadas de relatório não podem ser alteradas ou excluídas.';
END;
$$;
CREATE TRIGGER report_snapshots_immutable BEFORE UPDATE OR DELETE ON report_snapshots
FOR EACH ROW EXECUTE FUNCTION prevent_report_snapshot_mutation();
