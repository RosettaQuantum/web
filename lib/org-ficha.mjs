// La ficha maestra de las organizaciones (18-nov-2026): de qué país es una organización, sin deducirlo
// del TLD. Encargo del 18-nov, aprobado por el dueño.
//
// EL DEFECTO. El país salía SÓLO del TLD (public/js/ficha.mjs → paisDeDominio). Las organizaciones
// chilenas con dominio .com del estudio (37 de 220) salían «país no determinado» y no se comparaban con
// su sector chileno. El orden ahora es: (1) esta ficha maestra, (2) el `pais` que declara quien consulta,
// (3) el TLD (Fi.resolverPais).
//
// LA LISTA NO SE PUBLICA. Vive en una tabla PRIVADA de D1 (db/org-ficha.schema.sql). La carga se genera
// fuera del repo desde el archivo sellado del estudio (el repo es público: check-sin-clientes). Lo único
// que sale de aquí es el código de país de UN dominio que alguien ya pidió medir.
//
// FALLA HACIA ATRÁS, NUNCA ROMPE. Si la tabla no existe, la base no responde o la fila trae basura,
// devuelve null y la medición sigue con el parámetro y luego con el TLD. Se dice en consola, no al usuario.
export async function fichaMaestra(db, dominio) {
  if (!db || !dominio) return null;
  try {
    const r = await db.prepare("SELECT pais, sector, fuente, actualizado FROM org_ficha WHERE dominio = ?1").bind(String(dominio).toLowerCase()).first();
    if (!r || !/^[A-Z]{2}$/.test(String(r.pais || ""))) return null;
    return { pais: r.pais, sector: r.sector ?? null, fuente: r.fuente ?? null, actualizado: r.actualizado ?? null };
  } catch (e) {
    console.error(`org_ficha: no se pudo leer (${(e && e.message) || e}); el país cae al parámetro y al TLD`);
    return null;
  }
}
