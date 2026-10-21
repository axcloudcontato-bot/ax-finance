/**
 * Legenda dos gráficos do painel desenhada com a mesma amostra de cada série (linha cheia, linha
 * tracejada, barra, linha com ponto), na cor do gráfico. Assim "a linha tracejada" do texto é
 * literalmente a que aparece na legenda, sem depender só da cor.
 */
export type LegendMark = "area" | "dashed" | "bar" | "line-dot";

export function ChartLegend({ items }: { items: { label: string; mark: LegendMark; color: string }[] }) {
  return (
    <ul className="chart-legend" aria-label="Legenda do gráfico">
      {items.map((item) => (
        <li key={item.label}>
          <svg viewBox="0 0 28 12" width="28" height="12" aria-hidden="true" style={{ color: item.color }}>
            {item.mark === "bar" ? <rect x="9" y="1" width="10" height="10" rx="2" fill="currentColor" /> : null}
            {item.mark === "area" ? <><rect x="1" y="6" width="26" height="6" fill="currentColor" opacity="0.18" /><path d="M1 6h26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></> : null}
            {item.mark === "dashed" ? <path d="M1 6h26" stroke="currentColor" strokeWidth="2" strokeDasharray="5 3" /> : null}
            {item.mark === "line-dot" ? <><path d="M1 6h26" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /><circle cx="14" cy="6" r="3" fill="currentColor" /></> : null}
          </svg>
          <span>{item.label}</span>
        </li>
      ))}
    </ul>
  );
}
