"use client";

import { Bar, CartesianGrid, ComposedChart, Line, ReferenceLine, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface MonthlyPoint {
  /** "AAAA-MM" */
  month: string;
  revenue: number;
  expense: number;
  result: number;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });
const MONTH_NAMES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

const monthLabel = (value: string) => `${MONTH_NAMES[Number(value.slice(5, 7)) - 1]}/${value.slice(2, 4)}`;

const chartConfig = {
  revenue: { label: "Receitas", color: "var(--chart-3)" },
  expense: { label: "Despesas", color: "var(--chart-4)" },
  result: { label: "Resultado", color: "var(--chart-1)" },
} satisfies ChartConfig;

/**
 * Receitas e despesas por competência nos últimos meses (barras lado a lado) e o resultado de cada
 * mês (linha). As barras não se empilham: são grandezas que se comparam, não partes de um total.
 */
export function MonthlyChart({ data }: { data: MonthlyPoint[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="dashboard-monthly-chart aspect-auto"
      role="img"
      aria-label="Receitas, despesas e resultado de cada um dos últimos meses"
    >
      <ComposedChart accessibilityLayer data={data} margin={{ top: 12, left: 4, right: 14, bottom: 0 }} barGap={4}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} tickFormatter={monthLabel} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={72} tickFormatter={(value: number) => compactCurrency.format(value)} />
        <ReferenceLine y={0} stroke="var(--border)" />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              className="min-w-[12rem] gap-2 shadow-none [&_div.flex-1]:items-center [&_div.flex-1]:gap-4 [&>div]:gap-2"
              labelFormatter={(value) => monthLabel(String(value))}
              valueFormatter={(value) => currency.format(value)}
            />
          }
        />
        <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="expense" fill="var(--color-expense)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Line dataKey="result" type="monotone" stroke="var(--color-result)" strokeWidth={2} dot={{ r: 3 }} />
      </ComposedChart>
    </ChartContainer>
  );
}
