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
Deploy: **push a `main`**. Lo publica `.github/workflows/deploy.yml`, que es el único
escritor sancionado del Worker (ver «Deploy» más abajo).

> **No conectes la integración Git de Cloudflare** (Workers → Settings → Build → Connect to
> Git). Sería un segundo publicador sobre el mismo Worker, y dos fuentes de verdad sobre la
> misma superficie se revierten entre sí sin conflicto y sin aviso — nos costó dos despliegues
> el 2026-08-24. Si alguien la conecta igual, el detector de deriva lo caza: el build de
> Cloudflare no exporta `GITHUB_SHA`, así que sella `local` y
> `scripts/check-deploy-solo-main.mjs --deriva` grita.

## Ledger from D1 (H19 — done, build-time)

The ledger is data-driven from the D1 database `rosettaq-ledger`. On every build,
`prebuild` runs `scripts/sync-ledger.mjs`, which pulls the live rows via
`wrangler d1 execute` (authenticated in your Claude Code) into `src/data/ledger.json`;
the ledger pages render natively from it (EN + ES). If wrangler/D1 is unreachable,
it keeps the committed snapshot so the build never breaks.

- Add/update a verdict in D1 -> next `npm run build` picks it up -> deploy publishes it.
- No SSR, no runtime binding: fully static, fast, safe. Source of truth is D1.

## Deploy — una superficie, un escritor

**Publicar = mergear a `main`.** No lo hagas a mano: `.github/workflows/deploy.yml` construye,
despliega, purga la caché y corre los chequeos contra la URL viva.

`npx wrangler deploy` desde una rama **está bloqueado a propósito**
(`scripts/check-deploy-solo-main.mjs`, cableado en `predeploy`). El 2026-08-24 un deploy a mano
desde una rama sobrescribió lo que CI acababa de publicar desde `main`, sin conflicto de git y
sin aviso: Cloudflare no integra dos fuentes, aplica la última que llegó. Costó dos despliegues.

```bash
npm install
npm run build   # sync-ledger (lee D1) + astro build -> dist/
# publicar: git push y merge a main. CI hace el resto.
```

Para comprobar en cualquier momento que lo desplegado viene de `main`:

```bash
node scripts/check-deploy-solo-main.mjs --deriva
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
