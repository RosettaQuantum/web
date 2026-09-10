#!/usr/bin/env node
/**
 * Minifica el JavaScript suelto de `public/` una vez construido (dist/js/**).
 *
 * POR QUE. `js/home.js` se servia con 139.413 bytes, 493 lineas y los comentarios de
 * andamio adentro —"script extraido VERBATIM de la maqueta congelada"—. No es un
 * problema de velocidad: el sitio carga en 420 ms. Es que se ve el andamio. Cualquiera
 * que abra el fuente de una pagina que se vende como institucion lee las notas internas
 * de como se construyo.
 *
 * NO SE REESCRIBE NINGUN ARCHIVO FUENTE. `public/js/*.js` queda tal cual —con sus
 * comentarios, que son la mitad del valor de este repo—; lo que se minifica es la copia
 * que Astro ya deposito en `dist/`. El fuente explica, el servido pesa poco.
 *
 * FALLA CERRADO: si un archivo no se puede minificar, aborta. Servir a medias —unos
 * minificados y otros no— es peor que no minificar: nadie sabe cual esta cual.
 *
 * Uso:  node scripts/minificar-js.mjs
 */
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { transform } from "esbuild";

const RAIZ = "dist/js";

function archivos(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const f = join(dir, e);
    if (statSync(f).isDirectory()) out.push(...archivos(f));
    else if (f.endsWith(".js")) out.push(f);
  }
  return out;
}

let antes = 0, despues = 0, fallas = [];
const lista = archivos(RAIZ);
for (const f of lista) {
  const src = readFileSync(f, "utf8");
  antes += src.length;
  try {
    // `legalComments: none` saca TODOS los comentarios, incluidos los de licencia:
    // en public/js no hay codigo de terceros — el unico vendor (three.js) vive en
    // public/piezas y no pasa por aca.
    const { code } = await transform(src, { minify: true, legalComments: "none", target: "es2019" });
    writeFileSync(f, code);
    despues += code.length;
    console.log(`  ${f.replace("dist/", "").padEnd(28)} ${String(src.length).padStart(7)} → ${String(code.length).padStart(7)} bytes`);
  } catch (e) {
    fallas.push(`${f}: ${e.message}`);
  }
}
if (fallas.length) {
  console.error("\nFALLA · no se pudo minificar:\n  " + fallas.join("\n  "));
  process.exit(1);
}
const pct = antes ? Math.round((1 - despues / antes) * 100) : 0;
console.log(`\nminificado: ${lista.length} archivos · ${Math.round(antes/1024)} KB → ${Math.round(despues/1024)} KB (−${pct}%)`);
