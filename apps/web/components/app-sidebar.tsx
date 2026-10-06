"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Bell,
  CreditCard,
  BookUser,
  History,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Lock,
  LifeBuoy,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  ShieldCheck,
  Users,
} from "@/components/ui/animated-icons";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import type { MembershipRole } from "@ax-finance/db";
import { NavItem, type NavItemData } from "@/components/nav-item";
import { initialsOf } from "@/lib/user-display";

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
      {
        id: "contas",
        title: "Contas e transferências",
        icon: Landmark,
        children: [
          { id: "contas-lista", title: "Contas", icon: Landmark, href: "/contas" },
          { id: "transferencias", title: "Transferências", icon: Landmark, href: "/transferencias" },
        ],
      },
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
        ],
      },
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
  userName,
  userEmail,
  membershipRole,
  canManageMembers,
  isPlatformAdmin,
  planCode,
  canUseCreditCards,
  logoutAction,
  mobileOpen = false,
  onMobileClose,
}: {
  userName: string;
  userEmail: string;
  membershipRole: MembershipRole;
  canManageMembers: boolean;
  isPlatformAdmin: boolean;
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

  const roleLabel: Record<MembershipRole, string> = {
    OWNER: "Proprietário",
    FINANCE_ADMIN: "Administrador financeiro",
    OPERATOR: "Operador",
    ACCOUNTANT: "Contador",
    VIEWER: "Consulta",
  };
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
      <button
        type="button"
        onClick={() => updateCollapsed(!collapsed)}
        className={`app-sidebar-toggle absolute z-10 hidden shrink-0 place-items-center rounded-lg border border-transparent outline-none transition-[background-color,border-color,color,box-shadow,transform] focus-visible:ring-2 focus-visible:ring-primary/40 md:grid ${
          collapsed
            ? "top-[11px] -right-3 size-7 bg-card shadow-sm"
            : "top-3 right-3 size-8"
        }`}
        aria-label={collapsed ? "Expandir menu lateral" : "Recolher menu lateral"}
        aria-expanded={!collapsed}
        aria-controls="app-sidebar-navigation"
        title={collapsed ? "Expandir menu" : "Recolher menu"}
      >
        {collapsed ? <PanelLeftOpen className="size-3.5" strokeWidth={1.7} /> : <PanelLeftClose className="size-4" strokeWidth={1.7} />}
      </button>

      <div className={`flex h-full w-full flex-col overflow-hidden p-3 transition-[width,padding] duration-300 ease-in-out ${collapsed ? "md:w-[72px] md:p-2" : "md:w-[260px] md:p-3"}`}>
        <div id="app-sidebar-navigation" role="navigation" className="flex flex-1 flex-col items-stretch gap-4 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="flex shrink-0 items-center">
            <div className={`min-w-0 flex-1 ${collapsed ? "" : "pr-9"}`}>
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
                  <span className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
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
          {isPlatformAdmin ? <NavItem collapsed={collapsed} item={{ id: "admin-interno", title: "Administração interna", icon: ShieldCheck, href: "/admin" }} /> : null}
          <NavItem collapsed={collapsed} item={{ id: "notificacoes", title: "Notificações", icon: Bell, href: "/configuracoes/notificacoes" }} />
          <NavItem collapsed={collapsed} item={{ id: "seguranca", title: "Segurança", icon: Settings, href: "/configuracoes/seguranca" }} />
          <NavItem collapsed={collapsed} item={{ id: "suporte", title: "Suporte", icon: LifeBuoy, href: "/configuracoes/suporte" }} />
          {canManageMembers ? (
            <>
              <NavItem collapsed={collapsed} item={{ id: "assinatura", title: "Assinatura", icon: CreditCard, href: "/configuracoes/assinatura" }} />
              <NavItem collapsed={collapsed} item={{ id: "usuarios", title: "Usuários e acessos", icon: Users, href: "/configuracoes/usuarios" }} />
            </>
          ) : null}

          <div
            className={`mt-2 flex items-center overflow-hidden rounded-xl py-1 transition-[gap,padding] duration-300 ${collapsed ? "justify-center px-0" : "gap-3 px-1"}`}
            title={collapsed ? `${userName} — ${roleLabel[membershipRole]}` : undefined}
          >
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
              {initialsOf(userName)}
            </span>
            <span className={`min-w-0 flex-1 transition-opacity duration-200 ${collapsed ? "sr-only opacity-0" : "opacity-100"}`}>
              <span className="block truncate text-[13px] font-medium text-foreground">
                {userName}
              </span>
              <span className="block truncate text-[11px] text-muted-foreground">{userEmail}</span>
              <span className="block truncate text-[10px] text-muted-foreground/70">
                {roleLabel[membershipRole]}
              </span>
            </span>
          </div>

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
