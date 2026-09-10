#!/usr/bin/env node
/**
 * El sistema de diseño se sostiene: pocos tamaños, ningún texto diminuto, contraste AA.
 *
 * EL DEFECTO (medido en producción el 10-sep-2026, sobre la home):
 *   · 22 tamaños de fuente distintos
 *   · 76 elementos con texto bajo 13px — nueve tamaños entre 9 y 12,5px
 *   · dos colores de texto por debajo de 4,5:1 sobre el papel de la marca:
 *     el teal #0F8B7E daba 3,82:1 y el oro #B8892E daba 2,88:1, y se usaban
 *     justamente en los textos más chicos
 *
 * Nada de eso rompe una página. Por eso duró: se ve "denso" y se lee mal, y ninguna
 * prueba lo mira. Es lo que Nicholas describió como «se ve roto o frankenstein».
 *
 * POR QUE RENDERIZANDO. Un tamaño puede venir de una hoja, de un `style` inline, de un
 * `rem` que hereda, o del valor por defecto del navegador — el `h3` de la home salía en
 * 21,06px porque nadie le había escrito una regla y heredaba el 1.17em del navegador
 * sobre un body de 18px. Contando `font-size` en los archivos, ese octavo tamaño no
 * aparece. Se le pregunta a la pantalla.
 *
 * EL CONTRASTE SE MIDE CONTRA EL FONDO REAL, subiendo por los ancestros hasta encontrar
 * uno opaco. Asumir el fondo del `body` daba por malos los botones de tinta, que son
 * texto claro sobre superficie oscura y están bien.
 *
 * SU PUNTO CIEGO, declarado: mira texto. No juzga espaciado, ni jerarquía, ni si la
 * página está bien compuesta. Eso lo ve una persona.
 *
 * Uso:
 *   node scripts/check-sistema.mjs --self-test
 *   node scripts/check-sistema.mjs [--base https://...]
 */

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion que toque CSS o agregue una pagina",
  hace: "manda el tamaño nuevo a la escala de tokens.css en vez de escribir un px suelto",
};

import { abrirChrome } from "./lib/chrome.mjs";

export const LIMITES = { tamanos: 8, bajo13: 0, colores: 6, contraste: 4.5 };

/** Las paginas de marca. Q-Ready queda fuera: conserva la identidad retirada por decision. */
export const RUTAS = ["/", "/es/", "/ledger/", "/es/ledger/", "/library/", "/es/biblioteca/",
                      "/services/", "/es/servicios/", "/blog/", "/es/blog/",
                      "/methodology/", "/informe-pqc/"];

/**
 * El nucleo, puro. Recibe lo medido y decide. Devuelve SIEMPRE los denominadores.
 * @param {{ruta:string, ancho:number, tam:number, bajo13:number, col:number, malContraste:string[]}[]} medidas
 */
export function evaluarSistema(medidas) {
  const fallas = [];
  for (const m of medidas) {
    const d = `${m.ruta} @${m.ancho}`;
    if (m.tam > LIMITES.tamanos) fallas.push(`${d}: ${m.tam} tamaños de fuente (tope ${LIMITES.tamanos})`);
    if (m.bajo13 > LIMITES.bajo13) fallas.push(`${d}: ${m.bajo13} elementos con texto bajo 13px`);
    if (m.col > LIMITES.colores) fallas.push(`${d}: ${m.col} colores de texto (tope ${LIMITES.colores})`);
    if (m.malContraste.length) fallas.push(`${d}: ${m.malContraste.length} bajo ${LIMITES.contraste}:1 — ${m.malContraste[0]}`);
  }
  return { ok: fallas.length === 0, fallas, denominadores: { medidas: medidas.length } };
}

// --------------------------------------------------------------------------- self-test

function selfTest() {
  let ok = 0, mal = 0;
  const p = (n, c, d = "") => { if (c) { ok++; console.log(`  ok   ${n}`); } else { mal++; console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`); } };
  const sana = { ruta: "/", ancho: 1440, tam: 6, bajo13: 0, col: 6, malContraste: [] };

  p("calla con una pagina dentro del sistema", evaluarSistema([sana]).ok);

  // EL ESTADO REAL del 10-sep, antes del bloque 2.
  const antes = { ruta: "/", ancho: 1440, tam: 22, bajo13: 76, col: 6,
                  malContraste: ["3.82 rgb(15,139,126) \"A product of its own\""] };
  const r = evaluarSistema([antes]);
  p("grita con la home tal como estaba", !r.ok && r.fallas.length === 3, JSON.stringify(r.fallas));
  p("nombra los 22 tamaños", r.fallas.some((f) => /22 tamaños/.test(f)));
  p("nombra los 76 elementos diminutos", r.fallas.some((f) => /76 elementos/.test(f)));
  p("nombra el contraste con su ejemplo", r.fallas.some((f) => /3\.82/.test(f)));

  // Los limites son de tope, no de igualdad: 8 tamaños pasa, 9 no.
  p("8 tamaños pasa", evaluarSistema([{ ...sana, tam: 8 }]).ok);
  p("9 tamaños grita", !evaluarSistema([{ ...sana, tam: 9 }]).ok);
  p("un solo elemento bajo 13px ya grita", !evaluarSistema([{ ...sana, bajo13: 1 }]).ok);
  p("reporta el denominador", evaluarSistema([sana, sana]).denominadores.medidas === 2);

  console.log(`\n  ${ok} ok · ${mal} fallas`);
  return mal === 0 ? 0 : 1;
}

// ------------------------------------------------------------------------------ vivo

function sonda() {
  const lum = (s) => { const m = s.match(/\d+/g).slice(0, 3).map((v) => v / 255)
    .map((v) => v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4));
    return 0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]; };
  const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  // El fondo REAL: sube por los ancestros hasta uno opaco. Asumir el del body daba por
  // malos los botones de tinta, que son texto claro sobre oscuro y estan bien.
  const fondo = (e) => { let n = e; while (n && n !== document.documentElement) {
      const b = getComputedStyle(n).backgroundColor;
      if (b && b !== "rgba(0, 0, 0, 0)" && !/rgba\(.*,\s*0\)$/.test(b)) return b;
      n = n.parentElement; } return "rgb(244, 245, 241)"; };
  const el = [...document.querySelectorAll("body *")].filter((e) => e.offsetParent !== null &&
    [...e.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim()));
  const tam = new Set(), col = new Set(), malContraste = [];
  let bajo13 = 0;
  for (const e of el) {
    const c = getComputedStyle(e);
    tam.add(c.fontSize); col.add(c.color);
    if (parseFloat(c.fontSize) < 13) bajo13++;
    const r = cr(c.color, fondo(e));
    if (r < 4.5) malContraste.push(r.toFixed(2) + " " + c.color + ' "' + e.textContent.trim().slice(0, 24) + '"');
  }
  return { tam: tam.size, col: col.size, bajo13, malContraste: [...new Set(malContraste)] };
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv.includes("--self-test")) process.exit(selfTest());
  const i = process.argv.indexOf("--base");
  const BASE = (i >= 0 ? process.argv[i + 1] : process.env.PREVIEW_URL || "https://rosettaquantum.com").replace(/\/+$/, "");
  console.log(`sistema · ${RUTAS.length} paginas de marca × 2 anchos — ${BASE}`);
  const medidas = [];
  for (const [ancho, alto] of [[1440, 900], [390, 844]]) {
    const c = await abrirChrome({ ancho, alto });
    for (const ruta of RUTAS) {
      try { medidas.push({ ruta, ancho, ...(await c.evaluar(BASE + ruta, sonda, 2600)) }); }
      catch (e) { console.log(`  NO SE PUDO MEDIR ${ruta} @${ancho}: ${e.message.slice(0, 50)}`); }
    }
    await c.cerrar();
  }
  const r = evaluarSistema(medidas);
  console.log(`  medidas: ${r.denominadores.medidas} de ${RUTAS.length * 2}`);
  if (r.ok && medidas.length === RUTAS.length * 2) {
    console.log(`  ok   ≤${LIMITES.tamanos} tamaños · 0 bajo 13px · ≤${LIMITES.colores} colores · todo sobre ${LIMITES.contraste}:1`);
    process.exit(0);
  }
  r.fallas.forEach((f) => console.log(`  FALLA ${f}`));
  if (medidas.length !== RUTAS.length * 2) console.log(`  ATENCION: ${RUTAS.length * 2 - medidas.length} no se pudieron medir (≠ estan bien)`);
  process.exit(r.fallas.length ? 1 : 2);
}
