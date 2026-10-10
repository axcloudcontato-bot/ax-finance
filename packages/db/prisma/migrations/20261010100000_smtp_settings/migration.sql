-- Configuração do servidor de e-mail (SMTP) da plataforma, editada no painel administrativo.
-- Uma única linha ("default"). Sem ela, ou desligada, o worker usa as variáveis SMTP_* do .env.
CREATE TABLE "smtp_settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "host" TEXT NOT NULL,
  "port" INTEGER NOT NULL,
  "secure" BOOLEAN NOT NULL DEFAULT false,
  "username" TEXT,
  -- Senha cifrada (AES-256-GCM, mesma chave da outbox); nunca volta para a tela.
  "password_encrypted" TEXT,
  "from_address" TEXT NOT NULL,
  "updated_by_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "smtp_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "smtp_settings_singleton" CHECK ("id" = 'default'),
  CONSTRAINT "smtp_settings_port_range" CHECK ("port" BETWEEN 1 AND 65535)
);

ALTER TABLE "smtp_settings" ADD CONSTRAINT "smtp_settings_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "smtp_settings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "smtp_settings" FORCE ROW LEVEL SECURITY;

-- Leitura: administradores da plataforma (tela) e processos sem usuário no contexto (o worker, que
-- envia os e-mails). Uma requisição de cliente, que sempre roda com app.current_user_id, não lê.
CREATE POLICY smtp_settings_select ON "smtp_settings" FOR SELECT
  USING (public.app_is_platform_admin() OR COALESCE(current_setting('app.current_user_id', true), '') = '');

-- Escrita só por administrador da plataforma (o domínio ainda restringe ao super administrador).
CREATE POLICY smtp_settings_admin_write ON "smtp_settings" FOR ALL
  USING (public.app_is_platform_admin())
  WITH CHECK (public.app_is_platform_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON "smtp_settings" TO ax_app;
