#!/usr/bin/env node
/**
 * Pull the latest public World Bank WDI series for Ethiopia and write a
 * snapshot the dashboards can merge. Designed to run locally and in GitHub
 * Actions with no secrets.
 *
 * FAOSTAT is attempted for coffee export value; if the service is down the
 * snapshot keeps the compiled coffee figures.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..");
const WB = "https://api.worldbank.org/v2/country/ETH/indicator";
const FAO =
  "https://fenixservices.fao.org/faostat/api/v1/en/data/TCL?area=238&item=656&element=5922&showcodes=no";

const INDICATORS = {
  pop: "SP.POP.TOTL",
  gdpUsd: "NY.GDP.MKTP.CD",
  growth: "NY.GDP.MKTP.KD.ZG",
  agShare: "NV.AGR.TOTL.ZS",
  indShare: "NV.IND.TOTL.ZS",
  srvShare: "NV.SRV.TOTL.ZS",
  agGrowth: "NV.AGR.TOTL.KD.ZG",
  indGrowth: "NV.IND.TOTL.KD.ZG",
  srvGrowth: "NV.SRV.TOTL.KD.ZG",
  agEmp: "SL.AGR.EMPL.ZS",
  indEmp: "SL.IND.EMPL.ZS",
  srvEmp: "SL.SRV.EMPL.ZS",
  internet: "IT.NET.USER.ZS",
  mobile: "IT.CEL.SETS.P2",
  literacy: "SE.ADT.LITR.ZS",
  litYouth: "SE.ADT.1524.LT.ZS",
  litFe: "SE.ADT.LITR.FE.ZS",
  litMa: "SE.ADT.LITR.MA.ZS",
  stunt: "SH.STA.STNT.ZS",
  waste: "SH.STA.WAST.ZS",
  under: "SN.ITK.DEFC.ZS",
  access: "EG.ELC.ACCS.ZS",
  accessRu: "EG.ELC.ACCS.RU.ZS",
  accessUr: "EG.ELC.ACCS.UR.ZS",
  unemp: "SL.UEM.TOTL.ZS",
  unempY: "SL.UEM.1524.ZS",
  urbGrow: "SP.URB.GROW",
  urbShare: "SP.URB.TOTL.IN.ZS",
  trade: "NE.TRD.GNFS.ZS",
  exports: "NE.EXP.GNFS.ZS",
  lpi: "LP.LPI.OVRL.XQ",
  rain: "AG.LND.PRCP.MM",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.json();
}

async function fetchIndicator(id, mrv = 16) {
  const url = `${WB}/${id}?format=json&mrv=${mrv}&per_page=${mrv}`;
  const json = await fetchJson(url);
  const meta = json?.[0] ?? {};
  const rows = (json?.[1] ?? [])
    .filter((r) => r && r.value != null && Number.isFinite(Number(r.value)))
    .map((r) => ({ year: String(r.date), value: Number(r.value) }))
    .sort((a, b) => a.year.localeCompare(b.year));
  return { id, lastupdated: meta.lastupdated, rows };
}

async function fetchAll() {
  const entries = Object.entries(INDICATORS);
  const out = {};
  let lastUpdated = "";
  for (let i = 0; i < entries.length; i += 6) {
    const chunk = entries.slice(i, i + 6);
    const part = await Promise.all(
      chunk.map(async ([key, id]) => {
        try {
          return [key, await fetchIndicator(id)];
        } catch (err) {
          console.warn(`skip ${key}: ${err.message}`);
          return [key, { id, rows: [] }];
        }
      }),
    );
    for (const [key, val] of part) {
      out[key] = val;
      if (val.lastupdated && val.lastupdated > lastUpdated) lastUpdated = val.lastupdated;
    }
    if (i + 6 < entries.length) await sleep(250);
  }
  return { series: out, lastUpdated };
}

async function fetchCoffee() {
  try {
    const json = await fetchJson(FAO);
    const rows = (json?.data ?? [])
      .filter((r) => r.Value != null)
      .map((r) => ({ year: String(r.Year), value: Number(r.Value) }))
      .sort((a, b) => a.year.localeCompare(b.year));
    return rows;
  } catch (err) {
    console.warn(`FAOSTAT coffee skip: ${err.message}`);
    return [];
  }
}

function latest(rows) {
  return rows?.length ? rows[rows.length - 1] : null;
}
function prior(rows) {
  return rows?.length > 1 ? rows[rows.length - 2] : null;
}
function round1(n) {
  return n == null ? undefined : Math.round(Number(n) * 10) / 10;
}
function pct(n, d = 1) {
  return `${Number(n).toFixed(d)}%`;
}
function byYear(rows) {
  return Object.fromEntries((rows ?? []).map((r) => [r.year, r.value]));
}
function alignYears(maps, min = 4) {
  const counts = {};
  for (const m of maps) for (const y of Object.keys(m)) counts[y] = (counts[y] || 0) + 1;
  return Object.keys(counts)
    .filter((y) => counts[y] === maps.length)
    .sort()
    .slice(-12);
}

function indexify(rows) {
  if (!rows?.length) return [];
  const max = Math.max(...rows.map((r) => r.value), 1);
  return rows.map((r) => ({ year: r.year, value: Math.round((r.value / max) * 1000) / 10 }));
}

function src(code, year) {
  return `World Bank WDI ${code}, ${year}`;
}

function buildOverlay(bundle, coffee) {
  const s = bundle.series;
  const pop = latest(s.pop.rows);
  const gdpUsd = latest(s.gdpUsd.rows);
  const growth = latest(s.growth.rows);
  const agShare = latest(s.agShare.rows);
  const indShare = latest(s.indShare.rows);
  const srvShare = latest(s.srvShare.rows);
  const internet = latest(s.internet.rows);
  const mobile = latest(s.mobile.rows);
  const literacy = latest(s.literacy.rows);
  const litYouth = latest(s.litYouth.rows);
  const litFe = latest(s.litFe.rows);
  const litMa = latest(s.litMa.rows);
  const stunt = latest(s.stunt.rows);
  const waste = latest(s.waste.rows);
  const access = latest(s.access.rows);
  const accessRu = latest(s.accessRu.rows);
  const accessUr = latest(s.accessUr.rows);
  const unemp = latest(s.unemp.rows);
  const unempY = latest(s.unempY.rows);
  const urbGrow = latest(s.urbGrow.rows);
  const lpi = latest(s.lpi.rows);
  const trade = latest(s.trade.rows);
  const rain = latest(s.rain.rows);
  const coffeeLast = latest(coffee);

  const kpis = {
    population: pop
      ? { id: "population", value: pop.value, prior: prior(s.pop.rows)?.value ?? null, year: pop.year, unit: "people" }
      : null,
    gdp: gdpUsd
      ? { id: "gdp", value: gdpUsd.value, prior: prior(s.gdpUsd.rows)?.value ?? null, year: gdpUsd.year, unit: "usd" }
      : null,
    gdpGrowth: growth
      ? {
          id: "gdpGrowth",
          value: growth.value,
          prior: prior(s.growth.rows)?.value ?? null,
          year: growth.year,
          unit: "percent",
        }
      : null,
    internet: internet
      ? {
          id: "internet",
          value: internet.value,
          prior: prior(s.internet.rows)?.value ?? null,
          year: internet.year,
          unit: "percent",
        }
      : null,
    literacy: literacy
      ? {
          id: "literacy",
          value: literacy.value,
          prior: prior(s.literacy.rows)?.value ?? null,
          year: literacy.year,
          unit: "percent",
        }
      : null,
    agriculture: agShare
      ? {
          id: "agriculture",
          value: agShare.value,
          prior: prior(s.agShare.rows)?.value ?? null,
          year: agShare.year,
          unit: "percent",
        }
      : null,
  };

  const projects = {};

  projects.gdp = {
    metrics: {
      ...(growth ? { growth: { value: pct(growth.value), year: growth.year, source: src("NY.GDP.MKTP.KD.ZG", growth.year) } } : {}),
      ...(agShare ? { agShare: { value: pct(agShare.value), year: agShare.year, source: src("NV.AGR.TOTL.ZS", agShare.year) } } : {}),
      ...(indShare ? { indShare: { value: pct(indShare.value), year: indShare.year, source: src("NV.IND.TOTL.ZS", indShare.year) } } : {}),
      ...(srvShare ? { srvShare: { value: pct(srvShare.value), year: srvShare.year, source: src("NV.SRV.TOTL.ZS", srvShare.year) } } : {}),
    },
    series: undefined,
    mix:
      agShare && indShare && srvShare
        ? [
            { key: "srv", value: Math.round(srvShare.value * 10) / 10 },
            { key: "ag", value: Math.round(agShare.value * 10) / 10 },
            { key: "ind", value: Math.round(indShare.value * 10) / 10 },
          ]
        : undefined,
    pair:
      agShare && indShare && srvShare
        ? [
            { key: "ag", a: Math.round(agShare.value * 10) / 10, b: round1(latest(s.agEmp.rows)?.value) },
            { key: "ind", a: Math.round(indShare.value * 10) / 10, b: round1(latest(s.indEmp.rows)?.value) },
            { key: "srv", a: Math.round(srvShare.value * 10) / 10, b: round1(latest(s.srvEmp.rows)?.value) },
          ]
        : undefined,
  };

  const agG = byYear(s.agGrowth.rows);
  const indG = byYear(s.indGrowth.rows);
  const srvG = byYear(s.srvGrowth.rows);
  const agS = byYear(s.agShare.rows);
  const indS = byYear(s.indShare.rows);
  const srvS = byYear(s.srvShare.rows);
  const gdpYears = alignYears([agG, indG, srvG, agS, indS, srvS], 4);
  if (gdpYears.length >= 4) {
    projects.gdp.series = gdpYears.map((year) => ({
      year,
      ag: round1((agS[year] / 100) * agG[year]),
      ind: round1((indS[year] / 100) * indG[year]),
      srv: round1((srvS[year] / 100) * srvG[year]),
    }));
  }

  const netYears = (s.internet.rows ?? []).slice(-8);
  projects.internet = {
    metrics: {
      ...(internet ? { users: { value: pct(internet.value), year: internet.year, source: src("IT.NET.USER.ZS", internet.year) } } : {}),
      ...(mobile
        ? { mobile: { value: `~${mobile.value.toFixed(0)} / 100`, year: mobile.year, source: src("IT.CEL.SETS.P2", mobile.year) } }
        : {}),
    },
    series: netYears.length >= 4 ? netYears.map((r) => ({ year: r.year, users: Math.round(r.value * 10) / 10 })) : undefined,
  };

  const litRows = (s.literacy.rows ?? []).filter((r) => r.value > 0);
  const gap = litMa && litFe ? Math.round((litMa.value - litFe.value) * 10) / 10 : null;
  projects.literacy = {
    metrics: {
      ...(literacy ? { lit: { value: pct(literacy.value), year: literacy.year, source: src("SE.ADT.LITR.ZS", literacy.year) } } : {}),
      ...(litYouth ? { youthLit: { value: pct(litYouth.value), year: litYouth.year, source: src("SE.ADT.1524.LT.ZS", litYouth.year) } } : {}),
      ...(gap != null ? { female: { value: `~${gap} pp`, year: litFe.year, source: src("SE.ADT.LITR.FE/MA.ZS", litFe.year) } } : {}),
    },
    series: litRows.length >= 3 ? litRows.map((r) => ({ year: r.year, lit: Math.round(r.value * 10) / 10 })) : undefined,
  };

  const rainIdx = indexify(s.rain.rows ?? []);
  const coffeeIdx = indexify(coffee);
  const rainMap = Object.fromEntries(rainIdx.map((r) => [r.year, r.value]));
  const coffeeMap = Object.fromEntries(coffeeIdx.map((r) => [r.year, r.value]));
  const agYears = [...new Set([...Object.keys(rainMap), ...Object.keys(coffeeMap)])].sort().slice(-6);
  projects.agriculture = {
    series:
      coffeeIdx.length >= 4 && rainIdx.length >= 4
        ? agYears
            .filter((year) => coffeeMap[year] != null && rainMap[year] != null)
            .slice(-6)
            .map((year) => ({ year, coffee: coffeeMap[year], rain: rainMap[year] }))
        : undefined,
  };

  const stuntRows = (s.stunt.rows ?? []).filter((r) => r.value > 0);
  projects.malnutrition = {
    metrics: {
      ...(stunt ? { stunt: { value: pct(stunt.value, 0), year: stunt.year, source: src("SH.STA.STNT.ZS", stunt.year) } } : {}),
      ...(waste ? { waste: { value: pct(waste.value, 0), year: waste.year, source: src("SH.STA.WAST.ZS", waste.year) } } : {}),
    },
    series: stuntRows.length >= 3 ? stuntRows.map((r) => ({ year: r.year, stunt: Math.round(r.value) })) : undefined,
  };

  projects.trade = {
    metrics: {
      ...(lpi ? { lpi: { value: lpi.value.toFixed(2), year: lpi.year, source: src("LP.LPI.OVRL.XQ", lpi.year) } } : {}),
    },
  };

  const accRows = (s.access.rows ?? []).slice(-8);
  const ru = accessRu?.value;
  const ur = accessUr?.value;
  projects.energy = {
    metrics: {
      ...(access ? { access: { value: pct(access.value, 0), year: access.year, source: src("EG.ELC.ACCS.ZS", access.year) } } : {}),
      ...(ru != null && ur != null
        ? {
            rural: {
              value: `${pct(ur - ru, 0)} gap`,
              year: accessUr.year,
              source: src("EG.ELC.ACCS.UR/RU.ZS", accessUr.year),
            },
          }
        : {}),
    },
    series: accRows.length >= 4 ? accRows.map((r) => ({ year: r.year, access: Math.round(r.value) })) : undefined,
  };

  const yUnemp = (s.unempY.rows ?? []).slice(-6);
  projects.youth = {
    metrics: {
      ...(unemp ? { unemp: { value: pct(unemp.value), year: unemp.year, source: src("SL.UEM.TOTL.ZS", unemp.year) } } : {}),
    },
  };

  projects.housing = {
    metrics: {
      ...(urbGrow
        ? { urban: { value: pct(urbGrow.value), year: urbGrow.year, source: src("SP.URB.GROW", urbGrow.year) } }
        : {}),
    },
  };

  const drought = indexify(s.rain.rows ?? []).map((r) => ({
    year: r.year,
    drought: Math.round((100 - r.value) * 10) / 10,
  }));
  void drought;
  void coffeeLast;


  for (const key of Object.keys(projects)) {
    const p = projects[key];
    if (p.metrics && !Object.keys(p.metrics).length) delete p.metrics;
    if (!p.series) delete p.series;
    if (!p.mix) delete p.mix;
    if (!p.pair) delete p.pair;
    if (!p.metrics && !p.series && !p.mix && !p.pair) delete projects[key];
  }

  const kpisClean = Object.fromEntries(Object.entries(kpis).filter(([, v]) => v));

  return {
    fetchedAt: new Date().toISOString(),
    source: "live",
    lastUpdated: bundle.lastUpdated || new Date().toISOString().slice(0, 10),
    kpis: kpisClean,
    projects,
    notes: [
      "National time series refresh from World Bank WDI (Ethiopia).",
      coffeeLast ? "Coffee export value from FAOSTAT TCL when reachable." : "FAOSTAT coffee unavailable this run — compiled coffee mix retained.",
      "Regional scores, corridor dwell, housing completions, and incubator counts have no public API and stay compiled.",
    ],
  };
}

function applyToApp(app, overlay) {
  if (overlay.kpis && Object.keys(overlay.kpis).length && app.fallback) {
    app.fallback = {
      ...app.fallback,
      kpis: { ...app.fallback.kpis, ...overlay.kpis },
      source: "cached",
      lastUpdated: overlay.lastUpdated,
    };
  }
  if (!Array.isArray(app.projects)) return app;
  for (const project of app.projects) {
    const patch = overlay.projects[project.slug];
    if (!patch) continue;
    if (patch.metrics && Array.isArray(project.metrics)) {
      project.metrics = project.metrics.map((m) => {
        const u = patch.metrics[m.id];
        if (!u) return m;
        return { ...m, value: u.value, source: u.source || m.source };
      });
    }
    if (patch.series?.length && Array.isArray(project.seriesKeys)) {
      const keys = project.seriesKeys.map((k) => k.key);
      const usable =
        patch.series.length >= 3 &&
        keys.length > 0 &&
        patch.series.every((row) => keys.every((k) => typeof row[k] === "number"));
      if (usable) {
        project.series = patch.series.map((row) => {
          const next = { year: String(row.year) };
          for (const k of keys) next[k] = typeof row[k] === "number" ? row[k] : 0;
          return next;
        });
      }
    }
    if (patch.mix?.length && Array.isArray(project.mix)) {
      const map = Object.fromEntries(patch.mix.map((m) => [m.key, m.value]));
      project.mix = project.mix.map((m) => (map[m.key] != null ? { ...m, value: map[m.key] } : m));
    }
    if (patch.pair?.length && Array.isArray(project.pair)) {
      const map = Object.fromEntries(patch.pair.map((m) => [m.key, m]));
      project.pair = project.pair.map((m) => {
        const u = map[m.key];
        if (!u) return m;
        return { ...m, a: u.a ?? m.a, b: u.b ?? m.b };
      });
    }
  }
  return app;
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  console.log("wrote", path);
}

const workspaceMode = existsSync(join(ROOT, "gh-pages", "data", "app.json"));
const livePath = workspaceMode ? join(ROOT, "gh-pages", "data", "live.json") : join(ROOT, "data", "live.json");
const appPath = workspaceMode ? join(ROOT, "gh-pages", "data", "app.json") : join(ROOT, "data", "app.json");
const tsPath = workspaceMode ? join(ROOT, "src", "lib", "live-overlay.json") : null;

const bundle = await fetchAll();
const coffee = await fetchCoffee();
const overlay = buildOverlay(bundle, coffee);
writeJson(livePath, overlay);
if (tsPath) writeJson(tsPath, overlay);
if (existsSync(appPath)) {
  const app = JSON.parse(readFileSync(appPath, "utf8"));
  writeJson(appPath, applyToApp(app, overlay));
}
console.log("refresh complete", overlay.lastUpdated, Object.keys(overlay.projects).join(","));
