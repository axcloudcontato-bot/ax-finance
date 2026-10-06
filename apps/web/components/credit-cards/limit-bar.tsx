import { formatCents } from "@/lib/currency";

/** Barra do limite: quanto do limite já está comprometido (faturas em aberto + parcelas futuras). */
export function LimitBar({ limitCents, usedCents }: { limitCents: bigint; usedCents: bigint }) {
  const ratio = limitCents > BigInt(0) ? Number((usedCents * BigInt(1000)) / limitCents) / 10 : 0;
  const percent = Math.max(0, Math.min(100, ratio));
  const tone = usedCents > limitCents ? "is-over" : ratio >= 80 ? "is-high" : "";
  const available = limitCents - usedCents;

  return (
    <div className="limit-bar">
      <div className="limit-bar-track" role="img" aria-label={`${Math.round(ratio)}% do limite em uso`}>
        <span className={tone} style={{ width: `${percent}%` }} />
      </div>
      <div className="limit-bar-legend">
        <span>Usado {formatCents(usedCents)}</span>
        <span className={available < BigInt(0) ? "is-over" : undefined}>
          {available < BigInt(0) ? `Estourou ${formatCents(-available)}` : `Disponível ${formatCents(available)}`}
        </span>
      </div>
    </div>
  );
}
