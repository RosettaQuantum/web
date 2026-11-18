/*
 * ¿La página construida pide no ser indexada? (18-nov-2026)
 * Una sola definición, importada por la config del sitemap y por su guardia: la señal es
 * el <meta name="robots" content="…noindex…"> que la propia página emite, no una lista
 * escrita al lado. Caso real: /es/metodologia/qex y /methodology/qex llevaban noindex
 * (texto provisorio) y estaban en sitemap-0.xml — una señal decía «no me indexes» y la
 * otra iba a buscar al buscador.
 */
import fs from "node:fs";
import path from "node:path";

const sinComentarios = (h) => h.replace(/<!--[\s\S]*?-->/g, "");
/** true si el HTML trae un meta robots con noindex (fuera de comentarios). */
export function htmlNoindex(html) {
  for (const m of sinComentarios(html).matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    if (/\bname\s*=\s*["']?robots["']?/i.test(t) && /\bcontent\s*=\s*["'][^"']*\bnoindex\b/i.test(t)) return true;
  }
  return false;
}
/** Ruta en dist/ del HTML de una URL del sitio (https://…/a/b/ → dist/a/b/index.html). */
export function archivoDe(url, dist) {
  const p = new URL(url).pathname;
  const rel = p.endsWith("/") ? path.join(p, "index.html") : (path.extname(p) ? p : path.join(p, "index.html"));
  return path.join(dist, rel);
}
/** true si la página construida de esa URL lleva noindex. Sin archivo: false (no se adivina). */
export function urlNoindex(url, dist) {
  const f = archivoDe(url, dist);
  try { return htmlNoindex(fs.readFileSync(f, "utf8")); } catch { return false; }
}
