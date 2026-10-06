import { findCreditCardIssuer } from "@ax-finance/domain";
import { CreditCard } from "@/components/ui/animated-icons";

/**
 * Selo do banco emissor: sigla sobre a cor aproximada da marca. Não é a logo oficial (marca
 * registrada de cada banco); o catálogo vive em `credit-cards/issuers.ts`. Sem emissor, ícone neutro.
 */
export function IssuerBadge({ issuer, size = 40 }: { issuer: string | null | undefined; size?: number }) {
  const found = findCreditCardIssuer(issuer);
  const style = { width: size, height: size, borderRadius: Math.round(size * 0.28), fontSize: Math.round(size * (found && found.initials.length > 2 ? 0.3 : 0.38)) };

  if (!found) {
    return (
      <span className="issuer-badge is-neutral" style={style} aria-hidden="true">
        <CreditCard className="size-5" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span className="issuer-badge" style={{ ...style, background: found.color, color: found.textColor }} role="img" aria-label={found.name} title={found.name}>
      {found.initials}
    </span>
  );
}
