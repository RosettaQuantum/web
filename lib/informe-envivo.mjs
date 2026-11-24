// Sondas del informe QEX EN VIVO (30-oct-2026): lo que el navegador no puede medir solo.
// POST /api/sondas {dominio, www, sensibles[]} → borde, certificado, endpoints, correo, security.txt.
//
// El descubrimiento por Certificate Transparency NO pasa por aquí: lo hace el navegador contra
// crt.sh (que admite CORS), y el cálculo del QEX vive en public/js/qex-nucleo.mjs. Este archivo
// sólo hace lo que exige un socket o una consulta sin CORS:
//   · borde       — medirBorde() de lib/borde-envivo.mjs, sin cambios (tres saludos TLS 1.3).
//   · certificado — UN saludo TLS 1.2: en 1.2 el certificado viaja en claro, así que se lee sin
//                   completar la conexión. Se lee la hoja: algoritmo, curva o bits, emisor, vigencia.
//   · endpoints   — por cada host sensible: DNS (¿sigue publicado?) y, si resuelve, un saludo TLS
//                   (¿responde en 443?). Mismo método que endpoints-sensibles-2026-10.json.
//   · correo      — registros MX → proveedor. security.txt — ¿existe un canal de reporte?
//   · ssh         — SÓLO en mediciones autorizadas (clave del cliente en el pedido, contra el
//                   secreto SONDAS_SSH_CLAVE). Lee el banner y el KEXINIT del puerto 22: ¿ofrece
//                   intercambio post-cuántico? Una conexión por host, sin intentar entrar.
//                   Sin secreto configurado, nunca corre. La página pública no lo pide.
//
// Regla de la casa que este archivo no rompe: lo que no se pudo medir vuelve null con su error,
// nunca como «no». Y no guarda nada: ni D1 ni caché, salvo el contador por IP.

import { connect } from "cloudflare:sockets";
import { medirBorde, saludo, normalizarHost, permitido, TODOS, SOLO_HIB } from "./borde-envivo.mjs";
import { completarConVps } from "./sonda-tls-vps.mjs";
import { leerBanner, paqueteCompleto, evaluarSsh } from "./ssh-kex.mjs";
import { dominioPublico, dominioVerificado } from "./qready-verificado.mjs";
import { hojaTls13 } from "./tls13-certificado.mjs";
import { nombrador, enmascararEndpoints } from "../public/js/ficha.mjs";
// El tope de nombres por medición: UNA definición (qex-nucleo.mjs), la misma que usa nombresASondear y
// que publica la rúbrica. Antes era un 15 escrito aquí, otro en lib/sonda-tls-vps.mjs y un 17 en el VPS.
import { MAX_SONDEADOS } from "../public/js/qex-nucleo.mjs";
import { proveedorMx } from "./proveedores-catalogo.mjs";

const ESPERA_MS = 8000;
const MAX_SENSIBLES = MAX_SONDEADOS;
const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u24 = (n) => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const azar = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)));
const ext = (t, d) => [...u16(t), ...u16(d.length), ...d];

// ---------------------------------------------------------------- certificado por TLS 1.2
export function clientHello12(host) {
  const hn = Array.from(new TextEncoder().encode(host));
  // ECDSA primero, como un navegador: si el servidor tiene certificado ECDSA y RSA, entrega el ECDSA.
  const suites = [0xc02b, 0xc02c, 0xcca9, 0xc02f, 0xc030, 0xcca8, 0xc009, 0xc013, 0x009c, 0x002f];
  let body = [0x03, 0x03, ...azar(32), 0x00];
  body.push(...u16(suites.length * 2), ...suites.flatMap(u16), 0x01, 0x00);
  let exts = ext(0x0000, [...u16(hn.length + 3), 0x00, ...u16(hn.length), ...hn]);
  const sg = [0x001d, 0x0017, 0x0018].flatMap(u16);
  exts = exts.concat(ext(0x000a, [...u16(sg.length), ...sg]));
  exts = exts.concat(ext(0x000b, [0x01, 0x00]));                       // ec_point_formats
  const sa = [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601].flatMap(u16);
  exts = exts.concat(ext(0x000d, [...u16(sa.length), ...sa]));
  exts = exts.concat(ext(0x0017, []));                                 // extended_master_secret
  exts = exts.concat(ext(0xff01, [0x00]));                             // renegotiation_info
  body = body.concat(u16(exts.length), exts);
  const hs = [0x01, ...u24(body.length), ...body];
  return new Uint8Array([0x16, 0x03, 0x01, ...u16(hs.length), ...hs]);
}

// DER mínimo: lo justo para llegar a emisor, vigencia y llave pública de la hoja.
function tlv(b, i) {
  const tag = b[i]; let len = b[i + 1], off = i + 2;
  if (len & 0x80) { const n = len & 0x7f; len = 0; for (let k = 0; k < n; k++) len = len * 256 + b[off + k]; off += n; }
  return { tag, ini: off, fin: off + len, sig: off + len };
}
const hijos = (b, t) => { const o = []; for (let i = t.ini; i < t.fin;) { const h = tlv(b, i); o.push(h); i = h.sig; } return o; };
function oid(b, t) {
  const v = b.subarray(t.ini, t.fin); const p = [Math.floor(v[0] / 40), v[0] % 40]; let n = 0;
  for (let i = 1; i < v.length; i++) { n = n * 128 + (v[i] & 0x7f); if (!(v[i] & 0x80)) { p.push(n); n = 0; } }
  return p.join(".");
}
const texto = (b, t) => new TextDecoder().decode(b.subarray(t.ini, t.fin));
function fecha(b, t) {
  let s = texto(b, t);
  if (t.tag === 0x17) s = (Number(s.slice(0, 2)) < 50 ? "20" : "19") + s;   // UTCTime
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}T${s.slice(8, 10)}:${s.slice(10, 12)}:${s.slice(12, 14)}Z`;
}
function atributo(b, nombre, oidBuscado) {
  for (const set of hijos(b, nombre)) for (const atv of hijos(b, set)) {
    const [o, v] = hijos(b, atv);
    if (o && v && oid(b, o) === oidBuscado) return texto(b, v);
  }
  return null;
}
const CURVAS = { "1.2.840.10045.3.1.7": ["P-256", 256], "1.3.132.0.34": ["P-384", 384], "1.3.132.0.35": ["P-521", 521] };
const FIRMAS = { "1.2.840.10045.4.3.2": "ecdsa-with-SHA256", "1.2.840.10045.4.3.3": "ecdsa-with-SHA384",
  "1.2.840.10045.4.3.4": "ecdsa-with-SHA512", "1.2.840.113549.1.1.11": "sha256WithRSAEncryption",
  "1.2.840.113549.1.1.12": "sha384WithRSAEncryption", "1.2.840.113549.1.1.13": "sha512WithRSAEncryption",
  "1.2.840.113549.1.1.10": "rsassa-pss", "1.3.101.112": "ed25519" };
// Las firmas post-cuánticas de NIST IR 8547 final, tabla 3 (18-nov-2026): ML-DSA (FIPS 204), SLH-DSA (FIPS 205),
// LMS/HSS y XMSS/XMSS^MT (SP 800-208). El mismo OID va en la llave (SPKI) y en la firma. Fuentes copiadas por
// script, con su sha256, en docs/fuentes/regla-llave-2026-11-18.md:
//  · ML-DSA y SLH-DSA: el registro de NIST (CSOR, «Digital Signature Algorithms Registered Objects»):
//    «nistAlgorithms OBJECT IDENTIFIER ::= { joint-iso-ccitt(2) country(16) us(840) organization(1) gov(101)
//    csor(3) nistAlgorithm(4) }», «sigAlgs OBJECT IDENTIFIER ::= { nistAlgorithms 3 }»; id-ml-dsa-44/65/87 =
//    { sigAlgs 17/18/19 }; id-hash-ml-dsa-*-with-sha512 = { sigAlgs 32/33/34 }; id-slh-dsa-* = { sigAlgs 20…31 };
//    id-hash-slh-dsa-* = { sigAlgs 35…46 }.
//  · HSS/LMS: RFC 9708 y RFC 9802 §4.1, id-alg-hss-lms-hashsig = { iso(1) member-body(2) us(840) rsadsi(113549)
//    pkcs(1) pkcs9(9) smime(16) alg(3) 17 }.
//  · XMSS y XMSS^MT: RFC 9802 §4.2-4.3, id-alg-xmss-hashsig / id-alg-xmssmt-hashsig = { iso(1)
//    identified-organization(3) dod(6) internet(1) security(5) mechanisms(5) pkix(7) algorithms(6) 34 / 35 }.
// Cada entrada: [familia, juego de parámetros, fuerza clásica de IR 8547 tabla 3]. En HSS/LMS y XMSS el juego
// (hash y altura) va dentro de la llave, no en el OID: la fuerza queda null («no leída»), y vale igual 100.
const SLH = ["sha2-128s", "sha2-128f", "sha2-192s", "sha2-192f", "sha2-256s", "sha2-256f", "shake-128s", "shake-128f", "shake-192s", "shake-192f", "shake-256s", "shake-256f"];
const fuerzaSlh = (p) => Number(/-(128|192|256)[sf]$/.exec(p)[1]);
export const FIRMAS_PQ_OID = Object.freeze({
  "2.16.840.1.101.3.4.3.17": ["ML-DSA", "ML-DSA-44", 128], "2.16.840.1.101.3.4.3.18": ["ML-DSA", "ML-DSA-65", 192], "2.16.840.1.101.3.4.3.19": ["ML-DSA", "ML-DSA-87", 256],
  "2.16.840.1.101.3.4.3.32": ["ML-DSA", "HashML-DSA-44", 128], "2.16.840.1.101.3.4.3.33": ["ML-DSA", "HashML-DSA-65", 192], "2.16.840.1.101.3.4.3.34": ["ML-DSA", "HashML-DSA-87", 256],
  ...Object.fromEntries(SLH.map((p, i) => [`2.16.840.1.101.3.4.3.${20 + i}`, ["SLH-DSA", `SLH-DSA-${p.toUpperCase()}`, fuerzaSlh(p)]])),
  ...Object.fromEntries(SLH.map((p, i) => [`2.16.840.1.101.3.4.3.${35 + i}`, ["SLH-DSA", `HashSLH-DSA-${p.toUpperCase()}`, fuerzaSlh(p)]])),
  "1.2.840.113549.1.9.16.3.17": ["HSS/LMS", "HSS/LMS", null],
  "1.3.6.1.5.5.7.6.34": ["XMSS", "XMSS", null], "1.3.6.1.5.5.7.6.35": ["XMSS^MT", "XMSS^MT", null],
});
for (const [o, [, nombre]] of Object.entries(FIRMAS_PQ_OID)) FIRMAS[o] = nombre.toLowerCase();

export function leerHoja(der) {
  const cert = tlv(der, 0); const [tbs, algFirma] = hijos(der, cert);
  let c = hijos(der, tbs); if (c[0].tag === 0xa0) c = c.slice(1);       // [0] versión
  const [, , emisor, vigencia, sujeto, spki] = c;
  const [nb, na] = hijos(der, vigencia);
  const [algId, llave] = hijos(der, spki);
  const [algOid, param] = hijos(der, algId);
  const out = { firma: FIRMAS[oid(der, hijos(der, algFirma)[0])] || oid(der, hijos(der, algFirma)[0]),
    emisor: atributo(der, emisor, "2.5.4.10") || atributo(der, emisor, "2.5.4.3"),
    sujeto: atributo(der, sujeto, "2.5.4.3"), not_before: fecha(der, nb), not_after: fecha(der, na),
    algoritmo: null, curva: null, bits: null };
  const a = oid(der, algOid);
  if (a === "1.2.840.10045.2.1") {
    out.algoritmo = "EC"; const cv = param && param.tag === 0x06 ? CURVAS[oid(der, param)] : null;
    if (cv) [out.curva, out.bits] = cv;
  } else if (a === "1.2.840.113549.1.1.1" || a === "1.2.840.113549.1.1.10") {
    out.algoritmo = "RSA";
    const rsa = tlv(der, llave.ini + 1);                                  // BIT STRING: 1 byte de relleno
    const n = hijos(der, rsa)[0]; let i = n.ini; while (der[i] === 0) i++;
    out.bits = (n.fin - i - 1) * 8 + (32 - Math.clz32(der[i]));
  } else if (a === "1.3.101.112") { out.algoritmo = "Ed25519"; out.bits = 256; }
  else if (FIRMAS_PQ_OID[a]) { [out.algoritmo, out.curva, out.bits] = FIRMAS_PQ_OID[a]; }   // curva = el juego de parámetros
  else out.algoritmo = a;
  return out;
}

// B1 (16-nov-2026): si el servidor no acepta TLS 1.2 (alerta), la hoja se lee por TLS 1.3 (lib/tls13-certificado.mjs).
// `abrir` sólo se sustituye en la prueba (scripts/check-tls13-certificado.mjs), que levanta servidores reales.
const abrirSocket = async (host, puerto) => connect({ hostname: host, port: puerto });
export const METODO_TLS13 = "saludo TLS 1.3; se descifra el saludo hasta la hoja que entrega el servidor (sin completar la sesión)";
export async function leerCertificado(host, abrir12 = null, abrir13 = abrirSocket) {
  const r = await leerCertificado12(host, abrir12);
  if (r.ok || !/^alerta TLS/.test(String(r.error || ""))) return r;
  const t0 = Date.now();
  try {
    const { der } = await hojaTls13(host, abrir13, ESPERA_MS);
    return { host, ok: true, metodo: METODO_TLS13, error: null, ...leerHoja(der), ms: Date.now() - t0, medido_desde: "worker", tls12: r.error };
  } catch (e) {
    return { ...r, error: `${r.error}; por TLS 1.3: ${String((e && e.message) || e)}` };
  }
}
async function leerCertificado12(host, abrir = null) {
  const t0 = Date.now();
  const out = { host, ok: false, metodo: "saludo TLS 1.2; se lee la hoja que entrega el servidor", error: null, ms: null, medido_desde: "worker" };
  let socket;
  const tarea = (async () => {
    socket = abrir ? await abrir(host, 443) : connect({ hostname: host, port: 443 });
    const w = socket.writable.getWriter(); await w.write(clientHello12(host)); w.releaseLock();
    const r = socket.readable.getReader();
    let buf = new Uint8Array(0), hs = new Uint8Array(0);
    const juntar = (a, b) => { const n = new Uint8Array(a.length + b.length); n.set(a); n.set(b, a.length); return n; };
    for (;;) {
      while (buf.length < 5 || buf.length < 5 + ((buf[3] << 8) | buf[4])) {
        const { value, done } = await r.read(); if (done) throw new Error("el servidor cerró antes del certificado");
        buf = juntar(buf, value);
        if (buf.length > 200000) throw new Error("respuesta demasiado larga");
      }
      const tipo = buf[0], largo = (buf[3] << 8) | buf[4];
      const cuerpo = buf.subarray(5, 5 + largo); buf = buf.subarray(5 + largo);
      if (tipo === 0x15) throw new Error(`alerta TLS ${cuerpo[0]}/${cuerpo[1]} (el servidor no aceptó TLS 1.2)`);
      if (tipo !== 0x16) throw new Error(`registro inesperado ${tipo}`);
      hs = juntar(hs, cuerpo);
      for (let i = 0; i + 4 <= hs.length;) {
        const t = hs[i], l = (hs[i + 1] << 16) | (hs[i + 2] << 8) | hs[i + 3];
        if (i + 4 + l > hs.length) break;
        if (t === 0x0b) {
          const m = hs.subarray(i + 4, i + 4 + l), l1 = (m[3] << 16) | (m[4] << 8) | m[5];
          Object.assign(out, leerHoja(m.subarray(6, 6 + l1)), { ok: true });
          return;
        }
        if (t === 0x0e) throw new Error("el servidor terminó el saludo sin enviar certificado");
        i += 4 + l;
      }
    }
  })();
  try {
    await Promise.race([tarea, new Promise((_, no) => setTimeout(() => no(new Error(`sin respuesta en ${ESPERA_MS / 1000} s`)), ESPERA_MS))]);
  } catch (e) { out.error = String((e && e.message) || e); }
  finally { try { socket && socket.close(); } catch {} out.ms = Date.now() - t0; }
  return out;
}

// ---------------------------------------------------------------- DNS, endpoints, correo
const STATUS = { 0: "NOERROR", 2: "SERVFAIL", 3: "NXDOMAIN", 5: "REFUSED" };
export async function dns(nombre, tipo) {
  const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(nombre)}&type=${tipo}`,
    { headers: { accept: "application/dns-json" } });
  if (!r.ok) throw new Error(`DoH ${r.status}`);
  const j = await r.json();
  return { status: STATUS[j.Status] || `RCODE ${j.Status}`, answer: j.Answer || [] };
}

// Lo que dicen los saludos A y B de un nombre. La usa también lib/sonda-tls-vps.mjs con los saludos
// del VPS: una sola lectura. Una alerta TLS también es respuesta (el servidor está ahí); sólo el
// silencio o el corte son «no responde». hibrido: true/false sólo si B contestó; si no, null.
export function endpointDeSaludos(s, b) {
  return {
    responde_443: !s.error,
    detalle: s.error ? `sin respuesta TLS en 443 (${s.error})` : s.alerta ? `responde con ${s.alerta}` : `responde; grupo ${s.grupo}`,
    hibrido: s.error || !b || b.error ? null : b.grupo === "X25519MLKEM768",
  };
}

// El código HTTP de la raíz (16-nov-2026, aprobado por el dueño): un ambiente de pruebas que responde
// 403 está «publicado con el acceso bloqueado» (alerta media), no «expuesto» (F). Un GET a «/» SIN seguir
// redirecciones —el mismo nivel de intrusión que un navegador—, sin leer el cuerpo y con tope de 5 s.
// null = no se obtuvo código (corte, error TLS de fetch): la nota lo lee como hoy, «responde» → grave.
const HTTP_MS = 6000;
const HTTP_A_LA_VEZ = 4;
export async function codigoHttp(host, fetchImpl = fetch) {
  // Una línea por GET: es la evidencia en el terreno (wrangler tail) de a quién se le pidió la página.
  console.log(JSON.stringify({ sonda: "get_raiz", host }));
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), HTTP_MS);
  try {
    const r = await fetchImpl(`https://${host}/`, { method: "GET", redirect: "manual", signal: ctl.signal,
      headers: { "user-agent": "RosettaQ-Ready/1.0 (+https://rosettaquantum.com/q-ready)" } });
    try { await r.body?.cancel(); } catch {}
    return { http_status: Number.isInteger(r.status) && r.status > 0 ? r.status : null, http_error: null };
  } catch (e) {
    return { http_status: null, http_error: e.name === "AbortError" ? "no respondió a tiempo" : String(e.message || e) };
  } finally { clearTimeout(t); }
}

export async function sondaEndpoint(host) {
  const out = { host, medido_utc: new Date().toISOString(), dns_status: null, ip: [], cname: [], responde_443: null, detalle: null,
    hibrido: null, http_status: null, medido_desde: "worker" };
  try {
    const d = await dns(host, "A");
    out.dns_status = d.status;
    out.ip = d.answer.filter((a) => a.type === 1).map((a) => a.data);
    out.cname = d.answer.filter((a) => a.type === 5).map((a) => String(a.data).replace(/\.$/, ""));
  } catch (e) { out.detalle = `DNS sin respuesta: ${e.message || e}`; return out; }
  if (out.dns_status === "NXDOMAIN") { out.detalle = "el nombre ya no existe en DNS: no se envió saludo"; return out; }
  if (!out.ip.length && !out.cname.length) { out.detalle = `DNS ${out.dns_status} sin direcciones: no se envió saludo`; return out; }
  // A (todos los grupos + llave x25519) dice si responde; B (SÓLO el híbrido, llave vacía) dice si lo
  // SOPORTA (13-nov-2026, aprobado: sin B por nombre la nota A no era alcanzable). Misma regla que el borde.
  const [s, b] = await Promise.all([saludo(host, TODOS, true), saludo(host, SOLO_HIB, false)]);
  return Object.assign(out, endpointDeSaludos(s, b));
}

// El código HTTP se pide DESPUÉS de los saludos, sólo a los nombres que respondieron (también los que
// completó el VPS: fetch sí llega detrás de Cloudflare), de a HTTP_A_LA_VEZ. Medido el 16-nov en el
// preview: pedido en paralelo con los saludos, un nombre que contesta 403 en 0,4 s se quedaba sin código
// 2 de 3 veces («no respondió a tiempo»): un Worker abre 6 conexiones a la vez y el GET esperaba en
// cola detrás de los sockets, con su reloj corriendo. Sin código, la nota lo lee como hoy (grave).
export async function conCodigoHttp(endpoints, fetchImpl = fetch) {
  const out = endpoints.map((e) => ({ ...e, http_status: e.http_status ?? null, http_consultado: e.responde_443 === true }));
  const cola = out.filter((e) => e.responde_443 === true);
  const trabajar = async () => {
    for (let e = cola.shift(); e; e = cola.shift()) {
      const h = await codigoHttp(e.host, fetchImpl);
      e.http_status = h.http_status;
      if (h.http_error) e.http_error = h.http_error;
    }
  };
  await Promise.all(Array.from({ length: HTTP_A_LA_VEZ }, trabajar));
  return out;
}

// El proveedor de cada MX vive en lib/proveedores-catalogo.mjs desde el 24-nov-2026 (RQ.T): una sola
// tabla para la ficha y para el descubrimiento de proveedores. Se re-exporta con el mismo nombre.
export { proveedorMx };

export async function correo(dominio) {
  try {
    const d = await dns(dominio, "MX");
    const mx = d.answer.filter((a) => a.type === 15).map((a) => String(a.data).split(" ").pop().replace(/\.$/, "")).sort();
    return { mx, proveedor: mx.length ? [...new Set(mx.map(proveedorMx))].join(" + ") : null, error: null };
  } catch (e) { return { mx: [], proveedor: null, error: String(e.message || e) }; }
}

// ---------------------------------------------------------------- SSH (sólo autorizado)
export async function sondaSsh(host) {
  const t0 = Date.now();
  const out = { host, puerto: 22, medido_utc: new Date().toISOString(), ok: false, error: null, ms: null };
  let socket;
  const tarea = (async () => {
    socket = connect({ hostname: host, port: 22 });
    const w = socket.writable.getWriter();
    await w.write(new TextEncoder().encode("SSH-2.0-RosettaQReady_1.0\r\n")); w.releaseLock();
    const r = socket.readable.getReader();
    let buf = new Uint8Array(0);
    for (;;) {
      const b = leerBanner(buf);
      if (b && paqueteCompleto(b.resto) !== null) { Object.assign(out, evaluarSsh(buf), { ok: true }); return; }
      const { value, done } = await r.read();
      if (done) throw new Error("el servidor cerró antes de enviar su lista de algoritmos");
      const n = new Uint8Array(buf.length + value.length); n.set(buf); n.set(value, buf.length); buf = n;
      if (buf.length > 40000) throw new Error("respuesta demasiado larga");
    }
  })();
  try {
    await Promise.race([tarea, new Promise((_, no) => setTimeout(() => no(new Error(`sin respuesta en ${ESPERA_MS / 1000} s`)), ESPERA_MS))]);
  } catch (e) { out.error = String((e && e.message) || e); }
  finally { try { socket && socket.close(); } catch {} out.ms = Date.now() - t0; }
  return out;
}

/** Comparación en tiempo constante: la clave no se adivina midiendo cuánto tarda el rechazo. */
async function claveValida(dada, secreto) {
  if (typeof dada !== "string" || !dada || !secreto) return false;
  const h = async (x) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(x)));
  const [a, b] = await Promise.all([h(dada), h(secreto)]);
  let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

export async function securityTxt(dominio, www) {
  const intentos = [];
  for (const h of [...new Set([dominio, www])]) {
    const url = `https://${h}/.well-known/security.txt`;
    try {
      const r = await fetch(url, { redirect: "follow", headers: { "user-agent": "RosettaQ-Ready/1.0 (+https://rosettaquantum.com/q-ready)" } });
      const t = r.ok ? (await r.text()).slice(0, 20000) : "";
      const ok = r.ok && /^\s*contact\s*:/im.test(t);
      intentos.push({ url, status: r.status, contact: ok });
      if (ok) return { publicado: true, url: r.url, intentos };
    } catch (e) { intentos.push({ url, error: String(e.message || e) }); }
  }
  // «No publicado» sólo con una respuesta que lo diga: 404, o 200 sin línea Contact (una página
  // cualquiera). Un 403 o un 5xx es un portero o una falla: no se sabe, y se dice null.
  const dice = (i) => i.status === 404 || i.status === 410 || (i.status === 200 && !i.contact);
  return { publicado: intentos.some(dice) ? false : null, url: null, intentos };
}

export async function getRaizPermitido(env, dominio) {
  try { return !!(await dominioPublico(env && env.DB, dominio, "produccion")); } catch { return false; }
}
export async function endpointsConRaiz(env, dominio, endpoints, fetchImpl = fetch) {
  const getPermitido = await getRaizPermitido(env, dominio);
  return { getPermitido, endpoints: getPermitido ? await conCodigoHttp(endpoints, fetchImpl)
    : endpoints.map((e) => ({ ...e, http_status: null, http_consultado: false })) };
}

// /api/sondas para quien no es dueño verificado (17-nov-2026): cada nombre enmascarado con el MISMO
// nombrador que la API, la ficha y la página, más su posición `i` en la lista TAL COMO LLEGÓ (`pedidos`,
// antes de filtrar y deduplicar): la página reasocia por esa posición (ver ficha.mjs → reasociar).
export function sondasParaTercero(endpoints, pedidos, dominio, www) {
  const norm = pedidos.map((p) => normalizarHost(p));
  const ver = nombrador(dominio, false, [dominio, www, ...norm.filter(Boolean)]);
  return enmascararEndpoints(endpoints, ver).map((e, k) => ({ ...e, i: norm.indexOf(endpoints[k].host) }));
}

// opciones.interno: la llamada viene del propio servidor (lib/medicion-agentes.mjs → tomarFoto), que
// necesita los nombres completos para su foto y enmascara su respuesta él mismo.
export async function manejarSondas(request, env = {}, { interno = false } = {}) {
  const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), {
    status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST con {\"dominio\", \"www\", \"sensibles\": []}." }, 405);
  const c = await request.json().catch(() => ({}));
  const dominio = normalizarHost(c.dominio), www = normalizarHost(c.www || (c.dominio && "www." + c.dominio));
  if (!dominio || !www) return json({ ok: false, error: "Escribe un dominio público, por ejemplo ejemplo.cl." }, 400);
  if (!(www === dominio || www.endsWith("." + dominio))) return json({ ok: false, error: "El sitio tiene que ser del mismo dominio." }, 400);
  const pedidos = Array.isArray(c.sensibles) ? c.sensibles : [];
  // Sólo nombres del dominio medido: la página no sirve para sondear hosts ajenos.
  const sensibles = [...new Set(pedidos.map(normalizarHost).filter((h) => h && h.endsWith(dominio)))];
  if (sensibles.length > MAX_SENSIBLES) return json({ ok: false, error: `Como máximo ${MAX_SENSIBLES} endpoints por medición.` }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (!(await permitido(ip, "__rl-sondas", 4))) return json({ ok: false, error: "Demasiadas mediciones seguidas. Espera un minuto." }, 429);
  // SSH sólo con clave válida. Un pedido con clave equivocada se rechaza entero: medir a medias
  // sin decirlo haría que el informe leyera «sin SSH» donde hubo un rechazo.
  const pideSsh = c.ssh_clave !== undefined;
  if (pideSsh && !(await claveValida(c.ssh_clave, env.SONDAS_SSH_CLAVE)))
    return json({ ok: false, error: "La clave para medir SSH no es válida. La medición de SSH sólo corre con autorización del dueño del dominio." }, 403);
  const hostsSsh = pideSsh ? [...new Set([dominio, www, ...sensibles])] : [];
  const inicio = new Date().toISOString();
  const [borde0, certificado0, endpoints0, mx, sec, ssh] = await Promise.all([
    medirBorde(www), leerCertificado(www), Promise.all(sensibles.map(sondaEndpoint)), correo(dominio), securityTxt(dominio, www),
    Promise.all(hostsSsh.map(sondaSsh))]);
  // Lo que el Worker no pudo saludar (un dominio detrás de Cloudflare: la plataforma no deja abrir
  // sockets a sus propias direcciones) lo saluda la sonda del VPS, por la cola firmada. Si el VPS no
  // está o no contesta, queda lo del Worker: null, nunca «no soporta» (lib/sonda-tls-vps.mjs).
  const { borde, certificado, endpoints: endpoints1, vps } = await completarConVps(env, { dominio, www, borde: borde0, certificado: certificado0, endpoints: endpoints0 });
  // El GET a la raíz SÓLO si el dueño verificó el dominio por DNS (decisión del dueño, 17-nov-2026).
  // Hasta el 16-nov la herramienta pública pedía la página de los ambientes de pruebas de CUALQUIER
  // dominio que alguien midiera. Ahora decide la MISMA función que la página /verificado
  // (dominioPublico: verificado Y público, entorno producción; el preview comparte esa base). Sin dueño
  // verificado —o si la base no contesta: falla cerrada— sólo el saludo TLS, como antes, y la nota lo
  // lee como «publicado» (media, techo B), nunca como abierto ni como bloqueado.
  const { getPermitido, endpoints } = await endpointsConRaiz(env, dominio, endpoints1);
  // ¿Pinta la página los nombres completos? Sólo si el dueño verificó el dominio por DNS (16-nov-2026,
  // la misma consulta que la medición para agentes; falla cerrado).
  // pagina_publica: si además eligió publicar su nota, la ficha de la página enlaza /verificado/<dominio>.
  const { verificado: nombres_completos, publico: pagina_publica } = await dominioVerificado(env.DB, dominio);
  // CERRADO (17-nov-2026, decisión del dueño): sin verificación, los nombres van enmascarados. El dueño
  // verificado, y el propio servidor (interno), reciben todo.
  const enmascarados = !interno && !nombres_completos;
  return json({ ok: true, instrumento: "rosetta-sondas-envivo/1", dominio, www, medido_utc: inicio, nombres_completos, pagina_publica,
    nombres_enmascarados: enmascarados,
    borde, certificado, endpoints: enmascarados ? sondasParaTercero(endpoints, pedidos, dominio, www) : endpoints, correo: mx, security_txt: sec, vps,
    get_raiz: getPermitido ? "dueño verificado" : "no consultada",
    ssh: pideSsh ? ssh : null,
    descartados: pedidos.length - sensibles.length });
}
