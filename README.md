# StockApp — Angular + Node (Stocks Search)

Single-page Angular app with a minimal Node/Express backend (proxy) that serves stock data and UI features like autocomplete, quotes, charts, news, watchlist, and portfolio.

> **Note**: This repository contains only the source code. Deployment artifacts (e.g., App Engine config, builds) are intentionally excluded.

## Tech Stack
- **Frontend**: Angular, Angular Material, Bootstrap (responsive)
- **Charts**: Highcharts (via highcharts-angular)
- **Backend**: Node/Express proxy (all API calls go through server)
- **Data**: Finnhub, Polygon.io
- **Database**: MongoDB Atlas (watchlist & portfolio)

## Key Features
- Search with **autocomplete** (typeahead filters common stocks)
- Ticker **details page** with market status, price, and summary
- **Tabs**: Summary • Top News • Charts • Insights
- **Watchlist** (MongoDB): add/remove tickers with alerts
- **Portfolio** (MongoDB): wallet, buy/sell modals, P/L updates
- **Responsive** layout (desktop & mobile)

## 📸 Preview

<p align="center">
  <img src="./screenshots/home.png" width="45%"/>
  <img src="./screenshots/autocomplete.png" width="45%"/>
</p>
<p align="center">
  <img src="./screenshots/summary_tab.png" width="45%"/>
  <img src="./screenshots/news_tab.png" width="45%"/>
</p>
<p align="center">
  <img src="./screenshots/charts_tab.png" width="45%"/>
  <img src="./screenshots/insights_tab.png" width="45%"/>
</p>
<p align="center">
  <img src="./screenshots/watchlist.png" width="45%"/>
  <img src="./screenshots/portfolio.png" width="45%"/>
</p>
<p align="center">
  <img src="./screenshots/buy_modal.png" width="45%"/>
  <img src="./screenshots/sell_modal.png" width="45%"/>
</p>
<p align="center">
  <img src="./screenshots/mobile_view.png" width="45%"/>
</p>

## Local Development
```bash
# From repo root (this folder)
npm install   # or pnpm i / yarn

# Start Angular dev server
npm run start
# App on http://localhost:4200
