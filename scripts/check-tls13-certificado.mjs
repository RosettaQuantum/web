#!/usr/bin/env node
/**
 * B1 (16-nov-2026): el certificado de un servidor que sólo acepta TLS 1.3 se lee igual.
 *
 * EL DEFECTO REAL: yutrack.com respondió «alerta TLS 2/70 (el servidor no aceptó TLS 1.2)» al saludo con
 * que se lee la hoja; «Certificados y PKI» (40 % del QEX) quedó en null y la nota salió A. Ahora, ante
 * una alerta en 1.2, el Worker lee la hoja por TLS 1.3 (lib/tls13-certificado.mjs: X25519, llaves del
 * saludo, AES-128-GCM).
 *
 * Contra servidores TLS REALES (node:tls, en 127.0.0.1, con certificados recién hechos por openssl), no
 * contra bytes inventados: el descifrado AES-GCM autenticado no pasa por casualidad.
 *   grito:    un servidor sólo TLS 1.3 → la hoja se lee, con el método 1.3, y es la del servidor;
 *   silencio: un servidor TLS 1.2 → se lee por 1.2, sin tocar 1.3; uno que cierra → error con causa, sin colgarse;
 *   MUTACIÓN: sin el respaldo por 1.3 → el caso de yutrack vuelve a quedar sin hoja (el guardia lo ve).
 * Punto ciego: no prueba HelloRetryRequest ni suites distintas de TLS_AES_128_GCM_SHA256 (el saludo sólo
 * ofrece esa y X25519, las obligatorias del RFC 8446 §9.1).
 *   node scripts/check-tls13-certificado.mjs
 */
import { registerHooks } from "node:module";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import tls from "node:tls";
import net from "node:net";
import { Readable, Writable } from "node:stream";
import { X509Certificate } from "node:crypto";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const { conMutante } = await import("./lib/mutar.mjs");
const I = await import("../lib/informe-envivo.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige lib/tls13-certificado.mjs o el respaldo de leerCertificado antes de desplegar: un certificado que no se lee deja «Certificados y PKI» en null" };

const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);

const dir = mkdtempSync(join(tmpdir(), "rq-tls13-"));
function certificado(nombre, tipo) {
  const k = join(dir, `${nombre}.key`), c = join(dir, `${nombre}.pem`);
  const llave = tipo === "ec" ? ["-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:P-256"] : ["-newkey", "rsa:2048"];
  execFileSync("openssl", ["req", "-x509", ...llave, "-nodes", "-keyout", k, "-out", c, "-days", "2", "-subj", `/CN=${nombre}`], { stdio: "pipe" });
  return { key: readFileSync(k), cert: readFileSync(c) };
}
async function servidor(opciones) {
  const srv = opciones.cerrar ? net.createServer((s) => s.destroy()) : tls.createServer(opciones, (s) => s.end());
  srv.on("tlsClientError", () => {});
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const port = srv.address().port;
  const abrir = async () => {
    const s = net.connect(port, "127.0.0.1");
    await new Promise((r, n) => { s.once("connect", r); s.once("error", n); });
    s.on("error", () => {});
    return { readable: Readable.toWeb(s), writable: Writable.toWeb(s), close: () => s.destroy() };
  };
  return { abrir, cerrar: () => srv.close() };
}
const sujeto = (pem) => new X509Certificate(pem).subject.replace(/^CN=/, "");

const c13 = certificado("solo13.example", "ec"), c12 = certificado("solo12.example", "rsa");
const s13 = await servidor({ ...c13, minVersion: "TLSv1.3", maxVersion: "TLSv1.3" });
const s12 = await servidor({ ...c12, minVersion: "TLSv1.2", maxVersion: "TLSv1.2" });
const sCierra = await servidor({ cerrar: true });

async function leer(M, s) { return await M.leerCertificado("prueba.example", s.abrir, s.abrir); }

// GRITO (el caso de yutrack): sólo TLS 1.3
const r13 = await leer(I, s13);
igual([r13.ok, r13.metodo, r13.sujeto, r13.algoritmo, /^alerta TLS 2\/70/.test(r13.tls12 || "")], [true, I.METODO_TLS13, sujeto(c13.cert), "EC", true],
  "sólo TLS 1.3: la 1.2 recibe la alerta 70 y la hoja se lee por 1.3, la del servidor");
// SILENCIO: TLS 1.2 se lee por 1.2, como siempre
const r12 = await leer(I, s12);
igual([r12.ok, /TLS 1\.2/.test(r12.metodo), r12.sujeto, r12.algoritmo, r12.tls12], [true, true, sujeto(c12.cert), "RSA", undefined], "TLS 1.2: se lee por 1.2, sin tocar 1.3");
// SILENCIO: un servidor que corta → error con causa, ok false (no se inventa una hoja)
const rC = await leer(I, sCierra);
igual([rC.ok, typeof rC.error === "string" && rC.error.length > 0], [false, true], "un servidor que corta: sin hoja y con la causa");
// MUTACIÓN: sin el respaldo por 1.3, el caso de yutrack queda sin hoja
await conMutante(new URL("lib/informe-envivo.mjs", raiz), 'if (r.ok || !/^alerta TLS/.test(String(r.error || ""))) return r;', "return r;",
  async (M) => igual((await leer(M, s13)).ok, false, "MUTACIÓN: sin el respaldo por TLS 1.3 → la hoja no se lee (el guardia lo ve)"));

for (const s of [s13, s12, sCierra]) s.cerrar();
if (fallas.length) { console.error("check-tls13-certificado: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-tls13-certificado: ok (${casos} casos · servidores TLS 1.3 y 1.2 reales en 127.0.0.1 · 1 mutación grita)`);
