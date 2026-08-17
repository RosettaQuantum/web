/**
 * Recomputar el sello EN EL NAVEGADOR del comprador.
 *
 * Este archivo es el producto. Todo lo demás de la consola muestra lo que decimos; esto
 * deja que el otro lo compruebe sin instalar nada, sin pedirnos permiso y sin creernos.
 *
 * LAS CUATRO CONVENCIONES, Y POR QUE HAY CUATRO
 * ---------------------------------------------
 * El archivo creció en cuatro etapas y lo sellado se sella una vez: no se re-sella para
 * uniformar, porque un hash publicado es un hecho público. Así que verificar significa
 * probar las cuatro y decir cuál reprodujo — que es lo que hace `verify_seals.py`.
 *
 *   v3            JCS (RFC 8785). Payload sin `content_hash` NI `schema`.
 *   v2            json.dumps de Python, separadores por omisión, sin `content_hash` ni `schema`.
 *   v1 canónica   igual que v2 pero conservando `schema`.
 *   v1 legada     separadores COMPACTOS, `content_hash: null` en vez de ausente, y
 *                 `ensure_ascii` por omisión — o sea, los no-ASCII escapados a \\uXXXX.
 *
 * DOS TRAMPAS QUE ME COSTARON UNA MEDICION MAL REPORTADA
 * ------------------------------------------------------
 * 1. Cada convención necesita SU lector. v1/v2 comparan contra el texto que produce
 *    Python, donde un float de valor entero es `8.0`; `JSON.parse` lo vuelve `8` y el
 *    literal se pierde para siempre. Por eso v1/v2 usan `parseConLiterales`. v3 es al
 *    revés: JCS normaliza, y necesita números de verdad — o sea `JSON.parse`.
 *    Usar un solo lector para todo da 0 de v3 o 0 de v1.
 * 2. La legada escapa los no-ASCII y `JSON.stringify` no. Ese solo detalle hacía que 29
 *    de 60 archivos parecieran no verificables cuando sí lo son.
 *
 * Medido sobre el archivo completo: las cuatro juntas verifican TODO lo publicado.
 */
import { jcs } from "./jcs.mjs";
import { pyDumps, parseConLiterales } from "./sello.mjs";

const quita = (o, ks) => Object.fromEntries(Object.entries(o).filter(([k]) => !ks.includes(k)));
const cuerpo = d => quita(d, ["meta", "storage"]);

const NO_ASCII = /[-￿]/g;
const asciiza = s => s.replace(NO_ASCII, c => "\\u" + c.charCodeAt(0).toString(16).padStart(4, "0"));

/** json.dumps(..., separators=(",",":")) con ensure_ascii por omisión. */
function compacto(v) {
  if (v === null) return "null";
  if (v && v.constructor && v.constructor.name === "NumeroLiteral") return v.texto;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number") return String(v);
  if (typeof v === "string") return asciiza(JSON.stringify(v));
  if (Array.isArray(v)) return "[" + v.map(compacto).join(",") + "]";
  return "{" + Object.keys(v).sort().map(k => asciiza(JSON.stringify(k)) + ":" + compacto(v[k])).join(",") + "}";
}

async function sha256(texto) {
  const buf = new TextEncoder().encode(texto);
  const h = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Verifica un archivo sellado contra el hash que declara.
 * `crudo` es el TEXTO tal como se bajó del espejo — no un objeto ya parseado, porque el
 * literal de los números se pierde al parsear y es justo lo que v1/v2 necesitan.
 *
 * Devuelve `{ ok, convencion, calculado, declarado, probadas }`.
 */
export async function verificarSello(crudo) {
  const lit = parseConLiterales(crudo);
  const pln = JSON.parse(crudo);
  const declarado = String(pln?.meta?.content_hash || "");
  const hex = declarado.replace(/^sha256:/, "");

  const recetas = {
    "v3 (JCS, RFC 8785)": () => jcs({ meta: quita(pln.meta, ["content_hash", "schema"]), ...cuerpo(pln) }),
    "v2":                 () => pyDumps({ meta: quita(lit.meta, ["content_hash", "schema"]), ...cuerpo(lit) }),
    "v1 canónica":        () => pyDumps({ meta: quita(lit.meta, ["content_hash"]), ...cuerpo(lit) }),
    "v1 legada":          () => lit.w6 === undefined ? null
                                : compacto({ meta: { ...lit.meta, content_hash: null }, w6: lit.w6 }),
  };

  const probadas = [];
  for (const [nombre, fn] of Object.entries(recetas)) {
    let texto = null;
    try { texto = fn(); } catch (e) { probadas.push({ nombre, error: e.message }); continue; }
    if (texto == null) { probadas.push({ nombre, error: "no aplica a este documento" }); continue; }
    const calculado = await sha256(texto);
    probadas.push({ nombre, calculado });
    if (calculado === hex) return { ok: true, convencion: nombre, calculado, declarado, probadas };
  }
  // Falla cerrado y con la evidencia: si ninguna reprodujo, se muestran las cuatro.
  return { ok: false, convencion: null, calculado: null, declarado, probadas };
}
