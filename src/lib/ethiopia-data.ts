export type KpiId =
  | "population"
  | "gdp"
  | "gdpGrowth"
  | "internet"
  | "literacy"
  | "agriculture";

export type Kpi = {
  id: KpiId;
  value: number;
  prior: number | null;
  year: string;
  unit: "people" | "usd" | "percent";
};

export type DashboardData = {
  kpis: Record<KpiId, Kpi>;
  gdpSeries: { year: string; growth: number }[];
  exportMix: { key: "coffee" | "oilseeds" | "flowers" | "pulses" | "horticulture"; share: number }[];
  labor: { key: "laborAg" | "laborServices" | "laborIndustry"; share: number }[];
  source: "live" | "cached";
  lastUpdated: string;
};

const WB = "https://api.worldbank.org/v2/country/ETH/indicator";

type WbMeta = { lastupdated?: string };
type WbRow = { date: string; value: number | null };
type WbPayload = [WbMeta, WbRow[] | null];

async function fetchIndicator(id: string, mrv = 8): Promise<{ lastupdated?: string; rows: WbRow[] }> {
  const url = `${WB}/${id}?format=json&mrv=${mrv}&per_page=${mrv}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`World Bank ${id} ${res.status}`);
  const json = (await res.json()) as WbPayload;
  const rows = (json[1] ?? []).filter((row) => row.value != null);
  return { lastupdated: json[0]?.lastupdated, rows };
}

function latest(rows: WbRow[]): WbRow {
  const row = rows[0];
  if (!row || row.value == null) throw new Error("empty series");
  return row;
}

function priorOf(rows: WbRow[]): number | null {
  const row = rows[1];
  return row?.value ?? null;
}

export const FALLBACK: DashboardData = {
  kpis: {
    population: { id: "population", value: 135472051, prior: 132059767, year: "2025", unit: "people" },
    gdp: { id: "gdp", value: 126358758448, prior: 149740297952, year: "2025", unit: "usd" },
    gdpGrowth: { id: "gdpGrowth", value: 9.7715182202934, prior: 7.61277447616879, year: "2025", unit: "percent" },
    internet: { id: "internet", value: 21.94129944, prior: 20.33749962, year: "2024", unit: "percent" },
    literacy: { id: "literacy", value: 60.4599990844727, prior: 54.8853699463392, year: "2022", unit: "percent" },
    agriculture: {
      id: "agriculture",
      value: 32.8186147009719,
      prior: 34.7737782046291,
      year: "2025",
      unit: "percent",
    },
  },
  gdpSeries: [
    { year: "2021", growth: 5.64 },
    { year: "2022", growth: 5.32 },
    { year: "2023", growth: 6.59 },
    { year: "2024", growth: 7.61 },
    { year: "2025", growth: 9.77 },
  ],
  exportMix: [
    { key: "coffee", share: 48 },
    { key: "oilseeds", share: 21 },
    { key: "flowers", share: 14 },
    { key: "pulses", share: 10 },
    { key: "horticulture", share: 7 },
  ],
  labor: [
    { key: "laborAg", share: 62 },
    { key: "laborServices", share: 26 },
    { key: "laborIndustry", share: 12 },
  ],
  source: "cached",
  lastUpdated: "2026-07-13",
};

export async function loadDashboardData(): Promise<DashboardData> {
  try {
    const [pop, gdp, growth, net, lit, agr] = await Promise.all([
      fetchIndicator("SP.POP.TOTL", 6),
      fetchIndicator("NY.GDP.MKTP.CD", 4),
      fetchIndicator("NY.GDP.MKTP.KD.ZG", 8),
      fetchIndicator("IT.NET.USER.ZS", 5),
      fetchIndicator("SE.ADT.LITR.ZS", 4),
      fetchIndicator("NV.AGR.TOTL.ZS", 4),
    ]);

    const popRow = latest(pop.rows);
    const gdpRow = latest(gdp.rows);
    const growthRow = latest(growth.rows);
    const netRow = latest(net.rows);
    const litRow = latest(lit.rows);
    const agrRow = latest(agr.rows);

    const series = [...growth.rows]
      .filter((row) => row.value != null)
      .slice(0, 5)
      .reverse()
      .map((row) => ({ year: row.date, growth: Number(row.value) }));

    const lastUpdated =
      pop.lastupdated ?? gdp.lastupdated ?? growth.lastupdated ?? FALLBACK.lastUpdated;

    return {
      kpis: {
        population: {
          id: "population",
          value: Number(popRow.value),
          prior: priorOf(pop.rows),
          year: popRow.date,
          unit: "people",
        },
        gdp: {
          id: "gdp",
          value: Number(gdpRow.value),
          prior: priorOf(gdp.rows),
          year: gdpRow.date,
          unit: "usd",
        },
        gdpGrowth: {
          id: "gdpGrowth",
          value: Number(growthRow.value),
          prior: priorOf(growth.rows),
          year: growthRow.date,
          unit: "percent",
        },
        internet: {
          id: "internet",
          value: Number(netRow.value),
          prior: priorOf(net.rows),
          year: netRow.date,
          unit: "percent",
        },
        literacy: {
          id: "literacy",
          value: Number(litRow.value),
          prior: priorOf(lit.rows),
          year: litRow.date,
          unit: "percent",
        },
        agriculture: {
          id: "agriculture",
          value: Number(agrRow.value),
          prior: priorOf(agr.rows),
          year: agrRow.date,
          unit: "percent",
        },
      },
      gdpSeries: series.length >= 3 ? series : FALLBACK.gdpSeries,
      exportMix: FALLBACK.exportMix,
      labor: FALLBACK.labor,
      source: "live",
      lastUpdated,
    };
  } catch {
    return FALLBACK;
  }
}

export function formatKpi(value: number, unit: Kpi["unit"], lang: "en" | "am"): string {
  const locale = lang === "am" ? "am-ET" : "en-US";
  if (unit === "people") {
    if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    return new Intl.NumberFormat(locale).format(Math.round(value));
  }
  if (unit === "usd") {
    if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
    if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    return `$${new Intl.NumberFormat(locale).format(Math.round(value))}`;
  }
  return `${value.toFixed(1)}%`;
}

export function deltaLabel(current: number, prior: number | null, unit: Kpi["unit"]): {
  text: string;
  direction: "up" | "down" | "flat";
} | null {
  if (prior == null || prior === 0) return null;
  if (unit === "percent") {
    const pts = current - prior;
    const direction = pts > 0.05 ? "up" : pts < -0.05 ? "down" : "flat";
    const sign = pts > 0 ? "+" : "";
    return { text: `${sign}${pts.toFixed(1)}pp`, direction };
  }
  const pct = ((current - prior) / prior) * 100;
  const direction = pct > 0.4 ? "up" : pct < -0.4 ? "down" : "flat";
  const sign = pct > 0 ? "+" : "";
  return { text: `${sign}${pct.toFixed(1)}%`, direction };
}
