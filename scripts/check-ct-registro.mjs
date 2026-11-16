#!/usr/bin/env node
/**
 * La medición en vivo no depende de que crt.sh conteste.
 *
 * Defecto medido el 11-nov-2026: el navegador esperaba a crt.sh hasta 120 s antes de medir nada
 * más; crt.sh tardó >60 s, 41 s, 13 s y 17 s para un mismo dominio. Ahora el registro lo pide el
 * servidor (lib/ct-registro.mjs) con caché y segunda fuente. Este guardia comprueba:
 *  - que la página pide /api/ct y NO vuelve a llamar a crt.sh directo (el código, sin comentarios);
 *  - que el Worker enruta /api/ct;
 *  - la conversión de Cert Spotter a filas de crt.sh y su paginación, con un fetch simulado;
 *  - (16-nov-2026) que las dos fuentes se UNEN y no se elige una: con las respuestas REALES de crt.sh
 *    y Cert Spotter de un mismo día para un dominio (enmascarado como rastreo.example en
 *    scripts/fixtures/ct-union/), crt.sh trae 1 nombre y Cert Spotter 15, entre ellos staging y
 *    serverless-staging, que respondían. Elegir una daba nota C o F según quién contestó. MUTACIÓN:
 *    volver a elegir una → los nombres de staging desaparecen → grita.
 *   node scripts/check-ct-registro.mjs --self-test
 */
import { readFileSync } from "node:fs";
import { filasDesdeCertSpotter, certSpotter, dominioValido, manejarCT, leerD1, guardarD1, FUENTE_UNION, CLAVE_D1_CS } from "../lib/ct-registro.mjs";
import * as N from "../public/js/qex-nucleo.mjs";
import { conMutante } from "./lib/mutar.mjs";

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "repara lib/ct-registro.mjs o la llamada de la medición en vivo antes de desplegar" };

const fallas = [];
const igual = (a, b, q) => { if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
// Sólo comentarios que ABREN una línea: un "/*" o "//" dentro de una cadena ("/blog/*",
// "https://") se comería código, y eso ya pasó al escribir este guardia.
const sinComentarios = (t) => t.replace(/^\s*\/\*[\s\S]*?\*\/\s*$/gm, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\*.*$/gm, "");

// grito y silencio del cableado
const pagina = sinComentarios(readFileSync(new URL("../public/js/medicion-envivo.mjs", import.meta.url), "utf8"));
if (!/fetch\(`\/api\/ct\?d=/.test(pagina)) fallas.push("la medición en vivo no pide /api/ct");
if (/fetch\([^)]*crt\.sh/.test(pagina)) fallas.push("la medición en vivo volvió a llamar a crt.sh directo desde el navegador");
const paradojico = sinComentarios("// antes: fetch(`https://crt.sh/?q=x`)\nconst a = 1;");
if (/fetch\([^)]*crt\.sh/.test(paradojico)) fallas.push("el guardia lee comentarios como código");
const w = sinComentarios(readFileSync(new URL("../worker.js", import.meta.url), "utf8"));
if (!/pathname === "\/api\/ct"\) return manejarCT\(/.test(w)) fallas.push("worker.js no enruta /api/ct");

// conversión
igual(filasDesdeCertSpotter([{ id: "9", dns_names: ["a.x.cl", "b.x.cl"], not_before: "n", not_after: "m" }]),
  [{ name_value: "a.x.cl\nb.x.cl", not_before: "n", not_after: "m", id: "9" }], "Cert Spotter → filas");
igual(filasDesdeCertSpotter([{ id: "1" }])[0].name_value, "", "emisión sin nombres no revienta");
igual([dominioValido("banco.cl"), dominioValido("a b.cl"), dominioValido("../x"), dominioValido("x")], [true, false, false, false], "dominio válido");

// paginación: 100 + 100 + 30 = 230, y el segundo pedido usa after = último id
const vistos = [];
const pagina_ = (n, desde) => Array.from({ length: n }, (_, i) => ({ id: String(desde + i), dns_names: [`h${desde + i}.x.cl`] }));
const falso = async (u) => { vistos.push(u); const k = vistos.length; return new Response(JSON.stringify(k === 1 ? pagina_(100, 0) : k === 2 ? pagina_(100, 100) : pagina_(30, 200)), { status: 200 }); };
const texto = await certSpotter("x.cl", falso);
igual(JSON.parse(texto).length, 230, "pagina hasta la página corta");
igual(/after=99/.test(vistos[1] || ""), true, "el segundo pedido sigue desde el último id");
// una segunda página que falla no borra la primera
const vistos2 = [];
const falla2 = async (u) => { vistos2.push(u); return vistos2.length === 1 ? new Response(JSON.stringify(pagina_(100, 0))) : new Response("", { status: 429 }); };
igual(JSON.parse(await certSpotter("x.cl", falla2)).length, 100, "conserva lo ya recibido si la siguiente página falla");
// la primera página que falla es error, no lista vacía
let dioError = false; try { await certSpotter("x.cl", async () => new Response("", { status: 503 })); } catch { dioError = true; }
igual(dioError, true, "sin ninguna página es error, nunca «cero nombres»");

// ---------------------------------------------------------------- las fuentes: se UNEN (16-nov-2026)
const filasDesdeTexto = (t) => JSON.stringify(filasDesdeCertSpotter(JSON.parse(t)));
// Caché del borde, D1 y red simuladas. Las respuestas son las REALES del 16-nov (enmascaradas).
const D = "rastreo.example";
const CRT_REAL = readFileSync(new URL("./fixtures/ct-union/crtsh-rastreo.example.json", import.meta.url), "utf8");
const CS_REAL = readFileSync(new URL("./fixtures/ct-union/certspotter-rastreo.example.json", import.meta.url), "utf8");
const CS = "Cert Spotter (SSLMate), sólo certificados vigentes";
const almacen = new Map();
globalThis.caches = { default: {
  match: async (k) => { const v = almacen.get(k.url); return v ? new Response(v) : undefined; },
  put: async (k, r) => { almacen.set(k.url, await r.text()); },
} };
// waitUntil se junta y se espera: una escritura a la caché o a D1 que llega tarde contamina el caso siguiente
const pendientes = [];
const ctx = { waitUntil: (p) => { pendientes.push(p); } };
const esperar = async () => { while (pendientes.length) await pendientes.shift(); };
const filas = new Map();
const DB = { prepare: (sql) => ({ bind: (...a) => ({
  first: async () => /^SELECT/.test(sql) ? filas.get(a[0]) || null : null,
  run: async () => { const prev = filas.get(a[0]); if (!prev || a[1] > prev.consultado_utc) filas.set(a[0], { consultado_utc: a[1], ms: a[2], gz: a[3] }); },
}) }) };
const fetchOriginal = globalThis.fetch;
const red = { crt: true, cs: true, tocada: [] };
globalThis.fetch = async (u) => {
  u = String(u);
  if (u.includes("crt.sh")) { red.tocada.push("crt.sh"); return red.crt ? new Response(CRT_REAL) : new Response("", { status: 502 }); }
  if (u.includes("certspotter")) { red.tocada.push("certspotter"); return red.cs ? new Response(CS_REAL) : new Response("", { status: 503 }); }
  throw new Error("red inesperada: " + u);
};
const limpio = () => { pendientes.length = 0; almacen.clear(); filas.clear(); red.tocada = []; red.crt = true; red.cs = true; };
let ip = 0;
const pedir = async (M = { manejarCT }, d = D) => {
  const j = await (await M.manejarCT(new Request(`https://rosettaquantum.com/api/ct?d=${d}`, { headers: { "cf-connecting-ip": "10.0.0." + (++ip) } }), ctx, { DB })).json();
  await esperar();
  return j;
};
// los nombres que ve la medición con esa respuesta, por el mismo camino que la página y el servidor
const nombres = async (r, d = D) => N.hostsCT(N.nombresCT((await N.ctDesdeServidor(r, 0)).filas, d), d);
const hostsDe = (texto) => [...N.nombresCT(JSON.parse(texto), D).keys()].sort();
const antiguo = (dias) => new Date(Date.now() - dias * 86400e3).toISOString();

// 1 · las dos responden: la unión, con las dos fuentes declaradas
limpio();
let r = await pedir();
const hU = await nombres(r);
igual([r.ok, r.fuente, r.fuentes.map((f) => f.fuente)], [true, FUENTE_UNION, ["crt.sh", CS]], "las dos responden: se unen y se declaran las dos");
igual(r.fuentes.map((f) => f.certificados), [135, 18], "cada fuente declara cuántos certificados aportó (los reales: 135 y 18)");
igual([hostsDe(CRT_REAL).length, hostsDe(filasDesdeTexto(CS_REAL)).length], [1, 15], "caso real: crt.sh ve 1 nombre, Cert Spotter 15");
igual(hU.map((h) => h.host), [...new Set([...hostsDe(CRT_REAL), ...hostsDe(filasDesdeTexto(CS_REAL))])].sort(), "la unión ve exactamente los nombres de las dos");
const sondeo = N.nombresASondear(hU).pedidos;
igual(["staging." + D, "serverless-staging." + D].every((h) => sondeo.includes(h)), true, "caso real: staging y serverless-staging entran al sondeo");
igual(r.intentos, [], "nada falló, nada se declara como falla");
// la huella es de lo que se recibió: el texto unido trae las filas de las dos
igual(JSON.parse(r.texto).length, 135 + 18, "el texto unido trae las filas de las dos fuentes");

// 2 · crt.sh caído, sin copia: Cert Spotter solo, declarado (igual que antes)
limpio(); red.crt = false;
r = await pedir();
igual([r.fuente, r.fuentes.length, r.intentos.map((x) => x.fuente)], [CS, 1, ["crt.sh"]], "crt.sh caído y sin copia: Cert Spotter solo, y crt.sh declarado en las fallas");
igual((await nombres(r)).some((h) => h.host === "staging." + D), true, "con Cert Spotter solo, staging igual se ve");
// 3 · Cert Spotter caído: crt.sh solo, declarado
limpio(); red.cs = false;
r = await pedir();
igual([r.fuente, r.fuentes.length, r.intentos.map((x) => x.fuente)], ["crt.sh", 1, [CS]], "Cert Spotter caído y sin copia: crt.sh solo, y Cert Spotter declarado en las fallas");
// 4 · las dos caídas, sin copias: 503 con las dos razones
limpio(); red.crt = false; red.cs = false;
const r503 = await manejarCT(new Request(`https://rosettaquantum.com/api/ct?d=${D}`, { headers: { "cf-connecting-ip": "10.9.9.9" } }), ctx, { DB }); await esperar();
const j503 = await r503.json();
igual([r503.status, j503.ok, j503.intentos.length], [503, false, 2], "las dos caídas y sin copia: 503 con las dos razones, nunca «cero nombres»");

// 5 · PRIORIDAD (defecto medido el 11-nov): una copia de crt.sh de días NO se pierde porque Cert Spotter
// conteste: crt.sh caído hoy + copia de 3 días + Cert Spotter vivo → la unión, declarada vieja.
limpio(); red.crt = false;
almacen.set(`https://rosettaquantum.com/__ct/v2/crtsh/${D}`, JSON.stringify({ fuente: "crt.sh", consultado_utc: antiguo(3), texto: CRT_REAL }));
r = await pedir();
igual([r.fuente, r.vieja, r.fuentes.map((f) => [f.fuente, f.vieja])], [FUENTE_UNION, true, [["crt.sh", true], [CS, false]]], "copia de crt.sh de 3 días + Cert Spotter vivo: la unión, declarada vieja");

// 6 · las dos copias frescas en el borde: sin red
limpio();
await pedir();
red.tocada = [];
r = await pedir();
igual([r.fuente, r.desde_copia, !!r.vieja, red.tocada], [FUENTE_UNION, true, false, []], "las dos copias frescas: la unión sin ir a la red, declarada copia");

// 7 · COPIA GLOBAL EN D1 (defecto medido el 12-nov): la caché del borde es por centro de datos. En otro
// colo, las copias de D1 de las DOS fuentes bastan, sin red.
limpio();
await pedir();
igual([filas.has(D), filas.has(CLAVE_D1_CS + D)], [true, true], "las dos fuentes dejan su copia global en D1");
almacen.clear(); red.tocada = [];
r = await pedir();
igual([r.fuente, r.desde_copia, red.tocada, (await nombres(r)).length], [FUENTE_UNION, true, [], hU.length], "colo sin copia: las dos copias de D1, sin red, mismos nombres");
// 8 · D1 con copias viejas (10 días) y las dos fuentes caídas: la unión de las copias, declarada vieja
limpio();
await guardarD1(DB, D, { texto: CRT_REAL, consultado_utc: antiguo(10), ms: 9 });
await guardarD1(DB, CLAVE_D1_CS + D, { texto: JSON.stringify(filasDesdeCertSpotter(JSON.parse(CS_REAL))), consultado_utc: antiguo(10), ms: 9 });
red.crt = false; red.cs = false;
r = await pedir();
igual([r.fuente, r.vieja, (await nombres(r)).length], [FUENTE_UNION, true, hU.length], "las dos caídas, copias de D1 de 10 días: la unión de las copias, declarada vieja");
igual((await leerD1(DB, D)).texto, CRT_REAL, "D1 devuelve el texto exacto (la huella no cambia)");
await guardarD1(DB, D, { texto: "[]", consultado_utc: antiguo(20), ms: 1 });
igual((await leerD1(DB, D)).texto, CRT_REAL, "una copia más vieja no pisa a una más nueva");
igual((await leerD1(DB, CLAVE_D1_CS + D, CS)).fuente, CS, "la copia de Cert Spotter en D1 se declara como de Cert Spotter");
// 9 · límite por minuto con una copia fresca: no hay 429, se usa lo que hay y se declara
limpio();
almacen.set(`https://rosettaquantum.com/__ct/v2/crtsh/${D}`, JSON.stringify({ fuente: "crt.sh", consultado_utc: antiguo(0.1), texto: CRT_REAL }));
const minuto = Math.floor(Date.now() / 60000);
almacen.set(`https://rosettaquantum.com/__lim/ct/10.7.7.7/${minuto}`, "6");
const rLim = await (await manejarCT(new Request(`https://rosettaquantum.com/api/ct?d=${D}`, { headers: { "cf-connecting-ip": "10.7.7.7" } }), ctx, { DB })).json(); await esperar();
igual([rLim.ok, rLim.fuente, rLim.intentos.map((x) => x.fuente), red.tocada], [true, "crt.sh", [CS], []], "límite por minuto con copia fresca de crt.sh: se usa la copia y Cert Spotter se declara no consultado");

// MUTACIÓN: volver a ELEGIR una fuente (la primera que haya) en vez de unirlas → staging desaparece.
await conMutante(new URL("../lib/ct-registro.mjs", import.meta.url), "const partes = [rc.p, rs.p].filter(Boolean);", "const partes = [rc.p || rs.p].filter(Boolean);",
  async (M) => {
    limpio();
    const m = await pedir(M);
    const s = N.nombresASondear(await nombres(m)).pedidos;
    igual(s.includes("staging." + D), false, "MUTACIÓN: eligiendo una fuente, staging no entra al sondeo (el guardia la ve)");
  });
globalThis.fetch = fetchOriginal;

if (fallas.length) { console.error("check-ct-registro: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log("check-ct-registro: ok (cableado, conversión, paginación, falla cerrada, unión de crt.sh y Cert Spotter con respuestas reales, copias por fuente, 1 mutación grita)");
