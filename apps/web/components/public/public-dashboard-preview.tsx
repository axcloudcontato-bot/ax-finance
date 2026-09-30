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
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

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
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 8, right: 4, left: -28, bottom: 0 }} barGap={2}>
                <CartesianGrid stroke="#e8edf5" vertical={false} />
                <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#8490a5", fontSize: 9 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#9aa4b5", fontSize: 8 }} />
                <Tooltip cursor={{ fill: "#f4f7fc" }} contentStyle={{ border: "1px solid #dce4f0", borderRadius: 10, fontSize: 11 }} />
                <Bar dataKey="entradas" fill="#22c7b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="saidas" fill="#4a82f7" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="public-v2-reconciliation"><ListChecks size={14} /><span><strong>2 itens</strong> aguardam conciliação</span><small>Revisar</small></div>
      </section>
    </div>
  );
}
