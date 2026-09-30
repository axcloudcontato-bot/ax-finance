import Link from "next/link";
import { ArrowRight, BarChart3, CheckCircle2, Landmark, ListChecks } from "@/components/ui/animated-icons";
import { PublicFooter, PublicHeader } from "@/components/public/public-chrome";
import { publicPageMetadata } from "@/lib/site";

export const metadata = publicPageMetadata({
  title: "Demonstração do controle financeiro",
  description: "Veja como o AX Finance organiza saldos, contas a pagar e receber, fluxo de caixa, importação e conciliação bancária.",
  path: "/demonstracao",
});

const steps = [
  { number: "01", title: "Comece pela posição real", text: "Cadastre contas e saldos iniciais sem transformar patrimônio em receita.", icon: Landmark },
  { number: "02", title: "Organize compromissos", text: "Registre receitas e despesas, recorrências, parcelas, categorias e centros de custo.", icon: CheckCircle2 },
  { number: "03", title: "Confira o banco", text: "Importe CSV ou OFX, revise a prévia e concilie com as baixas registradas.", icon: ListChecks },
  { number: "04", title: "Leia o que aconteceu", text: "Compare realizado e previsto, identifique vencidos e acompanhe a projeção de caixa.", icon: BarChart3 },
];

export default function DemonstrationPage() {
  return <div className="public-site"><PublicHeader /><main className="public-main">
    <section className="public-demo-hero"><div className="public-container"><span className="public-eyebrow">Demonstração do produto</span><h1>Da posição bancária ao fechamento, sem perder a origem dos números.</h1><p>Este cenário usa dados inteiramente fictícios de uma empresa de serviços. Ele mostra o fluxo disponível no produto, não resultados prometidos.</p></div></section>
    <section className="public-section"><div className="public-container public-demo-steps">{steps.map(({number,title,text,icon:Icon})=><article key={number}><span className="public-step-number">{number}</span><div className="public-feature-icon"><Icon className="size-5" /></div><h2>{title}</h2><p>{text}</p></article>)}</div></section>
    <section className="public-section public-demo-screen-section"><div className="public-container public-demo-screen-grid"><div><span className="public-eyebrow">Exemplo prático</span><h2>Setembro fechando com caixa positivo.</h2><p>A empresa recebeu R$ 32.800, pagou R$ 24.060 e ainda possui R$ 12.460 em compromissos a vencer. Dois movimentos bancários aguardam conferência.</p><ul className="public-check-list"><li>Os cards compartilham o mesmo período e filtros.</li><li>Valores realizados vêm de baixas efetivas.</li><li>Previsões usam os vencimentos dos títulos em aberto.</li><li>Transferências próprias não inflam receitas ou despesas.</li></ul></div><div className="public-demo-ledger"><header><strong>Resumo de setembro</strong><span>Dados fictícios</span></header><dl><div><dt>Saldo disponível hoje</dt><dd>R$ 48.350,00</dd></div><div><dt>Recebimentos realizados</dt><dd className="positive">R$ 32.800,00</dd></div><div><dt>Pagamentos realizados</dt><dd className="negative">R$ 24.060,00</dd></div><div><dt>Geração líquida</dt><dd className="positive">R$ 8.740,00</dd></div><div><dt>Saldo projetado em 30 dias</dt><dd>R$ 52.180,00</dd></div></dl><div className="public-demo-ledger-note"><ListChecks className="size-4" /> Conciliação pendente: 2 linhas</div></div></div></section>
    <section className="public-final-cta"><div className="public-container"><span className="public-eyebrow">Experimente com sua própria rotina</span><h2>Comece sem cartão e sem importação obrigatória.</h2><p>Você pode cadastrar uma conta, informar o saldo real e explorar o fluxo antes de migrar dados.</p><Link className="public-button light" href="/registro">Começar avaliação <ArrowRight className="size-5" /></Link></div></section>
  </main><PublicFooter /></div>;
}
