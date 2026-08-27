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
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PESOS, ORDEN } from '../src/lib/qex.js';

const aqui = dirname(fileURLToPath(import.meta.url));
/* DOS RAICES, y confundirlas fue lo que tumbo un deploy (2026-08-21).
 *
 *   REPO    = la raiz del repositorio. Todo lo del sitio vive aqui y existe en
 *             cualquier maquina, incluido CI.
 *   PROYECTO= la carpeta del proyecto, DOS niveles arriba del repo. Ahi vive el
 *             corpus del estudio, que NO esta versionado y no puede estarlo: trae
 *             hallazgos por organizacion con nombre y este repositorio es publico.
 *
 * La version anterior calculaba una sola raiz como `../../..` desde scripts/, que
 * en mi Mac daba la carpeta del proyecto y en CI daba /home/runner/work. Con eso
 * buscaba hasta el JSON del propio informe fuera del repo y reventaba con ENOENT.
 * Nunca habia corrido en CI, asi que nadie lo supo hasta que lo cablee. */
const REPO = resolve(aqui, '..');
const PROYECTO = resolve(REPO, '../..');
const leer = (p) => readFileSync(resolve(REPO, p), 'utf8');

/* La implementacion de referencia vive fuera del repo (es del proyecto, no del
   sitio), asi que en CI no existe. Se guarda una copia dentro de scripts/lib/ y
   se prefiere la de afuera cuando esta: la de afuera es la que manda, la copia
   existe para que el guardia pueda correr en cualquier maquina.
   Si las dos existen y difieren, eso TAMBIEN es una divergencia y se grita. */
/* La primera version de esto tenia el defecto del dia dentro: cuando el original
 * no estaba en la maquina, devolvia la COPIA y la comparaba consigo misma. En CI
 * salia verde siempre. **Un control que se compara contra si mismo siempre se da
 * la razon.** Lo encontro CTO. (2026-08-21)
 *
 * Desde CI es genuinamente imposible saber si el original --que vive fuera del
 * repo-- cambio. Asi que no se finge: se DECLARA que esa comprobacion no se pudo
 * hacer, y entra al resumen como «sin verificar», nunca como aprobada.
 * Quien edite el original y no sincronice la copia lo va a ver en su propia
 * maquina, que es donde si se puede comprobar. */
let sincroniaVerificada = false;
const leerPy = () => {
  const fuera = resolve(PROYECTO, 'calcular_qex.py');
  const dentro = resolve(aqui, 'lib/calcular_qex.py');
  const copia = readFileSync(dentro, 'utf8');
  if (!existsSync(fuera)) {
    console.log('  ? sincronia con calcular_qex.py: SIN VERIFICAR — la original no esta en esta maquina');
    console.log('    (vive fuera del repo; desde CI no hay forma de saber si cambio)');
    return copia;
  }
  // COMPARA LA FORMULA, NO LOS BYTES — corregido el 2026-08-26 despues de que el guardia
  // llevara dias en rojo por una diferencia deliberada.
  //
  // La copia del repo NO es ni debe ser identica a la original: la original resuelve la ruta
  // del corpus del estudio chileno contra su propio directorio, **que dentro del repo no
  // existe** —y ese corpus esta gitignoreado justamente porque este repositorio es publico—.
  // Exigir identidad byte a byte pedia algo imposible y gritaba a diario por algo inofensivo.
  // **Un guardia que grita sin motivo ensena a ignorarlo**, y el nombre de este dice lo que
  // le importa: «una sola ponderacion».
  //
  // Lo que si tiene que coincidir es la formula: pesos y techo. Es lo que se compara ahora,
  // y es estrictamente lo que este guardia existe para proteger.
  const original = readFileSync(fuera, 'utf8');
  const formulaDe = (src) => JSON.stringify({
    pesos: [...src.matchAll(/^\s*"(\w+)":\s*([0-9.]+),/gm)].map((m) => [m[1], m[2]]).sort(),
    tope: (/^\s*TOPE\s*=\s*(\d+)/m.exec(src) ?? [])[1] ?? null,
  });
  if (formulaDe(original) !== formulaDe(copia)) {
    mal('scripts/lib/calcular_qex.py difiere de la original EN LA FORMULA (pesos o techo)');
    return copia;
  }
  sincroniaVerificada = true;
  bien('scripts/lib/calcular_qex.py comparte pesos y techo con la original (el resto puede diferir a proposito)');
  return copia;
};

let fallas = 0;
const mal = (m) => { console.log(`  ✗ ${m}`); fallas++; };
const bien = (m) => console.log(`  ✓ ${m}`);

console.log('QEX · una sola ponderacion');

// 1) el motor del indice (Python) manda
const py = leerPy();
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
const json = JSON.parse(leer('src/data/informe-pqc/2026-08.json'));
for (const d of json.indice.dimensiones) {
  if (PESOS[d.id] !== d.peso) mal(`informe-pqc 2026-08 ${d.id} = ${d.peso} % · src/lib/qex.js = ${PESOS[d.id]} %`);
}
if (fallas === 0) bien('el estudio publicado (220 organizaciones) usa la misma ponderacion');

// 3) ningun score ni banda escritos a mano en lo que se renderiza
for (const f of ['src/components/qready/QrReport.astro', 'src/components/qready/QrLanding.astro']) {
  const src = leer(f);
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
  const py = leerPy();
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

console.log(fallas
  ? `\nQEX: ${fallas} divergencia(s). El build se detiene.`
  : `\nQEX: una sola formula, sin numeros escritos a mano.${sincroniaVerificada ? '' : ' (1 comprobacion sin verificar: ver arriba)'}`);
process.exit(fallas ? 1 : 0);
