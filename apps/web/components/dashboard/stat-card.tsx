"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

export function StatCard({
  icon,
  label,
  value,
  footerLabel,
  footerValue,
  comparisonLabel,
  comparisonValue,
  gradient,
  prominent = false,
  modalTitle,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  footerLabel: string;
  footerValue: string;
  comparisonLabel?: string;
  comparisonValue?: string;
  gradient: "blue" | "teal" | "orange" | "pink";
  prominent?: boolean;
  modalTitle: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled])') ?? []);
    focusable()[0]?.focus();
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) {
        event.preventDefault();
        dialog?.focus();
      } else if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items[items.length - 1]?.focus();
      } else if (!event.shiftKey && document.activeElement === items[items.length - 1]) {
        event.preventDefault();
        items[0]?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        className={`stat-card is-${gradient}${prominent ? " is-prominent" : ""}`}
        onClick={() => setOpen(true)}
      >
        <div className="stat-icon">{icon}</div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        <div className="stat-footer">
          <span>{footerLabel}</span>
          <span>{footerValue}</span>
        </div>
        {comparisonLabel && comparisonValue ? (
          <div className="stat-comparison">
            <span>{comparisonLabel}</span>
            <strong>{comparisonValue}</strong>
          </div>
        ) : null}
      </button>

      {open ? (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div ref={dialogRef} className="modal-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} style={{ maxWidth: "640px" }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                {icon}
                <h2 id={titleId}>{modalTitle}</h2>
              </div>
              <button
                type="button"
                className="modal-close"
                aria-label="Fechar"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </div>
            {children}
          </div>
        </div>
      ) : null}
    </>
  );
}
