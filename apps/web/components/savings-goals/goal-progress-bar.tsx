"use client";

import { motion, useReducedMotion } from "motion/react";
import { formatPercent } from "@/lib/percent";

/**
 * Barra do cofrinho: enche da esquerda para a direita até o percentual guardado (limitada a 100%,
 * o número ao lado mostra o real, ex.: 104%). `large` mostra marcos de 25/50/75%.
 */
export function GoalProgressBar({ percent, barPercent, color, reached, large = false }: { percent: number; barPercent: number; color: string; reached: boolean; large?: boolean }) {
  const reduceMotion = useReducedMotion();
  const label = `${formatPercent(percent)} da meta guardado`;
  return (
    <div className={`goal-progress goal-color-${color}${large ? " is-large" : ""}${reached ? " is-reached" : ""}`}>
      <div className="goal-progress-track" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(barPercent)}>
        <motion.span
          className="goal-progress-fill"
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${barPercent}%` }}
          transition={{ duration: reduceMotion ? 0 : 0.9, ease: [0.22, 1, 0.36, 1] }}
        />
        {large ? [25, 50, 75].map((mark) => <i key={mark} className={barPercent >= mark ? "is-passed" : undefined} style={{ left: `${mark}%` }} aria-hidden="true" />) : null}
      </div>
    </div>
  );
}

