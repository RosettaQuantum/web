/**
 * Verificador de sellos: la convencion canonica de Rosetta, en JavaScript.
 *
 * Vive en su propio modulo por dos razones. La primera es tecnica y la descubri
 * importandolo mal: estaba dentro de `check-quantum-catalog.mjs`, y ese archivo corre
 * 147 pruebas contra produccion al cargarse — importarlo para usar dos funciones
 * disparaba la suite entera. La segunda importa mas: el laboratorio va a usar esto para
 * validar el canonicalizador v3 desde afuera, y un verificador enterrado en un chequeo
 * no se puede reusar.
 *
 * Sus vectores estan en scripts/test-sello.mjs.
 */

/**
 * `json.dumps(obj, sort_keys=True, ensure_ascii=False)` de Python, en JS.
 *
 * Se implementa a mano a proposito: usar nuestro propio serializador seria comprobar
 * el sello contra si mismo.
 *
 * Y hay una trampa que costo encontrar. Python distingue int de float y escribe
 * `8.0`; JavaScript no, y escribe `8`. Como el sello se calcula sobre ESE texto,
 * un verificador que parsea el JSON y lo vuelve a serializar NO puede reproducir el
 * hash fuera de Python. Por eso aca los numeros se conservan como venian en el
 * archivo: `parseConLiterales` guarda el literal original en vez del valor.
 *
 * Esto es un limite REAL de la convencion del sello, no un detalle de este script.
 */
/** Un numero tal como venia escrito en el archivo: "8.0" no es lo mismo que "8". */
class NumeroLiteral { constructor(texto) { this.texto = texto; } }

export function pyDumps(v) {
  if (v === null) return "null";
  if (v instanceof NumeroLiteral) return v.texto;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(v);
  if (typeof v === "string") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(pyDumps).join(", ") + "]";
  return "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ": " + pyDumps(v[k])).join(", ") + "}";
}

/** JSON.parse que conserva el literal de cada numero. */
export function parseConLiterales(texto) {
  let i = 0;
  const blanco = () => { while (i < texto.length && /\s/.test(texto[i])) i++; };
  function valor() {
    blanco();
    const c = texto[i];
    if (c === "{") {
      i++; const o = {};
      blanco();
      if (texto[i] === "}") { i++; return o; }
      for (;;) {
        blanco();
        const k = cadena();
        blanco(); i++;                 // ':'
        o[k] = valor();
        blanco();
        if (texto[i] === ",") { i++; continue; }
        i++; return o;                 // '}'
      }
    }
    if (c === "[") {
      i++; const a = [];
      blanco();
      if (texto[i] === "]") { i++; return a; }
      for (;;) {
        a.push(valor());
        blanco();
        if (texto[i] === ",") { i++; continue; }
        i++; return a;                 // ']'
      }
    }
    if (c === '"') return cadena();
    if (texto.startsWith("true", i)) { i += 4; return true; }
    if (texto.startsWith("false", i)) { i += 5; return false; }
    if (texto.startsWith("null", i)) { i += 4; return null; }
    const ini = i;
    while (i < texto.length && /[-+0-9eE.]/.test(texto[i])) i++;
    return new NumeroLiteral(texto.slice(ini, i));
  }
  function cadena() {
    let out = ""; i++;                 // '"'
    while (texto[i] !== '"') {
      if (texto[i] === "\\") {
        const e = texto[i + 1];
        if (e === "u") { out += String.fromCharCode(parseInt(texto.slice(i + 2, i + 6), 16)); i += 6; continue; }
        out += { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", '"': '"', "\\": "\\", "/": "/" }[e] ?? e;
        i += 2; continue;
      }
      out += texto[i++];
    }
    i++; return out;
  }
  return valor();
}
