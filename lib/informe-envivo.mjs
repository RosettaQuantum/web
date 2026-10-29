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
//
// Regla de la casa que este archivo no rompe: lo que no se pudo medir vuelve null con su error,
// nunca como «no». Y no guarda nada: ni D1 ni caché, salvo el contador por IP.

import { connect } from "cloudflare:sockets";
import { medirBorde, saludo, normalizarHost, permitido, TODOS } from "./borde-envivo.mjs";

const ESPERA_MS = 8000;
const MAX_SENSIBLES = 15;
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
  else out.algoritmo = a;
  return out;
}

export async function leerCertificado(host) {
  const t0 = Date.now();
  const out = { host, ok: false, metodo: "saludo TLS 1.2; se lee la hoja que entrega el servidor", error: null, ms: null };
  let socket;
  const tarea = (async () => {
    socket = connect({ hostname: host, port: 443 });
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

export async function sondaEndpoint(host) {
  const out = { host, medido_utc: new Date().toISOString(), dns_status: null, ip: [], cname: [], responde_443: null, detalle: null };
  try {
    const d = await dns(host, "A");
    out.dns_status = d.status;
    out.ip = d.answer.filter((a) => a.type === 1).map((a) => a.data);
    out.cname = d.answer.filter((a) => a.type === 5).map((a) => String(a.data).replace(/\.$/, ""));
  } catch (e) { out.detalle = `DNS sin respuesta: ${e.message || e}`; return out; }
  if (out.dns_status === "NXDOMAIN") { out.detalle = "el nombre ya no existe en DNS: no se envió saludo"; return out; }
  if (!out.ip.length && !out.cname.length) { out.detalle = `DNS ${out.dns_status} sin direcciones: no se envió saludo`; return out; }
  const s = await saludo(host, TODOS, true);
  // Una alerta TLS también es respuesta: el servidor está ahí. Sólo el silencio o el corte son «no responde».
  out.responde_443 = !s.error;
  out.detalle = s.error ? `sin respuesta TLS en 443 (${s.error})` : s.alerta ? `responde con ${s.alerta}` : `responde; grupo ${s.grupo}`;
  return out;
}

const PROVEEDOR_MX = [[/iphmx\.com$/, "Cisco Secure Email (IronPort)"], [/pphosted\.com$/, "Proofpoint"],
  [/mimecast\.com$/, "Mimecast"], [/protection\.outlook\.com$/, "Microsoft 365"], [/(google|googlemail)\.com$/, "Google Workspace"],
  [/barracudanetworks\.com$/, "Barracuda"], [/messagelabs\.com$/, "Broadcom (Symantec)"]];
export const proveedorMx = (mx) => { for (const [rx, n] of PROVEEDOR_MX) if (rx.test(mx)) return n; return mx.split(".").slice(-2).join("."); };

export async function correo(dominio) {
  try {
    const d = await dns(dominio, "MX");
    const mx = d.answer.filter((a) => a.type === 15).map((a) => String(a.data).split(" ").pop().replace(/\.$/, "")).sort();
    return { mx, proveedor: mx.length ? [...new Set(mx.map(proveedorMx))].join(" + ") : null, error: null };
  } catch (e) { return { mx: [], proveedor: null, error: String(e.message || e) }; }
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

export async function manejarSondas(request) {
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
  const inicio = new Date().toISOString();
  const [borde, certificado, endpoints, mx, sec] = await Promise.all([
    medirBorde(www), leerCertificado(www), Promise.all(sensibles.map(sondaEndpoint)), correo(dominio), securityTxt(dominio, www)]);
  return json({ ok: true, instrumento: "rosetta-sondas-envivo/1", dominio, www, medido_utc: inicio,
    borde, certificado, endpoints, correo: mx, security_txt: sec,
    descartados: pedidos.length - sensibles.length });
}
