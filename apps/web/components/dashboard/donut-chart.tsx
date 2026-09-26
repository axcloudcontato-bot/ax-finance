"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

function formatValue(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export function DonutChart({ segments }: { segments: DonutSegment[] }) {
  const hasData = segments.some((segment) => segment.value > 0);
  const data = hasData ? segments : [{ label: "Sem dados", value: 1, color: "#e9ecf1" }];

  return (
    <div>
      <ResponsiveContainer width="100%" height={160}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="label"
            innerRadius={48}
            outerRadius={70}
            paddingAngle={hasData ? 2 : 0}
            stroke="none"
          >
            {data.map((segment) => (
              <Cell key={segment.label} fill={segment.color} />
            ))}
          </Pie>
          {hasData ? <Tooltip formatter={(value) => formatValue(Number(value))} /> : null}
        </PieChart>
      </ResponsiveContainer>

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
