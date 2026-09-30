import type { Prisma } from "@ax-finance/db";
import { withCompanyContext } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { PlanFeatureUnavailableError } from "../errors";

export const PLAN_FEATURES = [
  "BANK_RECONCILIATION",
  "PERIOD_CLOSING",
  "AUDIT_LOG",
  "MANAGERIAL_DRE",
] as const;

export type PlanFeature = (typeof PLAN_FEATURES)[number];
export type SelectablePlanCode = "PERSONAL" | "ESSENTIAL";

export const PLAN_CATALOG = {
  PERSONAL: {
    code: "PERSONAL",
    name: "Gestão Pessoal",
    monthlyPriceCents: 2990,
    features: [] as readonly PlanFeature[],
  },
  ESSENTIAL: {
    code: "ESSENTIAL",
    name: "Essencial",
    monthlyPriceCents: 5900,
    features: [...PLAN_FEATURES] as readonly PlanFeature[],
  },
} as const;

export type PlanDefinition = (typeof PLAN_CATALOG)[SelectablePlanCode];

/**
 * Códigos antigos e administrativos continuam com o conjunto completo para
 * evitar retirar recursos de assinaturas já existentes durante a migração.
 */
export function resolvePlanDefinition(planCode: string | null | undefined): PlanDefinition {
  return planCode?.toUpperCase() === "PERSONAL" ? PLAN_CATALOG.PERSONAL : PLAN_CATALOG.ESSENTIAL;
}

export function isPlanFeatureEnabled(planCode: string | null | undefined, feature: PlanFeature): boolean {
  return resolvePlanDefinition(planCode).features.includes(feature);
}

async function findSubscriptionPlanCode(tx: Prisma.TransactionClient, companyId: string) {
  const subscription = await tx.subscription.findUnique({
    where: { companyId },
    select: { planCode: true, status: true },
  });
  return subscription;
}

export async function getCompanyPlanAccess(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  const subscription = await withCompanyContext(userId, companyId, (tx) =>
    findSubscriptionPlanCode(tx, companyId)
  );
  const plan = resolvePlanDefinition(subscription?.planCode);
  return {
    code: plan.code,
    name: plan.name,
    monthlyPriceCents: plan.monthlyPriceCents,
    features: [...plan.features],
    subscriptionStatus: subscription?.status ?? null,
  };
}

export async function assertCompanyPlanFeature(
  userId: string,
  companyId: string,
  feature: PlanFeature
) {
  await assertActiveMembership(userId, companyId);
  const subscription = await withCompanyContext(userId, companyId, (tx) =>
    findSubscriptionPlanCode(tx, companyId)
  );
  if (!isPlanFeatureEnabled(subscription?.planCode, feature)) {
    throw new PlanFeatureUnavailableError(resolvePlanDefinition(subscription?.planCode).name);
  }
}
