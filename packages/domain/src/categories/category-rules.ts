import { z } from "zod";
import { withCompanyContext, type TenantScopedClient } from "@ax-finance/db";
import { assertActiveMembership } from "../companies/assert-membership";
import { assertCompanyPermission } from "../companies/permissions";
import { recordAuditEvent } from "../audit/record-audit-event";
import { CategoryNotFoundError, CategoryRuleNotFoundError, CostCenterNotFoundError, PartyNotFoundError } from "../errors";

export const CATEGORY_RULE_MATCHES = ["CONTAINS", "STARTS_WITH", "EQUALS"] as const;
export const CATEGORY_RULE_SCOPES = ["RECEIVABLE", "PAYABLE", "BOTH"] as const;
export type CategoryRuleMatchType = (typeof CATEGORY_RULE_MATCHES)[number];
export type CategoryRuleScopeType = (typeof CATEGORY_RULE_SCOPES)[number];

export const categoryRuleInput = z.object({
  pattern: z.string().trim().min(2).max(120),
  matchType: z.enum(CATEGORY_RULE_MATCHES).default("CONTAINS"),
  appliesTo: z.enum(CATEGORY_RULE_SCOPES).default("BOTH"),
  categoryId: z.string().uuid(),
  costCenterId: z.string().uuid().nullish(),
  partyId: z.string().uuid().nullish(),
});

/** Comparação sem maiúsculas, acentos nem espaços repetidos: "Uber *Trip" casa com "uber". */
export function normalizeRuleText(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
}

export interface RuleLike {
  id: string;
  pattern: string;
  matchType: CategoryRuleMatchType;
  appliesTo: CategoryRuleScopeType;
}

const SPECIFICITY: Record<CategoryRuleMatchType, number> = { EQUALS: 3, STARTS_WITH: 2, CONTAINS: 1 };

/**
 * Primeira regra que casa com a descrição, da mais específica para a mais geral: "igual a" antes de
 * "começa com" antes de "contém"; empate, o texto mais longo ("uber eats" antes de "uber").
 */
export function matchCategoryRule<T extends RuleLike>(rules: T[], description: string, type: "RECEIVABLE" | "PAYABLE"): T | null {
  const text = normalizeRuleText(description);
  if (!text) return null;
  const ordered = [...rules].sort((left, right) =>
    SPECIFICITY[right.matchType] - SPECIFICITY[left.matchType] || normalizeRuleText(right.pattern).length - normalizeRuleText(left.pattern).length);
  for (const rule of ordered) {
    if (rule.appliesTo !== "BOTH" && rule.appliesTo !== type) continue;
    const pattern = normalizeRuleText(rule.pattern);
    if (!pattern) continue;
    const hit = rule.matchType === "EQUALS" ? text === pattern : rule.matchType === "STARTS_WITH" ? text.startsWith(pattern) : text.includes(pattern);
    if (hit) return rule;
  }
  return null;
}

async function assertReferences(tx: TenantScopedClient, companyId: string, data: z.infer<typeof categoryRuleInput>) {
  const category = await tx.category.findFirst({ where: { id: data.categoryId, companyId, status: "ACTIVE" }, select: { id: true } });
  if (!category) throw new CategoryNotFoundError();
  if (data.costCenterId && !(await tx.costCenter.findFirst({ where: { id: data.costCenterId, companyId, status: "ACTIVE" }, select: { id: true } }))) throw new CostCenterNotFoundError();
  if (data.partyId && !(await tx.party.findFirst({ where: { id: data.partyId, companyId, status: "ACTIVE" }, select: { id: true } }))) throw new PartyNotFoundError();
}

const ruleInclude = {
  category: { select: { id: true, name: true, nature: true, status: true } },
  costCenter: { select: { id: true, name: true } },
  party: { select: { id: true, name: true } },
} as const;

export async function listCategoryRules(userId: string, companyId: string) {
  await assertActiveMembership(userId, companyId);
  return withCompanyContext(userId, companyId, (tx) => listCategoryRulesInTx(tx, companyId));
}

export function listCategoryRulesInTx(tx: TenantScopedClient, companyId: string) {
  return tx.categoryRule.findMany({ where: { companyId }, include: ruleInclude, orderBy: [{ pattern: "asc" }] });
}

export async function createCategoryRule(userId: string, companyId: string, rawInput: unknown) {
  const data = categoryRuleInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    await assertReferences(tx, companyId, data);
    const rule = await tx.categoryRule.create({
      data: {
        companyId,
        pattern: data.pattern,
        matchType: data.matchType,
        appliesTo: data.appliesTo,
        categoryId: data.categoryId,
        costCenterId: data.costCenterId ?? null,
        partyId: data.partyId ?? null,
        createdByUserId: userId,
      },
    });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "CATEGORY_RULE_CREATED", resourceType: "CategoryRule", resourceId: rule.id, summary: `Regra "${rule.pattern}" criada` });
    return rule;
  });
}

export async function updateCategoryRule(userId: string, companyId: string, ruleId: string, rawInput: unknown) {
  const data = categoryRuleInput.parse(rawInput);
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const existing = await tx.categoryRule.findFirst({ where: { id: ruleId, companyId }, select: { id: true } });
    if (!existing) throw new CategoryRuleNotFoundError();
    await assertReferences(tx, companyId, data);
    const rule = await tx.categoryRule.update({
      where: { id: ruleId },
      data: { pattern: data.pattern, matchType: data.matchType, appliesTo: data.appliesTo, categoryId: data.categoryId, costCenterId: data.costCenterId ?? null, partyId: data.partyId ?? null },
    });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "CATEGORY_RULE_UPDATED", resourceType: "CategoryRule", resourceId: rule.id, summary: `Regra "${rule.pattern}" atualizada` });
    return rule;
  });
}

export async function deleteCategoryRule(userId: string, companyId: string, ruleId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");
  return withCompanyContext(userId, companyId, async (tx) => {
    const rule = await tx.categoryRule.findFirst({ where: { id: ruleId, companyId } });
    if (!rule) throw new CategoryRuleNotFoundError();
    await tx.categoryRule.delete({ where: { id: ruleId } });
    await recordAuditEvent(tx, { companyId, actorUserId: userId, eventType: "CATEGORY_RULE_DELETED", resourceType: "CategoryRule", resourceId: rule.id, summary: `Regra "${rule.pattern}" excluída` });
  });
}

/**
 * Regra que vale para a descrição, só com categoria ativa e do tipo certo (entrada usa categoria de
 * receita; saída, as demais). Usada pela sugestão de categoria e pelo lançamento a partir do extrato.
 */
export async function findMatchingRuleInTx(tx: TenantScopedClient, companyId: string, description: string, type: "RECEIVABLE" | "PAYABLE") {
  const rules = await listCategoryRulesInTx(tx, companyId);
  const usable = rules.filter((rule) => rule.category.status === "ACTIVE" && (type === "RECEIVABLE" ? rule.category.nature === "OPERATING_REVENUE" : rule.category.nature !== "OPERATING_REVENUE"));
  return matchCategoryRule(usable, description, type);
}
