#!/usr/bin/env node
/**
 * Vigila a los vigilantes: todo scripts/check-*.mjs tiene que estar cableado en
 * prebuild o postbuild. Un guardia que no se ejecuta no es un guardia.
 *
 * Nace de un defecto real (2026-08-20): check-informe-cifras.mjs se escribio,
 * se probo por mutacion y se dejo en el repositorio... sin agregarlo a prebuild.
 * Vivio un dia entero sin correr en ningun build. Nadie lo noto porque el
 * archivo estaba ahi y pasaba al ejecutarlo a mano -- el modo de fallo es que
 * el control existe y no se ejerce.
 *
 * Punto ciego declarado: comprueba que el guardia este NOMBRADO en un script de
 * npm. No comprueba que ese script corra en CI, ni que alguien mire su salida.
 *
 * Y NO distingue guardias de build de auditorias de produccion, que es una
 * diferencia que ya costo dos veces: check-alcance y check-openapi miden el sitio
 * VIVO (`BASE = https://rosettaquantum.com`). Cableados en prebuild hacen fallar
 * el build por el estado de produccion -- o por el trabajo de otra rama que si
 * esta desplegada y esta no conoce. Van en `npm run check:prod`, despues de
 * desplegar. Antes de cablear un guardia nuevo: mirar si tiene un BASE.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(raiz, 'package.json'), 'utf8'));

// Todo lo que npm puede ejecutar, no solo pre/postbuild: un guardia cableado en
// un script propio tambien cuenta, siempre que algo lo invoque.
const guiones = Object.values(pkg.scripts ?? {}).join(' \n ');

const guardias = readdirSync(resolve(raiz, 'scripts'))
  .filter((f) => /^check-.*\.mjs$/.test(f));

let fallas = 0;
console.log(`guardias cableados · ${guardias.length} en scripts/`);
for (const g of guardias) {
  if (guiones.includes(`scripts/${g}`)) console.log(`  ✓ ${g}`);
  else { console.log(`  ✗ ${g} existe y NO lo ejecuta ningun script de npm. No es un guardia: es un archivo.`); fallas++; }
}

// Y al reves: un script de npm que invoque un guardia inexistente rompe el build
// de una forma que se lee como "el guardia fallo" cuando en verdad no esta.
for (const m of guiones.matchAll(/scripts\/(check-[\w.-]+\.mjs)/g)) {
  if (!guardias.includes(m[1])) { console.log(`  ✗ package.json invoca scripts/${m[1]}, que no existe`); fallas++; }
}

console.log(fallas
  ? `\nguardias: ${fallas} sin cablear. El build se detiene.`
  : '\nguardias: todos los que existen se ejecutan.');
process.exit(fallas ? 1 : 0);
