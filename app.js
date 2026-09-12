const COLORS = ["#3ee0c4", "#7aa8b8", "#4d7c74", "#c5d4dc", "#3d5560"];
const STACK = ["#4d7c74", "#3ee0c4", "#7aa8b8"];
const WB = "https://api.worldbank.org/v2/country/ETH/indicator";

const state = { lang: localStorage.getItem("ethiointel-lang") === "am" ? "am" : "en", data: null, national: null };

const tx = (obj) => (obj ? obj[state.lang] : "");
const c = () => state.data.copy[state.lang];
const ESC = {"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"};
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (m) => ESC[m]);

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const slug = hash.startsWith("projects/") ? hash.slice(9) : "";
  return slug;
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

function clock() {
  return new Intl.DateTimeFormat(state.lang === "am" ? "am-ET" : "en-GB", {
    timeZone: "Africa/Addis_Ababa", calendar: "gregory", year: "numeric", month: "short", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).format(new Date()) + " EAT";
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
      <div class="lang" role="group" aria-label="${esc(copy.language)}">
        <button type="button" data-lang="en" aria-pressed="${state.lang === "en"}">${esc(copy.english)}</button>
        <button type="button" data-lang="am" aria-pressed="${state.lang === "am"}">${esc(copy.amharic)}</button>
      </div>
    </div>
  </header>`;
}

function nav(active) {
  const copy = c();
  return `<nav class="nav" aria-label="${esc(copy.programmes)}">
    <a href="#/" class="${active ? "" : "home-on"}">${esc(copy.command)}</a>
    ${state.data.projects.map((p) => `<a href="#/projects/${p.slug}" class="${active === p.slug ? "on" : ""}"><span class="micro">${p.number}</span> ${esc(tx(p.title))}</a>`).join("")}
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

function pie(mix) {
  const total = mix.reduce((s, m) => s + m.value, 0) || 1;
  let acc = 0;
  const stops = mix.map((m, i) => {
    const a = acc;
    acc += (m.value / total) * 360;
    return `${COLORS[i % COLORS.length]} ${a}deg ${acc}deg`;
  });
  return `<div class="pie-wrap">
    <div class="pie" style="background:conic-gradient(${stops.join(",")})"></div>
    <ul class="legend">${mix.map((m, i) => `<li><span><span class="sw" style="background:${COLORS[i % COLORS.length]}"></span>${esc(tx(m.name))}</span><span class="src">${m.value}%</span></li>`).join("")}</ul>
  </div>`;
}

function seriesChart(p) {
  const keys = p.seriesKeys;
  const max = Math.max(
    ...p.series.flatMap((row) => keys.map((k) => Number(row[k.key]) || 0)),
    1,
  );
  return `<div class="bars">${p.series.map((row) => {
    const segs = keys.map((k, i) => {
      const v = Number(row[k.key]) || 0;
      const h = (v / max) * 100;
      return `<span style="height:${h}%;background:${p.seriesKind === "stack" ? STACK[i % STACK.length] : COLORS[i % COLORS.length]}"></span>`;
    }).join("");
    return `<div class="col"><div class="${p.seriesKind === "stack" ? "stack" : "stack"}">${segs}</div><span class="lbl">${esc(row.year)}</span></div>`;
  }).join("")}</div>`;
}

function pairChart(p) {
  const max = Math.max(...p.pair.flatMap((r) => [r.a, r.b]), 1);
  return `<div class="pair">${p.pair.map((r) => `<div>
    <div class="lab"><span>${esc(tx(r.name))}</span></div>
    <div class="two">
      <div class="track"><div class="fill" style="width:${(r.a / max) * 100}%"></div></div>
      <div class="track"><div class="fill" style="width:${(r.b / max) * 100}%"></div></div>
    </div>
    <p class="src">${esc(tx(p.pairA))} ${r.a} · ${esc(tx(p.pairB))} ${r.b}</p>
  </div>`).join("")}</div>`;
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
  return `<article class="card">
    <div class="row"><h2 class="sec">${esc(copy.regionalLens)} — ${esc(tx(p.regionTitle))}</h2>
      <p class="micro">${esc(low)} <span class="atlas-scale"></span> ${esc(high)} · ${esc(tx(p.regionUnit))}</p></div>
    <div class="heat atlas">${p.regions.map((r) => {
      const t = (r.value - min) / span;
      const mix = Math.round(12 + t * 55);
      return `<div data-id="${esc(r.id)}" style="background:color-mix(in oklab, var(--primary) ${mix}%, var(--elevated))"><p>${esc(tx(names[r.id]))}</p><b>${r.value}</b></div>`;
    }).join("")}</div>
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
        <div class="grid3">${order.map((id) => {
          const k = n.kpis[id];
          return `<article class="card"><p class="k">${esc(copy[id])}</p><p class="v">${fmtKpi(k.value, k.unit)}</p><p class="src">${delta(k.value, k.prior, k.unit)} ${k.year} · ${esc(copy.worldBank)}</p></article>`;
        }).join("")}</div>
      </section>
      <section>
        <h2 class="sec">${esc(copy.programmes)}</h2>
        <div class="grid2">${state.data.projects.map((p) => `<a class="card" href="#/projects/${p.slug}">
          <div class="row"><span class="icon">${p.number}</span><span class="tag">${esc(tx(p.tag))}</span></div>
          <h3 style="margin:1rem 0 0;font-size:1rem">${esc(tx(p.title))}</h3>
          <p class="muted">${esc(tx(p.goal))}</p>
          <p class="open">${esc(copy.openDashboard)}</p>
        </a>`).join("")}</div>
      </section>
      <div class="grid2">
        <article class="card"><h2 class="sec">${esc(copy.methodology)}</h2><p class="muted">${esc(copy.sourceNote)}</p></article>
        <article class="card"><h2 class="sec">${esc(copy.facts)}</h2>
          ${[["capitalLabel","capital"],["currency","currencyValue"],["area","areaValue"],["officialLang","officialLangValue"],["medianAge","medianAgeValue"]].map(([a,b]) => `<div class="row" style="border-bottom:1px solid var(--border);padding:0.6rem 0"><span class="muted">${esc(copy[a])}</span><span>${esc(copy[b])}</span></div>`).join("")}
        </article>
      </div>
    </main>
    ${footer()}`;
}

function projectView(p) {
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

function render() {
  document.documentElement.lang = state.lang === "am" ? "am" : "en";
  document.documentElement.dataset.lang = state.lang;
  const slug = route();
  const project = state.data.projects.find((p) => p.slug === slug);
  document.getElementById("app").innerHTML = project ? projectView(project) : home();
}

function bind() {
  document.body.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (!btn) return;
    state.lang = btn.getAttribute("data-lang");
    localStorage.setItem("ethiointel-lang", state.lang);
    render();
  });
  window.addEventListener("hashchange", render);
  setInterval(() => {
    const el = document.getElementById("clock");
    if (el) el.textContent = clock();
  }, 1000);
}

async function main() {
  const res = await fetch("data/app.json");
  state.data = await res.json();
  state.national = state.data.fallback;
  bind();
  render();
  state.national = await loadWb();
  render();
}

main();
