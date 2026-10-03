-- Conta interna (sem cobrança): empresas da própria operação, que não pagam e não podem ser
-- bloqueadas por assinatura. O marcador é ligado só por um SUPER_ADMIN (com auditoria) e faz
-- três coisas: o bloqueio de escrita ignora a empresa (domínio), o webhook/conciliação não
-- alteram o estado dela e a conciliação nem a lista.
ALTER TABLE "subscriptions" ADD COLUMN "billing_exempt" BOOLEAN NOT NULL DEFAULT false;

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
  is_exempt BOOLEAN;
  changed INTEGER;
BEGIN
  SELECT id, status, billing_exempt INTO subscription_id, previous_status, is_exempt
  FROM public.subscriptions
  WHERE company_id = p_company_id
  FOR UPDATE;

  IF subscription_id IS NULL OR is_exempt THEN
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

CREATE OR REPLACE FUNCTION app_billing_list_reconcilable(p_limit INTEGER)
RETURNS TABLE (
  company_id TEXT,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  status TEXT,
  plan_code TEXT,
  current_period_end TIMESTAMP,
  cancellation_effective_at TIMESTAMP
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT s.company_id,
         s.stripe_customer_id,
         s.stripe_subscription_id,
         s.status::text,
         s.plan_code,
         s.current_period_end,
         s.cancellation_effective_at
  FROM public.subscriptions s
  WHERE NOT s.billing_exempt
    AND ((s.stripe_subscription_id IS NOT NULL AND s.status <> 'CANCELLED')
      OR (s.stripe_subscription_id IS NULL
          AND s.stripe_customer_id IS NOT NULL
          AND s.updated_at > CURRENT_TIMESTAMP - INTERVAL '3 days'))
  ORDER BY s.billing_event_at ASC NULLS FIRST
  LIMIT GREATEST(1, LEAST(p_limit, 500))
$$;
