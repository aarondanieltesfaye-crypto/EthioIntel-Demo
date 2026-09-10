# EthioIntel

Palantir-style Ethiopian data intelligence demo. Dark operational UI, bilingual English / Amharic, national indicators, and two core charts.

## What it shows

- Population, GDP, real growth, internet users, adult literacy, and agriculture’s share of GDP
- Five-year real GDP growth (bar)
- Agricultural export mix (pie)
- Employment by sector and a compact country snapshot
- Live World Bank WDI refresh when the API is reachable, with a published snapshot as fallback

## Language

Use **EN / አማ** in the header. All labels, titles, and supporting copy switch with the toggle. Preference is stored in the browser.

## Data

Primary source: [World Bank World Development Indicators](https://data.worldbank.org/) for Ethiopia (`ETH`). Export mix is an illustrative agricultural composition (coffee, oilseeds, cut flowers, pulses, fruit & vegetables), not a live customs feed.

## Stack

React, TanStack Start, Tailwind CSS, Recharts, Zustand, Lucide.

## License

MIT
