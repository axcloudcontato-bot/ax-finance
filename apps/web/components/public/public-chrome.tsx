import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Wallet } from "@/components/ui/animated-icons";

export function PublicHeader({ dashboardHref }: { dashboardHref?: string } = {}) {
  return (
    <header className="public-header">
      <div className="public-container public-header-inner">
        <Link className="public-brand" href="/" aria-label="AX Finance — início">
          <div className="public-brand-mark"><Wallet className="size-5" /></div>
          <span>AX Finance</span>
        </Link>
        <nav className="public-nav" aria-label="Navegação pública">
          <Link href="/#recursos">Recursos</Link>
          <Link href="/#precos">Preço</Link>
          <Link href="/demonstracao">Demonstração</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/suporte">Suporte</Link>
        </nav>
        <div className="public-header-actions">
          {dashboardHref ? <Link className="public-button small" href={dashboardHref}>Abrir painel <ArrowRight className="size-4" /></Link> : <><Link className="public-login-link" href="/login">Entrar</Link><Link className="public-button small" href="/registro">Testar grátis <ArrowRight className="size-4" /></Link></>}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container public-footer-grid">
        <div>
          <Link className="public-brand" href="/"><div className="public-brand-mark"><Wallet className="size-5" /></div><span>AX Finance</span></Link>
          <p>Gestão financeira clara para sua rotina pessoal ou para uma pequena empresa de serviços.</p>
        </div>
        <div><strong>Produto</strong><Link href="/#recursos">Recursos</Link><Link href="/#precos">Preço</Link><Link href="/demonstracao">Demonstração</Link><Link href="/faq">Perguntas frequentes</Link></div>
        <div><strong>Atendimento</strong><Link href="/suporte">Suporte</Link><a href="mailto:contato@axcloud.com.br">contato@axcloud.com.br</a><Link href="/informacoes-fiscais">Informações fiscais</Link></div>
        <div><strong>Legal</strong><Link href="/termos">Termos de uso</Link><Link href="/privacidade">Privacidade</Link><Link href="/cancelamento">Cancelamento e exportação</Link></div>
      </div>
      <div className="public-container public-footer-bottom"><span>© 2026 AX Finance.</span><span>Dados financeiros são privados e não são vendidos.</span></div>
    </footer>
  );
}

export function PublicPage({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: string; children: ReactNode }) {
  return (
    <div className="public-site">
      <PublicHeader />
      <main className="public-document-shell">
        <header className="public-document-hero">
          <span className="public-eyebrow">{eyebrow}</span>
          <h1>{title}</h1>
          <p>{intro}</p>
        </header>
        <article className="public-document">{children}</article>
      </main>
      <PublicFooter />
    </div>
  );
}
