# EthioIntel

Palantir-style policy intelligence for Ethiopia. Dark operational UI, bilingual English / Amharic, live World Bank national indicators, an on-site **analyst**, and **ten high-impact dashboards** for government and stakeholders.

**Live site:** [https://aarondanieltesfaye-crypto.github.io/EthioIntel-Demo/](https://aarondanieltesfaye-crypto.github.io/EthioIntel-Demo/)

## Programmes

1. Sectoral contribution to GDP growth
2. Internet access & economic opportunity
3. Adult literacy vs labour-market outcomes
4. Agricultural export mix & climate resilience
5. Malnutrition hotspots & resource allocation
6. Trade corridor efficiency
7. Energy access vs industrial growth
8. Youth employment & entrepreneurship map
9. Affordable housing demand vs supply
10. Drought & flood risk atlas

Each dashboard includes overview, key metrics with definitions, authoritative sources, visualizations, regional scores, actionable insights, quick wins, policy recommendations, and data-gap notes.

## Analyst

Use **Ask analyst** (bottom left). Questions are matched to the ten programmes and answered **on the page** from dashboard evidence plus the latest World Bank figures. There is no cloud language-model call, so nothing spends an API quota. Statistics are never invented.

## Language and theme

Use **EN / አማ** and **Dark / Light** in the header. Preference is stored in the browser.

## Data (automatic — no human step)

Open national series refresh without anyone editing the repo:

- **On every visit** the homepage KPIs and compatible dashboard charts fetch Ethiopia (`ETH`) from the [World Bank WDI API](https://api.worldbank.org).
- **Every Monday** a GitHub Action (`Refresh open data`) pulls World Bank WDI plus FAOSTAT coffee, writes `data/live.json`, and patches compatible dashboard metrics/charts. You can also run it from the Actions tab (**Run workflow**).

Regional scores, corridor dwell, housing stocks, and incubator counts have no public API. Those stay compiled from the latest ESS, EDHS, FAO, WFP, ILO, GSMA, IPDC, NMA, and NDRMC tables.

## GitHub Pages

The public URL is `https://aarondanieltesfaye-crypto.github.io/EthioIntel-Demo/`

If the site is blank, set **Settings → Pages** to **Deploy from a branch**, branch **main**, folder **/ (root)**.

Scheduled refresh needs **Actions** allowed (Settings → Actions → General → Allow all actions).

## License

MIT
