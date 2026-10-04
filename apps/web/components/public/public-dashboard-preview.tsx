"use client";

import {
  ArrowDownCircle,
  ArrowUpCircle,
  BarChart3,
  Landmark,
  LayoutDashboard,
  ListChecks,
  Settings,
  Tag,
  Users,
  Wallet,
} from "@/components/ui/animated-icons";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

const chartData = [
  { month: "Jan", entradas: 18, saidas: 8 },
  { month: "Fev", entradas: 23, saidas: 12 },
  { month: "Mar", entradas: 31, saidas: 17 },
  { month: "Abr", entradas: 28, saidas: 15 },
  { month: "Mai", entradas: 39, saidas: 21 },
  { month: "Jun", entradas: 34, saidas: 18 },
  { month: "Jul", entradas: 46, saidas: 25 },
  { month: "Ago", entradas: 42, saidas: 22 },
];

const chartConfig = {
  entradas: { label: "Entradas", color: "var(--chart-3)" },
  saidas: { label: "Saídas", color: "var(--chart-1)" },
} satisfies ChartConfig;

const navigation = [
  { label: "Visão geral", icon: LayoutDashboard, active: true },
  { label: "Entradas", icon: ArrowDownCircle },
  { label: "Saídas", icon: ArrowUpCircle },
  { label: "Transações", icon: Landmark },
  { label: "Categorias", icon: Tag },
  { label: "Contas", icon: Wallet },
  { label: "Relatórios", icon: BarChart3 },
  { label: "Configurações", icon: Settings },
];

export function PublicDashboardPreview() {
  return (
    <div className="public-v2-product" aria-label="Prévia demonstrativa do painel AX Finance com dados fictícios">
      <aside className="public-v2-product-nav" aria-hidden="true">
        <div className="public-v2-product-brand"><div><Wallet size={15} /></div><strong>AX Finance</strong></div>
        <div className="public-v2-product-links">
          {navigation.map(({ label, icon: Icon, active }) => (
            <div key={label} className={active ? "is-active" : undefined}><Icon size={14} /><span>{label}</span></div>
          ))}
        </div>
      </aside>

      <section className="public-v2-product-main">
        <header className="public-v2-product-header">
          <div><span>Visão financeira</span><small>Dados fictícios</small></div>
          <div className="public-v2-avatar"><Users size={13} /><span>JS</span></div>
        </header>

        <div className="public-v2-metrics">
          <article className="is-teal"><small>Recebido no mês</small><strong>R$ 32.800</strong><span>18 baixas realizadas</span></article>
          <article className="is-pink"><small>A pagar</small><strong>R$ 12.460</strong><span>9 títulos em aberto</span></article>
          <article className="is-blue"><small>Saldo disponível</small><strong>R$ 48.350</strong><span>3 contas ativas</span></article>
        </div>

        <div className="public-v2-chart-panel">
          <div className="public-v2-chart-heading"><div><strong>Fluxo de caixa</strong><span>Realizado nos últimos 8 meses</span></div><div className="public-v2-chart-legend"><span className="is-teal">Entradas</span><span className="is-blue">Saídas</span></div></div>
          <div className="public-v2-chart-area">
            <ChartContainer config={chartConfig} className="h-full w-full aspect-auto">
              <AreaChart accessibilityLayer data={chartData} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={6} tick={{ fontSize: 9 }} />
                <YAxis tickLine={false} axisLine={false} tickMargin={4} tick={{ fontSize: 8 }} />
                <ChartTooltip
                  cursor={false}
                  content={<ChartTooltipContent indicator="dot" className="shadow-none" valueFormatter={(value) => `R$ ${value} mil`} />}
                />
                <defs>
                  <linearGradient id="fillLandingEntradas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-entradas)" stopOpacity={0.6} />
                    <stop offset="95%" stopColor="var(--color-entradas)" stopOpacity={0.05} />
                  </linearGradient>
                  <linearGradient id="fillLandingSaidas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-saidas)" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="var(--color-saidas)" stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <Area dataKey="saidas" type="natural" fill="url(#fillLandingSaidas)" fillOpacity={0.4} stroke="var(--color-saidas)" strokeWidth={1.75} />
                <Area dataKey="entradas" type="natural" fill="url(#fillLandingEntradas)" fillOpacity={0.4} stroke="var(--color-entradas)" strokeWidth={1.75} />
              </AreaChart>
            </ChartContainer>
          </div>
        </div>

        <div className="public-v2-reconciliation"><ListChecks size={14} /><span><strong>2 itens</strong> aguardam conciliação</span><small>Revisar</small></div>
      </section>
    </div>
  );
}
