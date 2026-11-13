/*
 * /.well-known/q-ready, versión 0 (13-nov-2026). Funciones puras: ni red ni página.
 * Lo usan el Worker (lib/qready-wellknown.mjs: servir el nuestro firmado y validar el de otros), el
 * cron de Q-Ready Verified (para la A+) y scripts/check-qready-wellknown.mjs.
 *
 * El documento es JSON. La firma es Ed25519 (RFC 8032) sobre la forma canónica del documento SIN el
 * campo signature.value: claves ordenadas, sin espacios (la misma canon() de qex-nucleo.mjs, que
 * coincide con JCS, RFC 8785, para cadenas, enteros, booleanos y null; v0 no admite decimales).
 * La llave pública se publica como JWK en signature.keys, una URL https del MISMO dominio.
 * La especificación completa: /q-ready/spec y docs/ietf/draft-rosetta-q-ready-00.md.
 */
import { canon } from "./qex-nucleo.mjs";

export const VERSION = "0";
export const RUTA = "/.well-known/q-ready";
export const RUTA_LLAVES = "/.well-known/q-ready-keys.json";
export const INVENTARIO = ["complete", "in_progress", "not_started"];
export const ESTADO_PROVEEDOR = ["pq_hybrid", "planned", "classical", "unknown"];
export const ROLES = ["edge", "certificates", "email", "payments", "identity", "hosting", "other"];
export const MAX_VIGENCIA_DIAS = 366;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;
const INSTANTE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/;
const DOMINIO = /^([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

const b64u = {
  de: (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  a: (s) => { const t = String(s).replace(/-/g, "+").replace(/_/g, "/"); const p = t + "=".repeat((4 - (t.length % 4)) % 4);
    return Uint8Array.from(atob(p), (c) => c.charCodeAt(0)); },
};

// Lo que se firma: el documento con signature SIN value.
export function aFirmar(doc) {
  const { signature, ...resto } = doc || {};
  const sinValor = signature && typeof signature === "object" ? Object.fromEntries(Object.entries(signature).filter(([k]) => k !== "value")) : signature;
  return canon(sinValor === undefined ? resto : { ...resto, signature: sinValor });
}

function hayDecimal(v) {
  if (typeof v === "number") return !Number.isInteger(v);
  if (Array.isArray(v)) return v.some(hayDecimal);
  if (v && typeof v === "object") return Object.values(v).some(hayDecimal);
  return false;
}

// Forma del documento. Devuelve la lista de problemas (vacía = bien formado). `ahora` en ISO.
export function validarForma(doc, ahora = new Date().toISOString()) {
  const e = [];
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) return ["el documento no es un objeto JSON"];
  if (doc.q_ready !== VERSION) e.push(`q_ready debe ser "${VERSION}"`);
  if (typeof doc.domain !== "string" || !DOMINIO.test(doc.domain)) e.push("domain: falta o no es un dominio");
  if (!Array.isArray(doc.contact) || !doc.contact.length || !doc.contact.every((c) => typeof c === "string" && /^(mailto:[^@\s]+@[^@\s]+|https:\/\/\S+)$/.test(c)))
    e.push("contact: lista de URIs mailto: o https:");
  if (doc.owner != null && typeof doc.owner !== "string") e.push("owner: texto");
  const inv = doc.inventory;
  if (!inv || !INVENTARIO.includes(inv.status)) e.push(`inventory.status: uno de ${INVENTARIO.join(", ")}`);
  if (inv && inv.as_of != null && !FECHA.test(inv.as_of)) e.push("inventory.as_of: fecha AAAA-MM-DD");
  if (!doc.migration || !FECHA.test(String(doc.migration.target_date || ""))) e.push("migration.target_date: fecha AAAA-MM-DD");
  if (!Array.isArray(doc.providers)) e.push("providers: lista");
  else doc.providers.forEach((p, i) => {
    if (!p || !ROLES.includes(p.role)) e.push(`providers[${i}].role: uno de ${ROLES.join(", ")}`);
    if (!p || !ESTADO_PROVEEDOR.includes(p.status)) e.push(`providers[${i}].status: uno de ${ESTADO_PROVEEDOR.join(", ")}`);
    if (p && p.target_date != null && !FECHA.test(p.target_date)) e.push(`providers[${i}].target_date: fecha AAAA-MM-DD`);
  });
  if (!INSTANTE.test(String(doc.expires || ""))) e.push("expires: instante UTC ISO 8601 (…Z)");
  else {
    if (doc.expires <= ahora) e.push("expires: el documento venció");
    const dias = (Date.parse(doc.expires) - Date.parse(ahora)) / 864e5;
    if (dias > MAX_VIGENCIA_DIAS) e.push(`expires: más de ${MAX_VIGENCIA_DIAS} días en el futuro`);
  }
  const s = doc.signature;
  if (!s || s.alg !== "Ed25519") e.push('signature.alg debe ser "Ed25519"');
  if (!s || typeof s.kid !== "string" || !s.kid) e.push("signature.kid: falta");
  if (!s || typeof s.value !== "string" || !/^[A-Za-z0-9_-]{86}$/.test(s.value)) e.push("signature.value: 64 bytes en base64url");
  if (!s || typeof s.keys !== "string") e.push("signature.keys: falta la URL de las llaves");
  else {
    let u = null; try { u = new URL(s.keys); } catch { /* abajo */ }
    if (!u || u.protocol !== "https:") e.push("signature.keys: URL https");
    else if (typeof doc.domain === "string" && !(u.hostname === doc.domain || u.hostname.endsWith("." + doc.domain))) e.push("signature.keys: tiene que estar en el mismo dominio");
  }
  if (hayDecimal(doc)) e.push("el documento no admite números decimales (v0)");
  return e;
}

export async function importarPublica(jwk) {
  return crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: jwk.x }, { name: "Ed25519" }, false, ["verify"]);
}

// ¿La firma es válida con alguna llave del juego (JWKS) que tenga el mismo kid?
export async function verificarFirma(doc, jwks) {
  const s = doc && doc.signature;
  if (!s || typeof s.value !== "string") return { ok: false, motivo: "sin firma" };
  const llaves = (jwks && Array.isArray(jwks.keys) ? jwks.keys : []).filter((k) => k && k.kty === "OKP" && k.crv === "Ed25519" && k.kid === s.kid && typeof k.x === "string");
  if (!llaves.length) return { ok: false, motivo: `no hay llave Ed25519 con kid «${s.kid}» en ${s.keys}` };
  let firma;
  try { firma = b64u.a(s.value); } catch { return { ok: false, motivo: "firma ilegible" }; }
  const datos = new TextEncoder().encode(aFirmar(doc));
  for (const k of llaves) {
    try { if (await crypto.subtle.verify({ name: "Ed25519" }, await importarPublica(k), firma, datos)) return { ok: true, kid: k.kid }; }
    catch { /* llave ilegible: se prueba la siguiente */ }
  }
  return { ok: false, motivo: "la firma no corresponde al documento" };
}

// Firma un documento (sin signature.value) con una llave privada JWK Ed25519.
export async function firmar(doc, privJwk) {
  const llave = await crypto.subtle.importKey("jwk", { kty: "OKP", crv: "Ed25519", x: privJwk.x, d: privJwk.d }, { name: "Ed25519" }, false, ["sign"]);
  const base = { ...doc, signature: { ...(doc.signature || {}) } };
  delete base.signature.value;
  const firma = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, llave, new TextEncoder().encode(aFirmar(base))));
  return { ...base, signature: { ...base.signature, value: b64u.de(firma) } };
}

export const llavePublica = (privJwk, kid) => ({ kty: "OKP", crv: "Ed25519", x: privJwk.x, kid, use: "sig", alg: "EdDSA" });

// Validación completa: forma + firma. Devuelve { valido, vigente, errores, firma }.
export async function validar(doc, jwks, ahora = new Date().toISOString()) {
  const errores = validarForma(doc, ahora);
  const firma = jwks ? await verificarFirma(doc, jwks) : { ok: false, motivo: "no se pudieron leer las llaves" };
  if (!firma.ok) errores.push(`firma: ${firma.motivo}`);
  const vigente = !!(doc && INSTANTE.test(String(doc.expires || "")) && doc.expires > ahora);
  return { valido: errores.length === 0, vigente, errores, firma };
}
