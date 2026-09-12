# EthioIntel

Palantir-style policy intelligence for Ethiopia. Dark operational UI, bilingual English / Amharic, live World Bank national indicators, and **ten high-impact dashboards** for government and stakeholders.

**Live site (after Pages is on):** [https://aarondanieltesfaye-crypto.github.io/EthioIntel-Demo/](https://aarondanieltesfaye-crypto.github.io/EthioIntel-Demo/)

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

## Language

Use **EN / አማ** in the header. Preference is stored in the browser.

## Data

National totals refresh from the [World Bank World Development Indicators](https://data.worldbank.org/) for Ethiopia (`ETH`) when the API is reachable. Regional scores, corridor times, housing stocks, and incubator counts are compiled from the latest published ESS, EDHS, FAO, WFP, ILO, GSMA, IPDC, NMA, and NDRMC tables — they are not live administrative feeds.

## Turn on GitHub Pages (one-time)

The site files already live on `main`. Enable hosting once:

1. Open [Settings → Pages](https://github.com/aarondanieltesfaye-crypto/EthioIntel-Demo/settings/pages)
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**
3. Branch: **main**, folder: **/ (root)**
4. Save

The public URL will be `https://aarondanieltesfaye-crypto.github.io/EthioIntel-Demo/`

Alternatively, set Source to **GitHub Actions** and re-run the **Deploy GitHub Pages** workflow.

## License

MIT
