#!/usr/bin/env node
/**
 * REGLA QUE ESTE GUARDIA EJERCE — no es una preferencia tecnica:
 *
 *   Un informe de cliente se entrega POR ARCHIVO a su destinatario, nunca
 *   sirviendolo desde la web publica. Ni con URL secreta, ni con noindex, ni
 *   "temporalmente". La web sirve lo agregado y anonimo; lo individual viaja
 *   como documento a quien le pertenece.
 *
 * Decision de Nicholas, 2026-08-21, textual: «ese informe es privado».
 *
 * Nace de un riesgo real: `/informe-cliente/santander` se habria desplegado sin
 * noindex, sin autenticacion y con URL adivinable, publicando el score de un
 * banco con nombre, su inventario criptografico y la frase «cuatro endpoints
 * sensibles alcanzables desde internet». Y el propio documento lleva un banner
 * que afirma que los hallazgos individuales no se publican — desplegarlo
 * convertia esa frase en falsa en el mismo acto.
 *
 * Comprueba dos cosas, en dos momentos distintos:
 *   1. FUENTE  — cada JSON con `confidencial: true` tiene su pagina detras de
 *      una guarda de entorno, no construida por omision.
 *   2. SALIDA  — si existe dist/, ninguna pagina confidencial quedo dentro.
 *
 * Punto ciego declarado: comprueba rutas de Astro y el contenido de dist/. NO
 * sabe si el archivo llego a un bucket, un CDN o un correo por otra via.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const R = (p) => resolve(raiz, p);

// datos confidenciales -> ruta de Astro que los renderiza
const FUENTES = [
  { datos: 'src/data/informe-cliente', pagina: 'src/pages/informe-cliente/[cliente].astro',
    guarda: 'INFORME_CLIENTE', salida: 'dist/informe-cliente' },
];

let fallas = 0;
const mal = (m) => { console.log(`  ✗ ${m}`); fallas++; };
const bien = (m) => console.log(`  ✓ ${m}`);
console.log('confidencial · lo individual no se sirve desde la web');

for (const { datos, pagina, guarda, salida } of FUENTES) {
  const dir = R(datos);
  if (!existsSync(dir)) { console.log(`  — ${datos} no existe`); continue; }

  const conf = readdirSync(dir).filter((f) => f.endsWith('.json')).filter((f) => {
    try { return JSON.parse(readFileSync(join(dir, f), 'utf8')).confidencial === true; }
    catch { mal(`${datos}/${f} no se pudo leer — se trata como confidencial`); return true; }
  });
  if (!conf.length) { console.log(`  — ${datos} sin archivos marcados confidenciales`); continue; }

  // 1 · la fuente tiene que estar cerrada por omision
  if (!existsSync(R(pagina))) { mal(`${pagina} no existe y hay ${conf.length} JSON confidencial(es)`); continue; }
  const src = readFileSync(R(pagina), 'utf8');
  const cerrada = new RegExp(`if\\s*\\(\\s*!\\s*import\\.meta\\.env\\.${guarda}\\s*\\)\\s*return\\s*\\[\\s*\\]`).test(src);
  if (!cerrada) mal(`${pagina} construye ${conf.length} informe(s) confidencial(es) SIN la guarda ${guarda}. Produccion los publicaria.`);
  else bien(`${pagina} cerrada por omision (${conf.length} confidencial(es), guarda ${guarda})`);

  // 2 · y la salida no puede tenerlos, salvo que se hayan pedido a proposito
  const out = R(salida);
  if (existsSync(out) && statSync(out).isDirectory()) {
    const dentro = readdirSync(out);
    if (dentro.length && !process.env[guarda])
      mal(`${salida} contiene ${dentro.length} informe(s) confidencial(es) en un build donde ${guarda} no estaba puesta: ${dentro.join(', ')}`);
    else if (dentro.length) bien(`${salida} tiene ${dentro.length} informe(s), y ${guarda} fue pedida a proposito`);
  } else bien(`${salida} no existe en la salida`);
}

console.log(fallas
  ? `\nconfidencial: ${fallas} problema(s). El build se detiene.`
  : '\nconfidencial: nada individual queda expuesto.');
process.exit(fallas ? 1 : 0);
