"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface CashFlowPoint {
  month: string;
  entradas: number;
  saidas: number;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

const chartConfig = {
  entradas: { label: "Entradas", color: "var(--chart-3)" },
  saidas: { label: "Saídas", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Entradas e saídas por mês no modelo shadcn "chart-area". Sem `stackId`: entradas e saídas
 * são fluxos comparáveis entre si, e empilhá-los mostraria a soma dos dois, que não significa nada.
 */
export function CashFlowLineChart({ data }: { data: CashFlowPoint[] }) {
  return (
    <ChartContainer config={chartConfig} className="h-[260px] w-full aspect-auto" role="img" aria-label="Entradas e saídas por mês">
      <AreaChart accessibilityLayer data={data} margin={{ top: 8, left: 4, right: 16, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={72} tickFormatter={(value: number) => compactCurrency.format(value)} />
        <ChartTooltip
          cursor={false}
          content={<ChartTooltipContent indicator="dot" className="min-w-[11rem] gap-2 shadow-none" valueFormatter={(value) => currency.format(value)} />}
        />
        <defs>
          <linearGradient id="fillEntradas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-entradas)" stopOpacity={0.6} />
            <stop offset="95%" stopColor="var(--color-entradas)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="fillSaidas" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-saidas)" stopOpacity={0.6} />
            <stop offset="95%" stopColor="var(--color-saidas)" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <Area dataKey="saidas" type="natural" fill="url(#fillSaidas)" fillOpacity={0.4} stroke="var(--color-saidas)" strokeWidth={2} />
        <Area dataKey="entradas" type="natural" fill="url(#fillEntradas)" fillOpacity={0.4} stroke="var(--color-entradas)" strokeWidth={2} />
      </AreaChart>
    </ChartContainer>
  );
}
