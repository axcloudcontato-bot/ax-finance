import type { ReactNode } from "react";

export function AdminPageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="admin-page-header">
      <div><p className="admin-eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>
      {actions ? <div className="admin-page-actions">{actions}</div> : null}
    </header>
  );
}
