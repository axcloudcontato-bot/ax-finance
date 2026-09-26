import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "AX Finance",
  description: "Gestão financeira para pequenas empresas de serviços",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
