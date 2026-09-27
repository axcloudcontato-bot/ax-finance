"use client";

import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface RealizedForecastPoint {
  label: string;
  recebimentosRealizados: number;
  pagamentosRealizados: number;
  recebimentosPrevistos: number;
  pagamentosPrevistos: number;
}

const LABELS: Record<keyof Omit<RealizedForecastPoint, "label">, string> = {
  recebimentosRealizados: "Recebimentos realizados",
  pagamentosRealizados: "Pagamentos realizados",
  recebimentosPrevistos: "Recebimentos previstos",
  pagamentosPrevistos: "Pagamentos previstos",
};

export function RealizedForecastChart({ data }: { data: RealizedForecastPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e9ecf1" vertical={false} />
        <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} minTickGap={24} />
        <YAxis tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} width={72}
          tickFormatter={(value) => new Intl.NumberFormat("pt-BR", { notation: "compact", style: "currency", currency: "BRL" }).format(Number(value))} />
        <Tooltip formatter={(value, name) => [
          new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)),
          LABELS[name as keyof typeof LABELS] ?? name,
        ]} />
        <Legend formatter={(value) => LABELS[value as keyof typeof LABELS] ?? value} iconType="circle" />
        <Line type="monotone" dataKey="recebimentosRealizados" stroke="#0b9f93" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="pagamentosRealizados" stroke="#e44582" strokeWidth={2.5} dot={false} />
        <Line type="monotone" dataKey="recebimentosPrevistos" stroke="#0bc7b9" strokeWidth={2} strokeDasharray="6 4" dot={false} />
        <Line type="monotone" dataKey="pagamentosPrevistos" stroke="#fc5296" strokeWidth={2} strokeDasharray="6 4" dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
