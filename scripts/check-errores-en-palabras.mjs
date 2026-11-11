#!/usr/bin/env node
/**
 * El lector de /es/q-ready/medicion no ve errores técnicos en inglés.
 *
 * Defecto real (11-nov-2026): la tarjeta del certificado de falabella.com dijo
 * «No pudimos leer el certificado: Stream was cancelled». El texto crudo sigue en la traza
 * (el registro de la medición); en tarjetas y tablas pasa por enPalabras().
 * Comprueba:
 *  - el caso real se traduce, y lo que ya escribimos en español pasa intacto (silencio);
 *  - ninguna línea visible (fuera de traza()) interpola c.error, sa.error o la causa del correo crudos;
 *  - la frase de veredicto: medido vs. no medido, nunca «no protegido» por falta de dato.
 *   node scripts/check-errores-en-palabras.mjs --self-test
 */
import { readFileSync } from "node:fs";
import { enPalabras, fraseVeredicto } from "../public/js/medicion-palabras.mjs";

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "pasa el error nuevo por enPalabras() o corrige la frase antes de desplegar" };

const fallas = [];
const igual = (a, b, q) => { if (a !== b) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const INGLES = /\b(was|the|cancelled|canceled|aborted|refused|failed|stream|error)\b/i;

// grito: el defecto real y sus parientes
for (const t of ["Stream was cancelled", "The operation was aborted", "connect ECONNREFUSED", "Failed to fetch", "something odd happened"]) {
  const r = enPalabras(t);
  if (!r || INGLES.test(r)) fallas.push(`«${t}» llega al lector como «${r}»`);
}
igual(enPalabras("Stream was cancelled"), "la conexión se cortó antes de terminar", "caso falabella");
// silencio: nuestro español no se toca
igual(enPalabras("el servidor de medición no entregó a tiempo"), "el servidor de medición no entregó a tiempo", "español intacto");
igual(enPalabras(""), "", "vacío");

// cableado: en lo visible nada de error crudo (la traza sí lo lleva, a propósito)
// Interpolación directa del campo (`${c.error}`, `${esc(sa.error)}`); un `${c.error ? …` es una condición, no lo muestra.
const CRUDO = /\$\{\s*(esc\(\s*)?(c|sa|co)\??\.(error|causa)\s*\)?\s*\}|esc\(\s*s\.correo_tls\?\.causa\s*\|\|/;
const visibles = (archivo) => readFileSync(new URL(`../public/js/${archivo}`, import.meta.url), "utf8")
  .split("\n").map((l, i, todas) => [i + 1, l, todas[i - 1] || ""])
  // la traza es el registro técnico: su línea y la continuación de su llamada quedan fuera
  .filter(([, l, antes]) => !/^\s*(\/\/|\*)/.test(l) && !/\btraza\(/.test(l) && !(/\btraza\(/.test(antes) && !/\);\s*$/.test(antes)));
for (const f of ["medicion-envivo.mjs", "medicion-historia.mjs"])
  for (const [n, l] of visibles(f)) if (CRUDO.test(l)) fallas.push(`${f}:${n} muestra un error crudo: ${l.trim().slice(0, 90)}`);
// el patrón grita con el código viejo y calla con el nuevo
if (!CRUDO.test('fila("Estado", `No pudimos leer el certificado: ${esc(c.error)}`)')) fallas.push("el guardia no ve el error crudo de agosto");
if (CRUDO.test('fila("Estado", `No pudimos leer el certificado: ${esc(enPalabras(c.error))}`)')) fallas.push("el guardia grita con el código corregido");

// veredicto
const L = (w, c, ce) => [{ k: "web", estado: w }, { k: "correo", estado: c }, { k: "endp", estado: "info" }, { k: "cert", estado: ce }, { k: "ssh", estado: "nm" }];
igual(fraseVeredicto(L("si", "no", "no")), "Su sitio ya está protegido. Su correo y su certificado, todavía no.", "santander 11-nov");
igual(fraseVeredicto(L("si", "nm", "no")), "Su sitio ya está protegido. Su certificado, todavía no. No pudimos medir su correo.", "no medido aparte");
if (/todavía no/.test(fraseVeredicto(L("nm", "nm", "nm")))) fallas.push("tres canales sin medir se leen como no protegidos");
if (/ssh/i.test(fraseVeredicto(L("si", "si", "si")))) fallas.push("el veredicto nombra SSH, que esta página no mide");

if (fallas.length) { console.error("[errores-en-palabras] FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log("[errores-en-palabras] ok: el lector no ve errores en inglés y el veredicto sólo cuenta lo medido");
