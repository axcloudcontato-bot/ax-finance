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
  LogOut,
  Settings,
  Users,
} from "lucide-react";
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
    items: [{ id: "dashboard", title: "Dashboard", icon: LayoutDashboard, href: "/dashboard" }],
  },
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
          { id: "cad-pessoas", title: "Clientes e fornecedores", icon: BookUser, href: "/cadastros/pessoas" },
        ],
      },
      { id: "auditoria", title: "Auditoria", icon: History, href: "/auditoria" },
      { id: "fechamento", title: "Fechamento", icon: Lock, href: "/fechamento" },
    ],
  },
];

export function AppSidebar({
  userName,
  userEmail,
  membershipRole,
  canManageMembers,
  logoutAction,
}: {
  userName: string;
  userEmail: string;
  membershipRole: MembershipRole;
  canManageMembers: boolean;
  logoutAction: () => void | Promise<void>;
}) {
  const roleLabel: Record<MembershipRole, string> = {
    OWNER: "Proprietário",
    FINANCE_ADMIN: "Administrador financeiro",
    OPERATOR: "Operador",
    ACCOUNTANT: "Contador",
    VIEWER: "Consulta",
  };

  return (
    <div className="h-full w-[260px] shrink-0 overflow-hidden border-r border-border bg-card/50">
      <div className="flex h-full w-[260px] flex-col p-3">
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto pt-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.heading ?? index} className="flex flex-col gap-0.5">
              {group.heading ? (
                <span className="mb-1 px-2.5 text-[11px] font-semibold tracking-wider text-muted-foreground/50 uppercase">
                  {group.heading}
                </span>
              ) : null}
              {group.items.map((item) => (
                <NavItem key={item.id} item={item} />
              ))}
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
          <NavItem item={{ id: "notificacoes", title: "Notificações", icon: Bell, href: "/configuracoes/notificacoes" }} />
          <NavItem item={{ id: "seguranca", title: "Segurança", icon: Settings, href: "/configuracoes/seguranca" }} />
          {canManageMembers ? (
            <>
              <NavItem item={{ id: "assinatura", title: "Assinatura", icon: CreditCard, href: "/configuracoes/assinatura" }} />
              <NavItem item={{ id: "usuarios", title: "Usuários e acessos", icon: Users, href: "/configuracoes/usuarios" }} />
            </>
          ) : null}

          <div className="mt-2 flex items-center gap-3 overflow-hidden rounded-xl px-1 py-1">
            <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground text-xs font-semibold text-background">
              {initialsOf(userName)}
            </span>
            <span className="min-w-0 flex-1">
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
              onClick={() => sessionStorage.removeItem("ax-finance:period-filter:v1")}
              className="flex w-full items-center gap-2.5 rounded-[6px] px-2.5 py-[7px] text-left text-[13px] font-medium text-muted-foreground outline-none transition-colors hover:bg-black/5 hover:text-foreground"
            >
              <LogOut className="size-4 shrink-0" strokeWidth={1.5} />
              Sair
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
