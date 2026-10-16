"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  CreditCard,
  BookUser,
  CalendarDays,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Lock,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  PiggyBank,
  TrendingUp,
} from "@/components/ui/animated-icons";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { NavItem, type NavItemData } from "@/components/nav-item";

interface NavGroup {
  heading?: string;
  items: NavItemData[];
}

// Menu principal da Seção 4 do DIRECAO.md, agrupado. Só Configurações e
// alguns cadastros planejados ainda mostram "Em breve" em vez de virar link
// morto (Seção 24: separar disponível, piloto e planejado) — o resto já
// navega para rotas reais.
const NAV_GROUPS: NavGroup[] = [
  {
    heading: "Financeiro",
    items: [
      { id: "entradas", title: "Entradas", icon: ArrowDownCircle, href: "/entradas" },
      { id: "saidas", title: "Saídas", icon: ArrowUpCircle, href: "/saidas" },
      { id: "calendario", title: "Calendário", icon: CalendarDays, href: "/calendario" },
      {
        id: "contas",
        title: "Contas e transferências",
        icon: Landmark,
        children: [
          { id: "contas-lista", title: "Contas", icon: Landmark, href: "/contas" },
          { id: "transferencias", title: "Transferências", icon: Landmark, href: "/transferencias" },
        ],
      },
      { id: "cofrinhos", title: "Cofrinhos", icon: PiggyBank, href: "/cofrinhos" },
      { id: "dividas", title: "Dívidas", icon: CreditCard, href: "/dividas" },
      { id: "patrimonio", title: "Patrimônio", icon: TrendingUp, href: "/patrimonio" },
      { id: "cartoes", title: "Cartões de crédito", icon: CreditCard, href: "/cartoes" },
      { id: "conciliacao", title: "Conciliação", icon: ListChecks, href: "/conciliacao" },
    ],
  },
  {
    heading: "Gestão",
    items: [
      {
        id: "relatorios",
        title: "Relatórios",
        icon: BarChart3,
        children: [
          { id: "rel-fluxo", title: "Fluxo de caixa", icon: BarChart3, href: "/relatorios/fluxo-de-caixa" },
          {
            id: "rel-receber-pagar",
            title: "Contas a receber/pagar",
            icon: BarChart3,
            href: "/relatorios/em-aberto",
          },
          { id: "rel-dre", title: "DRE gerencial", icon: BarChart3, href: "/relatorios/dre" },
          { id: "rel-rentabilidade", title: "Rentabilidade", icon: BarChart3, href: "/relatorios/rentabilidade" },
          { id: "rel-forma", title: "Forma de pagamento", icon: BarChart3, href: "/relatorios/forma-de-pagamento" },
          { id: "rel-mensal", title: "Relatório mensal (PDF)", icon: BarChart3, href: "/relatorios/mensal" },
        ],
      },
      {
        id: "cadastros",
        title: "Cadastros",
        icon: BookUser,
        children: [
          { id: "cad-categorias", title: "Categorias", icon: BookUser, href: "/cadastros/categorias" },
          { id: "cad-centros-custo", title: "Centros de custo", icon: BookUser, href: "/cadastros/centros-de-custo" },
          { id: "cad-pessoas", title: "Clientes e fornecedores", icon: BookUser, href: "/cadastros/pessoas" },
          { id: "cad-regras", title: "Regras de categoria", icon: BookUser, href: "/cadastros/regras" },
        ],
      },
      { id: "orcamento", title: "Orçamento", icon: ListChecks, href: "/orcamento" },
      { id: "auditoria", title: "Auditoria", icon: History, href: "/auditoria" },
      { id: "fechamento", title: "Fechamento", icon: Lock, href: "/fechamento" },
    ],
  },
];

const DASHBOARD_ITEM: NavItemData = {
  id: "dashboard",
  title: "Dashboard",
  icon: LayoutDashboard,
  href: "/dashboard",
};

const SIDEBAR_PREFERENCE_KEY = "ax-finance:sidebar-collapsed:v1";

export function AppSidebar({
  planCode,
  canUseCreditCards,
  logoutAction,
  mobileOpen = false,
  onMobileClose,
}: {
  planCode: "PERSONAL" | "ESSENTIAL";
  /** Falso para quem tem acesso restrito a centros de custo: a fatura mistura vários centros. */
  canUseCreditCards: boolean;
  logoutAction: () => void | Promise<void>;
  /** Abaixo de md o menu vira uma gaveta; quem controla a abertura é o AppShell. */
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const [storedCollapsed, setCollapsed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  // Na gaveta o menu é sempre completo; a preferência de recolher só vale no desktop.
  const collapsed = storedCollapsed && isDesktop;
  const pathname = usePathname();

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(SIDEBAR_PREFERENCE_KEY) === "true");
    } catch {
      // O menu continua funcional mesmo quando o navegador bloqueia storage.
    }

    function syncPreference(event: StorageEvent) {
      if (event.key === SIDEBAR_PREFERENCE_KEY) setCollapsed(event.newValue === "true");
    }
    window.addEventListener("storage", syncPreference);

    const media = window.matchMedia("(min-width: 768px)");
    const syncViewport = () => setIsDesktop(media.matches);
    syncViewport();
    media.addEventListener("change", syncViewport);

    return () => {
      window.removeEventListener("storage", syncPreference);
      media.removeEventListener("change", syncViewport);
    };
  }, []);

  // Navegar fecha a gaveta; Esc também.
  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onMobileClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  function updateCollapsed(nextValue: boolean) {
    setCollapsed(nextValue);
    try {
      localStorage.setItem(SIDEBAR_PREFERENCE_KEY, String(nextValue));
    } catch {
      // Preferência não persistida; o estado da tela atual continua válido.
    }
  }

  const unavailableItems = new Set<string>(
    planCode === "PERSONAL" ? ["conciliacao", "rel-dre", "auditoria", "fechamento"] : [],
  );
  if (!canUseCreditCards) unavailableItems.add("cartoes");
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items
      .filter((item) => !unavailableItems.has(item.id))
      .map((item) => item.children
        ? { ...item, children: item.children.filter((child) => !unavailableItems.has(child.id)) }
        : item),
  })).filter((group) => group.items.length > 0);

  return (
    <>
    {/* Fundo da gaveta no celular: toque fora fecha. */}
    <button
      type="button"
      tabIndex={-1}
      aria-hidden="true"
      onClick={onMobileClose}
      className={`app-sidebar-backdrop fixed inset-x-0 top-16 bottom-0 z-30 md:hidden ${mobileOpen ? "is-open" : ""}`}
    />
    <aside
      className={`app-sidebar border-r border-border md:relative md:z-auto md:h-full md:shrink-0 md:bg-card/50 md:transition-[width] md:duration-300 md:ease-in-out ${
        collapsed ? "md:w-[72px]" : "md:w-[260px]"
      } ${mobileOpen ? "is-open" : ""}`}
      aria-label="Navegação principal"
      data-collapsed={collapsed}
    >
      <div className={`flex h-full w-full flex-col overflow-hidden p-3 transition-[width,padding] duration-300 ease-in-out ${collapsed ? "md:w-[72px] md:p-2" : "md:w-[260px] md:p-3"}`}>
        <div id="app-sidebar-navigation" role="navigation" className="flex flex-1 flex-col items-stretch gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center">
            <div className="min-w-0 flex-1">
              <NavItem
                item={DASHBOARD_ITEM}
                collapsed={collapsed}
                onRequestExpand={() => updateCollapsed(false)}
              />
            </div>
          </div>

          {visibleGroups.map((group, index) => (
            <div key={group.heading ?? index} className="flex flex-col gap-0.5">
              {group.heading ? (
                collapsed ? (
                  <span className="mx-2 mb-1 border-t border-border" aria-hidden="true" />
                ) : (
                  <span className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {group.heading}
                  </span>
                )
              ) : null}
              {group.items.map((item) => (
                <NavItem
                  key={item.id}
                  item={item}
                  collapsed={collapsed}
                  onRequestExpand={() => updateCollapsed(false)}
                />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          {/* Recolher/expandir o menu (só no desktop): no rodapé, ao lado de Sair. */}
          <button
            type="button"
            onClick={() => updateCollapsed(!collapsed)}
            className={`app-sidebar-toggle hidden w-full items-center rounded-[6px] py-[7px] text-left text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 md:flex ${collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"}`}
            aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
            aria-expanded={!collapsed}
            aria-controls="app-sidebar-navigation"
            title={collapsed ? "Expandir menu" : undefined}
          >
            {collapsed ? <PanelLeftOpen className="size-4 shrink-0" strokeWidth={1.5} /> : <PanelLeftClose className="size-4 shrink-0" strokeWidth={1.5} />}
            <span className={collapsed ? "sr-only" : undefined}>Recolher menu</span>
          </button>

          <form action={logoutAction}>
            <button
              type="submit"
              onClick={() => {
                sessionStorage.removeItem("ax-finance:period-filter:v1");
                Object.keys(sessionStorage)
                  .filter((key) => key.startsWith("ax-finance:dashboard-filters:v1:"))
                  .forEach((key) => sessionStorage.removeItem(key));
              }}
              className={`app-sidebar-logout flex w-full items-center rounded-[6px] py-[7px] text-left text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary/40 ${collapsed ? "justify-center px-0" : "gap-2.5 px-2.5"}`}
              aria-label={collapsed ? "Sair" : undefined}
              title={collapsed ? "Sair" : undefined}
            >
              <LogOut className="size-4 shrink-0" strokeWidth={1.5} />
              <span className={collapsed ? "sr-only" : undefined}>Sair</span>
            </button>
          </form>
        </div>
      </div>
    </aside>
    </>
  );
}
