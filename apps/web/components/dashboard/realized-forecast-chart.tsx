"use client";

import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export interface RealizedForecastPoint {
  label: string;
  recebimentosRealizados: number;
  pagamentosRealizados: number;
  recebimentosPrevistos: number;
  pagamentosPrevistos: number;
}

type SeriesKey = keyof Omit<RealizedForecastPoint, "label">;

const SERIES = [
  { key: "recebimentosRealizados", label: "Recebimentos realizados", shortLabel: "Realizado", color: "#078f85", group: "Recebimentos", dashed: false },
  { key: "recebimentosPrevistos", label: "Recebimentos previstos", shortLabel: "Previsto", color: "#2bc8ba", group: "Recebimentos", dashed: true },
  { key: "pagamentosRealizados", label: "Pagamentos realizados", shortLabel: "Realizado", color: "#d93f78", group: "Pagamentos", dashed: false },
  { key: "pagamentosPrevistos", label: "Pagamentos previstos", shortLabel: "Previsto", color: "#fb6b9f", group: "Pagamentos", dashed: true },
] as const satisfies ReadonlyArray<{
  key: SeriesKey;
  label: string;
  shortLabel: string;
  color: string;
  group: "Recebimentos" | "Pagamentos";
  dashed: boolean;
}>;

const SERIES_BY_KEY = Object.fromEntries(SERIES.map((series) => [series.key, series])) as Record<SeriesKey, (typeof SERIES)[number]>;
const GROUPS = ["Recebimentos", "Pagamentos"] as const;

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

export function RealizedForecastChart({ data }: { data: RealizedForecastPoint[] }) {
  return (
    <div className="dashboard-flow-chart">
      <div className="dashboard-flow-plot">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 14, right: 18, left: 2, bottom: 2 }}>
            <CartesianGrid strokeDasharray="2 5" stroke="#e7ebf2" vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fontWeight: 500, fill: "#697386" }}
              axisLine={{ stroke: "#dfe4ec" }}
              tickLine={false}
              minTickGap={28}
              tickMargin={10}
            />
            <YAxis
              tick={{ fontSize: 11, fontWeight: 500, fill: "#697386" }}
              axisLine={false}
              tickLine={false}
              width={72}
              tickMargin={8}
              tickFormatter={(value) => compactCurrency.format(Number(value))}
            />
            <Tooltip
              cursor={{ stroke: "#cfd6e3", strokeWidth: 1, strokeDasharray: "3 4" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="dashboard-flow-tooltip">
                    <strong>{label}</strong>
                    <div>
                      {payload.map((entry) => {
                        const series = SERIES_BY_KEY[entry.dataKey as SeriesKey];
                        if (!series) return null;
                        return (
                          <span key={series.key}>
                            <i style={{ background: series.color }} aria-hidden="true" />
                            <span>{series.label}</span>
                            <b>{currency.format(Number(entry.value))}</b>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            {SERIES.map((series) => (
              <Line
                key={series.key}
                type="monotoneX"
                dataKey={series.key}
                name={series.label}
                stroke={series.color}
                strokeWidth={series.dashed ? 2.25 : 3}
                strokeDasharray={series.dashed ? "7 5" : undefined}
                strokeLinecap="round"
                strokeLinejoin="round"
                dot={false}
                activeDot={{ r: series.dashed ? 3.5 : 4.5, strokeWidth: 2, fill: "#ffffff", stroke: series.color }}
                animationDuration={650}
                animationEasing="ease-out"
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <FlowLegend />
    </div>
  );
}
