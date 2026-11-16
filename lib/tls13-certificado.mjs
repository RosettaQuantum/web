// La hoja del certificado por TLS 1.3 (16-nov-2026, defecto B1).
//
// EL DEFECTO: el certificado se leía SÓLO con un saludo TLS 1.2 (en 1.2 el certificado viaja en claro).
// Un servidor que acepta sólo TLS 1.3 responde alerta 70 y «Certificados y PKI» (40 % del QEX) quedaba en
// null: yutrack.com salió A con esa dimensión sin medir. En TLS 1.3 el certificado viaja cifrado con las
// llaves del saludo, así que para leerlo hay que hacer el intercambio X25519 y derivar esas llaves.
//
// QUÉ HACE: un ClientHello TLS 1.3 (sólo TLS_AES_128_GCM_SHA256 y X25519, los obligatorios del RFC 8446
// §9.1), lee el ServerHello, deriva la llave de tráfico del saludo del servidor (RFC 8446 §7.1), descifra
// los registros hasta el mensaje Certificate y devuelve la hoja en DER. NO completa la sesión: no envía
// Finished, no valida la cadena ni la firma; cierra apenas tiene la hoja. Igual que el saludo 1.2, mide
// qué presenta el servidor, no si es de confianza.
//
// Sin dependencias: WebCrypto (X25519, HMAC-SHA256, AES-GCM), igual en el Worker y en node. El socket lo
// pone quien llama (`abrir`): cloudflare:sockets en el Worker, net en la prueba (scripts/check-tls13-certificado.mjs).
const u16 = (n) => [(n >> 8) & 0xff, n & 0xff];
const u24 = (n) => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
const ext = (t, d) => [...u16(t), ...u16(d.length), ...d];
const azar = (n) => Array.from(crypto.getRandomValues(new Uint8Array(n)));
const juntar = (...xs) => { const n = new Uint8Array(xs.reduce((s, x) => s + x.length, 0)); let o = 0; for (const x of xs) { n.set(x, o); o += x.length; } return n; };
const TXT = new TextEncoder();
const HRR = "cf21ad74e59a6111be1d8c021e65b891c2a211167abb8c5e079e09e2c8a8339c";
const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");

export function clientHello13(host, pub) {
  const hn = Array.from(TXT.encode(host));
  let body = [0x03, 0x03, ...azar(32), 32, ...azar(32)];                  // legacy_session_id de 32 (modo compatible)
  body.push(...u16(2), ...u16(0x1301), 0x01, 0x00);
  let e = ext(0x0000, [...u16(hn.length + 3), 0x00, ...u16(hn.length), ...hn]);
  e = e.concat(ext(0x000a, [...u16(2), ...u16(0x001d)]));                   // supported_groups: x25519
  const sa = [0x0403, 0x0804, 0x0401, 0x0503, 0x0805, 0x0501, 0x0806, 0x0601, 0x0807].flatMap(u16);
  e = e.concat(ext(0x000d, [...u16(sa.length), ...sa]));
  e = e.concat(ext(0x002b, [0x02, 0x03, 0x04]));                           // supported_versions: sólo 1.3
  e = e.concat(ext(0x0033, [...u16(36), ...u16(0x001d), ...u16(32), ...pub])); // key_share x25519
  body = body.concat(u16(e.length), e);
  return new Uint8Array([0x01, ...u24(body.length), ...body]);             // el mensaje (sin cabecera de registro)
}

async function hmac(clave, datos) {
  const k = await crypto.subtle.importKey("raw", clave, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await crypto.subtle.sign("HMAC", k, datos));
}
const sha256 = async (d) => new Uint8Array(await crypto.subtle.digest("SHA-256", d));
// HKDF-Expand-Label (RFC 8446 §7.1) para largos ≤ 32: un solo bloque.
async function expandirEtiqueta(secreto, etiqueta, contexto, largo) {
  const l = TXT.encode("tls13 " + etiqueta);
  const info = new Uint8Array([...u16(largo), l.length, ...l, contexto.length, ...contexto, 0x01]);
  return (await hmac(secreto, info)).subarray(0, largo);
}
// Las llaves del tráfico de saludo del servidor, desde el secreto X25519 y la transcripción CH‖SH.
export async function llavesSaludoServidor(compartido, transcripcion) {
  const ceros = new Uint8Array(32);
  const temprano = await hmac(ceros, ceros);                                 // HKDF-Extract(0, 0)
  const derivado = await expandirEtiqueta(temprano, "derived", await sha256(new Uint8Array(0)), 32);
  const saludo = await hmac(derivado, compartido);                           // HKDF-Extract(derived, ECDHE)
  const sHs = await expandirEtiqueta(saludo, "s hs traffic", await sha256(transcripcion), 32);
  return { clave: await expandirEtiqueta(sHs, "key", new Uint8Array(0), 16), iv: await expandirEtiqueta(sHs, "iv", new Uint8Array(0), 12) };
}

// El ServerHello: versión elegida, suite y la llave del servidor.
export function leerServerHello13(m) {
  if (m[0] !== 0x02) throw new Error("se esperaba ServerHello");
  let i = 4 + 2;
  if (hex(m.subarray(i, i + 32)) === HRR) throw new Error("el servidor pidió otro grupo (HelloRetryRequest)");
  i += 32; i += 1 + m[i];
  const suite = (m[i] << 8) | m[i + 1]; i += 3;
  const fin = i + 2 + ((m[i] << 8) | m[i + 1]); i += 2;
  let version = 0x0303, llave = null;
  while (i + 4 <= fin) {
    const t = (m[i] << 8) | m[i + 1], l = (m[i + 2] << 8) | m[i + 3], d = m.subarray(i + 4, i + 4 + l);
    if (t === 0x002b) version = (d[0] << 8) | d[1];
    if (t === 0x0033 && ((d[0] << 8) | d[1]) === 0x001d) llave = d.subarray(4, 4 + ((d[2] << 8) | d[3]));
    i += 4 + l;
  }
  if (version !== 0x0304) throw new Error("el servidor no eligió TLS 1.3");
  if (suite !== 0x1301) throw new Error(`suite inesperada 0x${suite.toString(16)}`);
  if (!llave || llave.length !== 32) throw new Error("sin llave X25519 del servidor");
  return { llave };
}

// abrir(host, puerto) → { readable, writable, close() }. Devuelve { der } o lanza con la causa.
export async function hojaTls13(host, abrir, esperaMs = 8000) {
  const par = await crypto.subtle.generateKey({ name: "X25519" }, true, ["deriveBits"]);
  const pub = new Uint8Array(await crypto.subtle.exportKey("raw", par.publicKey));
  const ch = clientHello13(host, pub);
  const socket = await abrir(host, 443);
  let reloj;
  const tarea = (async () => {
    const w = socket.writable.getWriter(); await w.write(new Uint8Array([0x16, 0x03, 0x01, ...u16(ch.length), ...ch])); w.releaseLock();
    const r = socket.readable.getReader();
    let buf = new Uint8Array(0), hs = new Uint8Array(0), llaves = null, seq = 0n, sh = null;
    for (;;) {
      while (buf.length < 5 || buf.length < 5 + ((buf[3] << 8) | buf[4])) {
        const { value, done } = await r.read(); if (done) throw new Error("el servidor cerró antes del certificado");
        buf = juntar(buf, value);
        if (buf.length > 300000) throw new Error("respuesta demasiado larga");
      }
      const cab = buf.subarray(0, 5), tipo = buf[0], largo = (buf[3] << 8) | buf[4];
      const cuerpo = buf.slice(5, 5 + largo); buf = buf.subarray(5 + largo);
      if (tipo === 0x15) throw new Error(`alerta TLS ${cuerpo[0]}/${cuerpo[1]}`);
      if (tipo === 0x14) continue;                                           // change_cipher_spec de compatibilidad
      if (!llaves) {
        if (tipo !== 0x16) throw new Error(`registro inesperado ${tipo}`);
        hs = juntar(hs, cuerpo);
        if (hs.length < 4) continue;
        const l = (hs[1] << 16) | (hs[2] << 8) | hs[3];
        if (hs.length < 4 + l) continue;
        sh = hs.subarray(0, 4 + l);
        const { llave } = leerServerHello13(sh);
        const priv = par.privateKey;
        const pubS = await crypto.subtle.importKey("raw", llave, { name: "X25519" }, false, []);
        const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: "X25519", public: pubS }, priv, 256));
        llaves = await llavesSaludoServidor(compartido, juntar(ch, sh));
        llaves.k = await crypto.subtle.importKey("raw", llaves.clave, "AES-GCM", false, ["decrypt"]);
        hs = hs.slice(4 + l);
        continue;
      }
      if (tipo !== 0x17) throw new Error(`registro inesperado ${tipo}`);
      const nonce = llaves.iv.slice();
      for (let k = 0; k < 8; k++) nonce[11 - k] ^= Number((seq >> BigInt(8 * k)) & 0xffn);
      seq += 1n;
      let claro;
      try { claro = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: nonce, additionalData: cab.slice(), tagLength: 128 }, llaves.k, cuerpo)); }
      catch { throw new Error("no se pudo descifrar el saludo del servidor"); }
      let fin = claro.length; while (fin > 0 && claro[fin - 1] === 0) fin--;
      if (claro[fin - 1] !== 0x16) continue;
      hs = juntar(hs, claro.subarray(0, fin - 1));
      for (let i = 0; i + 4 <= hs.length;) {
        const t = hs[i], l = (hs[i + 1] << 16) | (hs[i + 2] << 8) | hs[i + 3];
        if (i + 4 + l > hs.length) break;
        if (t === 0x0b) {                                                     // Certificate (RFC 8446 §4.4.2)
          const m = hs.subarray(i + 4, i + 4 + l), c = 1 + m[0];
          const l1 = (m[c + 3] << 16) | (m[c + 4] << 8) | m[c + 5];
          return { der: m.slice(c + 6, c + 6 + l1) };
        }
        i += 4 + l;
      }
    }
  })();
  tarea.catch(() => {});                                                     // si gana el reloj, la tarea muere al cerrar
  try {
    return await Promise.race([tarea, new Promise((_, no) => { reloj = setTimeout(() => no(new Error(`sin respuesta en ${esperaMs / 1000} s`)), esperaMs); })]);
  } finally { clearTimeout(reloj); try { socket.close(); } catch { /* ya cerrado */ } }
}
