#!/usr/bin/env node
/**
 * Los dos PDF de la guía PQC, impresos desde la MISMA página que sirve el Worker (17-nov-2026).
 *
 * POR QUÉ ASÍ. El conector de Cowork no adjunta archivos, así que el PDF no llega de afuera: se
 * imprime aquí, con el Chrome del repo (scripts/lib/chrome.mjs → imprimir), desde el html de cada
 * fila de `pages` con los indicadores inyectados por lib/guia.mjs — exactamente lo que verá el
 * lector en la web. El tamaño y los márgenes los pone la página (`@page{size:A4;…}`): se imprime
 * con `tamanoCss`, no con el Carta por omisión de Chrome.
 *
 * El html NUNCA pasa por un humano ni por el contexto de un modelo: va de D1 a un archivo temporal
 * y de ahí a Chrome. scripts/check-guia.mjs revisa lo que sale (%PDF-, A4, 30–50 páginas,
 * 0,5–3 MB).
 *
 * Uso:  node scripts/build-guia-pdf.mjs      (lee D1 de producción con wrangler, sin escribir)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { pathToFileURL } from "node:url";
import { abrirChrome } from "./lib/chrome.mjs";
import { INDICADORES, mapaIndicadores, inyectarIndicadores } from "../lib/guia.mjs";

const consulta = (sql) => {
  const out = execFileSync("npx", ["wrangler", "d1", "execute", "rosettaq-ledger", "--remote", "--json", "--command", sql],
    { stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 }).toString();
  return JSON.parse(out)[0].results;
};

const ids = INDICADORES.map((i) => `'${i}'`).join(",");
const mapa = mapaIndicadores(consulta(
  "SELECT p.indicator_id, p.value_num, p.date FROM pqc_indicators p JOIN (SELECT indicator_id, MAX(date) AS d " +
  `FROM pqc_indicators WHERE indicator_id IN (${ids}) GROUP BY indicator_id) m ON m.indicator_id = p.indicator_id AND m.d = p.date`));
const filas = consulta("SELECT lang, path, pdf_path, version, html FROM pages WHERE pdf_path IS NOT NULL ORDER BY lang");
if (filas.length !== 2) throw new Error(`se esperaban 2 filas con pdf_path y hay ${filas.length}`);

const tmp = mkdtempSync(join(tmpdir(), "guia-pdf-"));
const chrome = await abrirChrome({ ancho: 1280, alto: 900 });
try {
  for (const f of filas) {
    const { html, estado } = inyectarIndicadores(f.html, mapa);
    // La página vive en /guia/… y sus enlaces relativos apuntan ahí: un <base> los deja donde van.
    const doc = html.replace(/<head>/i, `<head><base href="https://rosettaquantum.com${f.path}">`);
    const archivo = join(tmp, `${f.lang}.html`);
    writeFileSync(archivo, doc);
    const pdf = await chrome.imprimir(pathToFileURL(archivo).href, { esperaMs: 6000, tamanoCss: true });
    const destino = join("public", f.pdf_path.replace(/^\//, ""));
    mkdirSync(dirname(destino), { recursive: true });
    writeFileSync(destino, pdf);
    console.log(`  ${f.lang}  v${f.version}  indicadores:${estado}  ${destino}  ${(pdf.length / 1048576).toFixed(2)} MB`);
  }
} finally {
  await chrome.cerrar();
  rmSync(tmp, { recursive: true, force: true });
}
