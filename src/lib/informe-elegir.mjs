/*
 * Qué edición del informe nacional se publica (13-nov-2026).
 *
 * Defecto real, dos veces: la página tomaba la edición de slug más alto (`ediciones[0]`) sin
 * mirar si estaba publicada. El 6-nov, un borrador de noviembre iba a bajar del aire el agosto
 * indexado; el 13-nov apareció en una rama un `2026-09.json` con la clave «SIMULADO» («datos
 * inventados para ver la mecánica»), que al fusionarse habría sido EL informe de Chile.
 *
 * `borrador` decide CÓMO se muestra una edición; esto decide CUÁL: la publicada más reciente
 * (`borrador === false`). Sólo si no hay ninguna publicada se muestra la más reciente, que por
 * la regla de falla cerrada sale con cartel y noindex. Un archivo que se declara simulado no
 * entra nunca: el build falla.
 *
 * PREVISUALIZAR UN BORRADOR (13-nov-2026, al imprimir el PDF de noviembre). Para mirar un
 * borrador habia que apartar las publicadas de la carpeta, y entonces `anterior` quedaba en
 * null: el PDF salia con los SIETE chips diciendo «linea base» y ni una comparacion contra
 * agosto — medido, no supuesto. Un informe cuya gracia es comparar, impreso sin comparar.
 *
 * Asi que la previsualizacion es un parametro EXPLICITO, no una heuristica: nombra el slug, y
 * las publicadas se quedan en la carpeta para que `anterior` exista. Tres cosas que NO cambia:
 * no toca `borrador`, asi que el cartel y el `noindex` siguen saliendo; no salta el chequeo de
 * «SIMULADO»; y un slug que no esta en la carpeta DETIENE el build en vez de caer de vuelta a
 * la publicada — una caida silenciosa haria que el PDF dijera noviembre mostrando agosto, que
 * es exactamente la divergencia que esto vino a cerrar.
 */
const SIMULADO = /^_?simulad[oa]s?$/i;

/** `ediciones` ordenadas de la más reciente a la más antigua: [{ slug, d }]. */
export function elegirEdicion(ediciones, { previsualizar = null } = {}) {
  for (const e of ediciones) {
    const clave = Object.keys(e.d || {}).find((k) => SIMULADO.test(k));
    if (clave) throw new Error(`informe-pqc: ${e.slug} se declara dato inventado («${clave}»). Una fija de prueba no vive en src/data/informe-pqc/.`);
  }
  if (previsualizar) {
    const j = ediciones.findIndex((e) => e.slug === previsualizar);
    if (j < 0) {
      throw new Error(`informe-pqc: se pidio previsualizar «${previsualizar}» y no esta en ` +
        `src/data/informe-pqc/ (hay: ${ediciones.map((e) => e.slug).join(", ") || "ninguna"}).`);
    }
    return { actual: ediciones[j], anterior: ediciones[j + 1] ?? null, previsualizando: true };
  }
  const i = ediciones.findIndex((e) => e.d.borrador === false);
  const k = i >= 0 ? i : 0;
  return { actual: ediciones[k], anterior: ediciones[k + 1] ?? null, previsualizando: false };
}
