#!/usr/bin/env node
/**
 * El repositorio es PÚBLICO: ningún archivo versionado nombra a un cliente.
 *
 * EL DEFECTO (3-nov-2026). La medición del correo de un banco cliente entró al repo como dato
 * de prueba, y su nombre estaba en comentarios, pruebas y un placeholder visible. Nicholas decidió
 * anonimizar hacia adelante y poner este guardia para que no vuelva.
 *
 * Cómo, sin delatar a quién protege: la lista son HUELLAS sha256 de nombres en minúsculas, no los
 * nombres. Un guardia que escribiera «no subas X» publicaría X. Se parte cada archivo en palabras
 * (letras y dígitos, sin tildes) y se compara la huella de cada una, y de cada par unido, contra
 * la lista. Precisión sobre cobertura: sólo grita por coincidencias exactas de palabra.
 *
 * QUÉ NO CUBRE: un nombre pegado a otra palabra sin separador («nombregroup»), escrito con faltas,
 * o dentro de una imagen o un PDF. La huella de una palabra común se puede adivinar probando un
 * diccionario: esto evita escribir el nombre, no lo vuelve secreto. Y el
 * historial: lo ya publicado antes del 3-nov sigue en commits viejos (decisión: hacia adelante).
 *
 * Para agregar un cliente: node scripts/check-sin-clientes.mjs --huella nombre
 */
export const CONSUMIDOR = {
  quien: "sesion que despliega la web",
  hace: "reemplaza el nombre del cliente por un ejemplo antes de que el commit llegue al repo público",
};

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const huella = (w) => createHash("sha256").update(w).digest("hex");
export const CLIENTES = new Set([
  "138df632fd0de2067dfcd75b6dbc543d8d66da31a79a39358216aa6ef63ad437",
]);

export function nombresEn(texto, lista = CLIENTES) {
  const palabras = texto.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const vistos = new Set();
  for (let i = 0; i < palabras.length; i++) {
    for (const w of [palabras[i], palabras[i] + (palabras[i + 1] || "")]) if (lista.has(huella(w))) vistos.add(w);
  }
  return [...vistos];
}

if (process.argv[2] === "--huella") { console.log(huella(String(process.argv[3] || "").toLowerCase())); process.exit(0); }

// Autoprueba: grito y silencio con una lista de prueba, sin nombrar a ningún cliente.
const prueba = new Set([huella("acmebank")]);
const fallas = [];
if (nombresEn("medido en mx1.AcmeBank.cl hoy", prueba).length !== 1) fallas.push("no grita con el nombre dentro de un host");
if (nombresEn("Acme Bank", prueba).length !== 1) fallas.push("no grita con el nombre partido en dos palabras");
if (nombresEn("acmebanking y acme-banco", prueba).length !== 0) fallas.push("grita con palabras que sólo empiezan igual");
if (CLIENTES.size === 0) fallas.push("la lista de clientes está vacía: el guardia no vigila nada");

const archivos = execSync("git ls-files -z", { encoding: "utf8" }).split("\0").filter((f) => f && !/\.(png|jpe?g|gif|webp|avif|ico|pdf|woff2?|ttf|otf|zip|gz|bin|npz)$/i.test(f));
const hallados = [];
for (const f of archivos) {
  let t; try { t = readFileSync(f, "utf8"); } catch { continue; }
  const n = nombresEn(t);
  if (n.length) hallados.push(`${f}: ${n.length} nombre(s) de cliente`);
}
for (const h of hallados) console.log("  FALLA " + h);
for (const f of fallas) console.log("  FALLA autoprueba: " + f);
console.log(`check-sin-clientes: ${archivos.length} archivos revisados, ${hallados.length} con nombres de cliente, autoprueba ${fallas.length ? "FALLA" : "ok"}`);
process.exit(hallados.length || fallas.length ? 1 : 0);
