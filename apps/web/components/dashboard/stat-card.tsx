"use client";

import { useEffect, useState, type ReactNode } from "react";

export function StatCard({
  icon,
  label,
  value,
  footerLabel,
  footerValue,
  gradient,
  modalTitle,
  children,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  footerLabel: string;
  footerValue: string;
  gradient: "blue" | "teal" | "orange" | "pink";
  modalTitle: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        className="stat-card"
        style={{ background: `var(--grad-${gradient})` }}
        onClick={() => setOpen(true)}
      >
        <div className="stat-icon">{icon}</div>
        <p className="stat-label">{label}</p>
        <p className="stat-value">{value}</p>
        <div className="stat-footer">
          <span>{footerLabel}</span>
          <span>{footerValue}</span>
        </div>
      </button>

      {open ? (
        <div className="modal-overlay" onClick={() => setOpen(false)}>
          <div className="modal-dialog" style={{ maxWidth: "640px" }} onClick={(event) => event.stopPropagation()}>
            <div className="modal-header">
              <h1>{modalTitle}</h1>
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
