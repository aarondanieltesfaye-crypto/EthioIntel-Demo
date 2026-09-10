import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { t } from "@/lib/i18n";
import type { DashboardData } from "@/lib/ethiopia-data";
import { useLanguage } from "@/lib/language-store";

const CHART = {
  primary: "var(--color-primary)",
  muted: "var(--color-muted)",
  fg: "var(--color-fg)",
  border: "var(--color-border)",
  surface: "var(--color-elevated)",
  slices: [
    "var(--color-chart-1)",
    "var(--color-chart-2)",
    "var(--color-chart-3)",
    "var(--color-chart-4)",
    "var(--color-chart-5)",
  ],
};

export function ChartsSection({ data }: { data: DashboardData }) {
  const lang = useLanguage((s) => s.lang);
  const c = t(lang);

  const exportData = data.exportMix.map((row) => ({
    ...row,
    name: c[row.key],
  }));

  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <article className="intel-card rounded-xl p-4 sm:p-5">
        <h2 className="font-mono text-2xs tracking-mark text-muted uppercase">{c.gdpChart}</h2>
        <div className="mt-4 h-64 sm:h-72">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.gdpSeries} barCategoryGap="28%">
              <CartesianGrid stroke={CHART.border} vertical={false} />
              <XAxis
                dataKey="year"
                tick={{ fill: CHART.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }}
                axisLine={{ stroke: CHART.border }}
                tickLine={false}
              />
              <YAxis
                tick={{ fill: CHART.muted, fontSize: 11, fontFamily: "IBM Plex Mono" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v}%`}
                width={40}
              />
              <Tooltip
                cursor={{ fill: "color-mix(in oklab, var(--color-primary) 8%, transparent)" }}
                content={({ active, payload, label }) => {
                  if (!active || !payload?.[0]) return null;
                  const value = Number(payload[0].value);
                  return (
                    <div className="rounded-md bg-elevated px-3 py-2 font-mono text-xs text-fg shadow-frame">
                      <p className="text-muted">{label}</p>
                      <p className="tabular-nums text-primary">{value.toFixed(2)}%</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="growth" fill={CHART.primary} radius={[2, 2, 0, 0]} maxBarSize={48} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="intel-card rounded-xl p-4 sm:p-5">
        <h2 className="font-mono text-2xs tracking-mark text-muted uppercase">{c.exportChart}</h2>
        <div className="mt-2 flex h-64 flex-col items-center gap-2 sm:h-72 sm:flex-row">
          <div className="h-48 w-full sm:h-full sm:w-1/2">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={exportData}
                  dataKey="share"
                  nameKey="name"
                  innerRadius="58%"
                  outerRadius="82%"
                  paddingAngle={2}
                  stroke="var(--color-surface)"
                  strokeWidth={2}
                >
                  {exportData.map((entry, i) => (
                    <Cell key={entry.key} fill={CHART.slices[i % CHART.slices.length]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const row = payload[0].payload as { name: string; share: number };
                    return (
                      <div className="rounded-md bg-elevated px-3 py-2 font-mono text-xs text-fg shadow-frame">
                        <p className="text-muted">{row.name}</p>
                        <p className="tabular-nums text-primary">{row.share}%</p>
                      </div>
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="grid w-full grid-cols-1 gap-2 sm:w-1/2">
            {exportData.map((row, i) => (
              <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2 text-fg">
                  <span
                    className="size-2.5 shrink-0 rounded-sm"
                    style={{ background: CHART.slices[i % CHART.slices.length] }}
                    aria-hidden="true"
                  />
                  {row.name}
                </span>
                <span className="font-mono text-xs tabular-nums text-muted">{row.share}%</span>
              </li>
            ))}
          </ul>
        </div>
      </article>
    </section>
  );
}
