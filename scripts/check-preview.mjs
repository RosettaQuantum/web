/**
 * P0 — el preview responde donde importa.
 *
 * Tres superficies, elegidas porque son las tres capas distintas del sitio y porque
 * las tres fallan de forma distinta:
 *   /            estatica pura: NO ejecuta el Worker (no esta en run_worker_first)
 *   /v1/state    la API: ejecuta el Worker y habla con D1
 *   /blog/<slug> un post que SOLO existe en D1: el Worker rellena el cascaron
 *
 * POR QUE ESTE ARCHIVO EXISTE Y NO ES UN BLOQUE DE BASH EN EL WORKFLOW
 * --------------------------------------------------------------------
 * Lo escribi primero en bash y fallo tres veces seguidas, las tres por el
 * instrumento y ninguna por el sitio:
 *   1. La sonda de propagacion pedia 200 en "/" — y "/" ya daba 200 desde el
 *      despliegue ANTERIOR. Salio del bucle al primer intento y midio codigo viejo.
 *   2. Corregida para leer el sello de version, buscaba name="build" y la pagina
 *      sirve name="rq-build": lei un grep truncado y escribi el nombre a medias.
 *   3. Pedia /blog sin barra final, que responde 307; curl sin -L devuelve cuerpo
 *      vacio, asi que "el post esta vacio" era en realidad "pedi la URL equivocada".
 *
 * Las tres ya estaban resueltas en el repo: scripts/lib/esperar.mjs existe para esto
 * y su cabecera cuenta que el CI cayo cinco veces por lo mismo. Reusarlo es la
 * correccion de fondo; el bash era maquinaria paralela para un problema ya resuelto.
 */
import { esperarVersion } from "./lib/esperar.mjs";

const BASE = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
const SHA = process.env.GITHUB_SHA || "";
const ESPERA = Number(process.env.ESPERA_MAX || 180);

if (!BASE) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const fallos = [];
const ok = (m) => console.log(`  ok    ${m}`);
const mal = (m) => { console.log(`  FALLA ${m}`); fallos.push(m); };

async function traer(ruta) {
  const r = await fetch(BASE + ruta, { redirect: "follow", headers: { "x-rq-check": "1" } });
  return { code: r.status, cuerpo: await r.text() };
}

console.log(`preview: ${BASE}`);
console.log(`esperando el build ${SHA.slice(0, 12)} (hasta ${ESPERA}s)`);
if (!(await esperarVersion(BASE, SHA, ESPERA))) {
  console.error("ABORTA: el edge no llego a servir este build. No se mide sobre codigo viejo.");
  process.exit(1);
}

// 1 · la home, estatica
{
  const { code, cuerpo } = await traer("/");
  code === 200 ? ok(`/ -> 200 (${cuerpo.length} bytes)`) : mal(`/ -> ${code}`);
}

// 2 · la API contra D1
{
  const { code, cuerpo } = await traer("/v1/state");
  if (code !== 200) mal(`/v1/state -> ${code}`);
  else {
    let j = null;
    try { j = JSON.parse(cuerpo); } catch { /* cae abajo */ }
    const n = j?.estado_medido?.corridas_selladas;
    Number.isInteger(n) && n > 0
      ? ok(`/v1/state -> 200 · corridas_selladas=${n} · veredictos=${j.estado_medido.veredictos_publicados}`)
      : mal(`/v1/state responde 200 pero sin estado_medido.corridas_selladas usable`);
  }
}

// 3 · un post que solo existe en D1. El slug se saca del indice EN VIVO: uno
//     escrito a mano deja de existir y la prueba pasa a verificar un 404 sin que
//     nadie mire. Con barra final: /blog responde 307 y el cuerpo del 307 es vacio.
{
  const { cuerpo: indice } = await traer("/blog/");
  const slugs = [...indice.matchAll(/href="\/blog\/([a-z0-9-]+-(?:en|es))\/"/g)].map((m) => m[1]);
  const unicos = [...new Set(slugs)];
  if (!unicos.length) mal("/blog/ no lista ningun post: el indice de D1 no se inyecto");
  else {
    ok(`/blog/ lista ${unicos.length} posts`);
    const slug = unicos[0];
    const { code, cuerpo } = await traer(`/blog/${slug}/`);
    const tieneArticulo = /<article/.test(cuerpo);
    code === 200 && tieneArticulo && cuerpo.length > 2000
      ? ok(`/blog/${slug}/ -> 200 · ${cuerpo.length} bytes · <article> presente`)
      : mal(`/blog/${slug}/ -> ${code} · ${cuerpo.length} bytes · <article>=${tieneArticulo}`);
  }
}

console.log(fallos.length ? `\nP0: ${fallos.length} fallo(s)` : "\nP0: las tres superficies responden");
process.exit(fallos.length ? 1 : 0);
