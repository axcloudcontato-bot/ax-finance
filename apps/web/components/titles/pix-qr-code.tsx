"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR Code do "PIX copia e cola", desenhado no navegador só quando o modal de cobrança abre. */
export function PixQrCode({ code, size = 196 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(code, { width: size, margin: 1, errorCorrectionLevel: "M" })
      .then((url) => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(null); });
    return () => { alive = false; };
  }, [code, size]);
  // QR gerado em memória (data: URL): o otimizador do next/image não traz ganho aqui.
  return src
    // eslint-disable-next-line @next/next/no-img-element
    ? <img className="pix-qr" src={src} width={size} height={size} alt="QR Code PIX para pagamento" />
    : <span className="pix-qr is-loading" style={{ width: size, height: size }} aria-hidden="true" />;
}
