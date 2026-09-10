import { t } from "@/lib/i18n";
import type { DashboardData } from "@/lib/ethiopia-data";
import { useLanguage } from "@/lib/language-store";

export function SourcesFooter({ data }: { data: DashboardData }) {
  const lang = useLanguage((s) => s.lang);
  const c = t(lang);

  return (
    <footer className="border-t border-border px-4 py-6 sm:px-6">
      <p className="font-mono text-2xs tracking-mark text-muted uppercase">{c.sources}</p>
      <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted">{c.sourceNote}</p>
      <p className="mt-3 font-mono text-2xs text-muted">
        {c.worldBank} · {c.unfpa} · {c.nbe} · {data.lastUpdated}
      </p>
    </footer>
  );
}
