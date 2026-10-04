"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CashProjectionPoint {
  date: string;
  projected: number;
  withoutOverdue: number;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

export function CashProjectionChart({ data }: { data: CashProjectionPoint[] }) {
  return (
    <div className="dashboard-cash-chart" role="img" aria-label="Projeção diária do saldo nos próximos 30 dias, com uma linha incluindo todos os recebíveis e outra sem os recebíveis já vencidos">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 12, right: 14, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 5" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="date" tickFormatter={(value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`} minTickGap={28} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <YAxis width={75} tickFormatter={(value: number) => compactCurrency.format(value)} tick={{ fontSize: 11, fill: "var(--muted)" }} axisLine={false} tickLine={false} />
          <ReferenceLine y={0} stroke="#d84f67" strokeDasharray="4 4" />
          <Tooltip
            labelFormatter={(value) => `Posição em ${String(value).slice(8, 10)}/${String(value).slice(5, 7)}`}
            formatter={(value, name) => [currency.format(Number(value)), name === "projected" ? "Todos os recebíveis" : "Sem recebíveis vencidos"]}
          />
          <Line dataKey="projected" name="projected" type="stepAfter" stroke="#3978db" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
          <Line dataKey="withoutOverdue" name="withoutOverdue" type="stepAfter" stroke="#d58a25" strokeWidth={2.5} strokeDasharray="6 4" dot={false} activeDot={{ r: 4 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
