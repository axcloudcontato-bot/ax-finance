"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface RealizedForecastPoint {
  label: string;
  recebimentosRealizados: number;
  pagamentosRealizados: number;
  recebimentosPrevistos: number;
  pagamentosPrevistos: number;
}

type SeriesKey = keyof Omit<RealizedForecastPoint, "label">;

// Recebimentos em verde-azulado e pagamentos em rosa; o previsto usa a mesma cor, tracejada.
const SERIES = [
  { key: "recebimentosRealizados", label: "Recebimentos realizados", shortLabel: "Realizado", color: "var(--chart-3)", group: "Recebimentos", dashed: false },
  { key: "recebimentosPrevistos", label: "Recebimentos previstos", shortLabel: "Previsto", color: "var(--chart-3)", group: "Recebimentos", dashed: true },
  { key: "pagamentosRealizados", label: "Pagamentos realizados", shortLabel: "Realizado", color: "var(--chart-4)", group: "Pagamentos", dashed: false },
  { key: "pagamentosPrevistos", label: "Pagamentos previstos", shortLabel: "Previsto", color: "var(--chart-4)", group: "Pagamentos", dashed: true },
] as const satisfies ReadonlyArray<{
  key: SeriesKey;
  label: string;
  shortLabel: string;
  color: string;
  group: "Recebimentos" | "Pagamentos";
  dashed: boolean;
}>;

const GROUPS = ["Recebimentos", "Pagamentos"] as const;

const chartConfig = Object.fromEntries(
  SERIES.map((series) => [series.key, { label: series.label, color: series.color }]),
) as ChartConfig;

const currency = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const compactCurrency = new Intl.NumberFormat("pt-BR", {
  notation: "compact",
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 1,
});

function FlowLegend() {
  return (
    <div className="dashboard-flow-legend" aria-label="Legenda do fluxo financeiro">
      {GROUPS.map((group) => (
        <div className="dashboard-flow-legend-group" key={group}>
          <span className="dashboard-flow-legend-title">{group}</span>
          <div className="dashboard-flow-legend-items">
            {SERIES.filter((series) => series.group === group).map((series) => (
              <span className="dashboard-flow-legend-item" key={series.key}>
                <span
                  className={`dashboard-flow-legend-line${series.dashed ? " is-dashed" : ""}`}
                  style={{ borderColor: series.color }}
                  aria-hidden="true"
                />
                {series.shortLabel}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Realizado × previsto no modelo shadcn "chart-area". O realizado tem área mais cheia e traço
 * contínuo; o previsto, área leve e traço tracejado. Sem `stackId`: são séries independentes.
 */
export function RealizedForecastChart({ data }: { data: RealizedForecastPoint[] }) {
  return (
    <div className="dashboard-flow-chart">
      <div className="dashboard-flow-plot">
        <ChartContainer config={chartConfig} className="h-full w-full aspect-auto" role="img" aria-label="Recebimentos e pagamentos realizados e previstos">
          <AreaChart accessibilityLayer data={data} margin={{ top: 14, left: 4, right: 18, bottom: 2 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={10} minTickGap={28} />
            <YAxis tickLine={false} axisLine={false} tickMargin={8} width={72} tickFormatter={(value: number) => compactCurrency.format(value)} />
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" className="min-w-[14rem] gap-2 shadow-none" valueFormatter={(value) => currency.format(value)} />}
            />
            <defs>
              {SERIES.map((series) => (
                <linearGradient key={series.key} id={`fill-${series.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={`var(--color-${series.key})`} stopOpacity={series.dashed ? 0.18 : 0.5} />
                  <stop offset="95%" stopColor={`var(--color-${series.key})`} stopOpacity={0.02} />
                </linearGradient>
              ))}
            </defs>
            {SERIES.map((series) => (
              <Area
                key={series.key}
                dataKey={series.key}
                type="monotoneX"
                fill={`url(#fill-${series.key})`}
                fillOpacity={0.4}
                stroke={`var(--color-${series.key})`}
                strokeWidth={series.dashed ? 2 : 2.5}
                strokeDasharray={series.dashed ? "7 5" : undefined}
              />
            ))}
          </AreaChart>
        </ChartContainer>
      </div>
      <FlowLegend />
    </div>
  );
}
