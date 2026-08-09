#!/usr/bin/env node
/**
 * Arma la visualizacion de un challenge a partir de piezas separadas.
 *
 * POR QUE
 * -------
 * El entregable original era UN archivo de 113.908 bytes del que **91.415 (80%)
 * eran coordenadas de 4 proteinas**. Con ese formato, el challenge siguiente no es
 * publicar datos nuevos: es fabricar otro HTML de 114 KB a mano. Separando datos de
 * render, el proximo challenge es un JSON.
 *
 * PIEZAS
 *   plantilla.html   cascaron con __RQ_ESTILO__ y __RQ_SCRIPT__
 *   estilo.css       CSS
 *   render.js        el dibujo (canvas 3D, tablas, controles) — sin datos
 *   datos/*.json     una corrida = un archivo
 *
 * PRUEBA DE QUE LA SEPARACION NO PERDIO NADA
 * ------------------------------------------
 * `--verificar-original` rearma con las piezas crudas y compara el sha256 contra el
 * entregable original. Si no da byte a byte, la separacion perdio algo y aborta. Un
 * refactor de un artefacto sellado que no se compara contra el original es una
 * suposicion, no un refactor.
 *
 * Uso:
 *   node scripts/build-viz-cleveland.mjs --verificar-original
 *   node scripts/build-viz-cleveland.mjs --salida <archivo.html> [--datos <json>]
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(RAIZ, "src/viz/cleveland");
const SHA_ORIGINAL = "831ae820774455f98cfd20c07c4c9014032c12526bf0cac61520bb0c5994742d";

const args = process.argv.slice(2);
const verificar = args.includes("--verificar-original");
const salida = args.includes("--salida") ? args[args.indexOf("--salida") + 1] : null;
const datosArg = args.includes("--datos") ? args[args.indexOf("--datos") + 1] : "datos/cleveland-2026-07.json";
const morir = m => { console.error("ABORTA: " + m); process.exit(1); };

const leer = p => readFileSync(join(DIR, p), "utf8");

/**
 * Arma el HTML. `crudo:true` reproduce el original exacto (sin arreglos), que es lo
 * unico que permite comparar contra su sha256.
 */
function armar({ datos, crudo = false }) {
  let plantilla = leer("plantilla.html");
  const estilo = leer("estilo.css");
  const render = leer("render.js");
  const json = leer(datos);

  if (!crudo) {
    // Arreglos tecnicos, todos declarados. Nada de esto es texto nuevo: es lo que
    // faltaba para que la pagina se pueda leer en un telefono y para que un lector
    // de pantalla sepa en que idioma esta.
    if (!/name="viewport"/.test(plantilla)) {
      // Sin esto el telefono renderiza a 980 px y lo escala: el texto queda ~2,6x
      // por debajo de lo legible.
      plantilla = plantilla.replace('<meta charset="utf-8">',
        '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">');
    }
    if (!/<html[^>]*lang=/.test(plantilla)) {
      plantilla = plantilla.replace('<!DOCTYPE html>', '<!DOCTYPE html>\n<html lang="es">');
    }
  }

  // El archivo original tenia DOS bloques de datos, no uno: `DATA` (coordenadas,
  // 91.415 B) y `ST` (estadistica por proteina, 10.557 B) enterrado a mitad del
  // script. Entre los dos son el 89,5% del entregable; el render real son 8 KB.
  // El segundo aparecio al intentar corregir la ortografia: el reemplazo toco
  // CLAVES de datos ("aceleracion" -> "aceleración") porque estaban mezcladas con
  // el codigo. Por eso salen las dos.
  const stats = leer(datos.replace(/\.json$/, ".stats.json"));
  const script = "<script>\nconst DATA=" + json + render.replace("__RQ_STATS__", stats) + "</script>";
  return plantilla.replace("__RQ_ESTILO__", "<style>" + estilo + "</style>")
                  .replace("__RQ_SCRIPT__", script);
}

for (const p of ["plantilla.html", "estilo.css", "render.js", datosArg]) {
  if (!existsSync(join(DIR, p))) morir(`falta la pieza ${p}`);
}

/**
 * Quita tildes y las dos etiquetas que agregamos, para poder comparar la version
 * corregida contra el entregable original. Si tras deshacer SOLO los cambios
 * declarados el sha256 vuelve a calzar, entonces no se colo ningun cambio ademas
 * de los que decimos haber hecho. Es la unica forma de probar eso sobre un archivo
 * de 114 KB que nadie va a leer entero.
 */
function deshacerCambiosDeclarados(html) {
  return html
    .replace('<!DOCTYPE html>\n<html lang="es">', "<!DOCTYPE html>")
    .replace('<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">', '<meta charset="utf-8">')
    // El bloque de CSS movil va entre marcas justamente para poder quitarlo aca.
    // Si se agrega CSS FUERA de las marcas, esta comprobacion falla — y tiene que
    // fallar: un cambio que no se puede deshacer es un cambio que no se declaro.
    .replace(/\n\/\* RQ-AGREGADO-MOVIL-INICIO \*\/[\s\S]*?\/\* RQ-AGREGADO-MOVIL-FIN \*\/\n/, "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

if (verificar) {
  const crudo = armar({ datos: "datos/cleveland-2026-07.json", crudo: true });
  const shaCrudo = createHash("sha256").update(deshacerCambiosDeclarados(crudo), "utf8").digest("hex");
  console.log(`rearmado crudo: ${Buffer.byteLength(crudo)} bytes`);
  console.log(`  sha256 (deshaciendo tildes): ${shaCrudo}`);
  console.log(`  sha256 del entregable original: ${SHA_ORIGINAL}`);
  if (shaCrudo !== SHA_ORIGINAL)
    morir("hay un cambio NO declarado. Deshacer tildes y las dos etiquetas deberia devolver el original exacto, y no lo hace.");
  console.log("  OK — los unicos cambios son los declarados: ortografia, viewport y lang.");

  const bueno = armar({ datos: "datos/cleveland-2026-07.json" });
  const tildes = (bueno.match(/[áéíóúñÁÉÍÓÚÑ]/g) || []).length;
  console.log(`  tildes y enyes: ${tildes} (el entregable original tenia 0)`);
  if (tildes < 20) morir("la correccion ortografica no se aplico");
  if (!/name="viewport"/.test(bueno)) morir("falta la etiqueta viewport");
  if (!/<html lang="es"/.test(bueno)) morir("falta el idioma declarado");
  // Las claves de datos NO llevan tilde: si alguna la tiene, el reemplazo entro
  // donde no debia y el render deja de encontrar el dato. Paso de verdad.
  for (const clave of ['"aceleracion"', "qubits_codificacion_binaria"]) {
    if (!bueno.includes(clave)) morir(`se corrompio la clave de datos ${clave}`);
  }
  console.log("  OK — claves de datos intactas.");
}

if (salida) {
  const html = armar({ datos: datosArg });
  writeFileSync(salida, html, "utf8");
  const sha = createHash("sha256").update(html, "utf8").digest("hex");
  console.log(`\nescrito ${salida} (${Buffer.byteLength(html)} bytes)`);
  console.log(`  datos: ${datosArg}`);
  console.log(`  sha256: ${sha}`);
}

if (!verificar && !salida) console.log("nada que hacer: pasa --verificar-original o --salida <archivo>");
