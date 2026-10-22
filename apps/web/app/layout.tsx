import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { MoneyInputMask } from "@/components/money-input-mask";
import "./globals.css";

// Teclado do celular redimensiona a área útil (Chrome/Android): janelas com rodapé fixo mantêm o
// campo ativo e o botão Salvar acima do teclado. Zoom continua livre (sem maximumScale).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "AX Finance | Gestão financeira pessoal e empresarial",
    template: "%s | AX Finance",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: "AX Cloud",
  publisher: "AX Cloud",
  category: "finance",
  alternates: { canonical: SITE_URL },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    title: "AX Finance | Gestão financeira pessoal e empresarial",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AX Finance | Gestão financeira pessoal e empresarial",
    description: SITE_DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body>
        {children}
        <MoneyInputMask />
      </body>
    </html>
  );
}
