"use client";

import { useLayoutEffect, useRef, type ReactNode } from "react";
import gsap from "gsap";

/**
 * Anima os filhos diretos (stagger fade+slide-up) quando o componente monta.
 * Server Components não podem chamar hooks — por isso o dashboard/login
 * envolvem seus cards com este wrapper client-only em vez de animar direto.
 * Roda uma vez por montagem: como o layout do app (sidebar/shell) não
 * remonta entre navegações client-side, isso nunca repete ao trocar de mês/
 * filtro na mesma página.
 */
export function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const container = containerRef.current;
    if (!container) return;

    const targets = Array.from(container.children);
    if (targets.length === 0) return;

    if (prefersReducedMotion) {
      gsap.set(targets, { opacity: 1, y: 0 });
      return;
    }

    const ctx = gsap.context(() => {
      // Sem stagger: todos os cards entram juntos, alinhados — o efeito de
      // "escadinha" (um atrás do outro) não combina com um grid de cards
      // que devem parecer parte do mesmo bloco.
      gsap.from(targets, {
        y: 16,
        opacity: 0,
        duration: 0.5,
        ease: "power2.out",
      });
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  );
}
