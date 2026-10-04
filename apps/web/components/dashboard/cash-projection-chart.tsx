"use client";

import { Area, AreaChart, CartesianGrid, ReferenceLine, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface CashProjectionPoint {
  date: string;
  projected: number;
  withoutOverdue: number;
}

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const compactCurrency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", notation: "compact", maximumFractionDigits: 1 });

const chartConfig = {
  projected: { label: "Todos os recebíveis", color: "var(--chart-1)" },
  withoutOverdue: { label: "Sem recebíveis vencidos", color: "var(--chart-2)" },
} satisfies ChartConfig;

const shortDate = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}`;

/**
 * Projeção diária do saldo no modelo shadcn "chart-area": áreas com degradê, grade só
 * horizontal e tooltip do componente. Diferenças deliberadas do modelo, por serem saldos:
 * - `stepAfter` em vez de `natural`: o saldo muda no dia do vencimento e fica constante até o
 *   próximo; a curva suavizada inventaria valores entre dois dias e passaria do real.
 * - sem `stackId`: as duas séries são o MESMO saldo com premissas diferentes, não partes de um
 *   total; empilhar somaria os dois e mostraria um valor que não existe.
 */
export function CashProjectionChart({ data }: { data: CashProjectionPoint[] }) {
  return (
    <ChartContainer
      config={chartConfig}
      className="dashboard-cash-chart aspect-auto"
      role="img"
      aria-label="Projeção diária do saldo nos próximos 30 dias, com uma área incluindo todos os recebíveis e outra sem os recebíveis já vencidos"
    >
      <AreaChart accessibilityLayer data={data} margin={{ top: 12, left: 4, right: 14, bottom: 0 }}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} minTickGap={28} tickFormatter={shortDate} />
        <YAxis tickLine={false} axisLine={false} tickMargin={8} width={72} tickFormatter={(value: number) => compactCurrency.format(value)} />
        <ReferenceLine y={0} stroke="var(--danger)" strokeDasharray="4 4" />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              indicator="dot"
              className="min-w-[12rem] gap-2 shadow-none [&_div.flex-1]:items-center [&_div.flex-1]:gap-4 [&>div]:gap-2"
              labelFormatter={(value) => `Posição em ${shortDate(String(value))}`}
              valueFormatter={(value) => currency.format(value)}
            />
          }
        />
        <defs>
          <linearGradient id="fillProjected" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-projected)" stopOpacity={0.6} />
            <stop offset="95%" stopColor="var(--color-projected)" stopOpacity={0.05} />
          </linearGradient>
          <linearGradient id="fillWithoutOverdue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--color-withoutOverdue)" stopOpacity={0.35} />
            <stop offset="95%" stopColor="var(--color-withoutOverdue)" stopOpacity={0.03} />
          </linearGradient>
        </defs>
        <Area dataKey="projected" type="stepAfter" fill="url(#fillProjected)" fillOpacity={0.4} stroke="var(--color-projected)" strokeWidth={2.25} />
        <Area dataKey="withoutOverdue" type="stepAfter" fill="url(#fillWithoutOverdue)" fillOpacity={0.4} stroke="var(--color-withoutOverdue)" strokeWidth={2.25} strokeDasharray="6 4" />
      </AreaChart>
    </ChartContainer>
  );
}
