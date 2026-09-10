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

/**
 * Los colores de la identidad retirada, en el formato en que los devuelve el navegador.
 * La marca no comparte ninguno, asi que verlos EN CUALQUIER elemento es concluyente.
 *
 * Esto cierra el punto ciego que la version anterior declaraba y que costo caro: se
 * medía solo el `body`. El 10-sep Nicholas abrio /es/blog y encontro tarjetas NEGRAS
 * sobre papel — el fondo de la pagina estaba bien y lo de adentro no. "Una pagina con
 * el fondo correcto y una seccion interior pintada en la paleta vieja pasa por aca":
 * estaba escrito, y aun asi hubo que verlo a ojo.
 */
export const COLORES_RETIRADOS = {
  "rgb(20, 18, 16)":    "--basalt",
  "rgb(31, 28, 24)":    "--basalt-2",
  "rgb(16, 14, 11)":    "--basalt-3",
  "rgb(61, 55, 47)":    "--stone-line",
  "rgb(244, 238, 223)": "--papyrus",
  "rgb(181, 172, 153)": "--papyrus-dim",
  "rgb(77, 196, 181)":  "--faience",
  "rgb(217, 184, 122)": "--gold",
};

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
  const sucias = [], exentas = [], sinMedir = [], noRespondieron = [];
  for (const m of medidas) {
    /* PRIMERO EL ESTADO, DESPUES LOS PIXELES.
     *
     * EL DEFECTO REAL (10-sep-2026): este guardia media el color de fondo sin
     * comprobar que la pagina existiera. Una ruta que da 404 igual pinta algo —la
     * pantalla de error de Astro es negra (rgb(25,24,27)) y la de Chrome es gris
     * oscuro (rgb(32,33,36))— asi que las dos entraban como «se renderiza en la
     * identidad retirada».
     *
     * Costo medido el mismo dia, y en las dos direcciones:
     *   contra el dev server ... 25 de 79 «sucias», y las paginas eran statics de
     *                            public/ que el dev server no sirve
     *   contra produccion ...... 8 de 79, y eran las paginas nuevas que todavia no
     *                            estaban desplegadas
     * En los dos casos el numero medía «cuantas paginas faltan en esta base», con
     * el rotulo de otra cosa. Es la falla de la casa: el instrumento declara una
     * condicion y mide otra, y ademas manda a arreglar la paleta de una pagina que
     * lo que necesita es existir.
     *
     * Las dos cosas son problemas y las dos bloquean — pero se reportan por
     * separado, porque mandan a lugares distintos. */
    if (m.estado != null && m.estado !== 200) {
      noRespondieron.push({ ruta: m.ruta, estado: m.estado });
      continue;
    }
    if (!m.fondo) { sinMedir.push(m.ruta); continue; }
    const motivos = [];
    if (m.fondo !== PAPEL) motivos.push(`fondo ${m.fondo}`);
    if (FAMILIAS_RETIRADAS.test(m.familia || "")) motivos.push(`tipografia ${m.familia.split(",")[0]}`);
    for (const d of m.dentro || []) {
      motivos.push(`${d.donde}: ${d.motivos.map((x) => x.replace(/rgb\([^)]+\)/, (c) => COLORES_RETIRADOS[c] || c)).join(" · ")}`);
    }
    if (!motivos.length) continue;
    const dec = DECLARADAS.find((d) => m.ruta === d.prefijo || m.ruta.startsWith(d.prefijo + "/"));
    (dec ? exentas : sucias).push({ ruta: m.ruta, motivos, razon: dec?.razon });
  }
  return {
    revisadas: medidas.length,
    enLaMarca: medidas.length - sucias.length - exentas.length - sinMedir.length - noRespondieron.length,
    exentas, sucias, sinMedir, noRespondieron,
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

  // EL CASO DE /es/blog, 10-sep: fondo de pagina correcto, tarjetas NEGRAS adentro.
  // Es el punto ciego que la version anterior declaraba y que hubo que ver a ojo.
  const conDentro = evaluarIdentidad([{ ruta: "/es/blog", ...marca,
    dentro: [{ donde: "a.post-item", motivos: ["fondo rgb(31, 28, 24)", "texto rgb(244, 238, 223)"] },
             { donde: "div.q", motivos: ["tipografia Marcellus"] }] }]);
  p("grita cuando el fondo esta bien y lo de ADENTRO no", conDentro.sucias.length === 1);
  p("traduce el color al nombre del token retirado",
    /--basalt-2/.test(conDentro.sucias[0].motivos.join()) && /--papyrus/.test(conDentro.sucias[0].motivos.join()),
    JSON.stringify(conDentro.sucias[0].motivos));
  p("dice DONDE vive, no solo que existe", /a\.post-item/.test(conDentro.sucias[0].motivos.join()));
  p("y calla si adentro no queda nada retirado",
    evaluarIdentidad([{ ruta: "/es/blog", ...marca, dentro: [] }]).sucias.length === 0);

  // EL FALSO POSITIVO DEL 10-sep: una pagina ausente puntuada como identidad retirada.
  // Los dos colores son reales: el 404 de Astro en el dev server y el error de Chrome
  // contra produccion. Antes del arreglo, estas dos entraban como `sucias`.
  const r404 = evaluarIdentidad([
    { ruta: "/services/sample-report/", estado: 404, fondo: "rgb(25, 24, 27)", familia: "sans-serif" },
    { ruta: "/how-we-compare/", estado: 404, fondo: "rgb(32, 33, 36)", familia: "sans-serif" },
    { ruta: "/", estado: 200, ...marca },
  ]);
  p("una pagina que no responde NO se acusa de identidad retirada", r404.sucias.length === 0, JSON.stringify(r404.sucias));
  p("se reporta como lo que es, con su codigo", r404.noRespondieron.length === 2
    && r404.noRespondieron.every((x) => x.estado === 404));
  p("y no se cuenta como si estuviera en la marca", r404.enLaMarca === 1);
  // Y AL REVES: una pagina que SI responde y esta sucia sigue gritando. El arreglo no
  // puede haber comprado el silencio a cambio de dejar de mirar.
  const rSucia = evaluarIdentidad([
    { ruta: "/informe-pqc", estado: 200, fondo: "rgb(20, 18, 16)", familia: "Instrument Sans, sans-serif" }]);
  p("una pagina viva y sucia sigue gritando", rSucia.sucias.length === 1 && rSucia.noRespondieron.length === 0);

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
  // Ademas del body, TODO lo que se ve: si un color o una familia retirada sobrevive
  // en cualquier elemento, aparece aca con el selector donde vive.
  const RET_COLOR = ["rgb(20, 18, 16)", "rgb(31, 28, 24)", "rgb(16, 14, 11)",
                     "rgb(61, 55, 47)", "rgb(244, 238, 223)", "rgb(181, 172, 153)",
                     "rgb(77, 196, 181)", "rgb(217, 184, 122)"];
  const RET_FAM = /Instrument Sans|Marcellus|Source Serif/;
  const donde = (el) => el.tagName.toLowerCase() +
    (el.id ? "#" + el.id : "") +
    (el.className && typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/)[0] : "");
  const dentro = [];
  const vistos = new Set();
  /* EXCEPCION DECLARADA Y ACOTADA, 10-sep-2026: las ILUSTRACIONES dentro del cuerpo de
     un post. 40 de los 114 posts publicados traen diagramas SVG con la paleta retirada
     escrita adentro del `body_html`, en D1. Portarlos es una migracion de CONTENIDO
     —no de chrome— y toca dato publicado, asi que se hace aparte y con revision.
     Se excluye SOLO lo que cuelga de un <svg> o <figure> dentro del articulo: el resto
     de esas mismas paginas se sigue vigilando entero. Una excepcion por pagina habria
     apagado la guardia justo donde ya encontro dos defectos. */
  const enIlustracion = (el) => !!el.closest("article svg, article figure, .body svg, .body figure");
  for (const el of document.querySelectorAll("body *")) {
    if (enIlustracion(el)) continue;
    const c = getComputedStyle(el);
    const motivos = [];
    if (RET_COLOR.includes(c.backgroundColor)) motivos.push("fondo " + c.backgroundColor);
    if (RET_COLOR.includes(c.color)) motivos.push("texto " + c.color);
    if (RET_FAM.test(c.fontFamily)) motivos.push("tipografia " + c.fontFamily.split(",")[0].replace(/"/g, ""));
    if (!motivos.length) continue;
    const clave = donde(el) + "|" + motivos.join();
    if (vistos.has(clave)) continue;          // un selector, no cien filas iguales
    vistos.add(clave);
    dentro.push({ donde: donde(el), motivos });
    if (dentro.length >= 6) break;            // con seis basta para saber que arreglar
  }
  return { fondo: cs.backgroundColor, familia: cs.fontFamily, dentro };
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
    // El estado se pide por HTTP y no al navegador: Chrome no expone el codigo de la
    // navegacion principal por esta via, y lo que hace falta saber es justamente si
    // hay pagina que juzgar.
    let estado = null;
    try { estado = (await fetch(BASE + r, { headers: { "x-rq-check": "1" }, redirect: "follow" })).status; }
    catch { estado = 0; }
    if (estado !== 200) { medidas.push({ ruta: r, estado, fondo: null, familia: null }); continue; }
    try { medidas.push({ ruta: r, estado, ...(await c.evaluar(BASE + r, leerIdentidad, 1500)) }); }
    catch (e) { medidas.push({ ruta: r, estado, fondo: null, familia: null }); }
  }
  await c.cerrar();
  const res = evaluarIdentidad(medidas);
  res.exentas.forEach((e) => console.log(`  exenta ${e.ruta} — ${e.razon}`));
  res.sinMedir.forEach((r) => console.log(`  NO SE PUDO MEDIR ${r}`));
  // Se listan APARTE de las sucias, y con su codigo: «esta pagina no esta en esta base»
  // manda a desplegar o a arreglar el inventario, no a tocar la paleta.
  res.noRespondieron.forEach((x) => console.log(`  NO RESPONDIO   ${x.ruta} -> ${x.estado || "sin respuesta"}`));
  if (!res.sucias.length && !res.sinMedir.length && !res.noRespondieron.length) {
    console.log(`  ok   ${res.enLaMarca} en la marca · ${res.exentas.length} exentas declaradas · 0 en la identidad retirada`);
    process.exit(0);
  }
  res.sucias.forEach((s) => console.log(`  FALLA ${s.ruta}: ${s.motivos.join(" · ")}`));
  console.log(`\n  ${res.sucias.length} de ${res.revisadas} paginas se renderizan en la identidad retirada sin estar declaradas.` +
    (res.noRespondieron.length ? ` · ${res.noRespondieron.length} no respondieron en esta base (≠ tienen mala paleta).` : "") +
    (res.sinMedir.length ? ` · ${res.sinMedir.length} no se pudieron medir (≠ estan bien).` : ""));
  if (res.noRespondieron.length && !res.sucias.length)
    console.log("  Ninguna pagina tiene la paleta mal. Lo que falta es que existan en la base que se midio.");
  process.exit(res.sucias.length || res.noRespondieron.length ? 1 : 2);
}
