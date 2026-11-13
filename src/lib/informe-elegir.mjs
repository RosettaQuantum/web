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
 */
const SIMULADO = /^_?simulad[oa]s?$/i;

/** `ediciones` ordenadas de la más reciente a la más antigua: [{ slug, d }]. */
export function elegirEdicion(ediciones) {
  for (const e of ediciones) {
    const clave = Object.keys(e.d || {}).find((k) => SIMULADO.test(k));
    if (clave) throw new Error(`informe-pqc: ${e.slug} se declara dato inventado («${clave}»). Una fija de prueba no vive en src/data/informe-pqc/.`);
  }
  const i = ediciones.findIndex((e) => e.d.borrador === false);
  const k = i >= 0 ? i : 0;
  return { actual: ediciones[k], anterior: ediciones[k + 1] ?? null };
}
