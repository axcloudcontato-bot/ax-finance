export default function AppLoading() {
  return (
    <main className="wide workspace-loading" aria-busy="true" aria-label="Carregando página">
      <p role="status">Carregando informações…</p>
      <div className="workspace-skeleton workspace-skeleton-heading" aria-hidden="true" />
      <div className="workspace-loading-metrics" aria-hidden="true">
        <div className="workspace-skeleton" />
        <div className="workspace-skeleton" />
        <div className="workspace-skeleton" />
      </div>
      <div className="workspace-skeleton workspace-skeleton-content" aria-hidden="true" />
    </main>
  );
}
