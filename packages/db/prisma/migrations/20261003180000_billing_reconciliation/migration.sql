-- Conciliação periódica com a Stripe (DIRECAO §21): o worker não tem usuário nem empresa
-- no contexto, então lista o que reconciliar por uma função SECURITY DEFINER que devolve
-- só os campos de cobrança (nenhum dado financeiro da empresa).
--
-- Entram: assinaturas já vinculadas à Stripe que não terminaram e, por 3 dias, clientes
-- criados no primeiro checkout cujo webhook nunca chegou a vincular a assinatura. As mais
-- antigas sem sincronização vêm primeiro e o lote é limitado.
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
  WHERE (s.stripe_subscription_id IS NOT NULL AND s.status <> 'CANCELLED')
     OR (s.stripe_subscription_id IS NULL
         AND s.stripe_customer_id IS NOT NULL
         AND s.updated_at > CURRENT_TIMESTAMP - INTERVAL '3 days')
  ORDER BY s.billing_event_at ASC NULLS FIRST
  LIMIT GREATEST(1, LEAST(p_limit, 500))
$$;

REVOKE ALL ON FUNCTION app_billing_list_reconcilable(INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_billing_list_reconcilable(INTEGER) TO ax_app;
