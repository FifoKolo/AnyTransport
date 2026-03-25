# AnyTransport

A static web platform for requesting and managing transport and removal quotes (house removals, piano transport, vehicle shipping, etc.).

## Tech Stack

- **Frontend:** Pure HTML5, CSS3, and Vanilla JavaScript (ES6+) — no framework
- **Maps:** Mapbox GL JS (v2.14.1) for route visualization
- **Data storage:** `localStorage` (client-side mock backend)
- **Package manager:** None (no build step required)

## Project Layout

```
/
├── index.html          # Landing page
├── create-job.html     # Job creation / quote request form
├── dashboard.html      # User dashboard
├── css/                # Modular stylesheets
├── js/                 # Application logic (auth, create-job, dashboard, etc.)
└── assets/             # Static assets (logo, images)
```

## Running Locally

The site is served as a static site using `npx serve`:

```bash
npx serve . -l 5000
```

Workflow: **Start application** — serves static files on port 5000 (webview).

## Deployment

Configured as a **static** deployment with `publicDir: "."`.
