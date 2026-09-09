#!/usr/bin/env node
/**
 * Ninguna pagina publica se RENDERIZA en la identidad retirada, salvo las declaradas.
 *
 * EL DEFECTO: el 28-ago se decidio una sola identidad y las paginas se portaron de a
 * una. Tres se quedaron atras semanas —`/informe-pqc` y las dos caras de `/cleveland`—
 * y ninguna guardia lo vio: `check-css` compara tokens en TRES paginas y `check-fuentes`
 * en DOS. Una lista de lo esperado no ve lo que falta del mundo. Las encontro Nicholas
 * navegando, que es la forma cara de encontrarlas.
 *
 * POR QUE SE MIDE RENDERIZANDO Y NO CON grep. La primera version de esta guardia buscaba
 * los tokens viejos en el HTML servido y acuso a 58 de 75 paginas ya portadas: es que
 * `global.css` TODAVIA declara y usa la paleta retirada en su `body`, y viaja inline en
 * todas. Las paginas de marca la pisan despues. En el archivo las dos se ven igual; en
 * la pantalla no. Un falso positivo retiene trabajo bueno, que es peor que dejar pasar
 * un caso (CLAUDE.md §2), asi que se le pregunta al navegador.
 *
 * LO QUE MIDE, por pagina: el color de fondo y la familia tipografica que el navegador
 * resuelve para `body`. En la marca eso es papel (#F4F5F1) con IBM Plex Sans; en la
 * identidad retirada, basalto (#141210) con Instrument Sans o Marcellus.
 *
 * LA LISTA DE PAGINAS SALE DE `dist/`, no de este archivo: una pagina nueva sin portar
 * aparece sola, sin que nadie se acuerde de agregarla.
 *
 * LAS EXCEPCIONES SE DECLARAN UNA POR UNA, CON SU RAZON. Una excepcion global —"todo lo
 * que cuelgue de /q-ready"— es una forma de dejar de mirar.
 *
 * SU PUNTO CIEGO, declarado: mira el `body`. Una pagina con el fondo correcto y una
 * seccion interior pintada en la paleta vieja pasa por aca. Eso lo ve un humano.
 *
 * Uso:
 *   node scripts/check-identidad.mjs --self-test
 *   node scripts/check-identidad.mjs [--base https://...]
 */

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion que publique una pagina nueva (Main o Diseno)",
  hace: "porta la pagina a MarcaLayout y a los tokens de global.css, o declara la excepcion aqui con su razon",
};

import { readdirSync, readFileSync, statSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { abrirChrome } from "./lib/chrome.mjs";

/** El papel de la marca, y lo que delata a la identidad retirada. */
export const PAPEL = "rgb(244, 245, 241)";      // --paper #F4F5F1
export const FAMILIAS_RETIRADAS = /Instrument Sans|Marcellus|Source Serif/;

export const DECLARADAS = [
  { prefijo: "/consola",
    razon: "identidad terminal, unica excepcion aprobada por Nicholas el 14-ago-2026 (dos identidades: terminal y registro)" },
  { prefijo: "/q-ready",
    razon: "vivas con noindex por decision de Nicholas en el cierre pre-GO; fuera del menu y sin indexar, el porte queda pendiente" },
  { prefijo: "/es/q-ready",
    razon: "misma decision que /q-ready" },
];

/**
 * El nucleo, puro. Recibe lo MEDIDO en el navegador y decide.
 * Devuelve SIEMPRE el denominador.
 * @param {{ruta:string, fondo:string, familia:string}[]} medidas
 */
export function evaluarIdentidad(medidas) {
  const sucias = [], exentas = [], sinMedir = [];
  for (const m of medidas) {
    if (!m.fondo) { sinMedir.push(m.ruta); continue; }
    const motivos = [];
    if (m.fondo !== PAPEL) motivos.push(`fondo ${m.fondo}`);
    if (FAMILIAS_RETIRADAS.test(m.familia || "")) motivos.push(`tipografia ${m.familia.split(",")[0]}`);
    if (!motivos.length) continue;
    const dec = DECLARADAS.find((d) => m.ruta === d.prefijo || m.ruta.startsWith(d.prefijo + "/"));
    (dec ? exentas : sucias).push({ ruta: m.ruta, motivos, razon: dec?.razon });
  }
  return {
    revisadas: medidas.length,
    enLaMarca: medidas.length - sucias.length - exentas.length - sinMedir.length,
    exentas, sucias, sinMedir,
  };
}

// --------------------------------------------------------------------------- self-test

function selfTest() {
  let ok = 0, mal = 0;
  const p = (n, c, d = "") => { if (c) { ok++; console.log(`  ok   ${n}`); } else { mal++; console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`); } };
  const marca = { fondo: PAPEL, familia: "IBM Plex Sans, system-ui, sans-serif" };

  const r0 = evaluarIdentidad([{ ruta: "/", ...marca }, { ruta: "/ledger", ...marca }]);
  p("calla con paginas portadas", r0.sucias.length === 0 && r0.enLaMarca === 2, JSON.stringify(r0));

  // EL CASO REAL medido el 2026-09-09, antes del porte.
  const r1 = evaluarIdentidad([
    { ruta: "/informe-pqc", fondo: "rgb(20, 18, 16)", familia: "Instrument Sans, sans-serif" },
    { ruta: "/cleveland", fondo: "rgb(11, 15, 20)", familia: "ui-sans-serif, -apple-system" },
    { ruta: "/", ...marca },
  ]);
  p("grita con las dos paginas reales sin portar", r1.sucias.length === 2, JSON.stringify(r1.sucias));
  p("caza tambien la que solo tiene el fondo malo (sin tipografia vieja)",
    r1.sucias.find((s) => s.ruta === "/cleveland").motivos.join() === "fondo rgb(11, 15, 20)");
  p("y la que ademas trae la tipografia retirada",
    r1.sucias.find((s) => s.ruta === "/informe-pqc").motivos.length === 2);
  p("reporta el denominador", r1.revisadas === 3 && r1.enLaMarca === 1);

  // EL FALSO POSITIVO que tumbo la primera version: declarar el token viejo no es
  // renderizar con el. Una pagina de marca resuelve papel aunque global.css declare
  // basalto mas arriba — por eso se mide la pantalla y no el archivo.
  const r2 = evaluarIdentidad([{ ruta: "/es/servicios", ...marca }]);
  p("una pagina de marca pasa aunque el CSS traiga la paleta vieja declarada", r2.sucias.length === 0);

  const r3 = evaluarIdentidad([
    { ruta: "/consola", fondo: "rgb(11, 15, 20)", familia: "IBM Plex Mono" },
    { ruta: "/q-ready/portal", fondo: "rgb(20, 18, 16)", familia: "Instrument Sans" },
  ]);
  p("calla en las excepciones declaradas", r3.sucias.length === 0 && r3.exentas.length === 2);
  p("la excepcion viaja con su razon", r3.exentas.every((e) => e.razon && e.razon.length > 20));
  p("una excepcion no se derrama al vecino de nombre parecido",
    evaluarIdentidad([{ ruta: "/q-ready-nuevo", fondo: "rgb(20, 18, 16)", familia: "x" }]).sucias.length === 1);
  p("una pagina que no se pudo medir NO cuenta como sana",
    (() => { const r = evaluarIdentidad([{ ruta: "/x", fondo: null, familia: null }]);
             return r.sinMedir.length === 1 && r.enLaMarca === 0; })());

  console.log(`\n  ${ok} ok · ${mal} fallas`);
  return mal === 0 ? 0 : 1;
}

// ------------------------------------------------------------------------------ vivo

function rutasDe(raiz) {
  const out = [];
  const rec = (dir) => {
    for (const e of readdirSync(dir)) {
      const f = join(dir, e);
      if (statSync(f).isDirectory()) { rec(f); continue; }
      if (!f.endsWith(".html")) continue;
      const r = "/" + relative(raiz, f).replace(/index\.html$/, "").replace(/\.html$/, "");
      out.push(r.replace(/\/{2,}/g, "/"));
    }
  };
  rec(raiz);
  // Los cascarones del blog no son paginas: son plantillas que el Worker rellena.
  return [...new Set(out)].filter((r) => !r.startsWith("/rq-shell-")).sort();
}

function leerIdentidad() {
  const cs = getComputedStyle(document.body);
  return { fondo: cs.backgroundColor, familia: cs.fontFamily };
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) process.exit(selfTest());
  const i = process.argv.indexOf("--base");
  const BASE = (i >= 0 ? process.argv[i + 1] : process.env.PREVIEW_URL || "https://rosettaquantum.com").replace(/\/+$/, "");
  const rutas = rutasDe("dist");
  console.log(`identidad · ${rutas.length} paginas de dist/, renderizadas contra ${BASE}`);
  const c = await abrirChrome({ ancho: 1280, alto: 900 });
  const medidas = [];
  for (const r of rutas) {
    // 1.500 ms, no 250: con la espera corta el `body` de /blog/ se medía transparente
    // —la hoja todavía no había aplicado— y la guardia la acusaba de estar fuera de la
    // marca. Medir antes de tiempo es medir otra cosa.
    try { medidas.push({ ruta: r, ...(await c.evaluar(BASE + r, leerIdentidad, 1500)) }); }
    catch (e) { medidas.push({ ruta: r, fondo: null, familia: null }); }
  }
  await c.cerrar();
  const res = evaluarIdentidad(medidas);
  res.exentas.forEach((e) => console.log(`  exenta ${e.ruta} — ${e.razon}`));
  res.sinMedir.forEach((r) => console.log(`  NO SE PUDO MEDIR ${r}`));
  if (!res.sucias.length && !res.sinMedir.length) {
    console.log(`  ok   ${res.enLaMarca} en la marca · ${res.exentas.length} exentas declaradas · 0 en la identidad retirada`);
    process.exit(0);
  }
  res.sucias.forEach((s) => console.log(`  FALLA ${s.ruta}: ${s.motivos.join(" · ")}`));
  console.log(`\n  ${res.sucias.length} de ${res.revisadas} paginas se renderizan en la identidad retirada sin estar declaradas.` +
    (res.sinMedir.length ? ` · ${res.sinMedir.length} no se pudieron medir (≠ estan bien).` : ""));
  process.exit(res.sucias.length ? 1 : 2);
}
