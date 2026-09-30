import { getPlatformAdminAccess, listCompaniesForUser } from "@ax-finance/domain";
import { getCurrentUser } from "@/lib/session";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Database,
  Landmark,
  ListChecks,
  ShieldCheck,
  Users,
  X,
} from "@/components/ui/animated-icons";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { PublicDashboardPreview } from "@/components/public/public-dashboard-preview";
import { publicPageMetadata, SITE_DESCRIPTION, SITE_URL } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Controle financeiro pessoal e empresarial",
  description: SITE_DESCRIPTION,
  path: "/",
});

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "AX Cloud",
    alternateName: "AX Finance",
    url: SITE_URL,
    logo: `${SITE_URL}/icon.png`,
    email: "contato@axcloud.com.br",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: "AX Finance",
    alternateName: "AX Financeiro",
    url: SITE_URL,
    inLanguage: "pt-BR",
    publisher: { "@id": `${SITE_URL}/#organization` },
  },
  {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}/#product`,
    name: "AX Finance",
    url: SITE_URL,
    description: SITE_DESCRIPTION,
    category: "Software de gestão financeira",
    brand: { "@id": `${SITE_URL}/#organization` },
    offers: [
      {
        "@type": "Offer",
        name: "Gestão Pessoal",
        price: "29.90",
        priceCurrency: "BRL",
        url: `${SITE_URL}/#precos`,
      },
      {
        "@type": "Offer",
        name: "Essencial",
        price: "59.00",
        priceCurrency: "BRL",
        url: `${SITE_URL}/#precos`,
      },
    ],
  },
];

export default async function RootPage() {
  const user = await getCurrentUser();
  if (!user) return <MarketingHome />;

  const [companies, platformAdmin] = await Promise.all([
    listCompaniesForUser(user.id),
    getPlatformAdminAccess(user.id),
  ]);

  const dashboardHref = companies.length > 0
    ? `/dashboard?empresa=${companies[0]!.id}`
    : platformAdmin
      ? "/admin"
      : "/onboarding";
  return <MarketingHome dashboardHref={dashboardHref} />;
}

const benefits = [
  { icon: ListChecks, title: "Organize sua rotina", text: "Contas, categorias, pessoas e centros de custo em um fluxo simples." },
  { icon: BarChart3, title: "Acompanhe em tempo real", text: "Veja o realizado, o previsto e o saldo das próximas semanas." },
  { icon: Database, title: "Importe seus extratos", text: "No Essencial, revise arquivos CSV ou OFX antes de conciliar." },
  { icon: ShieldCheck, title: "Decida com segurança", text: "Dados isolados, exportáveis e protegidos por acesso e MFA." },
];

const personalFeatures = [
  "Entradas, saídas e transferências",
  "Contas, categorias, pessoas e centros de custo",
  "Dashboard, fluxo de caixa e contas em aberto",
  "Suporte em horário comercial",
];

const essentialFeatures = [
  "Tudo da Gestão Pessoal",
  "Importação CSV e OFX",
  "Conciliação bancária",
  "Fechamento, auditoria e DRE gerencial",
  "Suporte em horário comercial",
];

function MarketingHome({ dashboardHref }: { dashboardHref?: string }) {
  const faqs = [
    ["Preciso cadastrar cartão para testar?", "Não. O período de avaliação é de 14 dias e começa sem cartão."],
    ["Qual plano devo escolher?", "A Gestão Pessoal cobre a rotina financeira diária. O Essencial adiciona conciliação bancária, fechamento, auditoria e DRE gerencial."],
    ["Consigo levar meus dados?", "Sim. Você pode exportar relatórios e gerar uma cópia completa dos registros da sua empresa."],
    ["Como funciona o cancelamento?", "O proprietário agenda o cancelamento na área de assinatura e mantém acesso até a data efetiva."],
  ];
  const primaryHref = dashboardHref ?? "/registro";

  return (
    <div className="public-site public-v2">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
      />
      <PublicHeader dashboardHref={dashboardHref} />
      <main className="public-main">
        <section className="public-v2-hero">
          <div className="public-container public-v2-hero-grid">
            <div className="public-v2-hero-copy">
              <div className="public-kicker"><CheckCircle2 size={16} /> 14 dias grátis, sem cartão</div>
              <h1>Seu dinheiro claro.<br />Suas decisões mais leves.</h1>
              <p>Organize contas a pagar e receber, acompanhe o que foi realizado e antecipe o que ainda está previsto. Tudo em um só lugar, do seu jeito.</p>
              <div className="public-hero-actions">
                <Link className="public-button" href={primaryHref}>{dashboardHref ? "Abrir meu painel" : "Começar avaliação"} <ArrowRight size={18} /></Link>
                <Link className="public-button secondary" href="/demonstracao">Ver demonstração</Link>
              </div>
              <div className="public-v2-trust-row">
                <div><ShieldCheck size={18} /><span><strong>Configuração rápida</strong><small>Comece em minutos</small></span></div>
                <div><Database size={18} /><span><strong>Seus dados protegidos</strong><small>Privacidade por empresa</small></span></div>
                <div><Users size={18} /><span><strong>Suporte em português</strong><small>Quando você precisar</small></span></div>
              </div>
            </div>
            <PublicDashboardPreview />
          </div>
        </section>

        <section className="public-v2-benefits" id="recursos">
          <div className="public-container">
            <div className="public-section-heading">
              <span className="public-eyebrow">Mais controle para o seu dia a dia</span>
              <h2>Tudo o que você precisa para uma rotina financeira saudável.</h2>
            </div>
            <div className="public-v2-benefit-grid">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article key={title}><div className="public-v2-benefit-icon"><Icon size={22} /></div><h3>{title}</h3><p>{text}</p></article>
              ))}
            </div>
          </div>
        </section>

        <section className="public-section public-v2-pricing" id="precos">
          <div className="public-container">
            <div className="public-section-heading">
              <span className="public-eyebrow">Planos para cada momento</span>
              <h2>Comece pessoal. Evolua quando precisar.</h2>
              <p>Os dois planos incluem lançamentos ilimitados dentro da política de uso justo e 14 dias de avaliação sem cartão.</p>
            </div>
            <div className="public-v2-price-grid">
              <article className="public-v2-price-card">
                <div className="public-v2-plan-heading"><div className="public-v2-plan-icon"><Users size={22} /></div><div><span>Uso individual</span><h3>Gestão Pessoal</h3><p>Para organizar a própria rotina financeira.</p></div></div>
                <div className="public-v2-price"><strong>R$ 29,90</strong><small>/mês</small></div>
                <ul className="public-v2-feature-list">
                  {personalFeatures.map((feature) => <li key={feature}><CheckCircle2 size={17} /><span>{feature}</span></li>)}
                </ul>
                <div className="public-v2-unavailable">
                  <div><X size={16} /><span>Fechamento, auditoria e DRE gerencial</span></div>
                  <div><X size={16} /><span>Conciliação bancária</span></div>
                </div>
                <Link className="public-button secondary" href={dashboardHref ?? "/registro?plano=PERSONAL"}>{dashboardHref ? "Abrir meu painel" : "Testar Gestão Pessoal"}</Link>
                <small className="public-v2-trial-note">Sem cartão durante o trial.</small>
              </article>

              <article className="public-v2-price-card is-featured">
                <div className="public-v2-plan-heading"><div className="public-v2-plan-icon"><Landmark size={22} /></div><div><span>Gestão completa</span><div className="public-v2-plan-title"><h3>Essencial</h3><em>Mais completo</em></div><p>Para uma gestão financeira completa.</p></div></div>
                <div className="public-v2-price"><strong>R$ 59,00</strong><small>/mês</small></div>
                <ul className="public-v2-feature-list">
                  {essentialFeatures.map((feature) => <li key={feature}><CheckCircle2 size={17} /><span>{feature}</span></li>)}
                </ul>
                <div className="public-v2-feature-spacer" aria-hidden="true" />
                <Link className="public-button" href={dashboardHref ?? "/registro?plano=ESSENTIAL"}>{dashboardHref ? "Abrir meu painel" : "Testar Essencial"}</Link>
                <small className="public-v2-trial-note">Sem cartão durante o trial.</small>
              </article>
            </div>
          </div>
        </section>

        <section className="public-v2-demo-band">
          <div className="public-container"><div><span className="public-eyebrow">Demonstração guiada</span><h2>Veja o AX Finance funcionando antes de começar.</h2><p>Conheça o fluxo completo com dados fictícios e entenda como cada indicador é calculado.</p></div><Link className="public-button light" href="/demonstracao">Abrir demonstração <ArrowRight size={18} /></Link></div>
        </section>

        <section className="public-section public-v2-faq">
          <div className="public-container public-v2-faq-grid">
            <div><span className="public-eyebrow">Dúvidas frequentes</span><h2>Respostas para o que mais importa.</h2><Link href="/faq">Ver todas as perguntas <ArrowRight size={16} /></Link></div>
            <div className="public-faq-list">{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div>
          </div>
        </section>

        <section className="public-final-cta public-v2-final-cta"><div className="public-container"><span className="public-eyebrow">Mais clareza hoje</span><h2>Um futuro mais tranquilo amanhã.</h2><p>Teste por 14 dias, sem cartão, e descubra como o AX Finance pode simplificar sua rotina financeira.</p><Link className="public-button light" href={primaryHref}>{dashboardHref ? "Voltar ao painel" : "Criar minha conta"} <ArrowRight size={18} /></Link></div></section>
      </main>
      <PublicFooter />
    </div>
  );
}
