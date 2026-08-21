#!/usr/bin/env node
/**
 * Vigila que exista UNA sola ponderacion del QEX y que ningun score se escriba
 * a mano. No compara contra una copia: lee las tres fuentes y las contrasta.
 *
 * Nace de un defecto real (2026-08-19): el informe de ejemplo declaraba una
 * tabla de pesos (edge 35 %) y dibujaba un 28 escrito a mano que esa tabla no
 * producia. Habia tres numeros para la misma empresa —33 (indice), 23,3
 * (los pesos del informe sobre sus dimensiones) y 28 (lo mostrado)— y ninguno
 * derivaba de otro. La revision visual no lo veia: los tres son plausibles.
 *
 * Punto ciego declarado: comprueba la ponderacion y que el score sea derivado.
 * NO comprueba que los valores por dimension de la empresa de ejemplo sean los
 * que salieron del escaneo — eso no es recomputable desde este repo.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PESOS, ORDEN } from '../src/lib/qex.js';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = resolve(aqui, '../../..');
const leer = (p) => readFileSync(resolve(raiz, p), 'utf8');

let fallas = 0;
const mal = (m) => { console.log(`  ✗ ${m}`); fallas++; };
const bien = (m) => console.log(`  ✓ ${m}`);

console.log('QEX · una sola ponderacion');

// 1) el motor del indice (Python) manda
const py = leer('calcular_qex.py');
const pyPesos = {};
for (const [, k, v] of py.matchAll(/^\s*"(\w+)":\s*([0-9.]+),/gm)) pyPesos[k] = Math.round(parseFloat(v) * 100);
// el motor Python llama 'certificados' a lo que aqui es 'cert'; el resto coincide
const EN_PYTHON = { cert: 'certificados' };
for (const k of ORDEN) {
  const py_k = EN_PYTHON[k] ?? k;
  if (!(py_k in pyPesos)) mal(`calcular_qex.py no declara la dimension ${py_k}`);
  else if (pyPesos[py_k] !== PESOS[k]) mal(`calcular_qex.py ${py_k} = ${pyPesos[py_k]} % · src/lib/qex.js ${k} = ${PESOS[k]} %`);
}
if (!fallas) bien(`calcular_qex.py coincide con src/lib/qex.js (${ORDEN.map((k) => `${k} ${PESOS[k]}`).join(' · ')})`);

// 2) el estudio ya publicado usa la misma
const json = JSON.parse(leer('Rosetta-21jul/rosetta-astro/src/data/informe-pqc/2026-08.json'));
for (const d of json.indice.dimensiones) {
  if (PESOS[d.id] !== d.peso) mal(`informe-pqc 2026-08 ${d.id} = ${d.peso} % · src/lib/qex.js = ${PESOS[d.id]} %`);
}
if (fallas === 0) bien('el estudio publicado (220 organizaciones) usa la misma ponderacion');

// 3) ningun score ni banda escritos a mano en lo que se renderiza
for (const f of ['src/components/qready/QrReport.astro', 'src/components/qready/QrLanding.astro']) {
  const src = leer(`Rosetta-21jul/rosetta-astro/${f}`);
  if (/SCORE\s*=\s*\d/.test(src)) mal(`${f} escribe el score a mano en vez de derivarlo`);
  else if (!/score\(VALORES\)/.test(src)) mal(`${f} no deriva el score con score() de src/lib/qex.js`);
  else if (/'(Expuesto|Consciente|En transición|Perímetro migrado|Cripto-ágil|Not ready|Aware|Piloting|Hybrid at edge|Crypto-agile)'/.test(src)) mal(`${f} escribe el nombre de una banda a mano`);
  else bien(`${f} deriva score y banda`);
}

// --- El TECHO tambien es la formula (agregado 2026-08-20) ---
// El guardia comparaba pesos y daba por buena "una sola formula". Pero
// calcular_qex.py recortaba en 84 y src/lib/qex.js no: para {100,100,100,100}
// uno decia 84 y el otro 100. Un techo que vive en un solo lado es una
// ponderacion distinta con los mismos pesos.
{
  const py = leer('calcular_qex.py');
  const mTope = py.match(/^TOPE\s*=\s*(\d+)/m);
  const { TOPE, score } = await import('../src/lib/qex.js');
  if (!mTope) mal('calcular_qex.py no declara TOPE');
  else if (Number(mTope[1]) !== TOPE)
    mal(`techo divergente: calcular_qex.py=${mTope[1]} vs src/lib/qex.js=${TOPE}`);
  else bien(`el techo coincide en ambos lados (${TOPE})`);
  const extremo = score({ cert: 100, higiene: 100, hndl: 100, edge: 100 });
  if (extremo !== TOPE) mal(`score() no recorta en el techo: devolvio ${extremo}, esperado ${TOPE}`);
  else bien('score() recorta en el techo');
}

console.log(fallas ? `\nQEX: ${fallas} divergencia(s). El build se detiene.` : '\nQEX: una sola formula, sin numeros escritos a mano.');
process.exit(fallas ? 1 : 0);
