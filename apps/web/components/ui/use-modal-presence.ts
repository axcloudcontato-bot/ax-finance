"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
const ENTER_EASE = "cubic-bezier(0.2, 0.8, 0.2, 1)";
const EXIT_EASE = "cubic-bezier(0.4, 0, 1, 1)";

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Posição de partida do modal: encolhido sobre o elemento clicado, para o detalhe "sair" de onde a
 * pessoa clicou. Sem origem visível (ex.: aberto pelo servidor após um erro), sobe de leve no centro.
 */
function originTransform(origin: HTMLElement | null, dialog: HTMLElement): string {
  const from = origin?.isConnected ? origin.getBoundingClientRect() : null;
  const to = dialog.getBoundingClientRect();
  const visible = from && from.width > 0 && from.bottom > 0 && from.top < window.innerHeight && from.right > 0 && from.left < window.innerWidth;
  if (!from || !visible || to.width === 0) return "translateY(12px) scale(0.97)";
  const dx = from.left + from.width / 2 - (to.left + to.width / 2);
  const dy = from.top + from.height / 2 - (to.top + to.height / 2);
  const scale = Math.min(0.9, Math.max(0.2, Math.max(from.width / to.width, from.height / to.height)));
  return `translate(${Math.round(dx)}px, ${Math.round(dy)}px) scale(${scale.toFixed(3)})`;
}

/** Só a entrada: o modal cresce a partir de `origin`. Para modais que somem sem transição de saída. */
export function animateModalIn(origin: HTMLElement | null, dialog: HTMLElement | null, overlay: HTMLElement | null) {
  if (!dialog || prefersReducedMotion()) return;
  overlay?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, easing: "ease-out" });
  dialog.animate(
    [{ transform: originTransform(origin, dialog), opacity: 0 }, { opacity: 1, offset: 0.35 }, { transform: "none", opacity: 1 }],
    { duration: 340, easing: ENTER_EASE },
  );
}

/**
 * Mantém o modal montado durante a saída: abre crescendo a partir do gatilho e, ao fechar, encolhe
 * de volta para ele antes de desmontar. Com "reduzir movimento" abre e fecha sem transição.
 * Devolve se o modal deve estar no DOM.
 */
export function useModalPresence(
  open: boolean,
  originRef: RefObject<HTMLElement | null>,
  dialogRef: RefObject<HTMLElement | null>,
  overlayRef: RefObject<HTMLElement | null>,
): boolean {
  const [mounted, setMounted] = useState(open);
  if (open && !mounted) setMounted(true);

  useIsomorphicLayoutEffect(() => {
    const dialog = dialogRef.current;
    const overlay = overlayRef.current;
    if (open) {
      animateModalIn(originRef.current, dialog, overlay);
      return;
    }
    if (!mounted) return;
    if (!dialog || prefersReducedMotion()) {
      setMounted(false);
      return;
    }
    const fade = overlay?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, easing: "ease-in", fill: "forwards" });
    const exit = dialog.animate(
      [{ transform: "none", opacity: 1 }, { opacity: 1, offset: 0.5 }, { transform: originTransform(originRef.current, dialog), opacity: 0 }],
      { duration: 220, easing: EXIT_EASE, fill: "forwards" },
    );
    let cancelled = false;
    const finish = () => { if (!cancelled) setMounted(false); };
    exit.finished.then(finish, () => undefined);
    // Aba em segundo plano pausa a animação: desmonta mesmo assim, logo depois do tempo previsto.
    const fallback = setTimeout(finish, 320);
    // Reabriu antes de terminar: a saída é cancelada e a entrada recomeça.
    return () => { cancelled = true; clearTimeout(fallback); exit.cancel(); fade?.cancel(); };
    // `mounted` fica fora de propósito: a saída só começa quando `open` vira false.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return mounted;
}
