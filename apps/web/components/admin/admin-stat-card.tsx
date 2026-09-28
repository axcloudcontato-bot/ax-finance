import type { ReactNode } from "react";

export function AdminStatCard({ label, value, detail, icon, tone = "blue" }: { label: string; value: ReactNode; detail?: ReactNode; icon: ReactNode; tone?: "blue" | "green" | "orange" | "red" | "violet" | "slate" }) {
  return (
    <article className={`admin-stat-card admin-tone-${tone}`}>
      <div className="admin-stat-topline"><span>{label}</span><span className="admin-stat-icon">{icon}</span></div>
      <strong className="admin-stat-value">{value}</strong>
      {detail ? <p className="admin-stat-detail">{detail}</p> : null}
    </article>
  );
}
