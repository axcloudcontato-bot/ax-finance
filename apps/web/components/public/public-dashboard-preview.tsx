"use client";

import {
  AlertTriangle,
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  CalendarDays,
  CreditCard,
  Landmark,
  LayoutDashboard,
  ListChecks,
  PiggyBank,
  Wallet,
} from "@/components/ui/animated-icons";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

/**
 * Prévia da tela real do painel (dados fictícios, marcados como tal): mesmo menu agrupado, mesmos
 * rótulos e cartões neutros do app. Os números fecham entre si: disponível − a pagar + a receber = projeção.
 */
const projection = [
  { day: "21/10", saldo: 48.35 },
  { day: "28/10", saldo: 44.9 },
  { day: "04/11", saldo: 50.6 },
  { day: "11/11", saldo: 47.8 },
  { day: "20/11", saldo: 52.18 },
];

const chartConfig = {
  saldo: { label: "Saldo projetado", color: "var(--chart-1)" },
} satisfies ChartConfig;

type PreviewNavItem = { label: string; icon: typeof Wallet; active?: boolean };

const navigation: { heading: string | null; items: PreviewNavItem[] }[] = [
  { heading: null, items: [{ label: "Dashboard", icon: LayoutDashboard, active: true }] },
  { heading: "Dia a dia", items: [{ label: "Entradas", icon: ArrowDownCircle }, { label: "Saídas", icon: ArrowUpCircle }, { label: "Calendário", icon: CalendarDays }, { label: "Conciliação", icon: ListChecks }] },
  { heading: "Contas e patrimônio", items: [{ label: "Contas", icon: Landmark }, { label: "Cofrinhos", icon: PiggyBank }, { label: "Cartões de crédito", icon: CreditCard }] },
  { heading: "Planejamento", items: [{ label: "Relatórios", icon: BarChart3 }] },
];

const metrics = [
  { label: "Disponível para uso hoje", value: "R$ 48.350,00", detail: "3 contas incluídas", primary: true },
  { label: "Projeção dos próximos 30 dias", value: "R$ 52.180,00", detail: "Com o que vence até 20/11" },
  { label: "A pagar até 20/11", value: "R$ 12.460,00", detail: "9 contas" },
  { label: "A receber até 20/11", value: "R$ 16.290,00", detail: "11 recebimentos" },
];

export function PublicDashboardPreview() {
  return (
    <div className="public-v3-product" aria-label="Prévia do painel do AX Finance com dados fictícios">
      <header className="public-v3-topbar" aria-hidden="true">
        <div className="public-v3-brand"><span><Wallet size={13} /></span><div><strong>AX Finance</strong><small>Instalações Exemplo Ltda</small></div></div>
        <span className="public-v3-avatar">JS</span>
      </header>
      <div className="public-v3-body">
        <aside className="public-v3-nav" aria-hidden="true">
          {navigation.map((group) => (
            <div key={group.heading ?? "inicio"} className="public-v3-nav-group">
              {group.heading ? <span className="public-v3-nav-heading">{group.heading}</span> : null}
              {group.items.map(({ label, icon: Icon, active }) => (
                <div key={label} className={active ? "is-active" : undefined}><Icon size={13} /><span>{label}</span></div>
              ))}
            </div>
          ))}
        </aside>

        <section className="public-v3-main">
          <div className="public-v3-title">
            <div><strong>Dashboard financeiro</strong><small>Posição em 21/10 · dados fictícios</small></div>
          </div>

          <div className="public-v3-metrics">
            {metrics.map((metric) => (
              <article key={metric.label} className={metric.primary ? "is-primary" : undefined}>
                <small>{metric.label}</small>
                <strong>{metric.value}</strong>
                <span>{metric.detail}</span>
              </article>
            ))}
          </div>

          <div className="public-v3-lower">
            <div className="public-v3-panel public-v3-attention">
              <strong>O que precisa de atenção</strong>
              <div className="public-v3-alert is-out"><AlertTriangle size={13} /><span><b>Contas a pagar vencidas</b><small>2 contas somam R$ 640,00</small></span></div>
              <div className="public-v3-alert is-warn"><ListChecks size={13} /><span><b>Conciliação pendente</b><small>4 linhas do extrato para conferir</small></span></div>
            </div>
            <div className="public-v3-panel public-v3-chart">
              <strong>Projeção de caixa</strong>
              <small>Saldo previsto nas próximas semanas (R$ mil)</small>
              <div className="public-v3-chart-area">
                <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
                  <AreaChart accessibilityLayer data={projection} margin={{ top: 6, right: 4, left: -26, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="day" tickLine={false} axisLine={false} tickMargin={6} tick={{ fontSize: 9 }} />
                    <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 8 }} domain={[40, 55]} />
                    <ChartTooltip cursor={false} content={<ChartTooltipContent indicator="line" className="shadow-none" valueFormatter={(value) => `R$ ${String(value).replace(".", ",")} mil`} />} />
                    <defs>
                      <linearGradient id="fillLandingSaldo" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-saldo)" stopOpacity={0.22} />
                        <stop offset="95%" stopColor="var(--color-saldo)" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area dataKey="saldo" type="monotone" fill="url(#fillLandingSaldo)" stroke="var(--color-saldo)" strokeWidth={1.75} />
                  </AreaChart>
                </ChartContainer>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
