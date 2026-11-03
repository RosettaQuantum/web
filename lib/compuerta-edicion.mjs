#!/usr/bin/env node
/**
 * La compuerta de la edicion mensual: decide si una edicion puede publicarse sola
 * o necesita la aprobacion de Nicholas.
 *
 * LA DECISION QUE IMPLEMENTA, textual (Nicholas, 3-nov-2026): aprueba cada edicion
 * con una sola tabla, hasta DOS ediciones seguidas sin hallazgos de ninguna guardia;
 * despues la maquina publica sola. Y el contador va en codigo, no en un prompt.
 *
 * POR QUE EN CODIGO. Un contador que vive en una instruccion -«acuerdate de que ya
 * van dos»- no se puede probar con un caso positivo jamas: si un dia no retiene una
 * edicion, nadie sabe si fue porque estaba limpia o porque dejo de mirar. Aqui es una
 * funcion con su caso de grito, su caso de silencio y su mutacion.
 *
 * FALLA CERRADO, en cuatro formas, y las cuatro hacen falta:
 *
 *   1. Una edicion SIN registro de guardias no es una edicion limpia. Es la regla que
 *      mas se nota: basta con no correr el guardia para que la edicion parezca buena,
 *      y una ausencia que cuenta como pase es el defecto que esta casa ya pago varias
 *      veces (CLAUDE.md 5 quater).
 *   2. Una edicion con fallas no es limpia, obviamente.
 *   3. Una edicion cuya COBERTURA retrocedio no es limpia, aunque tenga cero fallas.
 *      Si el mes pasado tres cifras no eran recomputables y este mes son cinco, el
 *      verde cubre menos que antes y no significa lo mismo. Verde no es cubierto.
 *   4. Se cuentan las ediciones CONSECUTIVAS mas recientes. Dos limpias con una sucia
 *      en medio no son dos limpias: el contador se reinicia.
 *
 * QUE CUENTA COMO EDICION, y es una eleccion que conviene discutir y no deducir: solo
 * las que llegaron a `borrador: false`, o sea las que de verdad se publicaron. Una
 * edicion que paso las guardias y nunca salio no ejercio la cadena completa -no paso
 * por revision legal, ni por avisos, ni por la purga de cache-, asi que no es
 * evidencia de que la maquina pueda publicar sola. Es la lectura estricta de las dos
 * posibles; si Nicholas quiere la otra, se cambia una linea y su prueba.
 *
 * SU PUNTO CIEGO, declarado: esto cuenta lo que las guardias dijeron, no lo que la
 * medicion midio. Dos ediciones limpias no prueban que los numeros sean ciertos;
 * prueban que nadie encontro una contradiccion entre ellos. La compuerta no mira la
 * pantalla ni el mundo.
 *
 * Uso:
 *   node lib/compuerta-edicion.mjs              # estado de hoy
 *   node lib/compuerta-edicion.mjs --self-test  # grito, silencio y mutacion
 */

export const EDICIONES_LIMPIAS_EXIGIDAS = 2;

/**
 * @param registro  mapa `AAAA-MM` -> { fallas, sin_cobertura, recomputados }
 * @param ediciones lista de `{ slug, publicada }`, la MAS RECIENTE PRIMERO
 */
export function estadoDeLaCompuerta(registro, ediciones) {
  const publicadas = ediciones.filter((e) => e.publicada);
  const motivos = [];
  let limpias = 0;

  for (const [i, e] of publicadas.entries()) {
    const r = registro?.[e.slug];
    if (!r) { motivos.push(`${e.slug}: sin registro de guardias`); break; }
    if (r.fallas > 0) { motivos.push(`${e.slug}: ${r.fallas} hallazgo(s)`); break; }

    // La cobertura se compara contra la edicion publicada anterior, que es la
    // siguiente de la lista por venir ordenada de nueva a vieja.
    const previa = registro?.[publicadas[i + 1]?.slug];
    if (previa && r.sin_cobertura > previa.sin_cobertura) {
      motivos.push(`${e.slug}: la cobertura retrocedio (${previa.sin_cobertura} -> ${r.sin_cobertura} cifras sin recomputar)`);
      break;
    }
    limpias++;
  }

  const puede = limpias >= EDICIONES_LIMPIAS_EXIGIDAS;
  return {
    puede,
    limpias,
    exigidas: EDICIONES_LIMPIAS_EXIGIDAS,
    // El motivo nunca queda vacio: si no puede, dice por que se corto la racha, y si
    // se corto por falta de ediciones lo dice tambien en vez de callar.
    motivo: puede
      ? `${limpias} ediciones publicadas seguidas sin hallazgos`
      : (motivos[0] ?? `solo ${limpias} edicion(es) publicada(s) limpia(s) en el historial`),
  };
}

// --- Autoprueba ---------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  let fallas = 0, casos = 0;
  const comprobar = (nombre, real, esperado) => {
    const ok = real === esperado;
    casos++;
    if (!ok) fallas++;
    console.log(`  ${ok ? '✓' : '✗'} ${nombre.padEnd(52)} ${real}${ok ? '' : ` (esperado ${esperado})`}`);
  };
  const L = { fallas: 0, sin_cobertura: 3, recomputados: 5 };
  const ed = (...s) => s.map((x) => ({ slug: x, publicada: true }));

  // Silencio: dos publicadas limpias seguidas -> publica sola.
  comprobar('dos limpias seguidas: puede',
    estadoDeLaCompuerta({ '2026-10': L, '2026-09': L }, ed('2026-10', '2026-09')).puede, true);

  // Gritos, uno por cada forma de fallar cerrado.
  comprobar('una sola limpia: NO puede',
    estadoDeLaCompuerta({ '2026-10': L }, ed('2026-10')).puede, false);
  comprobar('sin registro de guardias: NO puede',
    estadoDeLaCompuerta({ '2026-09': L }, ed('2026-10', '2026-09')).puede, false);
  comprobar('con un hallazgo: NO puede',
    estadoDeLaCompuerta({ '2026-10': { ...L, fallas: 1 }, '2026-09': L }, ed('2026-10', '2026-09')).puede, false);
  comprobar('la cobertura retrocedio 3 -> 5: NO puede',
    estadoDeLaCompuerta({ '2026-10': { ...L, sin_cobertura: 5 }, '2026-09': L }, ed('2026-10', '2026-09')).puede, false);
  comprobar('la cobertura MEJORO 3 -> 1: si puede',
    estadoDeLaCompuerta({ '2026-10': { ...L, sin_cobertura: 1 }, '2026-09': L }, ed('2026-10', '2026-09')).puede, true);
  comprobar('una sucia en medio reinicia la racha: NO puede',
    estadoDeLaCompuerta({ '2026-11': L, '2026-10': { ...L, fallas: 2 }, '2026-09': L },
      ed('2026-11', '2026-10', '2026-09')).puede, false);
  comprobar('un borrador limpio NO cuenta como edicion',
    estadoDeLaCompuerta({ '2026-10': L, '2026-09': L },
      [{ slug: '2026-10', publicada: true }, { slug: '2026-09', publicada: false }]).puede, false);
  comprobar('sin ninguna publicada: NO puede',
    estadoDeLaCompuerta({}, []).puede, false);

  // El motivo nunca sale vacio, en ninguno de los dos caminos.
  comprobar('el motivo de un no siempre dice algo',
    estadoDeLaCompuerta({}, []).motivo.length > 0, true);

  console.log(`\n${casos} casos · ${fallas} fallas`);
  if (fallas) process.exit(1);
}

// --- Estado de hoy ------------------------------------------------------------
// Lee las ediciones del directorio de datos y el registro que deja el guardia. Es el
// mismo criterio de `index.astro` para el borrador -si el JSON no dice `false`, es
// borrador- y esta escrito aqui una sola vez a proposito: dos definiciones de «esta
// publicada» divergen el dia que alguien toque una.
const { pathToFileURL } = await import('node:url');
const corridoDirecto = process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url;
if (corridoDirecto && !process.argv.includes('--self-test')) {
  const { readFileSync, readdirSync } = await import('node:fs');
  const DIR = 'src/data/informe-pqc';
  const REGISTRO = 'src/data/registro-guardias-informe-pqc.json';
  const ediciones = readdirSync(DIR)
    .filter((f) => /^\d{4}-\d{2}\.json$/.test(f))
    .map((f) => {
      const d = JSON.parse(readFileSync(`${DIR}/${f}`, 'utf8'));
      return { slug: f.replace(/\.json$/, ''), publicada: d.borrador === false };
    })
    .sort((a, b) => b.slug.localeCompare(a.slug));
  let registro = {};
  try { registro = JSON.parse(readFileSync(REGISTRO, 'utf8')); } catch { /* sin registro */ }

  const e = estadoDeLaCompuerta(registro, ediciones);
  console.log('ediciones (de nueva a vieja):');
  for (const x of ediciones) {
    const r = registro[x.slug];
    console.log(`  ${x.slug}  ${x.publicada ? 'publicada' : 'borrador '}  ${r ? `${r.fallas} fallas · ${r.sin_cobertura} sin cobertura` : 'sin registro de guardias'}`);
  }
  console.log(`\nracha limpia: ${e.limpias} de ${e.exigidas} · ${e.motivo}`);
  console.log(e.puede
    ? 'La maquina PUEDE publicar sola.'
    : 'La edicion necesita la aprobacion de Nicholas.');
}
