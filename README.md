# Rosetta Quantum — web (Astro, native i18n)

The public site (rosettaquantum.com) as an Astro project. Static build served by
the Cloudflare Worker `rosetta-quantum`. Homogeneous, component-based, no client hacks.

## Structure
- `src/pages/` — English at root (`/`, `/clases`, `/ledger`), Spanish under `/es/`.
  Native per-locale static pages (real SEO routes + hreflang) — no client-side toggle.
- `src/pages/blog/` — native content collection (GEO), `llms.txt`, `rss.xml`, sitemap.
- `src/layouts/BaseLayout.astro` + `BlogLayout.astro` — shared shell.
- `src/components/Nav.astro`, `Footer.astro` — shared, bilingual, with the EN·ES toggle.
- `src/content_html/*.{en,es}.html` — page bodies per locale (rendered via set:html).
- `src/styles/global.css` (tokens+nav+footer) + `src/styles/pages/*.css` (page styles).
- `public/js/*-fn-*.js` — functional scripts (console, ledger filter/detail), served as-is.
- `worker.js` + `wrangler.jsonc` — Cloudflare deploy (serves `./dist`).
- `public/consola/` — the console. Read [`HOJA-BASE.md`](HOJA-BASE.md) before touching its
  CSS: it inherits a stylesheet from another context, and that inheritance produced four
  defects that are invisible in the markup — including a button that was unreachable on a
  phone. `scripts/test-consola-zonas.mjs` guards the part that can be checked statically.

## Run / deploy
```bash
npm install
npm run build     # -> dist/  (9 routes: en + es + blog + llms.txt + rss + sitemap)
```
Deploy: Cloudflare → Workers → `rosetta-quantum` → Settings → Build → Connect to Git →
org RosettaQuantum, repo `web`, branch main, build `npm run build`. Push = auto-deploy.

## Ledger from D1 (H19 — done, build-time)

The ledger is data-driven from the D1 database `rosettaq-ledger`. On every build,
`prebuild` runs `scripts/sync-ledger.mjs`, which pulls the live rows via
`wrangler d1 execute` (authenticated in your Claude Code) into `src/data/ledger.json`;
the ledger pages render natively from it (EN + ES). If wrangler/D1 is unreachable,
it keeps the committed snapshot so the build never breaks.

- Add/update a verdict in D1 -> next `npm run build` picks it up -> deploy publishes it.
- No SSR, no runtime binding: fully static, fast, safe. Source of truth is D1.

## Deploy (Claude Code, authenticated)
```bash
npm install
npm run build       # runs sync-ledger (pulls D1) then astro build -> dist/
npx wrangler deploy # publishes dist/ to the rosetta-quantum worker
```

## Contact modal + leads (new)
`POST /api/lead` in `worker.js` writes to the D1 `leads` table (binding `DB` in
`wrangler.jsonc`). The site-wide bilingual modal (`src/components/LeadModal.astro`)
opens from any "Get early access" CTA. After deploy, test once:
`curl -X POST https://rosettaquantum.com/api/lead -H 'content-type: application/json' -d '{"email":"t@t.com","lang":"en"}'`
then check the row landed in D1. The `leads` table already exists in `rosettaq-ledger`.

## Mission section + full ES
- Added a "Why we exist" mission block after the hero (bilingual) — the molecular/medical
  why, framed to reinforce the neutral-referee thesis (honesty as the mission), not hype.
- The FAQ section is now fully translated to Spanish (was English-only before).

> Verificación E2E 2026-07-26: commit vía API (flujo Cowork) → CI → prod.
