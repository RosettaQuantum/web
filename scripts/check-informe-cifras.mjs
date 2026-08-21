#!/usr/bin/env node
/**
 * Vigila que cada titular del informe PQC se pueda RECOMPUTAR desde los datos crudos
 * del estudio. No compara contra una copia: recalcula.
 *
 * Nace de un defecto real (2026-08-19): el informe publicaba "14.763 nombres de host
 * sobre 174 organizaciones". Ningun subconjunto de los datos reproducia ese par. El
 * origen result ser una cifra calculada sobre una base (162 dominios .cl) y rotulada
 * con otra (174). La revision visual no lo veia: los dos numeros son plausibles.
 *
 * Punto ciego declarado: solo cubre los titulares con formula conocida. Los titulares
 * 'canal', 'proveedores' y 'tls13' vienen de conteos manuales y se marcan SIN COBERTURA
 * en vez de darse por buenos.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const leer = (p) => JSON.parse(readFileSync(resolve(raiz, p), 'utf8'));

const edicion  = leer('Rosetta-21jul/rosetta-astro/src/data/informe-pqc/2026-08.json');
const desc     = leer('estudio-chile-descubrimiento.json');
const result   = leer('estudio-chile-resultados.json');
// El hibrido ya NO sale de result: ese escaneo medía PREFERENCIA, no soporte
// (key_share de x25519). Akamai Enhanced TLS salía 0% cuando es 100%. La
// medicion válida es el re-escaneo forzado. (2026-08-20)
const rescan   = leer('rescan-soporte-2026-08.json');
const indice   = leer('indice-agosto-2026.json');

const enIndice = new Set(indice.map((r) => r.domain));
const base     = desc.filter((r) => enIndice.has(r.domain));   // 170: la base del indice
const sondeadas= result.filter((r) => r.probe_ok);             // 194
const pct = (n, d) => Math.round((n / d) * 100);
const mediana = (v) => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

// id -> [valor recomputado, base recomputada]
const FORMULAS = {
  irec:       () => [mediana(indice.map((r) => r.score)), indice.length],
  ambientes:  () => [pct(base.filter((r) => (r.no_productivo ?? 0) > 0).length, base.length), base.length],
  infra:      () => [pct(base.filter((r) => (r.infra_expuesta ?? 0) > 0).length, base.length), base.length],
  superficie: () => [base.reduce((a, r) => a + r.hostnames, 0), base.length],
  hibrido:    () => [pct(rescan.filter((r) => r.soporta).length, rescan.length), rescan.length],
};
const SIN_COBERTURA = new Set(['canal', 'proveedores', 'tls13']);

let fallas = 0, cubiertos = 0, saltados = 0;
console.log(`informe ${edicion.edicion} · ${edicion.titulares.length} titulares`);
for (const t of edicion.titulares) {
  if (SIN_COBERTURA.has(t.id)) {
    console.log(`  — ${t.id.padEnd(12)} SIN COBERTURA (conteo manual, no recomputable aqui)`);
    saltados++;
    continue;
  }
  const f = FORMULAS[t.id];
  if (!f) {                       // un titular nuevo sin formula es un fallo, no un silencio
    console.log(`  ✗ ${t.id.padEnd(12)} titular sin formula ni exencion declarada`);
    fallas++;
    continue;
  }
  cubiertos++;
  const [v, b] = f();
  if (v !== t.v || b !== t.base) {
    console.log(`  ✗ ${t.id.padEnd(12)} publica ${t.v} sobre ${t.base} · recomputado ${v} sobre ${b}`);
    fallas++;
  } else {
    console.log(`  ✓ ${t.id.padEnd(12)} ${v} sobre ${b}`);
  }
}

// La muestra declarada tambien se recomputa.
const esperado = { organizaciones: result.length, sondeadas: sondeadas.length,
                   con_descubrimiento: desc.filter((r) => r.ct_ok).length,
                   con_indice: indice.length, hostnames: base.reduce((a, r) => a + r.hostnames, 0) };
for (const [k, v] of Object.entries(esperado)) {
  if (edicion.muestra[k] !== v) {
    console.log(`  ✗ muestra.${k}: declara ${edicion.muestra[k]} · recomputado ${v}`);
    fallas++;
  }
}

// --- Todo desglose suma su total (agregado 2026-08-20) ---
// Hermano del guardia del score. Nace de un defecto real: el informe publicaba
// `certificados_detalle = {rsa2048:128, ecdsa_p256:48, rsa_mayor:10, total:187}`
// y 128+48+10 = 186. Un lector tecnico suma tres numeros en diez segundos, y lo
// hacia en la dimension que pesa 40 %.
//
// Recorre la edicion entera buscando cualquier objeto que declare un `total` y
// tenga al lado partes sumables. No hay lista de casos: lo que se agregue
// manana queda cubierto solo.
function partes(o) {
  // (a) un array de partes con n
  for (const k of ['distribucion', 'desglose', 'partes', 'tramos']) {
    const a = o[k];
    if (Array.isArray(a) && a.length && a.every((x) => x && typeof x.n === 'number'))
      return { via: k, suma: a.reduce((s, x) => s + x.n, 0) };
  }
  // (b) hermanos numericos del propio total.
  //
  // Preciso a proposito: un falso positivo retiene trabajo bueno, que es peor
  // que dejar pasar un caso. La primera version tomaba `soporta` y `pct` del
  // desglose de CDN como si fueran partes de `total` y gritaba siete veces
  // sobre datos correctos.
  //
  // Tres condiciones, y las tres hacen falta:
  //   - se descartan las claves que nunca son una parte (porcentajes, pesos)
  //   - tienen que quedar AL MENOS DOS hermanos: con uno solo no hay desglose
  //     que verificar, es un subconjunto (soporta 12 de 12)
  //   - ninguna parte puede exceder el total
  const NO_ES_PARTE = /^(pct|porcentaje|peso|pos|orden|version|anio|ano|year)$/i;
  const nums = Object.entries(o).filter(([k, v]) =>
    k !== 'total' && typeof v === 'number' && Number.isInteger(v) && !NO_ES_PARTE.test(k));
  if (nums.length >= 2 && nums.every(([, v]) => v <= o.total))
    return { via: nums.map(([k]) => k).join(' + '), suma: nums.reduce((s, [, v]) => s + v, 0) };
  return null;
}
function recorrer(o, ruta) {
  if (!o || typeof o !== 'object') return;
  if (Array.isArray(o)) return o.forEach((x, i) => recorrer(x, `${ruta}[${i}]`));
  if (typeof o.total === 'number') {
    const p = partes(o);
    if (!p) console.log(`  — ${ruta.padEnd(34)} declara total ${o.total} y no tiene partes sumables`);
    else if (p.suma !== o.total) {
      console.log(`  ✗ ${ruta.padEnd(34)} total ${o.total} · sus partes (${p.via}) suman ${p.suma}`);
      fallas++;
    } else console.log(`  ✓ ${ruta.padEnd(34)} total ${o.total} = suma de sus partes`);
  }
  for (const [k, v] of Object.entries(o)) recorrer(v, ruta ? `${ruta}.${k}` : k);
}
console.log('\ndesgloses que declaran un total:');
recorrer(edicion, '');


console.log(`\n${cubiertos} recomputados · ${saltados} sin cobertura · ${fallas} fallas`);
if (fallas) process.exit(1);
