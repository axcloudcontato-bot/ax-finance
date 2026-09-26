"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface CashFlowPoint {
  month: string;
  entradas: number;
  saidas: number;
}

export function CashFlowLineChart({ data }: { data: CashFlowPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecf1" vertical={false} />
        <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} />
        <Tooltip
          formatter={(value) =>
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value))
          }
        />
        <Legend
          formatter={(value) => (value === "entradas" ? "Entradas" : "Saídas")}
          iconType="circle"
        />
        <Line
          type="monotone"
          dataKey="entradas"
          name="entradas"
          stroke="#0bc7b9"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="saidas"
          name="saidas"
          stroke="#4680ff"
          strokeWidth={2}
          dot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
