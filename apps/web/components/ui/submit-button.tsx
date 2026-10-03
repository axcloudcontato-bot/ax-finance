"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { motion, useReducedMotion } from "motion/react";

const CROSSFADE = { type: "spring", stiffness: 260, damping: 34, mass: 0.8 } as const;
const INSTANT = { duration: 0 } as const;

function Spinner({ still }: { still: boolean }) {
  return (
    <motion.svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
      animate={still ? undefined : { rotate: 360 }}
      transition={still ? undefined : { duration: 0.85, repeat: Infinity, ease: "linear" }}
    >
      <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.22" />
      <path d="M10.5 6A4.5 4.5 0 0 0 6 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </motion.svg>
  );
}

export type SubmitButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "children"> & {
  children: ReactNode;
  /** Texto enquanto o formulário envia; por padrão repete o rótulo. */
  pendingLabel?: ReactNode;
};

/**
 * Botão de envio de formulário no modelo do LoadingButton: o rótulo faz
 * crossfade para um spinner enquanto a server action roda e o clique é
 * ignorado até terminar. O visual vem do CSS do produto (.ax-model-buttons);
 * aqui só há o comportamento. Deve ficar dentro de um <form>.
 */
export function SubmitButton({ children, pendingLabel, onClick, disabled, ...props }: SubmitButtonProps) {
  const { pending } = useFormStatus();
  const reduced = useReducedMotion();
  const fade = reduced ? INSTANT : CROSSFADE;

  return (
    <button
      {...props}
      type="submit"
      disabled={disabled}
      aria-busy={pending || undefined}
      aria-disabled={pending || undefined}
      onClick={(event) => {
        if (pending) {
          event.preventDefault();
          return;
        }
        onClick?.(event);
      }}
    >
      <span className="relative grid place-items-center">
        <motion.span
          initial={false}
          animate={pending ? { opacity: 0, y: 3, filter: "blur(3px)" } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={fade}
          className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          {children}
        </motion.span>
        <motion.span
          aria-hidden
          initial={false}
          animate={pending ? { opacity: 1, y: 0, filter: "blur(0px)" } : { opacity: 0, y: 3, filter: "blur(3px)" }}
          transition={fade}
          className="col-start-1 row-start-1 inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
        >
          <Spinner still={reduced === true || !pending} />
          {pendingLabel ?? children}
        </motion.span>
      </span>
    </button>
  );
}
