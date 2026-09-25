const COLORS = ["var(--c1)", "var(--c2)", "var(--c3)", "var(--c4)", "var(--c5)"];
const STACK = ["var(--c3)", "var(--c1)", "var(--c2)"];
const WB = "https://api.worldbank.org/v2/country/ETH/indicator";

const state = {
  lang: localStorage.getItem("ethiointel-lang") === "am" ? "am" : "en",
  theme: localStorage.getItem("ethiointel-theme") === "light" ? "light" : "dark",
  data: null,
  national: null,
  overlay: null,
  ui: { hidden: [], year: null, mix: null, pair: null, region: null, view: null, atlas: "atlas" },
  analyst: { open: false, busy: false, draft: "", messages: [], engine: null, matched: null },
};

const tx = (obj) => (obj ? obj[state.lang] : "");
const c = () => state.data.copy[state.lang];
const ESC = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ESC[m]);
const fmtN = (n) => {
  if (!Number.isFinite(n)) return "—";
  const a = Math.abs(n);
  if (a >= 100) return n.toFixed(0);
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
};


function applyProjectOverlay(p, overlay) {
  const patch = overlay?.projects?.[p.slug];
  if (!patch) return p;
  const next = { ...p };
  if (patch.metrics) {
    next.metrics = p.metrics.map((m) => {
      const u = patch.metrics[m.id];
      return u ? { ...m, value: u.value, source: u.source || m.source } : m;
    });
  }
  if (patch.series?.length >= 3 && Array.isArray(p.seriesKeys)) {
    const keys = p.seriesKeys.map((k) => k.key);
    const ok = keys.length && patch.series.every((row) => keys.every((k) => typeof row[k] === "number"));
    if (ok) {
      next.series = patch.series.map((row) => {
        const out = { year: String(row.year) };
        for (const k of keys) out[k] = row[k];
        return out;
      });
    }
  }
  if (patch.mix?.length && Array.isArray(p.mix)) {
    const map = Object.fromEntries(patch.mix.map((m) => [m.key, m.value]));
    next.mix = p.mix.map((m) => (map[m.key] != null ? { ...m, value: map[m.key] } : m));
  }
  if (patch.pair?.length && Array.isArray(p.pair)) {
    const map = Object.fromEntries(patch.pair.map((m) => [m.key, m]));
    next.pair = p.pair.map((m) => {
      const u = map[m.key];
      return u ? { ...m, a: u.a ?? m.a, b: u.b ?? m.b } : m;
    });
  }
  return next;
}

function mergeNational(overlay) {
  if (!overlay?.kpis) return;
  const k = overlay.kpis;
  const cur = state.national?.kpis || {};
  if (!k.population && !cur.population) return;
  state.national = {
    kpis: { ...cur, ...k },
    source: overlay.source || state.national?.source || "cached",
    lastUpdated: overlay.lastUpdated || state.national?.lastUpdated,
  };
}

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  return hash.startsWith("projects/") ? hash.slice(9) : "";
}

function fmtKpi(value, unit) {
  if (unit === "people") return value >= 1e6 ? (value / 1e6).toFixed(1) + "M" : Math.round(value).toLocaleString();
  if (unit === "usd") return value >= 1e9 ? "$" + (value / 1e9).toFixed(1) + "B" : "$" + Math.round(value).toLocaleString();
  return value.toFixed(1) + "%";
}

function delta(cur, prior, unit) {
  if (prior == null || prior === 0) return "";
  if (unit === "percent") {
    const pts = cur - prior;
    const dir = pts > 0.05 ? "up" : pts < -0.05 ? "down" : "";
    return `<span class="delta ${dir}">${pts > 0 ? "+" : ""}${pts.toFixed(1)}pp ${esc(c().yoy)}</span>`;
  }
  const pct = ((cur - prior) / prior) * 100;
  const dir = pct > 0.4 ? "up" : pct < -0.4 ? "down" : "";
  return `<span class="delta ${dir}">${pct > 0 ? "+" : ""}${pct.toFixed(1)}% ${esc(c().yoy)}</span>`;
}

async function loadWb() {
  const ids = {
    population: "SP.POP.TOTL",
    gdp: "NY.GDP.MKTP.CD",
    gdpGrowth: "NY.GDP.MKTP.KD.ZG",
    internet: "IT.NET.USER.ZS",
    literacy: "SE.ADT.LITR.ZS",
    agriculture: "NV.AGR.TOTL.ZS",
  };
  const units = { population: "people", gdp: "usd", gdpGrowth: "percent", internet: "percent", literacy: "percent", agriculture: "percent" };
  try {
    const entries = await Promise.all(
      Object.entries(ids).map(async ([key, id]) => {
        const res = await fetch(`${WB}/${id}?format=json&mrv=6&per_page=6`);
        if (!res.ok) throw new Error(id);
        const json = await res.json();
        const rows = (json[1] || []).filter((r) => r.value != null);
        return [key, { id: key, value: Number(rows[0].value), prior: rows[1]?.value ?? null, year: rows[0].date, unit: units[key], last: json[0]?.lastupdated }];
      }),
    );
    const kpis = Object.fromEntries(entries.map(([k, v]) => [k, v]));
    return { kpis, source: "live", lastUpdated: entries[0][1].last || state.data.fallback.lastUpdated };
  } catch {
    return state.data.fallback;
  }
}

async function fetchWbRows(id) {
  const res = await fetch(`${WB}/${id}?format=json&mrv=12&per_page=12`);
  if (!res.ok) throw new Error(id);
  const json = await res.json();
  const rows = (json[1] || [])
    .filter((r) => r && r.value != null)
    .map((r) => ({ year: String(r.date), value: Number(r.value) }))
    .sort((a, b) => a.year.localeCompare(b.year));
  return { last: json[0]?.lastupdated, rows };
}

async function hydrateOverlay() {
  const ids = {
    agShare: "NV.AGR.TOTL.ZS",
    indShare: "NV.IND.TOTL.ZS",
    srvShare: "NV.SRV.TOTL.ZS",
    agGrowth: "NV.AGR.TOTL.KD.ZG",
    indGrowth: "NV.IND.TOTL.KD.ZG",
    srvGrowth: "NV.SRV.TOTL.KD.ZG",
    internet: "IT.NET.USER.ZS",
    literacy: "SE.ADT.LITR.ZS",
    access: "EG.ELC.ACCS.ZS",
    stunt: "SH.STA.STNT.ZS",
    unemp: "SL.UEM.TOTL.ZS",
    urbGrow: "SP.URB.GROW",
  };
  const got = {};
  const entries = Object.entries(ids);
  try {
    for (let i = 0; i < entries.length; i += 4) {
      await Promise.all(
        entries.slice(i, i + 4).map(async ([key, id]) => {
          try {
            got[key] = await fetchWbRows(id);
          } catch {
            got[key] = { rows: [] };
          }
        }),
      );
    }
  } catch {
    return;
  }
  const last = (rows) => (rows && rows.length ? rows[rows.length - 1] : null);
  const pct = (n, d = 1) => `${Number(n).toFixed(d)}%`;
  const src = (code, year) => `World Bank WDI ${code}, ${year}`;
  const overlay = state.overlay || { projects: {}, kpis: {}, notes: [], source: "live", lastUpdated: "", fetchedAt: new Date().toISOString() };
  overlay.projects = overlay.projects || {};
  const ag = last(got.agShare?.rows);
  const ind = last(got.indShare?.rows);
  const srv = last(got.srvShare?.rows);
  const net = last(got.internet?.rows);
  const lit = last(got.literacy?.rows);
  const acc = last(got.access?.rows);
  const st = last(got.stunt?.rows);
  const un = last(got.unemp?.rows);
  const ug = last(got.urbGrow?.rows);
  const gdp = overlay.projects.gdp || {};
  if (ag && ind && srv) {
    gdp.metrics = {
      ...(gdp.metrics || {}),
      agShare: { value: pct(ag.value), year: ag.year, source: src("NV.AGR.TOTL.ZS", ag.year) },
      indShare: { value: pct(ind.value), year: ind.year, source: src("NV.IND.TOTL.ZS", ind.year) },
      srvShare: { value: pct(srv.value), year: srv.year, source: src("NV.SRV.TOTL.ZS", srv.year) },
    };
    gdp.mix = [
      { key: "srv", value: Math.round(srv.value * 10) / 10 },
      { key: "ag", value: Math.round(ag.value * 10) / 10 },
      { key: "ind", value: Math.round(ind.value * 10) / 10 },
    ];
    const agG = Object.fromEntries((got.agGrowth?.rows || []).map((r) => [r.year, r.value]));
    const indG = Object.fromEntries((got.indGrowth?.rows || []).map((r) => [r.year, r.value]));
    const srvG = Object.fromEntries((got.srvGrowth?.rows || []).map((r) => [r.year, r.value]));
    const agS = Object.fromEntries((got.agShare?.rows || []).map((r) => [r.year, r.value]));
    const indS = Object.fromEntries((got.indShare?.rows || []).map((r) => [r.year, r.value]));
    const srvS = Object.fromEntries((got.srvShare?.rows || []).map((r) => [r.year, r.value]));
    const years = Object.keys(agG).filter((y) => indG[y] != null && srvG[y] != null && agS[y] != null && indS[y] != null && srvS[y] != null).sort().slice(-8);
    if (years.length >= 4) {
      gdp.series = years.map((year) => ({
        year,
        ag: Math.round((agS[year] / 100) * agG[year] * 10) / 10,
        ind: Math.round((indS[year] / 100) * indG[year] * 10) / 10,
        srv: Math.round((srvS[year] / 100) * srvG[year] * 10) / 10,
      }));
    }
    overlay.projects.gdp = gdp;
  }
  if (net) {
    const internet = overlay.projects.internet || {};
    internet.metrics = { ...(internet.metrics || {}), users: { value: pct(net.value), year: net.year, source: src("IT.NET.USER.ZS", net.year) } };
    const rows = got.internet?.rows || [];
    if (rows.length >= 4) internet.series = rows.slice(-8).map((r) => ({ year: r.year, users: Math.round(r.value * 10) / 10 }));
    overlay.projects.internet = internet;
  }
  if (lit) {
    const literacy = overlay.projects.literacy || {};
    literacy.metrics = { ...(literacy.metrics || {}), lit: { value: pct(lit.value), year: lit.year, source: src("SE.ADT.LITR.ZS", lit.year) } };
    const rows = got.literacy?.rows || [];
    if (rows.length >= 3) literacy.series = rows.map((r) => ({ year: r.year, lit: Math.round(r.value * 10) / 10 }));
    overlay.projects.literacy = literacy;
  }
  if (acc) {
    const energy = overlay.projects.energy || {};
    energy.metrics = { ...(energy.metrics || {}), access: { value: pct(acc.value, 0), year: acc.year, source: src("EG.ELC.ACCS.ZS", acc.year) } };
    const rows = got.access?.rows || [];
    if (rows.length >= 4) energy.series = rows.slice(-8).map((r) => ({ year: r.year, access: Math.round(r.value) }));
    overlay.projects.energy = energy;
  }
  if (st) {
    const mal = overlay.projects.malnutrition || {};
    mal.metrics = { ...(mal.metrics || {}), stunt: { value: pct(st.value, 0), year: st.year, source: src("SH.STA.STNT.ZS", st.year) } };
    overlay.projects.malnutrition = mal;
  }
  if (un) {
    const youth = overlay.projects.youth || {};
    youth.metrics = { ...(youth.metrics || {}), unemp: { value: pct(un.value), year: un.year, source: src("SL.UEM.TOTL.ZS", un.year) } };
    overlay.projects.youth = youth;
  }
  if (ug) {
    const housing = overlay.projects.housing || {};
    housing.metrics = { ...(housing.metrics || {}), urban: { value: pct(ug.value), year: ug.year, source: src("SP.URB.GROW", ug.year) } };
    overlay.projects.housing = housing;
  }
  overlay.source = "live";
  overlay.fetchedAt = new Date().toISOString();
  state.overlay = overlay;
}

function clock() {
  return (
    new Intl.DateTimeFormat(state.lang === "am" ? "am-ET" : "en-GB", {
      timeZone: "Africa/Addis_Ababa",
      calendar: "gregory",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date()) + " EAT"
  );
}

function applyTheme() {
  document.documentElement.setAttribute("data-theme", state.theme);
  document.documentElement.style.colorScheme = state.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", state.theme === "light" ? "#eef2f4" : "#080c10");
}

function header(compact) {
  const copy = c();
  return `
  <header class="bar">
    <div class="bar-top">
      <div class="brand"><span class="dot"></span><p class="micro">${esc(copy.classification)}</p></div>
      <div class="brand"><p class="micro hide-sm">${esc(copy.region)} · ${esc(copy.capital)}</p><time class="clock" id="clock">${clock()}</time></div>
    </div>
    <div class="bar-main">
      <a class="brand" href="#/">
        <div class="mark"><svg viewBox="0 0 40 40" width="28" height="28" fill="none"><rect x="7.5" y="7.5" width="25" height="25" rx="1" transform="rotate(45 20 20)" stroke="currentColor" stroke-width="1.4"/><path d="M20 6.5 V13.5 M20 26.5 V33.5 M6.5 20 H13.5 M26.5 20 H33.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="square"/><circle cx="20" cy="20" r="3.2" fill="currentColor"/></svg></div>
        <div>
          <p class="live">${esc(copy.live)}</p>
          <h1>${esc(copy.title)}</h1>
          ${compact ? "" : `<p class="sub">${esc(copy.subtitle)}</p>`}
        </div>
      </a>
      <div class="toggles">
        <div class="lang" role="group" aria-label="${esc(copy.language)}">
          <button type="button" data-lang="en" aria-pressed="${state.lang === "en"}">${esc(copy.english)}</button>
          <button type="button" data-lang="am" aria-pressed="${state.lang === "am"}">${esc(copy.amharic)}</button>
        </div>
        <div class="theme" role="group" aria-label="${esc(copy.theme)}">
          <button type="button" data-theme="dark" aria-pressed="${state.theme === "dark"}">${esc(copy.dark)}</button>
          <button type="button" data-theme="light" aria-pressed="${state.theme === "light"}">${esc(copy.light)}</button>
        </div>
      </div>
    </div>
  </header>`;
}

function nav(active) {
  const copy = c();
  return `<nav class="nav-rail" aria-label="${esc(copy.programmes)}">
    <button type="button" class="nav-chevron left" hidden data-nav-shift="-1" aria-label="${esc(copy.scrollProgrammes)}">‹</button>
    <div class="nav" id="nav-scroll">
      <a href="#/" class="${active ? "" : "home-on"}">${esc(copy.command)}</a>
      ${state.data.projects.map((p) => `<a href="#/projects/${p.slug}" class="${active === p.slug ? "on" : ""}" data-slug="${esc(p.slug)}"><span class="micro">${p.number}</span> ${esc(tx(p.title))}</a>`).join("")}
    </div>
    <button type="button" class="nav-chevron right" hidden data-nav-shift="1" aria-label="${esc(copy.scrollProgrammes)}">›</button>
  </nav>`;
}

function footer(extra) {
  const copy = c();
  const n = state.national;
  return `<footer>
    <p class="sec">${esc(copy.sources)}</p>
    <p class="muted">${esc(copy.sourceNote)}</p>
    ${extra ? `<p class="muted">${esc(extra)}</p>` : ""}
    <p class="src">${esc(copy.worldBank)} · ESS · NBE · NMA · NDRMC · FAO · WFP · ILO · GSMA${n ? " · " + n.lastUpdated : ""}</p>
  </footer>`;
}

function colorFor(i, stack) {
  return stack ? STACK[i % STACK.length] : COLORS[i % COLORS.length];
}

function seriesChart(p) {
  const copy = c();
  const view = state.ui.view || (p.seriesKind === "line" ? "line" : p.seriesKind);
  const keys = p.seriesKeys;
  const visible = keys.filter((k) => !state.ui.hidden.includes(k.key));
  const w = 560;
  const h = 220;
  const pad = { t: 12, r: 12, b: 28, l: 36 };
  const iw = w - pad.l - pad.r;
  const ih = h - pad.t - pad.b;
  const years = p.series.map((row) => String(row.year));
  const max = Math.max(
    ...p.series.flatMap((row) =>
      view === "stack"
        ? [visible.reduce((s, k) => s + (Number(row[k.key]) || 0), 0)]
        : visible.map((k) => Number(row[k.key]) || 0),
    ),
    1,
  );
  const n = p.series.length;
  const groupW = iw / n;
  const isLine = view === "line";

  const yOf = (v) => pad.t + ih - (v / max) * ih;

  let body = "";
  if (isLine) {
    visible.forEach((k) => {
      const i = keys.findIndex((x) => x.key === k.key);
      const pts = p.series
        .map((row, xi) => {
          const x = pad.l + groupW * xi + groupW / 2;
          const y = yOf(Number(row[k.key]) || 0);
          return `${x},${y}`;
        })
        .join(" ");
      body += `<polyline fill="none" stroke="${colorFor(i, p.seriesKind === "stack")}" stroke-width="2" points="${pts}" />`;
      p.series.forEach((row, xi) => {
        const x = pad.l + groupW * xi + groupW / 2;
        const y = yOf(Number(row[k.key]) || 0);
        const dim = state.ui.year && state.ui.year !== String(row.year);
        body += `<circle class="dot" data-year="${esc(String(row.year))}" cx="${x}" cy="${y}" r="4" fill="${colorFor(i, p.seriesKind === "stack")}" opacity="${dim ? 0.28 : 1}"><title>${esc(tx(k.name))} ${fmtN(Number(row[k.key]) || 0)} · ${esc(String(row.year))}</title></circle>`;
      });
    });
  } else if (view === "stack") {
    p.series.forEach((row, xi) => {
      let acc = 0;
      const x = pad.l + groupW * xi + groupW * 0.28;
      const bw = groupW * 0.44;
      const dim = state.ui.year && state.ui.year !== String(row.year);
      visible.forEach((k) => {
        const i = keys.findIndex((x) => x.key === k.key);
        const v = Number(row[k.key]) || 0;
        const bh = (v / max) * ih;
        const y = pad.t + ih - acc - bh;
        acc += bh;
        body += `<rect class="bar" data-year="${esc(String(row.year))}" x="${x}" y="${y}" width="${bw}" height="${Math.max(bh, 0)}" fill="${colorFor(i, true)}" opacity="${dim ? 0.28 : 1}" rx="1"><title>${esc(tx(k.name))} ${fmtN(v)} · ${esc(String(row.year))}</title></rect>`;
      });
    });
  } else {
    const bw = groupW / (visible.length + 1.4);
    p.series.forEach((row, xi) => {
      const dim = state.ui.year && state.ui.year !== String(row.year);
      visible.forEach((k, ki) => {
        const i = keys.findIndex((x) => x.key === k.key);
        const v = Number(row[k.key]) || 0;
        const bh = (v / max) * ih;
        const x = pad.l + groupW * xi + groupW * 0.18 + ki * bw;
        const y = yOf(v);
        body += `<rect class="bar" data-year="${esc(String(row.year))}" x="${x}" y="${y}" width="${Math.max(bw * 0.86, 4)}" height="${Math.max(bh, 0)}" fill="${colorFor(i, false)}" opacity="${dim ? 0.28 : 1}" rx="1"><title>${esc(tx(k.name))} ${fmtN(v)} · ${esc(String(row.year))}</title></rect>`;
      });
    });
  }

  const labels = p.series
    .map((row, xi) => `<text x="${pad.l + groupW * xi + groupW / 2}" y="${h - 8}" text-anchor="middle">${esc(String(row.year))}</text>`)
    .join("");

  const ticks = [0, 0.5, 1]
    .map((t) => {
      const y = pad.t + ih * (1 - t);
      const val = max * t;
      return `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y}" y2="${y}" stroke="var(--border)" /><text x="${pad.l - 6}" y="${y + 3}" text-anchor="end">${fmtN(val)}</text>`;
    })
    .join("");

  const viewOpts =
    p.seriesKind === "stack"
      ? [
          ["stack", copy.chartStack],
          ["line", copy.chartLines],
        ]
      : [
          [p.seriesKind === "line" ? "bar" : "bar", copy.chartBars],
          ["line", copy.chartLines],
        ];

  const selected = p.series.find((row) => String(row.year) === state.ui.year);
  const total = selected ? visible.reduce((s, k) => s + (Number(selected[k.key]) || 0), 0) : 0;
  const readout = selected
    ? `<span class="hi">${esc(copy.pinned)}</span> · ${esc(state.ui.year)} · ${visible.map((k) => `${esc(tx(k.name))} ${fmtN(Number(selected[k.key]) || 0)}`).join(" · ")}${visible.length > 1 ? ` · ${esc(copy.total)} ${fmtN(total)}` : ""}`
    : esc(isLine ? copy.lineHint : copy.pinHint);

  return `<div>
    <div class="chart-tools">
      <div class="chips">${keys
        .map((k, i) => {
          const on = !state.ui.hidden.includes(k.key);
          return `<button type="button" class="chip ${on ? "on" : ""}" data-hide="${esc(k.key)}"><span class="sw" style="background:${colorFor(i, p.seriesKind === "stack")}"></span>${esc(tx(k.name))}</button>`;
        })
        .join("")}${state.ui.hidden.length ? `<button type="button" class="chip on" data-show-all="1">${esc(copy.showAll)}</button>` : ""}</div>
      <div class="seg-wrap">${viewOpts.map(([id, label]) => `<button type="button" class="seg ${view === id ? "on" : ""}" data-view="${esc(id)}">${esc(label)}</button>`).join("")}</div>
    </div>
    <svg class="svg-chart" viewBox="0 0 ${w} ${h}" role="img">${ticks}${body}${labels}</svg>
    <div class="years">${years.map((y) => `<button type="button" class="${state.ui.year === y ? "on" : ""}" data-year="${esc(y)}">${esc(y)}</button>`).join("")}</div>
    <p class="readout">${readout}</p>
  </div>`;
}

function pie(mix) {
  const copy = c();
  const total = mix.reduce((s, m) => s + m.value, 0) || 1;
  const cx = 80;
  const cy = 80;
  const r = 62;
  const ri = 38;
  let acc = -Math.PI / 2;
  const slices = mix
    .map((m, i) => {
      const a0 = acc;
      const a1 = acc + (m.value / total) * Math.PI * 2;
      acc = a1;
      const large = a1 - a0 > Math.PI ? 1 : 0;
      const x0 = cx + r * Math.cos(a0);
      const y0 = cy + r * Math.sin(a0);
      const x1 = cx + r * Math.cos(a1);
      const y1 = cy + r * Math.sin(a1);
      const xi0 = cx + ri * Math.cos(a0);
      const yi0 = cy + ri * Math.sin(a0);
      const xi1 = cx + ri * Math.cos(a1);
      const yi1 = cy + ri * Math.sin(a1);
      const dim = state.ui.mix && state.ui.mix !== m.key;
      const d = `M ${x0} ${y0} A ${r} ${r} 0 ${large} 1 ${x1} ${y1} L ${xi1} ${yi1} A ${ri} ${ri} 0 ${large} 0 ${xi0} ${yi0} Z`;
      return `<path class="slice" data-mix="${esc(m.key)}" d="${d}" fill="${COLORS[i % COLORS.length]}" opacity="${dim ? 0.28 : 1}"><title>${esc(tx(m.name))} ${fmtN(m.value)}%</title></path>`;
    })
    .join("");
  const selected = mix.find((m) => m.key === state.ui.mix);
  const readout = selected
    ? `<span class="hi">${esc(copy.isolated)}</span> · ${esc(tx(selected.name))} ${fmtN(selected.value)}%`
    : esc(copy.mixHint);
  return `<div>
    <div class="pie-wrap">
      <svg class="pie-svg" viewBox="0 0 160 160">${slices}</svg>
      <ul class="legend">${mix
        .map((m, i) => {
          const dim = state.ui.mix && state.ui.mix !== m.key;
          return `<li><button type="button" class="${dim ? "dim" : ""}" data-mix="${esc(m.key)}"><span><span class="sw" style="background:${COLORS[i % COLORS.length]}"></span>${esc(tx(m.name))}</span><span class="src">${fmtN(m.value)}%</span></button></li>`;
        })
        .join("")}</ul>
    </div>
    <p class="readout">${readout}</p>
  </div>`;
}

function pairChart(p) {
  const copy = c();
  const max = Math.max(...p.pair.flatMap((r) => [r.a, r.b]), 1);
  const selected = p.pair.find((r) => r.key === state.ui.pair);
  const readout = selected
    ? `<span class="hi">${esc(copy.pinned)}</span> · ${esc(tx(selected.name))} · ${esc(tx(p.pairA))} ${fmtN(selected.a)} · ${esc(tx(p.pairB))} ${fmtN(selected.b)} · ${esc(copy.difference)} ${fmtN(selected.a - selected.b)}`
    : esc(copy.pairHint);
  return `<div>
    <div class="pair">${p.pair
      .map((r) => {
        const dim = state.ui.pair && state.ui.pair !== r.key;
        return `<button type="button" class="${dim ? "dim" : ""}" data-pair="${esc(r.key)}">
          <div class="lab"><span>${esc(tx(r.name))}</span><span class="src">${fmtN(r.a)} · ${fmtN(r.b)}</span></div>
          <div class="two">
            <div class="track"><div class="fill" style="width:${(r.a / max) * 100}%"></div></div>
            <div class="track"><div class="fill" style="width:${(r.b / max) * 100}%"></div></div>
          </div>
        </button>`;
      })
      .join("")}</div>
    <p class="readout">${readout}</p>
  </div>`;
}

function heat(p) {
  const vals = p.regions.map((r) => r.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = Math.max(max - min, 1);
  const names = Object.fromEntries(state.data.regions.map((r) => [r.id, r.name]));
  const copy = c();
  const low = state.lang === "am" ? "ዝቅተኛ" : "Low";
  const high = state.lang === "am" ? "ከፍተኛ" : "High";
  const ranked = [...p.regions].sort((a, b) => b.value - a.value);
  const median = ranked[Math.floor(ranked.length / 2)]?.value ?? 0;
  const order = state.ui.atlas === "ranked" ? ranked : p.regions;
  const selected = p.regions.find((r) => r.id === state.ui.region);
  const rank = selected ? ranked.findIndex((r) => r.id === selected.id) + 1 : 0;
  const readout = selected
    ? `<span class="hi">${esc(copy.pinned)}</span> · ${esc(tx(names[selected.id]))} ${selected.value} ${esc(tx(p.regionUnit))} · ${esc(copy.rank)} ${rank} ${esc(copy.of)} ${ranked.length} · ${esc(copy.vsMedian)} ${selected.value - median >= 0 ? "+" : ""}${selected.value - median}`
    : esc(copy.atlasHint);
  return `<article class="card">
    <div class="row">
      <h2 class="sec">${esc(copy.regionalLens)} — ${esc(tx(p.regionTitle))}</h2>
      <div class="row" style="gap:0.75rem;align-items:center">
        <p class="micro">${esc(low)} <span class="atlas-scale"></span> ${esc(high)} · ${esc(tx(p.regionUnit))}</p>
        <div class="seg-wrap">
          <button type="button" class="seg ${state.ui.atlas === "atlas" ? "on" : ""}" data-atlas="atlas">${esc(copy.atlasView)}</button>
          <button type="button" class="seg ${state.ui.atlas === "ranked" ? "on" : ""}" data-atlas="ranked">${esc(copy.rankedView)}</button>
        </div>
      </div>
    </div>
    <div class="heat ${state.ui.atlas === "ranked" ? "ranked" : "atlas"}">${order
      .map((r) => {
        const t = (r.value - min) / span;
        const mix = Math.round(12 + t * 55);
        const on = state.ui.region === r.id;
        const dim = state.ui.region && !on;
        return `<button type="button" data-id="${esc(r.id)}" data-region="${esc(r.id)}" class="${on ? "on" : ""} ${dim ? "dim" : ""}" style="background:color-mix(in oklab, var(--primary) ${mix}%, var(--elevated))"><p>${esc(tx(names[r.id]))}</p><b>${r.value}</b></button>`;
      })
      .join("")}</div>
    <p class="readout">${readout}</p>
  </article>`;
}

function home() {
  const copy = c();
  const n = state.national || state.data.fallback;
  const order = ["population", "gdp", "gdpGrowth", "internet", "literacy", "agriculture"];
  return `
    ${header(false)}
    ${nav()}
    <main class="wrap">
      <section>
        <div class="row"><h2 class="sec">${esc(copy.kpis)}</h2><p class="micro">${n.source === "live" ? esc(copy.liveData) : esc(copy.cached)}</p></div>
        <div class="grid3">${order
          .map((id) => {
            const k = n.kpis[id];
            return `<article class="card"><p class="k">${esc(copy[id])}</p><p class="v">${fmtKpi(k.value, k.unit)}</p><p class="src">${delta(k.value, k.prior, k.unit)} ${k.year} · ${esc(copy.worldBank)}</p></article>`;
          })
          .join("")}</div>
      </section>
      <section>
        <h2 class="sec">${esc(copy.programmes)}</h2>
        <div class="grid2">${state.data.projects
          .map(
            (p) => `<a class="card" href="#/projects/${p.slug}">
          <div class="row"><span class="icon">${p.number}</span><span class="tag">${esc(tx(p.tag))}</span></div>
          <h3 style="margin:1rem 0 0;font-size:1rem">${esc(tx(p.title))}</h3>
          <p class="muted">${esc(tx(p.goal))}</p>
          <p class="open">${esc(copy.openDashboard)}</p>
        </a>`,
          )
          .join("")}</div>
      </section>
      <div class="grid2">
        <article class="card"><h2 class="sec">${esc(copy.methodology)}</h2><p class="muted">${esc(copy.sourceNote)}</p></article>
        <article class="card"><h2 class="sec">${esc(copy.facts)}</h2>
          ${[
            ["capitalLabel", "capital"],
            ["currency", "currencyValue"],
            ["area", "areaValue"],
            ["officialLang", "officialLangValue"],
            ["medianAge", "medianAgeValue"],
          ]
            .map(([a, b]) => `<div class="row" style="border-bottom:1px solid var(--border);padding:0.6rem 0"><span class="muted">${esc(copy[a])}</span><span>${esc(copy[b])}</span></div>`)
            .join("")}
        </article>
      </div>
    </main>
    ${footer()}`;
}

function projectView(raw) {
  const p = applyProjectOverlay(raw, state.overlay);
  const copy = c();
  const kindLabel = (k) => (k === "quickwin" ? copy.quickWin : k === "policy" ? copy.policy : copy.insights);
  return `
    ${header(true)}
    ${nav(p.slug)}
    <main class="wrap">
      <a class="back" href="#/">${esc(copy.backHome)}</a>
      <article class="card">
        <div class="row"><span class="icon">${p.number}</span><span class="tag">${esc(tx(p.tag))}</span></div>
        <h2 style="font-size:1.5rem;margin:1rem 0 0">${esc(tx(p.title))}</h2>
        <p class="sec" style="margin-top:0.75rem">${esc(copy.overview)}</p>
        <p class="muted">${esc(tx(p.overview))}</p>
        <p>${esc(tx(p.goal))}</p>
      </article>
      <section>
        <h2 class="sec">${esc(copy.keyMetrics)}</h2>
        <div class="grid2">${p.metrics.map((m) => `<article class="card"><p class="k">${esc(tx(m.label))}</p><p class="v">${esc(m.value)}</p><p class="muted">${esc(tx(m.definition))}</p><p class="src">${esc(m.source)}</p></article>`).join("")}</div>
      </section>
      <div class="grid2">
        <article class="card"><h2 class="sec">${esc(tx(p.seriesTitle))}</h2>${seriesChart(p)}</article>
        <article class="card"><h2 class="sec">${esc(tx(p.mixTitle))}</h2>${pie(p.mix)}</article>
      </div>
      <article class="card"><h2 class="sec">${esc(tx(p.pairTitle))}</h2>${pairChart(p)}</article>
      ${heat(p)}
      <div class="grid2">
        <article class="card"><h2 class="sec">${esc(copy.insights)}</h2>${p.insights.map((i) => `<div class="insight"><p class="kind">${esc(kindLabel(i.kind))}</p><h3 style="margin:0.25rem 0 0;font-size:0.9rem">${esc(tx(i.title))}</h3><p class="muted">${esc(tx(i.body))}</p></div>`).join("")}</article>
        <article class="card"><h2 class="sec">${esc(copy.challenges)}</h2>${p.challenges.map((i) => `<div class="insight"><h3 style="margin:0;font-size:0.9rem">${esc(tx(i.title))} ${i.gap ? `<span class="gap">${esc(copy.gap)}</span>` : ""}</h3><p class="muted">${esc(tx(i.body))}</p></div>`).join("")}</article>
      </div>
      <div class="grid2">
        <article class="card"><h2 class="sec">${esc(copy.dataSources)}</h2>
          <p class="micro">${esc(copy.primary)}</p><ul>${p.primary.map((s) => `<li class="muted">· ${esc(s.name)}</li>`).join("")}</ul>
          <p class="micro">${esc(copy.secondary)}</p><ul>${p.secondary.map((s) => `<li class="muted">· ${esc(s.name)}</li>`).join("")}</ul>
        </article>
        <article class="card"><h2 class="sec">${esc(copy.methodology)}</h2><p class="muted">${esc(tx(p.methodology))}</p></article>
      </div>
    </main>
    ${footer(tx(p.methodology))}`;
}

function wireNav() {
  const el = document.getElementById("nav-scroll");
  if (!el) return;
  const left = document.querySelector(".nav-chevron.left");
  const right = document.querySelector(".nav-chevron.right");
  const update = () => {
    const canL = el.scrollLeft > 4;
    const canR = el.scrollLeft + el.clientWidth < el.scrollWidth - 4;
    if (left) left.hidden = !canL;
    if (right) right.hidden = !canR;
    el.classList.toggle("pad-l", canL);
    el.classList.toggle("pad-r", canR);
  };
  update();
  el.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  const on = el.querySelector(".on, .home-on");
  if (on) on.scrollIntoView({ inline: "center", block: "nearest" });
}

function render() {
  document.documentElement.lang = state.lang === "am" ? "am" : "en";
  document.documentElement.dataset.lang = state.lang;
  applyTheme();
  const slug = route();
  const project = state.data.projects.find((p) => p.slug === slug);
  document.getElementById("app").innerHTML = project ? projectView(project) : home();
  wireNav();
  renderAnalyst();
}

function toggle(arr, key) {
  if (arr.includes(key)) return arr.filter((k) => k !== key);
  return [...arr, key];
}

function bind() {
  document.body.addEventListener("click", (e) => {
    const t = e.target.closest("[data-lang],[data-theme],[data-hide],[data-show-all],[data-view],[data-year],[data-mix],[data-pair],[data-region],[data-atlas],[data-nav-shift]");
    if (!t) return;

    if (t.hasAttribute("data-lang")) {
      state.lang = t.getAttribute("data-lang");
      localStorage.setItem("ethiointel-lang", state.lang);
      render();
      return;
    }
    if (t.hasAttribute("data-theme")) {
      state.theme = t.getAttribute("data-theme");
      localStorage.setItem("ethiointel-theme", state.theme);
      render();
      return;
    }
    if (t.hasAttribute("data-nav-shift")) {
      const el = document.getElementById("nav-scroll");
      if (el) el.scrollBy({ left: Number(t.getAttribute("data-nav-shift")) * Math.max(180, el.clientWidth * 0.55), behavior: "smooth" });
      return;
    }
    if (t.hasAttribute("data-hide")) {
      const key = t.getAttribute("data-hide");
      const next = toggle(state.ui.hidden, key);
      state.ui.hidden = next.length >= 20 ? [] : next;
      const slug = route();
      const p = state.data.projects.find((x) => x.slug === slug);
      if (p && state.ui.hidden.length >= p.seriesKeys.length) state.ui.hidden = [];
      render();
      return;
    }
    if (t.hasAttribute("data-show-all")) {
      state.ui.hidden = [];
      render();
      return;
    }
    if (t.hasAttribute("data-view")) {
      state.ui.view = t.getAttribute("data-view");
      render();
      return;
    }
    if (t.hasAttribute("data-year")) {
      const y = t.getAttribute("data-year");
      state.ui.year = state.ui.year === y ? null : y;
      render();
      return;
    }
    if (t.hasAttribute("data-mix")) {
      const k = t.getAttribute("data-mix");
      state.ui.mix = state.ui.mix === k ? null : k;
      render();
      return;
    }
    if (t.hasAttribute("data-pair")) {
      const k = t.getAttribute("data-pair");
      state.ui.pair = state.ui.pair === k ? null : k;
      render();
      return;
    }
    if (t.hasAttribute("data-region")) {
      const k = t.getAttribute("data-region");
      state.ui.region = state.ui.region === k ? null : k;
      render();
      return;
    }
    if (t.hasAttribute("data-atlas")) {
      state.ui.atlas = t.getAttribute("data-atlas");
      render();
    }
  });
  window.addEventListener("hashchange", () => {
    state.ui = { hidden: [], year: null, mix: null, pair: null, region: null, view: null, atlas: "atlas" };
    render();
  });
  setInterval(() => {
    const el = document.getElementById("clock");
    if (el) el.textContent = clock();
  }, 1000);
}


const ASK_STOP = new Set(["the","a","an","and","or","of","to","in","for","on","with","what","where","which","how","should","ethiopia","ethiopian","please","tell","me","about"]);
const ASK_HINTS = {
  gdp: ["gdp","industry","manufacturing","diversif","sector","ኢንዱስትሪ","ዕድገት"],
  internet: ["internet","fibre","fiber","digital","telecom","4g","ኢንተርኔት","ፋይበር"],
  literacy: ["literacy","tvet","school","skill","education","ማንበብ","ትምህርት"],
  agriculture: ["coffee","farm","crop","export","rain","ቡና","ግብርና"],
  malnutrition: ["stunt","nutrition","food","wasting","hunger","ምግብ"],
  trade: ["corridor","djibouti","port","logistics","berbera","ጅቡቲ","ወደብ"],
  energy: ["power","electric","grid","gerd","park","ኃይል","ኤሌክትሪክ"],
  youth: ["youth","job","startup","unemploy","incubator","ወጣት","ሥራ"],
  housing: ["housing","rent","condo","urban","ppp","መኖሪያ","ቤት"],
  climate: ["drought","flood","climate","seed","awash","ድርቅ","ጎርፍ"],
};

function askTokens(q) {
  return q.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, " ").split(/\s+/).filter((w) => w.length > 2 && !ASK_STOP.has(w));
}

function rankAsk(question) {
  const tks = askTokens(question);
  const scored = (state.data?.projects || []).map((raw) => {
    const p = applyProjectOverlay(raw, state.overlay);
    const hay = [p.slug, p.title.en, p.title.am, p.overview.en, p.goal.en, ...p.metrics.map((m) => m.label.en + " " + m.value)].join(" ").toLowerCase();
    let score = 0;
    for (const t of tks) {
      if (p.slug.includes(t)) score += 8;
      if (hay.includes(t)) score += 2;
    }
    for (const h of ASK_HINTS[p.slug] || []) if (question.toLowerCase().includes(h)) score += 6;
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  const top = scored.filter((s) => s.score > 0).slice(0, 3);
  return (top.length ? top : scored.slice(0, 2)).map((s) => s.p);
}

function composeAsk(question, projects) {
  const p = projects[0];
  const lang = state.lang;
  if (!p) {
    return lang === "am"
      ? "በዳሽቦርዱ ውስጥ የሚዛመድ ፕሮግራም አላገኘሁም። ስለ ዕድገት፣ ኢንተርኔት፣ ሥራ ወይም ድርቅ ይጠይቁ።"
      : "I could not match that to a programme. Try GDP, internet, jobs, nutrition, or drought.";
  }
  const tks = askTokens(question);
  const scoreHay = (text) => tks.reduce((n, t) => n + (String(text).toLowerCase().includes(t) ? 1 : 0), 0);
  const pickKind = (kind) => {
    const items = (p.insights || []).filter((i) => i.kind === kind);
    if (!items.length) return null;
    return items.slice().sort((a, b) => scoreHay(tx(b.title) + " " + tx(b.body)) - scoreHay(tx(a.title) + " " + tx(a.body)))[0];
  };
  const scoredM = (p.metrics || []).map((m) => ({ m, score: scoreHay(m.id + " " + tx(m.label)) }));
  scoredM.sort((a, b) => b.score - a.score);
  const metrics = (scoredM.some((s) => s.score > 0) ? scoredM.filter((s) => s.score > 0).slice(0, 3) : scoredM.slice(0, 3)).map((s) => s.m);
  const metricLine = metrics.map((m) => `${tx(m.label)} ${m.value}`).join(" · ");
  const insight = pickKind("insight");
  const quick = pickKind("quickwin");
  const policy = pickKind("policy");
  const stamp = state.overlay?.lastUpdated ? String(state.overlay.lastUpdated).slice(0, 10) : "";
  const dash = `${p.number} ${tx(p.title)}`;
  const related = projects[1];
  const relatedLine = related
    ? lang === "am"
      ? `\n\nተዛማጅ፦ ${related.number} ${tx(related.title)} — ${tx((pickKindFrom(related, "quickwin") || related).body || related.goal)}`
      : `\n\nRelated: ${related.number} ${tx(related.title)} — ${tx((pickKindFrom(related, "quickwin") || {}).body || related.goal)}`
    : "";
  function pickKindFrom(proj, kind) {
    const items = (proj.insights || []).filter((i) => i.kind === kind);
    if (!items.length) return null;
    return items[0];
  }
  if (lang === "am") {
    return `**${tx(p.title)}**\n${tx(p.goal)}\n\nማስረጃ፦ ${metricLine}\n\n${insight ? tx(insight.body) : tx(p.overview)}\n\nፈጣን ውጤት፦ ${quick ? tx(quick.body) : ""}\n\nምክረ ሐሳብ፦ ${policy ? tx(policy.body) : tx(p.goal)}\n\nምንጭ፦ ${metrics[0]?.source || "World Bank WDI"}${stamp ? ` · ቅርብ ማደስ ${stamp}` : ""}\nዳሽቦርድ፦ ${dash}${relatedLine}`;
  }
  return `**${tx(p.title)}**\n${tx(p.goal)}\n\nEvidence: ${metricLine}\n\n${insight ? tx(insight.body) : tx(p.overview)}\n\nQuick win: ${quick ? tx(quick.body) : ""}\n\nRecommendation: ${policy ? tx(policy.body) : tx(p.goal)}\n\nSource: ${metrics[0]?.source || "World Bank WDI"}${stamp ? ` · snapshot ${stamp}` : ""}\nDashboard: ${dash}${relatedLine}`;
}

function renderAskBody(text) {
  return esc(text).replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>").replace(/\n/g, "<br/>");
}

function suggestions() {
  return state.lang === "am"
    ? ["ፋይበር የት ቅድሚያ ይሰጥ?", "ኢንዱስትሪ ሥራ እየፈጠረ ነው?", "የተመጣጠነ ምግብ እጥረት የት ይባባሳል?", "በጅቡቲ ኮሪደር ፈጣን ውጤት?"]
    : ["Where should fibre go first?", "Is industry creating jobs?", "Which regions face the worst malnutrition?", "Quick win on the Djibouti corridor?"];
}

function followupsFor(slug) {
  const lang = state.lang;
  const map = {
    gdp: { en: ["Is industry creating jobs?", "How should GERD power be sequenced with parks?"], am: ["ኢንዱስትሪ ሥራ እየፈጠረ ነው?", "የፓርክ ኃይል እንዴት ይደረጋጅ?"] },
    internet: { en: ["Where should fibre go first?", "Is industry creating jobs?"], am: ["ፋይበር የት ቅድሚያ ይሰጥ?", "ኢንዱስትሪ ሥራ እየፈጠረ ነው?"] },
    literacy: { en: ["Is industry creating jobs?", "Where should fibre go first?"], am: ["ኢንዱስትሪ ሥራ እየፈጠረ ነው?", "ፋይበር የት ቅድሚያ ይሰጥ?"] },
    agriculture: { en: ["Which regions face the worst malnutrition?", "Which regions face the worst drought?"], am: ["የተመጣጠነ ምግብ እጥረት የት ይባባሳል?", "ድርቅ የት ይባባሳል?"] },
    malnutrition: { en: ["Which regions face the worst drought?", "Quick win on the Djibouti corridor?"], am: ["ድርቅ የት ይባባሳል?", "በጅቡቲ ኮሪደር ፈጣን ውጤት?"] },
    trade: { en: ["Quick win on the Djibouti corridor?", "How should GERD power be sequenced with parks?"], am: ["በጅቡቲ ኮሪደር ፈጣን ውጤት?", "የፓርክ ኃይል እንዴት ይደረጋጅ?"] },
    energy: { en: ["How should GERD power be sequenced with parks?", "Is industry creating jobs?"], am: ["የፓርክ ኃይል እንዴት ይደረጋጅ?", "ኢንዱስትሪ ሥራ እየፈጠረ ነው?"] },
    youth: { en: ["Is industry creating jobs?", "Where should fibre go first?"], am: ["ኢንዱስትሪ ሥራ እየፈጠረ ነው?", "ፋይበር የት ቅድሚያ ይሰጥ?"] },
    housing: { en: ["Where is the housing gap worst?", "Is industry creating jobs?"], am: ["የመኖሪያ ክፍተት የት ይባባሳል?", "ኢንዱስትሪ ሥራ እየፈጠረ ነው?"] },
    climate: { en: ["Which regions face the worst drought?", "Which regions face the worst malnutrition?"], am: ["ድርቅ የት ይባባሳል?", "የተመጣጠነ ምግብ እጥረት የት ይባባሳል?"] },
  };
  return (map[slug] && map[slug][lang]) || suggestions().slice(0, 2);
}

function renderAnalyst() {
  const root = document.getElementById("analyst-root");
  if (!root || !state.data) return;
  const copy = c();
  const a = state.analyst;
  const ranked = rankAsk(a.draft || "policy").slice(0, 3);
  const messages = a.messages
    .map(
      (m) =>
        `<article class="ask-msg ${m.role}">${m.role === "assistant" ? renderAskBody(m.content) : esc(m.content)}</article>`,
    )
    .join("");
  const follow = a.matched
    ? `<p class="micro" style="margin-top:0.75rem">${esc(copy.analystTry || "Try a brief")}</p>
       <div class="ask-sugs">${followupsFor(a.matched)
         .map((q) => `<button type="button" data-ask="${esc(q)}">${esc(q)}</button>`)
         .join("")}</div>
       <p><a class="open" href="#/projects/${a.matched}" data-analyst-close="1">${esc((state.data.projects.find((p) => p.slug === a.matched) || {}).number || "")} ${esc(tx((state.data.projects.find((p) => p.slug === a.matched) || {}).title))}</a></p>`
    : "";
  const empty = `
    <p class="micro">${esc(copy.analystTry || "Try a brief")}</p>
    <div class="ask-sugs">${suggestions()
      .map((q) => `<button type="button" data-ask="${esc(q)}">${esc(q)}</button>`)
      .join("")}</div>
    <p class="micro" style="margin-top:1rem">${esc(copy.programmes)}</p>
    <ul class="ask-progs">${ranked
      .map((p) => `<li><a href="#/projects/${p.slug}" data-analyst-close="1">${esc(p.number + " " + tx(p.title))}</a></li>`)
      .join("")}</ul>`;
  const listBody = a.messages.length ? messages + follow : empty;
  root.innerHTML = `
    <button type="button" class="ask-fab" data-analyst-open="1" ${a.open ? "hidden" : ""}>
      <span class="ask-fab-dot"></span>${esc(copy.analystAsk || "Ask analyst")}
    </button>
    ${
      a.open
        ? `<div class="ask-layer">
      <button type="button" class="ask-scrim" data-analyst-close="1" aria-label="${esc(copy.analystClose || "Close")}"></button>
      <aside class="ask-panel" role="dialog" aria-labelledby="ask-title">
        <header class="ask-head">
          <div>
            <p class="live">${esc(copy.analystLive || "Analyst")}</p>
            <h2 id="ask-title">${esc(copy.analystTitle || "EthioIntel Analyst")}</h2>
            <p class="muted">${esc(copy.analystBlurb || "")}</p>
          </div>
          <button type="button" class="ask-x" data-analyst-close="1" aria-label="${esc(copy.analystClose || "Close")}">×</button>
        </header>
        <div class="ask-list" id="ask-list">${listBody}${
            a.busy ? `<p class="micro ask-think">${esc(copy.analystThinking || "Reading…")}</p>` : ""
          }</div>
        <form class="ask-form" id="ask-form">
          <textarea id="ask-input" rows="2" placeholder="${esc(copy.analystPlaceholder || "")}">${esc(a.draft)}</textarea>
          <button type="submit" class="ask-send" ${a.busy || !a.draft.trim() ? "disabled" : ""}>${esc(copy.analystSend || "Send")}</button>
        </form>
        <p class="micro ask-hint">${esc(copy.analystGrounded || copy.analystHint || "")}</p>
      </aside>
    </div>`
        : ""
    }`;
  const list = document.getElementById("ask-list");
  if (list) list.scrollTop = list.scrollHeight;
  const input = document.getElementById("ask-input");
  if (input && a.open) {
    input.focus();
    input.selectionStart = input.value.length;
  }
}

function submitAsk(text) {
  const question = String(text || "").trim();
  if (!question || state.analyst.busy) return;
  state.analyst.draft = "";
  state.analyst.messages = [...state.analyst.messages, { role: "user", content: question }];
  state.analyst.busy = true;
  renderAnalyst();
  const projects = rankAsk(question);
  const local = composeAsk(question, projects);
  state.analyst.messages = [...state.analyst.messages, { role: "assistant", content: local }];
  state.analyst.engine = "local";
  state.analyst.matched = projects[0]?.slug || null;
  state.analyst.busy = false;
  renderAnalyst();
}

function bindAnalyst() {
  document.body.addEventListener("click", (e) => {
    const open = e.target.closest("[data-analyst-open]");
    if (open) {
      state.analyst.open = true;
      renderAnalyst();
      return;
    }
    const close = e.target.closest("[data-analyst-close]");
    if (close) {
      state.analyst.open = false;
      renderAnalyst();
      return;
    }
    const ask = e.target.closest("[data-ask]");
    if (ask) {
      submitAsk(ask.getAttribute("data-ask"));
    }
  });
  document.body.addEventListener("submit", (e) => {
    if (e.target.id !== "ask-form") return;
    e.preventDefault();
    const input = document.getElementById("ask-input");
    submitAsk(input ? input.value : state.analyst.draft);
  });
  document.body.addEventListener("input", (e) => {
    if (e.target.id !== "ask-input") return;
    state.analyst.draft = e.target.value;
  });
  document.body.addEventListener("keydown", (e) => {
    if (e.target.id !== "ask-input") return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitAsk(e.target.value);
    }
    if (e.key === "Escape") {
      state.analyst.open = false;
      renderAnalyst();
    }
  });
}


async function main() {
  applyTheme();
  const res = await fetch("data/app.json");
  state.data = await res.json();
  state.national = state.data.fallback;
  try {
    const live = await fetch("data/live.json");
    if (live.ok) {
      state.overlay = await live.json();
      mergeNational(state.overlay);
    }
  } catch (e) {}
  bind();
  bindAnalyst();
  render();
  renderAnalyst();
  state.national = await loadWb();
  mergeNational(state.overlay);
  render();
  try {
    await hydrateOverlay();
  } catch (e) {}
  mergeNational(state.overlay);
  render();
  renderAnalyst();
}

main();
