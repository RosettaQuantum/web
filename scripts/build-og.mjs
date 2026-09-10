#!/usr/bin/env node
/**
 * Genera las tarjetas sociales (og:image) a 1200x630, en public/og/.
 *
 * POR QUE EXISTE. Medido en produccion el 10-sep-2026: CERO coincidencias de `og:` y
 * `twitter:` en el HTML servido. Compartir cualquier pagina del sitio en Slack, LinkedIn
 * o X mostraba una URL pelada. Para un sitio cuyo canal declarado es que otros lo citen
 * —incluidos los modelos— es el peor lugar donde ahorrar catorce lineas de <head>.
 *
 * EL TITULAR DE CADA TARJETA NO SE INVENTA: es el H1 que la pagina ya publica y que ya
 * paso por Nicholas (CLAUDE.md §5). Una tarjeta social con una frase escrita para la
 * ocasion seria texto publico nuevo sin aprobar, viajando ademas fuera del sitio.
 *
 * LA LINEA DE DATO SALE DE /v1/state EN CADA BUILD, no de una constante: si el archivo
 * crece y la tarjeta dice otra cosa, la tarjeta miente en la superficie que mas se
 * comparte. Si el endpoint no responde, se ABORTA — una tarjeta con un numero inventado
 * es peor que no tener tarjeta.
 *
 * Se rasteriza con el mismo Chrome que usan las guardias (scripts/lib/chrome.mjs). No se
 * agrega ninguna dependencia: un pipeline social no justifica traer un rasterizador.
 *
 * Uso:  node scripts/build-og.mjs [--base https://rosettaquantum.com]
 */
import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { abrirChrome } from "./lib/chrome.mjs";

/** Titular por tarjeta = el H1 vivo de esa pagina. Se declara de donde sale cada uno. */
const TARJETAS = [
  { slug: "default",  h1: "Quantum, independently measured.",              de: "/" },
  { slug: "library",  h1: "Is there real evidence for this quantum claim?", de: "/library" },
  { slug: "ledger",   h1: "A public record that cannot be rewritten.",      de: "/ledger" },
  { slug: "services", h1: "Judgment, priced up front.",                     de: "/services" },
  { slug: "cases",    h1: "We make your pilot produce a defensible number.", de: "/pilots" },
];

const iBase = process.argv.indexOf("--base");
const BASE = (iBase >= 0 ? process.argv[iBase + 1] : "https://rosettaquantum.com").replace(/\/+$/, "");

const esc = (t) => String(t).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));

/** La tarjeta, en HTML. Sin gradiente, sin ilustracion, sin sombra: papel y tinta. */
function tarjeta(h1, dato) {
  return `<!doctype html><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400&family=IBM+Plex+Mono:wght@400;500&display=block">
<style>
 *{margin:0;padding:0;box-sizing:border-box}
 body{width:1200px;height:630px;background:#F4F5F1;color:#16181B;
      font-family:'Newsreader',Georgia,serif;display:flex;flex-direction:column;
      justify-content:space-between;padding:64px 72px;-webkit-font-smoothing:antialiased}
 .marca{display:flex;align-items:center;gap:16px}
 .marca img{width:32px;height:41px}
 .marca span{font-size:28px;letter-spacing:.01em}
 h1{font-size:84px;line-height:1.04;font-weight:400;letter-spacing:-.022em;max-width:15ch;text-wrap:balance}
 .dato{font-family:'IBM Plex Mono',monospace;font-size:28px;color:#4A4E48;letter-spacing:-.01em}
</style>
<div class="marca"><img src="${BASE}/rosetta-mark.svg" alt=""><span>Rosetta Quantum</span></div>
<h1>${esc(h1)}</h1>
<div class="dato">${esc(dato)}</div>`;
}

const est = await (await fetch(BASE + "/v1/state", { headers: { accept: "application/json" } })).json()
  .catch(() => null);
const m = est?.estado_medido;
if (!m || typeof m.corridas_selladas !== "number" || typeof m.victorias_cuanticas_medidas !== "number") {
  console.error(`ABORTA: /v1/state no dio las cifras. Una tarjeta social con un numero inventado
       es peor que no tener tarjeta: se cachea en Slack, LinkedIn y X durante meses.`);
  process.exit(1);
}
const DATO = `${m.corridas_selladas} sealed runs · ${m.victorias_cuanticas_medidas} quantum wins measured`;
console.log(`og · linea de dato viva: ${DATO}`);

mkdirSync("public/og", { recursive: true });
const c = await abrirChrome({ ancho: 1200, alto: 630 });
try {
  for (const t of TARJETAS) {
    const url = "data:text/html;charset=utf-8," + encodeURIComponent(tarjeta(t.h1, DATO));
    const png = await c.capturar(url, 1600);
    writeFileSync(`public/og/${t.slug}.png`, png);
    console.log(`  ${(t.slug + ".png").padEnd(14)} ${String(png.length).padStart(7)} bytes · H1 de ${t.de}`);
  }
} finally {
  await c.cerrar();
}
const faltan = TARJETAS.filter((t) => !existsSync(`public/og/${t.slug}.png`));
if (faltan.length) { console.error(`FALLA: no se escribieron ${faltan.map(t => t.slug).join(", ")}`); process.exit(1); }
console.log(`\nog: ${TARJETAS.length} tarjetas a 1200x630.`);
