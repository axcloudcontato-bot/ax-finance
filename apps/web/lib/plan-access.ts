import { redirect } from "next/navigation";
import { getCompanyPlanAccess, type PlanFeature } from "@ax-finance/domain";

const FEATURE_QUERY: Record<PlanFeature, string> = {
  BANK_RECONCILIATION: "conciliacao-bancaria",
  PERIOD_CLOSING: "fechamento",
  AUDIT_LOG: "auditoria",
  MANAGERIAL_DRE: "dre-gerencial",
};

export async function requirePlanFeature(userId: string, companyId: string, feature: PlanFeature) {
  const access = await getCompanyPlanAccess(userId, companyId);
  if (!access.features.includes(feature)) {
    redirect(`/configuracoes/assinatura?recurso=${FEATURE_QUERY[feature]}`);
  }
  return access;
}
