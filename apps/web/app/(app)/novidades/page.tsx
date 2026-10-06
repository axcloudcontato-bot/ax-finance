import type { Metadata } from "next";
import { CHANGELOG, CHANGE_KIND_LABEL } from "@/lib/changelog";

export const metadata: Metadata = { title: "Novidades" };

const formatDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });

export default function WhatsNewPage() {
  return (
    <main className="wide settings-page">
      <div className="page-header">
        <div>
          <h1>Novidades</h1>
          <p className="subtitle">O que mudou no AX Finance, da mais recente para a mais antiga.</p>
        </div>
      </div>

      <ol className="changelog">
        {CHANGELOG.map((entry) => (
          <li key={entry.id} id={entry.id} className="card changelog-entry">
            <header>
              <time dateTime={entry.date}>{formatDate(entry.date)}</time>
              <h2>{entry.title}</h2>
              <p>{entry.summary}</p>
            </header>
            <ul>
              {entry.changes.map((change) => (
                <li key={change.text}>
                  <span className={`changelog-kind is-${change.kind.toLowerCase()}`}>{CHANGE_KIND_LABEL[change.kind]}</span>
                  <span>{change.text}</span>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </main>
  );
}
