"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Building2, ChevronRight, LayoutDashboard, LifeBuoy, Mail } from "@/components/ui/animated-icons";

const items = [
  { href: "/admin", label: "Visão geral", description: "Indicadores da operação", icon: LayoutDashboard },
  { href: "/admin/empresas", label: "Empresas", description: "Assinaturas e trials", icon: Building2 },
  { href: "/admin/operacoes", label: "Operações", description: "Jobs e diagnósticos", icon: Activity },
  { href: "/admin/suporte", label: "Suporte", description: "Chamados e incidentes", icon: LifeBuoy },
  { href: "/admin/email", label: "E-mail", description: "Servidor SMTP", icon: Mail },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="admin-nav" aria-label="Navegação administrativa">
      <p className="admin-nav-label">Workspace</p>
      {items.map((item) => {
        const active = item.href === "/admin" ? pathname === item.href : pathname.startsWith(item.href);
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} className={`admin-nav-item${active ? " is-active" : ""}`} aria-current={active ? "page" : undefined}>
            <span className="admin-nav-icon"><Icon size={19} strokeWidth={1.8} /></span>
            <span className="admin-nav-copy"><strong>{item.label}</strong><small>{item.description}</small></span>
            <ChevronRight className="admin-nav-chevron" size={16} />
          </Link>
        );
      })}
    </nav>
  );
}
