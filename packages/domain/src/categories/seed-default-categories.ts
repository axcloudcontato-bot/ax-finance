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
 * DIRECAO.md é o público-alvo; há também o modelo pessoal abaixo) — só isso, nada de especial: são categorias
 * comuns, sem nenhuma marcação "do sistema". O usuário renomeia, arquiva ou
 * cria as suas por cima como faria com qualquer categoria manual.
 */
const BUSINESS_CATEGORY_GROUPS: DefaultCategoryGroup[] = [
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
 * Modelo para quem usa o sistema nas finanças pessoais (plano Gestão Pessoal). As rendas usam a
 * natureza de receita operacional, porque é ela que o seletor de "Nova entrada" aceita; o grupo
 * gerencial é o que a pessoa lê nos relatórios. Dívidas e financiamentos ficam em Financiamento e a
 * reserva em Investimento, para não se misturarem ao gasto do dia a dia.
 */
const PERSONAL_CATEGORY_GROUPS: DefaultCategoryGroup[] = [
  {
    name: "Renda",
    nature: "OPERATING_REVENUE",
    managerialGroup: "Renda",
    children: ["Salário", "Renda extra e trabalhos avulsos", "Rendimentos de investimentos", "Reembolsos e outras entradas"],
  },
  {
    name: "Moradia",
    nature: "EXPENSE",
    managerialGroup: "Moradia",
    children: ["Aluguel", "Condomínio e IPTU", "Água, luz e gás", "Internet e telefone", "Manutenção e reparos"],
  },
  {
    name: "Alimentação",
    nature: "EXPENSE",
    managerialGroup: "Alimentação",
    children: ["Supermercado", "Restaurantes e delivery"],
  },
  {
    name: "Transporte",
    nature: "EXPENSE",
    managerialGroup: "Transporte",
    children: ["Combustível", "Transporte público e aplicativos", "IPVA, seguro e manutenção do veículo"],
  },
  {
    name: "Saúde",
    nature: "EXPENSE",
    managerialGroup: "Saúde",
    children: ["Plano de saúde", "Consultas e exames", "Farmácia"],
  },
  {
    name: "Educação",
    nature: "EXPENSE",
    managerialGroup: "Educação",
    children: ["Escola e faculdade", "Cursos e livros"],
  },
  {
    name: "Lazer e estilo de vida",
    nature: "EXPENSE",
    managerialGroup: "Lazer e estilo de vida",
    children: ["Viagens", "Assinaturas e streaming", "Vestuário", "Cuidados pessoais", "Presentes e doações"],
  },
  {
    name: "Família e pets",
    nature: "EXPENSE",
    managerialGroup: "Família e pets",
    children: ["Filhos", "Pets"],
  },
  {
    name: "Impostos e taxas",
    nature: "EXPENSE",
    managerialGroup: "Impostos e taxas",
    children: ["Imposto de renda", "Tarifas bancárias", "Juros e multas pagos"],
  },
  {
    name: "Dívidas e financiamentos",
    nature: "FINANCING",
    managerialGroup: "Dívidas e financiamentos",
    children: ["Financiamento do imóvel ou veículo", "Empréstimos"],
  },
  {
    name: "Investimentos e reserva",
    nature: "INVESTMENT",
    managerialGroup: "Investimentos e reserva",
    children: ["Reserva de emergência", "Aportes em investimentos", "Previdência privada"],
  },
];

export type DefaultCategoryTemplate = "BUSINESS" | "PERSONAL";

const CATEGORY_TEMPLATES: Record<DefaultCategoryTemplate, DefaultCategoryGroup[]> = {
  BUSINESS: BUSINESS_CATEGORY_GROUPS,
  PERSONAL: PERSONAL_CATEGORY_GROUPS,
};

/** Plano Gestão Pessoal começa com o modelo pessoal; os demais, com o de empresa de serviços. */
export function categoryTemplateForPlan(planCode: string | null | undefined): DefaultCategoryTemplate {
  return planCode?.toUpperCase() === "PERSONAL" ? "PERSONAL" : "BUSINESS";
}

/**
 * Núcleo puro (recebe `tx` de fora) — usado tanto por `seedDefaultCategories`
 * (abre sua própria transação) quanto por `completeOnboarding` (roda dentro
 * da mesma transação que já criou a empresa/conta, pra tudo ser atômico).
 * Não faz nada se a empresa já tiver qualquer categoria — evita duplicar
 * caso seja chamado mais de uma vez para a mesma empresa.
 */
export async function createDefaultCategoriesInTx(
  tx: TenantScopedClient,
  companyId: string,
  template: DefaultCategoryTemplate = "BUSINESS",
) {
  const existingCount = await tx.category.count({ where: { companyId } });
  if (existingCount > 0) {
    return [];
  }

  const created = [];
  for (const [groupIndex, group] of CATEGORY_TEMPLATES[template].entries()) {
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
export async function seedDefaultCategories(userId: string, companyId: string, template: DefaultCategoryTemplate = "BUSINESS") {
  await assertCompanyPermission(userId, companyId, "CATALOG_WRITE");

  return withCompanyContext(userId, companyId, (tx) => createDefaultCategoriesInTx(tx, companyId, template));
}
