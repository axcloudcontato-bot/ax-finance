import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { SITE_DESCRIPTION, SITE_NAME, SITE_SOCIAL_IMAGE, SITE_URL } from "@/lib/site";
import { MoneyInputMask } from "@/components/money-input-mask";
import "@fontsource/montserrat/400.css";
import "@fontsource/montserrat/500.css";
import "@fontsource/montserrat/600.css";
import "@fontsource/montserrat/700.css";
import "./globals.css";

// Teclado do celular redimensiona a área útil (Chrome/Android): janelas com rodapé fixo mantêm o
// campo ativo e o botão Salvar acima do teclado. Zoom continua livre (sem maximumScale).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  interactiveWidget: "resizes-content",
  // Barra do navegador no celular na cor do fundo de cada tema (Openfix).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f6fa" },
    { media: "(prefers-color-scheme: dark)", color: "#101010" },
  ],
};

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Openfix | Gestão financeira pessoal e empresarial",
    template: "%s | Openfix",
  },
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  creator: "AX Cloud",
  publisher: "AX Cloud",
  category: "finance",
  manifest: "/manifest.webmanifest",
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
    title: "Openfix | Gestão financeira pessoal e empresarial",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "pt_BR",
    type: "website",
    images: [SITE_SOCIAL_IMAGE],
  },
  twitter: {
    card: "summary_large_image",
    title: "Openfix | Gestão financeira pessoal e empresarial",
    description: SITE_DESCRIPTION,
    images: [SITE_SOCIAL_IMAGE],
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
