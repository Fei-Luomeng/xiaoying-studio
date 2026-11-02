import { SiteHeader } from "@/components/site-header";

export default function LoadingTemplate() {
  return (
    <div className="shell">
      <SiteHeader />
      <main className="detail-main" aria-busy="true">
        <div className="detail-loading" role="status">
          <div className="skeleton-card" aria-hidden="true" />
          <p className="muted">正在打开模板…</p>
        </div>
      </main>
    </div>
  );
}
