import { useId } from "react";

/**
 * Marca Openfix: anel em degradê verde-menta → azul → roxo, com a ponta roxa passando por cima do
 * começo verde. Mesmo desenho de Logo/openfix-icon.svg (fonte dos PNGs de ícone, e-mail e PDF).
 * Os ids dos degradês são únicos por instância para várias marcas conviverem na mesma página.
 */
export function OpenfixMark({ size = 28, className }: { size?: number; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-ring`} x1="12" y1="10" x2="52" y2="54" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#2ED6A8" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <linearGradient id={`${id}-fold`} x1="53" y1="36" x2="37" y2="12" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#686DF6" />
          <stop offset="1" stopColor="#8B5CF6" />
        </linearGradient>
        <clipPath id={`${id}-band`}>
          <path clipRule="evenodd" d="M32 5.5a26.5 26.5 0 1 1 0 53a26.5 26.5 0 1 1 0-53zm0 11a15.5 15.5 0 1 0 0 31a15.5 15.5 0 1 0 0-31z" />
        </clipPath>
        <filter id={`${id}-blur`} filterUnits="userSpaceOnUse" x="0" y="0" width="64" height="64">
          <feGaussianBlur stdDeviation="2.2" />
        </filter>
      </defs>
      <circle cx="32" cy="32" r="21" stroke={`url(#${id}-ring)`} strokeWidth="11" />
      <g clipPath={`url(#${id}-band)`}>
        <path d="M37.4 11.7A21 21 0 0 0 33.6 11.06" stroke="#0B1F3B" strokeOpacity="0.22" strokeWidth="13" filter={`url(#${id}-blur)`} />
      </g>
      <path d="M52.7 35.6A21 21 0 0 0 37.4 11.7" stroke={`url(#${id}-fold)`} strokeWidth="11" />
    </svg>
  );
}

/** Anel + nome. `tone="light"` é a versão sobre fundo escuro (nome em branco, como a logo monocromática). */
export function OpenfixLogo({ size = 28, tone = "brand", className }: { size?: number; tone?: "brand" | "light"; className?: string }) {
  return (
    <span className={`openfix-logo${tone === "light" ? " is-light" : ""}${className ? ` ${className}` : ""}`} style={{ fontSize: Math.round(size * 0.82) }}>
      <OpenfixMark size={size} />
      <span className="openfix-wordmark">openfix</span>
    </span>
  );
}
