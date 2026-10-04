"use client";

import { Cell, Pie, PieChart } from "recharts";
import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

// A rosca não é um gráfico de área, mas usa o mesmo contêiner, tooltip e tokens do modelo
// shadcn; as cores de cada fatia continuam vindo de quem chama.
const chartConfig = {} satisfies ChartConfig;

export function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const hasData = segments.some((segment) => segment.value > 0);
  const data = (hasData ? segments : [{ label: "Sem dados", value: 1, color: "var(--border)" }]).map((segment) => ({
    ...segment,
    fill: segment.color,
  }));

  return (
    <div>
      <ChartContainer config={chartConfig} className="h-[160px] w-full aspect-auto" role="img" aria-label="Distribuição por categoria">
        <PieChart>
          {hasData ? (
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent hideLabel nameKey="label" className="shadow-none" valueFormatter={formatValue} />}
            />
          ) : null}
          <Pie data={data} dataKey="value" nameKey="label" innerRadius={48} outerRadius={70} paddingAngle={hasData ? 2 : 0} stroke="none">
            {data.map((segment) => (
              <Cell key={segment.label} fill={segment.fill} />
            ))}
          </Pie>
        </PieChart>
      </ChartContainer>

      <div className="donut-legend">
        {segments.map((segment) => (
          <div key={segment.label} className="donut-legend-item">
            <span className="donut-legend-dot" style={{ background: segment.color }} />
            <span>{segment.label}</span>
            <span style={{ marginLeft: "auto", fontWeight: 600 }}>{formatValue(segment.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
