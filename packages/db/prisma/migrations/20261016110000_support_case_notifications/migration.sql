-- Chamado aberto pelo cliente avisa a equipe interna por e-mail (outbox).
ALTER TYPE "OutboxEventType" ADD VALUE 'SUPPORT_CASE_OPENED';

-- Destinatários do aviso: administradores internos ativos que atendem chamados. SECURITY DEFINER
-- porque o worker roda sem usuário no contexto e a RLS de platform_admins só libera administradores;
-- a condição final faz a função devolver zero linhas para qualquer chamada feita em nome de um usuário.
CREATE OR REPLACE FUNCTION app_support_case_recipients()
RETURNS TABLE (email TEXT, name TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT u.email, u.name
  FROM public.platform_admins pa
  JOIN public.users u ON u.id = pa.user_id
  WHERE pa.active
    AND pa.role::text IN ('SUPER_ADMIN', 'OPERATIONS', 'SUPPORT')
    AND u.status::text = 'ACTIVE'
    AND COALESCE(current_setting('app.current_user_id', true), '') = ''
$$;

REVOKE ALL ON FUNCTION app_support_case_recipients() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_support_case_recipients() TO ax_app;
