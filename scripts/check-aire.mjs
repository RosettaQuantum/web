#!/usr/bin/env node
/**
 * T-aire — un subtítulo del texto corrido tiene aire arriba y abajo.
 *
 * EL DEFECTO (25-nov-2026, lo vio Nicholas a ojo en /es/servicios)
 * ----------------------------------------------------------------
 * «Por qué contratarnos»: cinco h3 con su párrafo, y entre el párrafo de un bloque y el
 * subtítulo del siguiente había 0 px. La hoja de marca empieza con `*{margin:0}` y sólo
 * `.pg h3` devolvía el margen, así que todo h3 fuera del primer bloque de la página salía
 * pegado. Medido sobre dist antes del arreglo: 5 de 5 h3 en /servicios y /es/servicios,
 * y el «Lo que recibes» de las seis /para/ y /for/, todos con 0 px arriba y 0 px abajo.
 * check-sistema declara que no juzga espaciado, así que nada lo miraba.
 *
 * QUÉ MIDE
 * --------
 * Abre en Chrome cada página construida en dist/ que tenga un <h3>, y para cada h3
 * VISIBLE que sea hijo directo de `.wrap` (el texto corrido de una sección) mide la
 * distancia real en pantalla al hermano visible de arriba y al de abajo. Pide ≥ 16 px
 * arriba y ≥ 4 px abajo (la regla pone 24 y 8; el umbral deja margen para redondeos y no
 * para un subtítulo pegado). Se le pregunta a la pantalla y no a la hoja: el margen puede
 * venir de cualquier regla, y el colapso de márgenes no se ve leyendo CSS.
 *
 * Y LO MISMO PARA EL PÁRRAFO QUE SIGUE A UN `.lede` (mismo día, mismo origen): pide
 * ≥ 8 px. Antes del arreglo, el bloque de precio de las tres /para/ y /for/ y el «Abre el
 * registro →» de /biblioteca quedaban a 0 px.
 *
 * GRITO Y SILENCIO, en cada corrida: la misma medida sobre /es/servicios con el margen
 * quitado a la fuerza (`.wrap>h3{margin:0}`, que es el estado de antes) TIENE que fallar,
 * y la página real tiene que pasar; lo mismo para el párrafo tras el lede en
 * /es/para/industria. Si la mutación no grita, el guardia no mide nada.
 *
 * PUNTO CIEGO DECLARADO: sólo h3 hijos directos de `.wrap`. Los h3 dentro de tarjetas
 * (home, ledger, /es/q) tienen su propio diseño y no se juzgan aquí; tampoco otros
 * párrafos seguidos ni otros encabezados. Mide a un solo ancho (1280): el margen no depende del ancho.
 */
export const CONSUMIDOR = {
  quien: "la sesion que toque CSS de marca o agregue una pagina con subtitulos",
  hace: "devuelve el margen al h3 en la regla comun (.wrap>h3 en home.css), no pagina por pagina",
};

import { existsSync, statSync, readFileSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { join, extname, normalize } from "node:path";

const ARRIBA_MIN = 16, ABAJO_MIN = 4, LEDE_MIN = 8;
const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };

if (!existsSync("dist/index.html")) { console.log("T-aire: no hay dist/ — corre después de construir"); process.exit(1); }

const paginas = [];
const recorrer = (d) => {
  for (const f of readdirSync(d)) {
    const p = join(d, f);
    if (statSync(p).isDirectory()) recorrer(p);
    else if (f === "index.html" && readFileSync(p, "utf8").includes("<h3")) paginas.push("/" + p.slice(5, -"index.html".length));
  }
};
recorrer("dist");
paginas.sort();

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json" };
const srv = createServer((req, res) => {
  const p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
  let f = join("dist", p);
  if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
  if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": TIPOS[extname(f)] || "application/octet-stream" });
  res.end(readFileSync(f));
});
await new Promise((r) => srv.listen(0, "127.0.0.1", r));
const BASE = `http://127.0.0.1:${srv.address().port}`;

// Corre DENTRO de la página; evaluar() la serializa con toString(), así que no recibe
// parámetros: la mutación se pide por el hash de la URL.
const medir = async () => {
  if (location.hash === "#sin-margen") {
    const st = document.createElement("style");
    st.textContent = "html body .wrap>h3{margin:0!important} html body .wrap>.lede+p{margin-top:0!important}";
    document.head.appendChild(st);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  }
  const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== "hidden"; };
  const salida = [];
  for (const h of document.querySelectorAll(".wrap>h3")) {
    if (!vis(h)) continue;
    const r = h.getBoundingClientRect();
    let a = h.previousElementSibling; while (a && !vis(a)) a = a.previousElementSibling;
    let b = h.nextElementSibling; while (b && !vis(b)) b = b.nextElementSibling;
    salida.push({ t: h.textContent.trim().slice(0, 40),
      arriba: a ? Math.round(r.top - a.getBoundingClientRect().bottom) : null,
      abajo: b ? Math.round(b.getBoundingClientRect().top - r.bottom) : null });
  }
  const lede = [];
  for (const p of document.querySelectorAll(".wrap>.lede+p")) {
    if (!vis(p) || !vis(p.previousElementSibling)) continue;
    lede.push({ t: p.textContent.trim().slice(0, 40), gap: Math.round(p.getBoundingClientRect().top - p.previousElementSibling.getBoundingClientRect().bottom) });
  }
  return { ancho: innerWidth, h3: salida, lede };
};
const tras = (m) => m.lede.filter((x) => x.gap < LEDE_MIN);
const pegados = (m) => m.h3.filter((h) => (h.arriba !== null && h.arriba < ARRIBA_MIN) || (h.abajo !== null && h.abajo < ABAJO_MIN));

const { abrirChrome } = await import("./lib/chrome.mjs");
let medidos = 0, paginasConH3 = 0, ledes = 0;
try {
  const c = await abrirChrome({ ancho: 1280, alto: 900 });
  try {
    for (const ruta of paginas) {
      const m = await c.evaluar(BASE + ruta, medir, 250);
      if (m.ancho !== 1280) { mal(`${ruta}: el navegador midió a ${m.ancho}px — el instrumento no mide lo que dice`); continue; }
      const t = tras(m);
      if (t.length) mal(`${ruta}: ${t.length} párrafo(s) pegados al lede — ${t.slice(0, 2).map((x) => `«${x.t}» a ${x.gap} px`).join(" · ")}`);
      ledes += m.lede.length;
      if (!m.h3.length) continue;
      paginasConH3++; medidos += m.h3.length;
      const p = pegados(m);
      if (p.length) mal(`${ruta}: ${p.length} de ${m.h3.length} subtítulos sin aire — ${p.slice(0, 3).map((h) => `«${h.t}» ${h.arriba ?? "—"} px arriba / ${h.abajo ?? "—"} px abajo`).join(" · ")}`);
    }
    // Grito y silencio sobre una página real que se sabe con el patrón.
    const real = await c.evaluar(BASE + "/es/servicios/", medir, 250);
    const roto = await c.evaluar(BASE + "/es/servicios/#sin-margen", medir, 250);
    if (real.h3.length < 5) mal(`/es/servicios: esperaba los 5 subtítulos de «Por qué contratarnos» y medí ${real.h3.length} — el caso de prueba se perdió`);
    else if (pegados(real).length) mal(`silencio: /es/servicios real tiene subtítulos pegados`);
    else if (pegados(roto).length < 5) mal(`grito: con el margen quitado sólo ${pegados(roto).length} de ${roto.h3.length} se marcan — la medida no ve el defecto`);
    else ok(`grito/silencio  /es/servicios: real ${real.h3.length} de ${real.h3.length} con aire (${real.h3[1].arriba}/${real.h3[1].abajo} px); sin margen ${pegados(roto).length} pegados (${roto.h3[1].arriba}/${roto.h3[1].abajo} px)`);
    const realL = await c.evaluar(BASE + "/es/para/industria/", medir, 250);
    const rotoL = await c.evaluar(BASE + "/es/para/industria/#sin-margen", medir, 250);
    if (!realL.lede.length) mal("/es/para/industria: no encontré el párrafo tras el lede — el caso de prueba se perdió");
    else if (tras(realL).length) mal("silencio: /es/para/industria real tiene un párrafo pegado al lede");
    else if (!tras(rotoL).length) mal("grito: sin el margen, el párrafo tras el lede no se marca — la medida no ve el defecto");
    else ok(`grito/silencio  /es/para/industria: tras el lede ${realL.lede.map((x) => x.gap).join("/")} px real; sin margen ${tras(rotoL).length} pegado(s) a ${tras(rotoL)[0].gap} px`);
  } finally { await c.cerrar(); }
} finally { srv.close(); }

console.log(`  ok    ${paginas.length} páginas con <h3> recorridas · ${paginasConH3} con subtítulos de texto corrido · ${medidos} medidos · ${ledes} párrafos tras lede`);
if (fallos.length) { console.log(`\nT-aire: ${fallos.length} falla(s). El margen va en la regla común (.wrap>h3), no en la página.`); process.exit(1); }
console.log("\nT-aire: todo subtítulo de texto corrido tiene aire arriba y abajo.");
