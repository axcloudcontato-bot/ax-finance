import type { TenantScopedClient } from "@ax-finance/db";
import { withCompanyContext } from "@ax-finance/db";
import { assertCompanyPermission } from "../companies/permissions";
import type { CATEGORY_NATURES } from "./create-category";

type CategoryNature = (typeof CATEGORY_NATURES)[number];

interface DefaultCategoryGroup {
  name: string;
  nature: CategoryNature;
  managerialGroup: string;
  children: string[];
}

/**
 * Ponto de partida razoável pra uma empresa de serviços (Seção 4 do
 * DIRECAO.md é o público-alvo) — só isso, nada de especial: são categorias
 * comuns, sem nenhuma marcação "do sistema". O usuário renomeia, arquiva ou
 * cria as suas por cima como faria com qualquer categoria manual.
 */
const DEFAULT_CATEGORY_GROUPS: DefaultCategoryGroup[] = [
  {
    name: "Receita de serviços",
    nature: "OPERATING_REVENUE",
    managerialGroup: "Receita de serviços",
    children: ["Serviços prestados", "Consultoria e projetos"],
  },
  {
    name: "Custos diretos",
    nature: "COST",
    managerialGroup: "Custos diretos",
    children: ["Mão de obra direta", "Materiais e insumos"],
  },
  {
    name: "Despesas com pessoal",
    nature: "EXPENSE",
    managerialGroup: "Despesas com pessoal",
    children: ["Salários e encargos", "Benefícios"],
  },
  {
    name: "Despesas administrativas",
    nature: "EXPENSE",
    managerialGroup: "Despesas administrativas",
    children: ["Aluguel e condomínio", "Água, luz e internet", "Material de escritório"],
  },
  {
    name: "Despesas comerciais",
    nature: "EXPENSE",
    managerialGroup: "Despesas comerciais",
    children: ["Marketing e publicidade", "Comissões sobre vendas"],
  },
  {
    name: "Despesas financeiras",
    nature: "EXPENSE",
    managerialGroup: "Despesas financeiras",
    children: ["Tarifas bancárias", "Juros e multas pagos"],
  },
  {
    name: "Investimentos",
    nature: "INVESTMENT",
    managerialGroup: "Investimentos",
    children: ["Equipamentos", "Software e licenças"],
  },
];

/**
 * Núcleo puro (recebe `tx` de fora) — usado tanto por `seedDefaultCategories`
 * (abre sua própria transação) quanto por `completeOnboarding` (roda dentro
 * da mesma transação que já criou a empresa/conta, pra tudo ser atômico).
 * Não faz nada se a empresa já tiver qualquer categoria — evita duplicar
 * caso seja chamado mais de uma vez para a mesma empresa.
 */
export async function createDefaultCategoriesInTx(tx: TenantScopedClient, companyId: string) {
  const existingCount = await tx.category.count({ where: { companyId } });
  if (existingCount > 0) {
    return [];
  }

  const created = [];
  for (const [groupIndex, group] of DEFAULT_CATEGORY_GROUPS.entries()) {
    const parent = await tx.category.create({
      data: {
        companyId,
        name: group.name,
        nature: group.nature,
        managerialGroup: group.managerialGroup,
        order: groupIndex,
      },
    });
    created.push(parent);

    for (const [childIndex, childName] of group.children.entries()) {
      const child = await tx.category.create({
        data: {
          companyId,
          name: childName,
          nature: group.nature,
          managerialGroup: group.managerialGroup,
          parentId: parent.id,
          order: childIndex,
        },
      });
      created.push(child);
    }
  }

  return created;
}

/** Chamado uma vez logo após `createCompany` — para código chamando fora de uma transação já aberta. */
export async function seedDefaultCategories(userId: string, companyId: string) {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");

  return withCompanyContext(userId, companyId, (tx) => createDefaultCategoriesInTx(tx, companyId));
}
