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

/**
 * La frase del certificado que no se pudo leer (aprobada 18-nov-2026: «Sí, así queda»).
 * Se ARMA con las cifras de la edición, no se copia: el mes que cambien, el texto cambia con ellas.
 * El sello (textos/2026-11/certificado-sin-leer.md) cubre lo construido para 2026-11, byte a byte.
 * Sólo existe redacción aprobada para 1 sin leer (singular). 0: no hay nada que declarar, no va.
 * Más de 1: el build se cae hasta que Nicholas apruebe el plural.
 */
export function fraseCertificadoSinLeer(total, muestra, sinMedir) {
  if (sinMedir == null) return null;
  if (!Number.isInteger(total) || !Number.isInteger(muestra) || !Number.isInteger(sinMedir)) throw new Error("informe-textos: cifras del certificado sin leer no son enteros");
  if (total + sinMedir !== muestra) throw new Error(`informe-textos: ${total} leídos + ${sinMedir} sin leer ≠ muestra ${muestra}`);
  if (sinMedir === 0) return null;
  if (sinMedir !== 1) throw new Error(`informe-textos: ${sinMedir} certificados sin leer y la frase aprobada es singular; falta aprobar el plural`);
  return `${total} de ${muestra} organizaciones con certificado leído. De ${sinMedir} no se pudo leer el certificado y queda fuera de este desglose.`;
}

/**
 * Texto 5 (aprobado 18-nov; 19-nov: también en la web). La primera frase NO se toma de aquí: vive en la
 * edición (indice.hallazgo_cert.texto), con su cifra vigilada por el motor. De aquí sale sólo la frase de
 * cierre, la de NIST, del documento sellado (fila «Diría» del texto 5). null si la edición no la declara.
 */
export function cierreCertificados(edicion, aprobados, leer) {
  const a = aprobados.find((x) => x.edicion === edicion && x.seccion === "certificados-constante");
  if (!a) return null;
  const md = leerSellado(a, leer);
  const bloque = /### 5 ·[\s\S]*?\| \*\*Diría\*\* \| (.+?) \|/.exec(md);
  if (!bloque) throw new Error("informe-textos: no encuentro la fila «Diría» del texto 5");
  const m = /(Con la regla de NIST IR 8547[^.]*\.)\s*$/.exec(bloque[1]);
  if (!m) throw new Error("informe-textos: la fila «Diría» del texto 5 no cierra con la frase de NIST");
  return m[1];
}
