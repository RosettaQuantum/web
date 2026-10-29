// Re-medición EN VIVO del borde de un dominio: ¿soporta, pide como mejora y elige el
// intercambio híbrido post-cuántico X25519MLKEM768? 29-oct-2026.
//
// Es un puerto fiel de los instrumentos de agosto (probe_soporte.py y rescan_eleccion.py,
// en Projects/Rosetta Quantum/), no un instrumento nuevo. Tres saludos TLS 1.3, cada uno
// UN solo ClientHello: se lee la primera respuesta y se cierra. No se completa la
// conexión, no viajan datos ni credenciales.
//
//   A · «como un navegador»: ofrece todos los grupos + llave x25519. ¿Paga un viaje extra
//       (HelloRetryRequest) para PEDIR el híbrido? Eso es «pide_mejora» (rescan_eleccion.py
//       lo llama hrr_upgrade; antes se llamaba, mal, «prefiere»). El defecto de agosto fue
//       leer esto como soporte.
//   B · «sólo híbrido»: ofrece SÓLO X25519MLKEM768, key_share VACÍO. Si el servidor
//       pide ese grupo por HelloRetryRequest, lo SOPORTA. Si no, alerta.
//   C · «elección libre»: ofrece híbrido y x25519, key_share VACÍO. ¿Cuál ELIGE?
//
// La regla que nace del defecto de agosto, y que este archivo no puede romper:
// SOPORTA se lee SÓLO de B. Un servidor que soporta el híbrido pero acepta x25519 para
// ahorrarse un viaje contesta A sin híbrido; leer A como soporte lo da en cero.
//
// Límites que el resultado declara solo: el Worker NO puede conectarse a direcciones
// de Cloudflare (lo impide la plataforma), así que un dominio detrás de Cloudflare
// vuelve con error de conexión y se dice así, nunca como «no soporta».

import { connect } from "cloudflare:sockets";

const HRR_RANDOM = "cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c";
const NOMBRE = { 0x11ec: "X25519MLKEM768", 0x11eb: "SecP256r1MLKEM768", 0x6399: "X25519Kyber768Draft00",
  0x001d: "x25519", 0x0017: "secp256r1", 0x0018: "secp384r1" };
const TODOS = [0x11ec, 0x11eb, 0x6399, 0x001d, 0x0017, 0x0018];   // A: igual que agosto
const SOLO_HIB = [0x11ec];                                        // B
const LIBRE = [0x11ec, 0x001d];                                   // C: igual que rescan_eleccion.py
const ESPERA_MS = 8000;

const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u24 = (n) => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const azar = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)));
const ext = (t, d) => [...u16(t), ...u16(d.length), ...d];

export function clientHello(host, grupos, conShareX25519) {
  const hn = Array.from(new TextEncoder().encode(host));
  const suites = [0x1301, 0x1302, 0x1303];
  let body = [0x03, 0x03, ...azar(32), 0x20, ...azar(32)];
  body.push(...u16(suites.length * 2), ...suites.flatMap(u16), 0x01, 0x00);
  let exts = ext(0x0000, [...u16(hn.length + 3), 0x00, ...u16(hn.length), ...hn]);
  const sg = grupos.flatMap(u16);
  exts = exts.concat(ext(0x000a, [...u16(sg.length), ...sg]));
  const sa = [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601].flatMap(u16);
  exts = exts.concat(ext(0x000d, [...u16(sa.length), ...sa]));
  exts = exts.concat(ext(0x002b, [0x02, 0x03, 0x04]));               // TLS 1.3
  if (conShareX25519) {
    const e = [...u16(0x001d), ...u16(32), ...azar(32)];
    exts = exts.concat(ext(0x0033, [...u16(e.length), ...e]));
  } else {
    exts = exts.concat(ext(0x0033, u16(0)));                          // key_share VACÍO
  }
  body = body.concat(u16(exts.length), exts);
  const hs = [0x01, ...u24(body.length), ...body];
  return new Uint8Array([0x16, 0x03, 0x01, ...u16(hs.length), ...hs]);
}

// Lee el ServerHello (o HRR): ¿es HRR? ¿qué grupo trae key_share? Mismo recorrido que leer() en Python.
export function leerServerHello(p) {
  if (!p.length || p[0] !== 0x02) return { hrr: null, grupo: null };
  const q = p.subarray(4);
  const rnd = Array.from(q.subarray(2, 34)).map((b) => b.toString(16).padStart(2, "0")).join("");
  let i = 34; const sid = q[i]; i += 1 + sid; i += 2 + 1;
  const elen = (q[i] << 8) | q[i + 1]; i += 2;
  const fin = i + elen; let grupo = null;
  while (i + 4 <= fin) {
    const t = (q[i] << 8) | q[i + 1], l = (q[i + 2] << 8) | q[i + 3]; i += 4;
    if (t === 0x0033 && l >= 2) grupo = (q[i] << 8) | q[i + 1];
    i += l;
  }
  return { hrr: rnd === HRR_RANDOM, grupo };
}

async function leerExacto(reader, n, buf) {
  while (buf.length < n) {
    const { value, done } = await reader.read();
    if (done) break;
    const nb = new Uint8Array(buf.length + value.length); nb.set(buf); nb.set(value, buf.length); buf = nb;
  }
  return buf;
}

export async function saludo(host, grupos, conShare) {
  const t0 = Date.now();
  const out = { grupo: null, hrr: null, alerta: null, error: null, ms: null };
  let socket;
  const tarea = (async () => {
    socket = connect({ hostname: host, port: 443 });
    const w = socket.writable.getWriter();
    await w.write(clientHello(host, grupos, conShare));
    w.releaseLock();
    const r = socket.readable.getReader();
    let buf = await leerExacto(r, 5, new Uint8Array(0));
    if (buf.length < 5) throw new Error("respuesta corta");
    const tipo = buf[0], largo = (buf[3] << 8) | buf[4];
    buf = await leerExacto(r, 5 + largo, buf);
    const cuerpo = buf.subarray(5, 5 + largo);
    if (tipo === 0x15) { out.alerta = cuerpo.length >= 2 ? `alert ${cuerpo[0]}/${cuerpo[1]}` : "alert"; return; }
    const s = leerServerHello(cuerpo);
    out.hrr = s.hrr; out.grupo = s.grupo == null ? null : (NOMBRE[s.grupo] || "0x" + s.grupo.toString(16));
  })();
  try {
    await Promise.race([tarea, new Promise((_, no) => setTimeout(() => no(new Error(`sin respuesta en ${ESPERA_MS / 1000} s`)), ESPERA_MS))]);
  } catch (e) {
    out.error = String(e && e.message || e);
  } finally {
    try { socket && socket.close(); } catch {}
    out.ms = Date.now() - t0;
  }
  return out;
}

// Cadena CNAME por DNS sobre HTTPS. Distingue Akamai Enhanced (edgekey.net) de Standard (edgesuite.net).
export async function cadenaCname(host) {
  const cadena = []; let actual = host;
  for (let i = 0; i < 6; i++) {
    const r = await fetch(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(actual)}&type=CNAME`,
      { headers: { accept: "application/dns-json" } });
    const j = await r.json().catch(() => ({}));
    const c = (j.Answer || []).find((a) => a.type === 5);
    if (!c) break;
    actual = String(c.data).replace(/\.$/, ""); cadena.push(actual);
  }
  const todo = cadena.join(" ");
  const cdn = /edgekey\.net/.test(todo) ? "Akamai Enhanced TLS" : /edgesuite\.net/.test(todo) ? "Akamai Standard TLS"
    : /akamai/.test(todo) ? "Akamai" : /cloudfront\.net/.test(todo) ? "Amazon CloudFront" : /fastly/.test(todo) ? "Fastly"
    : /azureedge|azurefd/.test(todo) ? "Azure Front Door" : cadena.length ? "otro" : "sin CNAME";
  return { cadena, cdn };
}

const HOST_OK = /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/;

export function normalizarHost(entrada) {
  const h = String(entrada || "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/[\/?#].*$/, "").replace(/:\d+$/, "").replace(/\.$/, "");
  if (!HOST_OK.test(h)) return null;                       // sólo nombres públicos; nada de IP ni localhost
  return h;
}

async function sha256Hex(texto) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// JSON con claves ordenadas: la huella no depende del orden en que se armó el objeto.
function canon(v) {
  if (Array.isArray(v)) return "[" + v.map(canon).join(",") + "]";
  if (v && typeof v === "object") return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canon(v[k])).join(",") + "}";
  return JSON.stringify(v);
}

export async function medirBorde(host) {
  const inicio = new Date();
  const [dns, a, b, c] = await Promise.all([
    cadenaCname(host).catch((e) => ({ cadena: [], cdn: null, error: String(e.message || e) })),
    saludo(host, TODOS, true), saludo(host, SOLO_HIB, false), saludo(host, LIBRE, false),
  ]);
  const conectado = !(a.error && b.error && c.error);
  // SOPORTA sólo desde B (ver arriba). Con error de conexión no hay veredicto: null, nunca false.
  const soporta = b.error ? null : b.grupo === "X25519MLKEM768";
  const pide_mejora = a.error ? null : a.grupo === "X25519MLKEM768";
  const elige = c.error ? null : c.grupo === "X25519MLKEM768";
  const informe = {
    instrumento: "rosetta-borde-envivo/1 · puerto de probe_soporte.py + rescan_eleccion.py (ago-2026)",
    host, medido_utc: inicio.toISOString(), dns,
    saludos: { A_como_navegador: a, B_solo_hibrido: b, C_eleccion_libre: c },
    veredicto: { conectado, soporta, pide_mejora, elige },
    alcance: "Mide el tramo cliente → borde. El tramo borde → origen no es observable desde fuera.",
  };
  informe.sha256 = await sha256Hex(canon(informe));
  return informe;
}

// Límite por IP: 6 mediciones por minuto. Usa la caché del borde, no la base: no escribe en D1.
async function permitido(ip) {
  const minuto = Math.floor(Date.now() / 60000);
  const key = new Request(`https://rosettaquantum.com/__rl-borde/${encodeURIComponent(ip)}/${minuto}`);
  const c = caches.default;
  const prev = await c.match(key);
  const n = prev ? Number(await prev.text()) || 0 : 0;
  if (n >= 6) return false;
  await c.put(key, new Response(String(n + 1), { headers: { "Cache-Control": "max-age=70" } }));
  return true;
}

export async function manejarBorde(request) {
  const json = (o, s = 200) => new Response(JSON.stringify(o, null, 2), {
    status: s, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });
  if (request.method !== "POST") return json({ ok: false, error: "Usa POST con {\"host\": \"www.ejemplo.cl\"}." }, 405);
  const cuerpo = await request.json().catch(() => ({}));
  const host = normalizarHost(cuerpo.host);
  if (!host) return json({ ok: false, error: "Escribe un nombre de dominio público, por ejemplo www.ejemplo.cl." }, 400);
  const ip = request.headers.get("cf-connecting-ip") || "local";
  if (!(await permitido(ip))) return json({ ok: false, error: "Demasiadas mediciones seguidas. Espera un minuto." }, 429);
  return json({ ok: true, ...(await medirBorde(host)) });
}
