"use client";

import { useEffect, useRef } from "react";

/** Rola a área horizontal até a coluna marcada com `.is-current` (ex.: o mês atual na grade do ano). */
export function ScrollToCurrent({ children, className }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const box = ref.current;
    const current = box?.querySelector<HTMLElement>("thead .is-current");
    const sticky = box?.querySelector<HTMLElement>("thead th:first-child");
    if (!box || !current) return;
    box.scrollLeft = Math.max(0, current.offsetLeft - (sticky?.offsetWidth ?? 0) - current.offsetWidth * 2);
  }, []);
  return <div ref={ref} className={className}>{children}</div>;
}
