// SSH desde afuera (2-nov-2026): ¿el servidor ofrece intercambio de llaves post-cuántico?
//
// Un servidor SSH publica EN CLARO, antes de cualquier autenticación, su banner y su paquete
// KEXINIT (RFC 4253 §7.1) con la lista de algoritmos de intercambio que acepta. Basta leerla:
// una conexión, sin intentar entrar, sin completar el intercambio.
//
// Este archivo es puro (sin sockets) para que se pruebe en node contra paquetes reales
// capturados (scripts/fixtures/ssh/). La conexión vive en lib/informe-envivo.mjs.
//
// Regla de la casa: un paquete que no se pudo leer entero vuelve como error, nunca como
// «no ofrece post-cuántico». pq:false sólo sale de una lista leída completa.

// Familias post-cuánticas híbridas conocidas en SSH. Se reconocen por familia, no por nombre
// exacto, para no perder variantes con sufijo de proveedor (…@openssh.com, …@amazon.com).
export const PQ_KEX = [
  [/^mlkem\d+x25519-/, "ML-KEM + X25519"],
  [/^mlkem\d+nistp\d+-/, "ML-KEM + ECDH NIST"],
  [/^sntrup761x25519-/, "sntrup761 + X25519"],
  [/kyber/i, "Kyber (borrador previo a ML-KEM)"],
];
export const familiaPq = (nombre) => { for (const [rx, f] of PQ_KEX) if (rx.test(nombre)) return f; return null; };

/** Separa el banner del resto. Antes del banner el servidor puede mandar otras líneas (RFC 4253 §4.2). */
export function leerBanner(buf) {
  let i = 0;
  for (let vueltas = 0; vueltas < 20; vueltas++) {
    const nl = buf.indexOf(0x0a, i);
    if (nl < 0) return null;
    const linea = new TextDecoder().decode(buf.subarray(i, nl)).replace(/\r$/, "");
    if (linea.startsWith("SSH-")) return { banner: linea, resto: buf.subarray(nl + 1) };
    i = nl + 1;
  }
  throw new Error("más de 20 líneas antes del banner SSH");
}

/** ¿Hay un paquete binario completo al inicio de `b`? Devuelve su largo total o null. */
export function paqueteCompleto(b) {
  if (b.length < 5) return null;
  const largo = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
  if (largo < 1 || largo > 35000) throw new Error(`largo de paquete imposible: ${largo}`);
  return b.length >= 4 + largo ? 4 + largo : null;
}

/** Lee un KEXINIT sin cifrar. Devuelve las listas; lanza si el paquete no es lo que dice ser. */
export function leerKexinit(b) {
  const total = paqueteCompleto(b);
  if (total === null) throw new Error("paquete KEXINIT incompleto");
  const relleno = b[4];
  const fin = total - relleno;
  if (b[5] !== 20) throw new Error(`se esperaba KEXINIT (20) y llegó el mensaje ${b[5]}`);
  let i = 6 + 16; // tipo + cookie
  const listas = [];
  for (let k = 0; k < 10; k++) {
    if (i + 4 > fin) throw new Error("KEXINIT cortado dentro de las listas");
    const l = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    if (i + 4 + l > fin) throw new Error("KEXINIT cortado dentro de una lista");
    const s = new TextDecoder().decode(b.subarray(i + 4, i + 4 + l));
    listas.push(s ? s.split(",") : []);
    i += 4 + l;
  }
  return { kex: listas[0], llaves_servidor: listas[1], cifrados: listas[2] };
}

/** Banner + KEXINIT → resultado listo para el informe. */
export function evaluarSsh(buf) {
  const b = leerBanner(buf);
  if (!b) throw new Error("no llegó el banner SSH");
  const k = leerKexinit(b.resto);
  // kex-strict-* y ext-info-* son marcas de extensión, no algoritmos de intercambio.
  const kex = k.kex.filter((n) => !/^(kex-strict-|ext-info-)/.test(n));
  const pq = kex.filter(familiaPq);
  return {
    banner: b.banner,
    kex,
    pq_ofrecido: pq.length > 0,
    pq_algoritmos: pq,
    pq_familias: [...new Set(pq.map(familiaPq))],
    pq_preferido: kex.length > 0 && familiaPq(kex[0]) !== null,
    llaves_servidor: k.llaves_servidor,
  };
}
