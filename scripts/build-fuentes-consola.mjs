#!/usr/bin/env node
/**
 * Incrusta las dos fuentes de la consola en un CSS autocontenido.
 *
 * POR QUE
 * -------
 * El prototipo las trae de Google Fonts y eso rompe dos cosas a la vez:
 *  - autocontenido: la consola tiene que servirse entera desde nuestro dominio;
 *  - el argumento del producto: es la pantalla que vende «no nos creas, comprueba», y
 *    pedirle al navegador del comprador que cargue tipografia de un tercero es exactamente
 *    la dependencia que el resto del sistema evita.
 *
 * QUE BAJA
 * --------
 * Solo el subconjunto LATINO de cada familia. Google sirve un @font-face por rango
 * unicode; bajar los seis de JetBrains Mono (cirilico, griego, vietnamita) triplicaria el
 * peso para caracteres que esta consola no usa. Se elige por `unicode-range`, no por
 * orden de aparicion: el orden cambia sin aviso.
 *
 * Se ejecuta a mano y su salida se commitea. No corre en CI: si Google cambia una URL, el
 * deploy no se cae — se cae este script, que es donde corresponde.
 *
 * Uso: node scripts/build-fuentes-consola.mjs
 */
import { writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const SALIDA = join(RAIZ, "public/consola/fuentes.css");

// Un UA de navegador: Google sirve woff2 solo a quien lo declara. Con el UA por
// omision devuelve formatos viejos y mas pesados.
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
           "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const FAMILIAS = [
  { nombre: "JetBrains Mono", query: "JetBrains+Mono:wght@400;600", pesos: ["400", "600"] },
  { nombre: "Share Tech Mono", query: "Share+Tech+Mono", pesos: ["400"] },
];

/** El bloque latino: el que cubre ASCII y las tildes del castellano. */
const ES_LATINO = r => r.includes("U+0000-00FF") || r.includes("U+0100-02BA");

async function bajar(url, comoTexto = false) {
  const r = await fetch(url, { headers: { "user-agent": UA } });
  if (!r.ok) throw new Error(`${url} respondio ${r.status}`);
  return comoTexto ? r.text() : Buffer.from(await r.arrayBuffer());
}

let css = `/* GENERADO por scripts/build-fuentes-consola.mjs — no editar a mano.
 *
 * Las dos familias de la consola, incrustadas como woff2 en base64. Sin esto la
 * pantalla que vende verificabilidad le pediria las letras a un tercero.
 * Solo el subconjunto latino: los rangos cirilico/griego/vietnamita no se usan aca.
 */\n`;
let total = 0;

for (const f of FAMILIAS) {
  const hoja = await bajar(`https://fonts.googleapis.com/css2?family=${f.query}&display=swap`, true);
  // Cada @font-face trae su unicode-range; se eligen por rango y no por posicion.
  const bloques = hoja.split("@font-face").slice(1);
  // Se cuenta por PESO cubierto, no por bloques: cada peso trae latin y latin-ext,
  // asi que contar bloques daba 4 donde esperaba 2 y el guardia gritaba con razon
  // sobre una expectativa mia equivocada. Lo que importa es que ningun peso quede sin
  // ningun corte — un 600 ausente se ve como una negrita que no engorda, y eso nadie
  // se lo atribuye al build.
  const cubiertos = new Set();
  let puestos = 0;
  for (const b of bloques) {
    const rango = (b.match(/unicode-range:\s*([^;]+)/) || [])[1] || "";
    const peso = (b.match(/font-weight:\s*(\d+)/) || [])[1] || "400";
    const url = (b.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    if (!url || !ES_LATINO(rango) || !f.pesos.includes(peso)) continue;
    cubiertos.add(peso);
    const bytes = await bajar(url);
    total += bytes.length;
    puestos++;
    css += `@font-face{font-family:'${f.nombre}';font-style:normal;font-weight:${peso};` +
           `font-display:swap;src:url(data:font/woff2;base64,${bytes.toString("base64")}) format('woff2');` +
           `unicode-range:${rango.trim()}}\n`;
  }
  const faltan = f.pesos.filter(p => !cubiertos.has(p));
  if (faltan.length) {
    // Falla cerrado: una familia a medias se ve como un defecto tipografico sutil, del
    // tipo que nadie atribuye al build.
    console.error(`ABORTA: de ${f.nombre} no encontre ningun corte latino para el peso ${faltan.join(", ")}.`);
    process.exit(1);
  }
  console.log(`  ${f.nombre}: ${puestos} corte(s) latino(s), pesos ${[...cubiertos].sort().join(" y ")}`);
}

writeFileSync(SALIDA, css);
console.log(`\n  escrito public/consola/fuentes.css — ${Math.round(css.length / 1024)} KB ` +
  `(${Math.round(total / 1024)} KB de fuente), sha256:${createHash("sha256").update(css).digest("hex").slice(0, 12)}…`);
