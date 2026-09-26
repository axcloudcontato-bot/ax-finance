import type { ReactNode } from "react";

export function StatCard({
  icon,
  label,
  value,
  footerLabel,
  footerValue,
  gradient,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  footerLabel: string;
  footerValue: string;
  gradient: "blue" | "teal" | "orange" | "pink";
}) {
  return (
    <div className="stat-card" style={{ background: `var(--grad-${gradient})` }}>
      <div className="stat-icon">{icon}</div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value}</p>
      <div className="stat-footer">
        <span>{footerLabel}</span>
        <span>{footerValue}</span>
      </div>
    </div>
  );
}
