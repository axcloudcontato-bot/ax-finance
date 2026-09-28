import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getPlatformAdminAccess } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import { logoutAction } from "../../(app)/actions";

export default async function InternalAdminLayout({children}:{children:ReactNode}){
  const user=await getCurrentUser();if(!user)redirect("/login");
  const access=await getPlatformAdminAccess(user.id);if(!access)redirect("/dashboard");
  return <div className="admin-shell"><header className="admin-topbar"><Link href="/admin" className="admin-brand">AX Finance <span>Admin interno</span></Link><div className="admin-identity"><span>{user.name}</span><span>{access.role}</span><Link href="/dashboard">Produto</Link><form action={logoutAction}><button type="submit" className="secondary">Sair</button></form></div></header>{children}</div>;
}
