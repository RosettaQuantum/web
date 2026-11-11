#!/usr/bin/env node
/**
 * La medición en vivo no depende de que crt.sh conteste.
 *
 * Defecto medido el 11-nov-2026: el navegador esperaba a crt.sh hasta 120 s antes de medir nada
 * más; crt.sh tardó >60 s, 41 s, 13 s y 17 s para un mismo dominio. Ahora el registro lo pide el
 * servidor (lib/ct-registro.mjs) con caché y segunda fuente. Este guardia comprueba:
 *  - que la página pide /api/ct y NO vuelve a llamar a crt.sh directo (el código, sin comentarios);
 *  - que el Worker enruta /api/ct;
 *  - la conversión de Cert Spotter a filas de crt.sh y su paginación, con un fetch simulado.
 *   node scripts/check-ct-registro.mjs --self-test
 */
import { readFileSync } from "node:fs";
import { filasDesdeCertSpotter, certSpotter, dominioValido } from "../lib/ct-registro.mjs";

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

if (fallas.length) { console.error("check-ct-registro: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log("check-ct-registro: ok (cableado, conversión, paginación, falla cerrada)");
