import Link from "next/link";

export function AdminNav() {
  return <div className="filters" style={{marginBottom:"1.25rem"}}>
    <Link href="/admin">Indicadores</Link>
    <Link href="/admin/empresas">Empresas e assinaturas</Link>
    <Link href="/admin/operacoes">Operações e jobs</Link>
    <Link href="/admin/suporte">Suporte e incidentes</Link>
  </div>;
}
