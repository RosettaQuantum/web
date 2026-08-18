#!/usr/bin/env node
/**
 * Estampa la version del build en TODA pagina servida, no solo en las de Astro.
 *
 * POR QUE EXISTE
 * --------------
 * `BaseLayout.astro` escribe <meta name="rq-build"> y `esperarVersion()` lo usa para saber
 * si el edge ya sirve ESTE build: esperar un 200 no distingue lo viejo de lo nuevo, y esa
 * trampa costo seis caidas de CI con produccion correcta.
 *
 * Pero el marcador lo pone el LAYOUT, y hay paginas que nunca pasan por el:
 * `public/consola/index.html` es HTML plano, y las dos caras de Cleveland las escribe
 * `build-viz-cleveland.mjs --publicar` directo en `public/`. Astro las copia tal cual.
 *
 * Medido en produccion el 17-ago-2026: /pricing/ y /api-docs/ traen el marcador;
 * /consola/, /cleveland/ y /es/cleveland/ NO. O sea que durante todo ese dia dos sesiones
 * verificamos la consola contra "la URL viva" con un 200 que no probaba cual version
 * estabamos mirando. El contenido estaba bien; la GARANTIA no era la que creiamos.
 *
 * QUE HACE
 * --------
 * Recorre `dist/` y le inserta el marcador a cada `.html` que no lo tenga. Toca la salida,
 * NO las fuentes: `public/` sigue limpio y quien edita la consola no tiene que acordarse
 * de nada. Un control que depende de la memoria de quien edita no es un control.
 *
 * Corre en `postbuild`, o sea que aplica igual en CI y en local.
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = join(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const BUILD = (process.env.GITHUB_SHA || process.env.RQ_BUILD || "local").slice(0, 12);
const MARCA = `<meta name="rq-build" content="${BUILD}" />`;

/** Todas las paginas servidas, para poder reportar el denominador. */
export function paginas(raiz) {
  const out = [];
  const rec = d => {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) rec(p);
      else if (e.endsWith(".html")) out.push(p);
    }
  };
  rec(raiz);
  return out;
}

export const tieneMarca = html => /name="rq-build"/.test(html);

/**
 * Inserta despues de <head>. Si no hay <head> se devuelve `null` y quien llama decide:
 * un fragmento HTML sin cabeza no es una pagina, y silenciarlo seria convertir "no se
 * hizo" en "se hizo".
 */
export function estampar(html, marca = MARCA) {
  if (tieneMarca(html)) return html;
  const m = html.match(/<head[^>]*>/i);
  if (!m) return null;
  const i = m.index + m[0].length;
  return html.slice(0, i) + "\n  " + marca + html.slice(i);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const todas = paginas(DIST);
  let ya = 0, puestas = 0;
  const sinCabeza = [];
  for (const p of todas) {
    const html = readFileSync(p, "utf8");
    if (tieneMarca(html)) { ya++; continue; }
    const nuevo = estampar(html);
    if (nuevo === null) { sinCabeza.push(p.replace(DIST, "")); continue; }
    writeFileSync(p, nuevo);
    puestas++;
  }
  console.log(`  sello de version ${BUILD}: ${ya} ya lo traian, ${puestas} estampadas, ` +
    `${sinCabeza.length} sin <head> · ${todas.length} paginas en total`);
  if (sinCabeza.length) {
    console.error("  ABORTA: hay paginas servidas sin <head>, y sin el no se puede saber que version sirven:\n   - " +
      sinCabeza.join("\n   - "));
    process.exit(1);
  }
  // Falla cerrado: si al terminar queda UNA sin marcar, el chequeo posterior al deploy
  // seria un 200 que no prueba nada — que es justo el defecto que este script cierra.
  const faltan = paginas(DIST).filter(p => !tieneMarca(readFileSync(p, "utf8")));
  if (faltan.length) {
    console.error(`  ABORTA: ${faltan.length} de ${todas.length} paginas siguen sin marcador.`);
    process.exit(1);
  }
}
