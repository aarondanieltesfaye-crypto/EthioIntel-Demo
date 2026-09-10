import { t } from "@/lib/i18n";
import type { DashboardData } from "@/lib/ethiopia-data";
import { useLanguage } from "@/lib/language-store";

export function SnapshotPanel({ data }: { data: DashboardData }) {
  const lang = useLanguage((s) => s.lang);
  const c = t(lang);

  const facts = [
    { label: c.capitalLabel, value: c.capital },
    { label: c.currency, value: c.currencyValue },
    { label: c.area, value: c.areaValue },
    { label: c.officialLang, value: c.officialLangValue },
    { label: c.medianAge, value: c.medianAgeValue },
  ];

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-5">
      <article className="intel-card rounded-xl p-4 sm:p-5 lg:col-span-3">
        <h2 className="font-mono text-2xs tracking-mark text-muted uppercase">{c.laborChart}</h2>
        <ul className="mt-5 space-y-4">
          {data.labor.map((row) => (
            <li key={row.key}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-sm text-fg">{c[row.key]}</span>
                <span className="font-mono text-xs tabular-nums text-muted">{row.share}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-elevated">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${row.share}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </article>

      <article className="intel-card rounded-xl p-4 sm:p-5 lg:col-span-2">
        <h2 className="font-mono text-2xs tracking-mark text-muted uppercase">{c.facts}</h2>
        <dl className="mt-4 divide-y divide-border">
          {facts.map((fact) => (
            <div key={fact.label} className="flex items-baseline justify-between gap-4 py-2.5">
              <dt className="text-sm text-muted">{fact.label}</dt>
              <dd className="text-right text-sm text-fg">{fact.value}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  );
}
