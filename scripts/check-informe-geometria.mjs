#!/usr/bin/env node
/**
 * Vigila que toda marca posicionada en absoluto tenga un ancestro que la sujete.
 *
 * Nace de un defecto real (2026-08-19) en el informe individual — el documento que
 * se cobra: las marcas de mediana nacional se declaran
 * `position:absolute; top:-3px; bottom:-3px` dentro de `.bar-track`, pero .bar-track
 * era `position:static`. Las cuatro marcas se anclaban a un ancestro lejano y se
 * dibujaban como lineas de 821 px cruzando la pagina entera, en vez de 27 px dentro
 * de su barra. Sobrevivio porque una linea vertical fina parece parte del diseno.
 *
 * Punto ciego declarado: comprueba la relacion contenedor/marca por clase, leyendo
 * el CSS. NO renderiza, asi que no ve defectos de geometria que solo aparecen con
 * datos reales (una barra al 100 %, un texto que desborda).
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (p) => readFileSync(resolve(raiz, p), 'utf8');

// plantilla que dibuja la marca -> clase del contenedor -> hoja que debe sujetarlo
const PARES = [
  { tpl: 'src/pages/informe-cliente/[cliente].astro', cont: 'bar-track', css: 'src/styles/pages/informe-pqc.css' },
  // La escala de comparacion con pares del informe individual: tres marcas en %
  // (su puntaje, la mediana del sector, la mitad central). El CSS vive en el
  // propio .astro, no en una hoja aparte. (2026-08-20)
  { tpl: 'src/components/qready/QrReport.astro', cont: 'peer-scale', css: 'src/components/qready/QrReport.astro' },
];

let fallas = 0;
console.log('informe · geometria de marcas absolutas');
for (const { tpl, cont, css } of PARES) {
  const src = leer(tpl);
  const marcas = [...src.matchAll(/position:absolute/g)].length;
  if (!marcas) { console.log(`  — ${cont.padEnd(12)} la plantilla ya no dibuja marcas absolutas`); continue; }

  const regla = leer(css).match(new RegExp(`\\.${cont}\\s*\\{([^}]*)\\}`));
  if (!regla) {
    console.log(`  ✗ ${cont.padEnd(12)} ${marcas} marca(s) absoluta(s) y .${cont} no existe en ${css}`);
    fallas++;
  } else if (!/position\s*:\s*(relative|absolute|fixed|sticky)/.test(regla[1])) {
    console.log(`  ✗ ${cont.padEnd(12)} ${marcas} marca(s) absoluta(s) sin ancla: .${cont} es static y las deja escapar`);
    fallas++;
  } else {
    console.log(`  ✓ ${cont.padEnd(12)} ${marcas} marca(s) absoluta(s), ancladas a .${cont}`);
  }
}
console.log(fallas ? `\ngeometria: ${fallas} marca(s) sin ancla. El build se detiene.` : '\ngeometria: toda marca absoluta tiene quien la sujete.');
process.exit(fallas ? 1 : 0);
