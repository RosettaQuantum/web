/**
 * RFC 8785 (JSON Canonicalization Scheme) en JavaScript.
 *
 * POR QUE EXISTE
 * --------------
 * El laboratorio diseño `rosettaq-archive/v3` sobre JCS y pidio que otra
 * implementacion, en otro lenguaje, lo confirme o lo contradiga antes de volverlo
 * convencion. Su razon es la correcta: **un formato canonico validado solo por quien
 * lo diseño es el mismo defecto que v3 viene a arreglar, un nivel mas arriba.**
 *
 * Escrito desde las reglas del RFC, sin mirar su implementacion.
 *
 * LAS CUATRO REGLAS, Y QUE HACE JS CON CADA UNA
 * ---------------------------------------------
 * 1. Sin espacios en blanco.                      -> se construye a mano.
 * 2. Claves ordenadas por UNIDADES UTF-16.        -> `Array.prototype.sort` por
 *    defecto compara cadenas justo asi. Ojo: NO es orden por code point, y ahi esta
 *    el caso con filo — un emoji (par suplente, unidades D83D/DE00) queda ANTES de
 *    U+FB33, mientras que por code point iria despues.
 * 3. Numeros con el algoritmo Number::toString de ECMAScript. -> es exactamente lo
 *    que hace `JSON.stringify`, asi que se delega.
 * 4. Cadenas con los escapes minimos y el no-ASCII LITERAL en UTF-8. -> tambien es
 *    lo que hace `JSON.stringify`.
 *
 * DIFERENCIA CLAVE CON v2, que conviene tener presente:
 * v2 preservaba el literal tal como venia en el archivo (`8.0` seguia siendo `8.0`).
 * JCS NORMALIZA: parsea a doble y re-serializa, asi que `8.0` pasa a `8` y `1e-06` a
 * `0.000001`. Es justo lo que hace que v3 sea reproducible fuera de Python.
 */

/** Canonicaliza un valor YA parseado. */
export function jcs(valor) {
  if (valor === null) return "null";
  const t = typeof valor;
  if (t === "boolean") return valor ? "true" : "false";
  if (t === "number") {
    if (!Number.isFinite(valor)) throw new Error(`JCS no admite ${valor}`);
    return JSON.stringify(valor);            // Number::toString de ECMAScript
  }
  if (t === "string") return JSON.stringify(valor);   // escapes minimos, no-ASCII literal
  if (Array.isArray(valor)) return "[" + valor.map(jcs).join(",") + "]";
  if (t === "object") {
    // Las claves se ordenan por unidades UTF-16, que es lo que hace sort() por defecto.
    // OJO: `Object.keys` adelanta las claves que parecen enteros ("1" antes que "a"),
    // pero como se ordena despues, el orden final no depende de eso.
    const claves = Object.keys(valor).sort();
    return "{" + claves.map(k => JSON.stringify(k) + ":" + jcs(valor[k])).join(",") + "}";
  }
  throw new Error(`JCS no admite el tipo ${t}`);
}

/** Canonicaliza desde el texto JSON. */
export function jcsDesdeTexto(texto) {
  return jcs(JSON.parse(texto));
}

/** sha256 del canonico, en el formato que usa el ledger. */
export async function selloJcs(valor) {
  const buf = new TextEncoder().encode(jcs(valor));
  const dig = await crypto.subtle.digest("SHA-256", buf);
  return "sha256:" + [...new Uint8Array(dig)].map(b => b.toString(16).padStart(2, "0")).join("");
}
