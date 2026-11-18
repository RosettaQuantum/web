/*
 * Textos aprobados por Nicholas que entran a UNA edición del informe (17-nov-2026).
 * El texto viaja por archivo, nunca copiado a mano: el .md se copia byte a byte desde el
 * documento aprobado y su sha256 queda en APROBADOS.json. Si una sola letra cambia, el
 * build se cae (falla cerrada): un texto aprobado que no es el aprobado no sale.
 * Sólo entra a la edición que lo declara: el párrafo de noviembre trae cifras de noviembre.
 */
import { createHash } from "node:crypto";

const escapar = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
/** Markdown en línea mínimo: **negrita** y `código`. Nada más, a propósito. */
export function enLinea(s) {
  return escapar(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/`([^`]+)`/g, '<code class="mono">$1</code>');
}

/** Lee los apartados «## Qué hicimos» y «## Qué NO hicimos». Cada uno, exactamente un párrafo. */
export function apartados(md) {
  const out = {};
  for (const [clave, titulo] of [["hicimos", "Qué hicimos"], ["no_hicimos", "Qué NO hicimos"]]) {
    const m = new RegExp(`^## ${titulo}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, "m").exec(md);
    if (!m) throw new Error(`informe-textos: falta el apartado «${titulo}»`);
    const parrafos = m[1].split(/\n\s*\n/).map((p) => p.trim().replace(/\s*\n\s*/g, " ")).filter(Boolean);
    if (parrafos.length !== 1) throw new Error(`informe-textos: «${titulo}» trae ${parrafos.length} párrafos y se aprobó uno`);
    out[clave] = parrafos[0];
  }
  return out;
}

export const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");

/** Lee un archivo aprobado y comprueba su sha256; un byte distinto tumba el build. */
function leerSellado(a, leer) {
  const md = leer(a.archivo);
  if (md == null) throw new Error(`informe-textos: falta ${a.archivo}`);
  const h = sha256(md);
  if (h !== a.sha256) throw new Error(`informe-textos: ${a.archivo} no es el aprobado (sha256 ${h.slice(0, 12)}… ≠ ${a.sha256.slice(0, 12)}…)`);
  return md;
}

/** La frase del apartado «## Frase»: exactamente un párrafo. */
export function frase(md) {
  const m = /^## Frase\s*$([\s\S]*?)(?=^## |(?![\s\S]))/m.exec(md);
  if (!m) throw new Error("informe-textos: falta el apartado «Frase»");
  const p = m[1].split(/\n\s*\n/).map((x) => x.trim().replace(/\s*\n\s*/g, " ")).filter(Boolean);
  if (p.length !== 1) throw new Error(`informe-textos: «Frase» trae ${p.length} párrafos y se aprobó uno`);
  return p[0];
}

/**
 * Textos de una edición. `aprobados` = APROBADOS.json; `leer(archivo)` devuelve el .md.
 * Devuelve { hicimos, no_hicimos } en HTML, o null si la edición no declara ninguno.
 */
export function textosDeEdicion(edicion, aprobados, leer) {
  const decl = aprobados.filter((a) => a.edicion === edicion && a.seccion === "legal");
  if (!decl.length) return null;
  if (decl.length > 1) throw new Error(`informe-textos: ${edicion} declara ${decl.length} textos para la sección legal; se espera uno`);
  const [a] = decl;
  const ap = apartados(leerSellado(a, leer));
  // La frase de rutas precisada (18-nov) también viaja sellada; si la edición no la declara, queda la original.
  const fr = aprobados.filter((x) => x.edicion === edicion && x.seccion === "legal-frase-rutas");
  if (fr.length > 1) throw new Error(`informe-textos: ${edicion} declara ${fr.length} frases de rutas`);
  const frase_rutas = fr.length ? enLinea(frase(leerSellado(fr[0], leer))) : null;
  return { hicimos: enLinea(ap.hicimos), no_hicimos: enLinea(ap.no_hicimos), frase_rutas, crudo: ap };
}
