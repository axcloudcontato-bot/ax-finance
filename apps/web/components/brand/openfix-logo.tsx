import Image from "next/image";

/** Símbolo oficial, com transparência, preparado a partir dos originais em Logo/. */
export function OpenfixMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <Image src="/brand/openfix-mark.webp" alt="" aria-hidden="true" width={size} height={size} className={className} unoptimized />
  );
}

/** A assinatura horizontal preserva o lettering original da marca. */
export function OpenfixLogo({ size = 28, tone = "brand", className }: { size?: number; tone?: "brand" | "light"; className?: string }) {
  return (
    <span className={`openfix-logo${tone === "light" ? " is-light" : ""}${className ? ` ${className}` : ""}`}>
      <Image
        src={tone === "light" ? "/brand/openfix-logo-white.webp" : "/brand/openfix-logo.webp"}
        alt="Openfix"
        width={size * 4}
        height={size}
        unoptimized
      />
    </span>
  );
}
