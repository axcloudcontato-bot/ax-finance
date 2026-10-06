"use client";

import { useEffect } from "react";

/**
 * O painel admin só tem tema claro. Ao chegar nele por navegação interna (sem recarregar) vindo do
 * produto em tema escuro, o <html> ainda carrega o escuro e os botões no modelo do produto ficariam
 * escuros sobre fundo claro. O produto reaplica a preferência da pessoa quando volta.
 */
export function ForceLightTheme() {
  useEffect(() => {
    document.documentElement.dataset.axTheme = "light";
    document.documentElement.style.colorScheme = "light";
  }, []);
  return null;
}
