/**
 * Genera src/styles/componentes/marca-gana.css — las reglas de la maqueta que global.css
 * estaba pisando, reescritas con un selector mas especifico para que ganen SIEMPRE.
 *
 * EL DEFECTO (medido en el navegador, 2-sep)
 * -----------------------------------------
 * El commit 3 asumio que BaseLayout carga global.css y DESPUES inyecta el CSS de pagina
 * inline, asi que la pagina ganaba. En el HTML servido es al reves: Astro pone el <link>
 * de global.css al FINAL del <head>, despues del <style> de la pagina. Comprobado en la
 * cabecera servida: <style> en el byte 919, <link rel=stylesheet> en el 20787.
 *
 * Consecuencia medida en el preview con getComputedStyle:
 *     body font-family = "Instrument Sans"   (la maqueta pide IBM Plex Sans)
 *     body font-size   = 17px / 27.2px       (la maqueta: 16.5px / 1.62)
 *     .wrap max-width  = 1080px              (la maqueta: 1000px)
 *     footer padding   = 44px 0 40px         (la maqueta: 34px 0 44px)
 * Los titulares SI salian en Newsreader porque esa regla solo existe en la hoja de la
 * maqueta: donde no hay choque, no hay problema. Donde lo hay, ganaba el diseño viejo —
 * sin error, sin fallback, y con la pagina viendose perfectamente razonable.
 *
 * POR QUE ESPECIFICIDAD Y NO ORDEN: el orden lo decide el empaquetador y puede cambiar
 * con una actualizacion de Astro. `html body` (0,0,2) le gana a `body` (0,0,1) siempre.
 *
 * Los valores NO se escriben a mano: se extraen de la hoja congelada.
 */
import { readFileSync, writeFileSync } from "node:fs";

const marca = readFileSync("src/styles/pages/home.css", "utf8");
const global = readFileSync("src/styles/global.css", "utf8");

const props = (d) => new Set(d.split(";").filter((x) => x.includes(":")).map((x) => x.split(":")[0].trim()));
// Los bloques @media se QUITAN antes de comparar. Aplanarlos fue el segundo error de
// este script: la maqueta declara `.nav-links{display:none}` y, dentro de
// @media(min-width:840px), `display:flex`. Al aplanar, la copia con mas especificidad
// habria forzado display:flex a TODOS los anchos y los seis enlaces habrian aparecido
// encima de la hamburguesa en el telefono. Un arreglo de cascada que rompe el movil.
function sinMedia(css) {
  let s = css.replace(/\/\*[\s\S]*?\*\//g, ""), out = "", i = 0;
  while (i < s.length) {
    const m = s.indexOf("@media", i);
    if (m < 0) { out += s.slice(i); break; }
    out += s.slice(i, m);
    let j = s.indexOf("{", m), n = 0;
    for (; j < s.length; j++) { if (s[j] === "{") n++; else if (s[j] === "}") { n--; if (!n) break; } }
    i = j + 1;
  }
  return out;
}

function reglas(css) {
  const out = {};
  // OJO con el parser: la version anterior anclaba a `[};]` y, al consumir el `}` de una
  // regla, se saltaba la siguiente. Reportaba 4 conflictos cuando habia mas — un guardia
  // que mira la mitad y dice que miro todo.
  for (const m of css.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g))
    for (const s of m[1].split(",")) (out[s.trim()] = out[s.trim()] || []).push(m[2].trim());
  return out;
}
const M = reglas(sinMedia(marca)), G = reglas(sinMedia(global));

// Solo los selectores que declaran las dos hojas Y comparten alguna propiedad.
const enConflicto = Object.keys(M).filter((s) => {
  if (!G[s]) return false;
  const pm = new Set(M[s].flatMap((d) => [...props(d)]));
  return G[s].some((d) => [...props(d)].some((p) => pm.has(p)));
});

const lineas = [];
for (const sel of enConflicto) {
  if (sel === "*") continue; // ambas declaran lo mismo; sobreescribirlo no cambia nada
  const decl = M[sel].join(";").replace(/;+/g, ";").replace(/^;|;$/g, "");
  // `html html` no existe. Para el elemento raiz se usa :root, que ya le gana a `html`.
  lineas.push(sel === "html" ? `:root{${decl}}` : `html ${sel}{${decl}}`);
}

// Y si un selector se promueve, sus reglas dentro de @media tienen que subir con el.
// Si no, `html .nav-links{display:none}` (0,1,1) le gana al `@media(min-width:840px)
// {.nav-links{display:flex}}` (0,1,0) y los seis enlaces del escritorio NO aparecen
// nunca. Promover la mitad de una regla responsive la rompe en el otro extremo.
const promovidos = new Set(enConflicto.filter((s) => s !== "*"));
const mediaLineas = [];
{
  const css = marca.replace(/\/\*[\s\S]*?\*\//g, "");
  let i = 0;
  while (true) {
    const m = css.indexOf("@media", i);
    if (m < 0) break;
    let j = css.indexOf("{", m), n = 0, fin = j;
    for (; fin < css.length; fin++) { if (css[fin] === "{") n++; else if (css[fin] === "}") { n--; if (!n) break; } }
    const cond = css.slice(m, j).trim(), cuerpo = css.slice(j + 1, fin);
    for (const r of cuerpo.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      for (const sel of r[1].split(",").map((x) => x.trim())) {
        if (!promovidos.has(sel)) continue;
        mediaLineas.push(`${cond}{${sel === "html" ? ":root" : "html " + sel}{${r[2].trim()}}}`);
      }
    }
    i = fin + 1;
  }
}

writeFileSync("src/styles/componentes/marca-gana.css",
`/* GENERADO por scripts/build-marca-gana.mjs — no editar a mano.
   Reglas de la maqueta v20 que global.css pisaba en el HTML servido, reescritas con
   'html ' delante para que ganen por especificidad y no por orden.
   Selectores en conflicto detectados: ${enConflicto.join(" · ")} */
` + lineas.concat(mediaLineas).join("\n") + "\n");
console.log(`marca-gana.css · ${lineas.length} reglas + ${mediaLineas.length} dentro de @media · conflictos: ${enConflicto.join(" · ")}`);
