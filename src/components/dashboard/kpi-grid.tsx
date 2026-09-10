import type { LucideIcon } from "lucide-react";
import { GraduationCap, Landmark, TrendingUp, Users, Wheat, Wifi } from "lucide-react";
import { t, type Copy } from "@/lib/i18n";
import { deltaLabel, formatKpi, type DashboardData, type KpiId } from "@/lib/ethiopia-data";
import { useLanguage } from "@/lib/language-store";
import { cn } from "@/lib/utils";

const ICONS: Record<KpiId, LucideIcon> = {
  population: Users,
  gdp: Landmark,
  gdpGrowth: TrendingUp,
  internet: Wifi,
  literacy: GraduationCap,
  agriculture: Wheat,
};

const ORDER: KpiId[] = ["population", "gdp", "gdpGrowth", "internet", "literacy", "agriculture"];

export function KpiGrid({ data }: { data: DashboardData }) {
  const lang = useLanguage((s) => s.lang);
  const c = t(lang);

  return (
    <section aria-labelledby="kpi-heading">
      <div className="mb-3 flex items-end justify-between gap-3">
        <h2 id="kpi-heading" className="font-mono text-2xs tracking-mark text-muted uppercase">
          {c.kpis}
        </h2>
        <p className="font-mono text-micro tracking-wide text-muted">
          {data.source === "live" ? c.liveData : c.cached}
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {ORDER.map((id) => (
          <li key={id} className="stagger-in">
            <KpiCard id={id} data={data} copy={c} lang={lang} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function KpiCard({
  id,
  data,
  copy,
  lang,
}: {
  id: KpiId;
  data: DashboardData;
  copy: Copy;
  lang: "en" | "am";
}) {
  const kpi = data.kpis[id];
  const Icon = ICONS[id];
  const delta = deltaLabel(kpi.value, kpi.prior, kpi.unit);
  const label = copy[id];

  return (
    <article className="intel-card rounded-lg p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium tracking-wide text-muted">{label}</p>
        <span className="flex size-8 items-center justify-center rounded-sm bg-elevated text-primary">
          <Icon className="size-4" strokeWidth={1.75} aria-hidden="true" />
        </span>
      </div>
      <p className="mt-3 font-mono text-3xl font-medium tabular-nums tracking-tight text-fg">
        {formatKpi(kpi.value, kpi.unit, lang)}
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-2xs tabular-nums text-muted">
        {delta ? (
          <span
            className={cn(
              delta.direction === "up" && "text-primary",
              delta.direction === "down" && "text-warn",
            )}
          >
            {delta.text} {copy.yoy}
          </span>
        ) : null}
        <span>
          {kpi.year} · {copy.worldBank}
        </span>
      </div>
    </article>
  );
}
