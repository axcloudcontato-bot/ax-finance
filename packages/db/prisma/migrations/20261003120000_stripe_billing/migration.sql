-- Cobrança da assinatura via Stripe (DIRECAO §21).
-- A Stripe é a fonte da verdade do pagamento; estas colunas só guardam os vínculos
-- e o instante do último estado aplicado, para descartar sinais fora de ordem.

ALTER TABLE "subscriptions"
  ADD COLUMN "stripe_customer_id" TEXT,
  ADD COLUMN "stripe_subscription_id" TEXT,
  ADD COLUMN "billing_event_at" TIMESTAMP(3);

CREATE UNIQUE INDEX "subscriptions_stripe_customer_id_key" ON "subscriptions"("stripe_customer_id");
CREATE UNIQUE INDEX "subscriptions_stripe_subscription_id_key" ON "subscriptions"("stripe_subscription_id");

-- Registro de cada webhook recebido: deduplica reentregas e deixa rastro de falhas.
-- Sem política de RLS e sem GRANT: o role da aplicação só alcança esta tabela pelas
-- funções SECURITY DEFINER abaixo.
CREATE TABLE "billing_events" (
  "id" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'STRIPE',
  "event_id" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "company_id" TEXT,
  "outcome" TEXT NOT NULL DEFAULT 'RECEIVED',
  "detail" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "billing_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "billing_events_outcome_check" CHECK ("outcome" IN ('RECEIVED', 'PROCESSED', 'IGNORED', 'FAILED'))
);

CREATE UNIQUE INDEX "billing_events_provider_event_id_key" ON "billing_events"("provider", "event_id");
CREATE INDEX "billing_events_outcome_idx" ON "billing_events"("outcome", "created_at");

ALTER TABLE "billing_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "billing_events" FORCE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE "billing_events" FROM ax_app;

-- Reserva o evento. Verdadeiro quando é novo ou quando uma tentativa anterior não
-- terminou (RECEIVED/FAILED); falso quando já foi processado ou ignorado.
CREATE OR REPLACE FUNCTION app_billing_claim_event(p_event_id TEXT, p_type TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  claimed INTEGER;
BEGIN
  INSERT INTO public.billing_events (id, event_id, type)
  VALUES (gen_random_uuid()::text, p_event_id, p_type)
  ON CONFLICT (provider, event_id) DO UPDATE
    SET type = EXCLUDED.type, updated_at = CURRENT_TIMESTAMP
    WHERE public.billing_events.outcome IN ('RECEIVED', 'FAILED');
  GET DIAGNOSTICS claimed = ROW_COUNT;
  RETURN claimed = 1;
END
$$;

CREATE OR REPLACE FUNCTION app_billing_finish_event(
  p_event_id TEXT,
  p_outcome TEXT,
  p_company_id TEXT,
  p_detail TEXT
)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = ''
AS $$
  UPDATE public.billing_events
  SET outcome = p_outcome,
      company_id = COALESCE(p_company_id, company_id),
      detail = left(p_detail, 500),
      updated_at = CURRENT_TIMESTAMP
  WHERE provider = 'STRIPE' AND event_id = p_event_id
$$;

-- Empresa dona da assinatura de cobrança: pelos ids da Stripe ou, na primeira vez, pela
-- dica de empresa que nós mesmos gravamos nos metadados do checkout.
CREATE OR REPLACE FUNCTION app_billing_find_company(
  p_customer_id TEXT,
  p_subscription_id TEXT,
  p_company_hint TEXT
)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.company_id
  FROM public.subscriptions s
  WHERE s.stripe_subscription_id = p_subscription_id
     OR s.stripe_customer_id = p_customer_id
     OR s.company_id = p_company_hint
  ORDER BY (s.stripe_subscription_id = p_subscription_id) DESC NULLS LAST,
           (s.stripe_customer_id = p_customer_id) DESC NULLS LAST
  LIMIT 1
$$;

-- Aplica o estado confirmado no provedor. Só grava se o instante for igual ou posterior
-- ao último já aplicado (sinais fora de ordem não revertem estado mais novo).
-- A carência nasce na primeira falha e é preservada enquanto o pagamento segue pendente.
CREATE OR REPLACE FUNCTION app_billing_apply(
  p_company_id TEXT,
  p_customer_id TEXT,
  p_subscription_id TEXT,
  p_status TEXT,
  p_plan_code TEXT,
  p_trial_ends_at TIMESTAMP,
  p_current_period_end TIMESTAMP,
  p_grace_ends_at TIMESTAMP,
  p_cancellation_effective_at TIMESTAMP,
  p_event_at TIMESTAMP
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  previous_status public."SubscriptionStatus";
  subscription_id TEXT;
  changed INTEGER;
BEGIN
  SELECT id, status INTO subscription_id, previous_status
  FROM public.subscriptions
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF subscription_id IS NULL THEN
    RETURN FALSE;
  END IF;

  UPDATE public.subscriptions
  SET stripe_customer_id = COALESCE(p_customer_id, stripe_customer_id),
      stripe_subscription_id = COALESCE(p_subscription_id, stripe_subscription_id),
      status = p_status::public."SubscriptionStatus",
      plan_code = COALESCE(p_plan_code, plan_code),
      trial_ends_at = COALESCE(p_trial_ends_at, trial_ends_at),
      current_period_end = COALESCE(p_current_period_end, current_period_end),
      grace_ends_at = CASE
        WHEN p_status IN ('PAYMENT_PENDING', 'GRACE_PERIOD') THEN COALESCE(grace_ends_at, p_grace_ends_at)
        ELSE NULL
      END,
      cancellation_effective_at = p_cancellation_effective_at,
      billing_event_at = p_event_at,
      updated_at = CURRENT_TIMESTAMP
  WHERE company_id = p_company_id
    AND (billing_event_at IS NULL OR billing_event_at <= p_event_at);
  GET DIAGNOSTICS changed = ROW_COUNT;

  IF changed = 1 AND previous_status::text IS DISTINCT FROM p_status THEN
    INSERT INTO public.audit_events (id, company_id, actor_user_id, event_type, resource_type, resource_id, summary, metadata)
    VALUES (
      gen_random_uuid()::text,
      p_company_id,
      'system:stripe',
      'SUBSCRIPTION_BILLING_SYNCED',
      'Subscription',
      subscription_id,
      'Assinatura ' || previous_status::text || ' → ' || p_status || ' (confirmado pela Stripe)',
      jsonb_build_object('from', previous_status::text, 'to', p_status, 'planCode', p_plan_code)
    );
  END IF;

  RETURN changed = 1;
END
$$;

REVOKE ALL ON FUNCTION app_billing_claim_event(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_billing_finish_event(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_billing_find_company(TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION app_billing_apply(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP, TIMESTAMP, TIMESTAMP, TIMESTAMP, TIMESTAMP) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_billing_claim_event(TEXT, TEXT) TO ax_app;
GRANT EXECUTE ON FUNCTION app_billing_finish_event(TEXT, TEXT, TEXT, TEXT) TO ax_app;
GRANT EXECUTE ON FUNCTION app_billing_find_company(TEXT, TEXT, TEXT) TO ax_app;
GRANT EXECUTE ON FUNCTION app_billing_apply(TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMP, TIMESTAMP, TIMESTAMP, TIMESTAMP, TIMESTAMP) TO ax_app;
