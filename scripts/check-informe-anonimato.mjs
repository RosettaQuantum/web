#!/usr/bin/env node
/**
 * Los dos puntos legales del informe que se pueden poner en codigo.
 *
 * DE DONDE SALEN. La seccion 13 de la edicion lista seis puntos pendientes de
 * revision legal antes de publicar. Cuatro son juicio de una persona -como esta
 * redactado el metodo frente a la ley chilena, si los descargos alcanzan- y dos son
 * aritmetica:
 *
 *   punto 2: «Publicacion de agregados sectoriales sin nombrar organizaciones.»
 *   punto 3: «Umbral de anonimato: ninguna cifra sobre bases menores a ocho
 *             organizaciones.»
 *
 * Esos dos no pueden quedar en una revision que alguien hace leyendo: un punto que
 * se comprueba a ojo una vez no protege la edicion del mes siguiente (CLAUDE.md 4).
 *
 * MEDIDO EL 3-NOV-2026, antes de escribir el guardia: la edicion de agosto NO nombra
 * ninguna de las 220 organizaciones de la muestra -comprobado por nombre y por
 * dominio, cero de 220, por dos caminos distintos- y publicaba CUATRO cifras sobre
 * bases menores a ocho.
 *
 * EL 2026-11-04 SE CERRARON LAS CUATRO: tres se fundieron en la fila «Otros» del
 * desglose de CDN y la cuarta -el argumento del contrato de Akamai- se retiro. Las
 * fijas de la autoprueba siguen usando esos valores medidos (Imperva, total 4), no
 * literales inventados.
 */
import { readFileSync } from 'node:fs';

export const CONSUMIDOR = {
  quien: "sesion Q-Ready medicion",
  hace: "funde en «Otros» o retira la cifra con base menor a ocho organizaciones antes de publicar la edicion",
};

export const UMBRAL_ANONIMATO = 8;

// Las bases se declaran a mano, ruta por ruta. Un recorrido generico que gritara
// sobre cualquier entero chico gritaria sobre puntajes, pesos, anios y porcentajes:
// un falso positivo retiene trabajo bueno, que es peor que dejar pasar un caso.
// Cada entrada dice QUE cuenta, porque «8» solo tiene sentido si son organizaciones.
export const BASES_DE_ORGANIZACIONES = [
  { ruta: 'verticales[].nprobe',          leer: (e) => e.verticales.map((v) => [v.n, v.nprobe]) },
  { ruta: 'indice.verticales[].norg',     leer: (e) => e.indice.verticales.map((v) => [v.id ?? v.nombre, v.norg]) },
  { ruta: 'cdn.desglose[].total',         leer: (e) => e.cdn.desglose.map((d) => [d.prov ?? d.n, d.total]) },
  // `cdn.mismoProveedor` se RETIRO de la edicion el 2026-11-04, asi que su declaracion
  // tambien se retira. No es un hueco: la regla de que una ruta ausente es falla hizo
  // justo lo que debia -2 fallas en cuanto se quito el bloque- y obligo a este borrado
  // deliberado. Si la cifra vuelve el mes que su base llegue a ocho, vuelve aqui.
  { ruta: 'cdn.conCdn.n / sinCdn.n',      leer: (e) => [['con CDN', e.cdn.conCdn.n], ['sin CDN', e.cdn.sinCdn.n]] },
  { ruta: 'superficie[].n',               leer: (e) => e.superficie.map((s) => [s.rango, s.n]) },
];

// Un dominio dentro de la edicion es una organizacion nombrada, sin vuelta. Los de
// los proveedores (edgekey.net, akamaiedge.net) tampoco van: la edicion habla de
// proveedores por su nombre comercial, no por su dominio.
const FORMA_DE_DOMINIO = /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)*\.(?:cl|com|net|org|io|dev)\b/i;

export function evaluar(edicion) {
  const bajoUmbral = [];
  for (const b of BASES_DE_ORGANIZACIONES) {
    let pares;
    // Falla cerrado: una ruta declarada que ya no existe es una falla, no un salto.
    // Si no, basta con renombrar un campo para que el guardia deje de mirarlo.
    try { pares = b.leer(edicion); } catch { pares = null; }
    if (!Array.isArray(pares) || !pares.length) { bajoUmbral.push({ ruta: b.ruta, que: '(ruta ausente)', n: null }); continue; }
    for (const [que, n] of pares) {
      if (typeof n !== 'number') { bajoUmbral.push({ ruta: b.ruta, que, n: null }); continue; }
      if (n < UMBRAL_ANONIMATO) bajoUmbral.push({ ruta: b.ruta, que, n });
    }
  }

  const nombradas = [];
  const recorrer = (o, ruta) => {
    if (typeof o === 'string') { if (FORMA_DE_DOMINIO.test(o)) nombradas.push({ ruta, valor: o.slice(0, 70) }); return; }
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o)) recorrer(v, ruta ? `${ruta}.${k}` : k);
  };
  recorrer(edicion, '');
  return { bajoUmbral, nombradas };
}

// --- Corrida ------------------------------------------------------------------
const esSelfTest = process.argv.includes('--self-test');
const RUTA = 'src/data/informe-pqc';
const { readdirSync } = await import('node:fs');
const slug = readdirSync(RUTA).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().pop();
const edicion = JSON.parse(readFileSync(`${RUTA}/${slug}`, 'utf8'));
let fallas = 0;

if (esSelfTest) {
  // Grito y silencio por cada regla, sobre la edicion real y no sobre un literal.
  const casos = [];
  const c = (nombre, real, esperado) => { casos.push(nombre); if (real !== esperado) { console.log(`  ✗ ${nombre}`); fallas++; } else console.log(`  ✓ ${nombre}`); };

  const limpia = JSON.parse(JSON.stringify(edicion));
  // Para el silencio del umbral hay que subir las cuatro bases chicas de agosto: el
  // archivo real GRITA hoy, y eso es el hallazgo, no un defecto del guardia.
  for (const d of limpia.cdn.desglose) if (d.total < UMBRAL_ANONIMATO) d.total = 9;
  c('umbral: se calla con todas las bases en 9 o mas', evaluar(limpia).bajoUmbral.length, 0);

  // El caso de grito se arma poniendo de vuelta un valor MEDIDO, no uno inventado: 4
  // es lo que el artefacto conto para Akamai Standard TLS. Asi la prueba sigue siendo
  // valida cuando la edicion se corrija -antes afirmaba «cuatro bases chicas» y se
  // quedo vieja en cuanto se fundieron tres de ellas en «Otros»-.
  const conBaseChica = JSON.parse(JSON.stringify(limpia));
  conBaseChica.cdn.desglose.push({ n: 'Imperva', total: 4, soporta: 4, pct: 100, propio: false });
  c('umbral: grita con una base medida de 4', evaluar(conBaseChica).bajoUmbral.length, 1);

  const sinRuta = JSON.parse(JSON.stringify(limpia));
  delete sinRuta.cdn.conCdn.n;
  c('umbral: una ruta declarada que desaparece es falla', evaluar(sinRuta).bajoUmbral.length > 0, true);

  c('nombres: se calla con la edicion real (0 de 220)', evaluar(edicion).nombradas.length, 0);
  const conNombre = JSON.parse(JSON.stringify(limpia));
  conNombre.verticales[0].n = 'Fintech y pagos (ejemplo: www.bancoejemplo.cl)';
  c('nombres: grita con un dominio metido en una vertical', evaluar(conNombre).nombradas.length, 1);

  const hoy = evaluar(edicion);
  console.log(`\n  (estado del archivo de hoy, informado y no afirmado: ${hoy.bajoUmbral.length} bases bajo 8, ${hoy.nombradas.length} nombradas)`);
  console.log(`\n${casos.length} casos · ${fallas} fallas`);
  if (fallas) process.exit(1);
} else {
  const { bajoUmbral, nombradas } = evaluar(edicion);
  console.log(`edicion ${slug} · umbral de anonimato ${UMBRAL_ANONIMATO} organizaciones\n`);
  console.log('punto 2 · organizaciones nombradas:');
  if (!nombradas.length) console.log('  ✓ ninguna');
  for (const n of nombradas) { console.log(`  ✗ ${n.ruta} → "${n.valor}"`); fallas++; }
  console.log('\npunto 3 · cifras sobre bases menores a 8:');
  if (!bajoUmbral.length) console.log('  ✓ ninguna');
  for (const b of bajoUmbral) { console.log(`  ✗ ${b.ruta.padEnd(30)} ${String(b.que).padEnd(34)} n=${b.n ?? 'ausente'}`); fallas++; }
  console.log(`\n${fallas} fallas`);
  // NO CUBRE: un nombre de organizacion escrito en prosa sin su dominio -«Banco
  // Falabella»- pasa por aqui. Para eso hace falta la lista de la muestra, que vive
  // fuera de este repo (estudio-chile-resultados.json), y la comprobacion va en el
  // paso que arma la edicion, donde la muestra esta a mano.
  if (fallas) process.exit(1);
}
