import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppHeader } from "@/components/dashboard/app-header";
import { ChartsSection } from "@/components/dashboard/charts-section";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { SnapshotPanel } from "@/components/dashboard/snapshot-panel";
import { SourcesFooter } from "@/components/dashboard/sources-footer";
import { FALLBACK, loadDashboardData, type DashboardData } from "@/lib/ethiopia-data";
import { t } from "@/lib/i18n";
import { useLanguage } from "@/lib/language-store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const lang = useLanguage((s) => s.lang);
  const c = t(lang);
  const [data, setData] = useState<DashboardData>(FALLBACK);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    loadDashboardData()
      .then((next) => {
        if (!cancelled) setData(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        {loading ? (
          <p className="font-mono text-2xs tracking-wide text-muted">{c.loading}</p>
        ) : null}
        <KpiGrid data={data} />
        <ChartsSection data={data} />
        <SnapshotPanel data={data} />
      </main>
      <SourcesFooter data={data} />
    </div>
  );
}
