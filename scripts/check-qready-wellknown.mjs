#!/usr/bin/env node
/**
 * Q-Ready Verified, fase 3 (13-nov-2026): /.well-known/q-ready firmado — el bueno pasa, el alterado
 * falla, el vencido se dice vencido, y la llave privada no vive en el repositorio.
 *
 * POR QUÉ EXISTE. Un validador de firmas que «pasa» todo es el guardia que se da la razón solo: nadie lo
 * nota hasta que alguien publica un documento adulterado y la página dice «válido». Y un documento
 * propio que vence sin que nadie lo renueve es una promesa vieja con buena cara.
 *
 * Contra el código que corre (public/js/qready-wellknown.mjs y lib/qready-wellknown.mjs), con una llave
 * Ed25519 generada AQUÍ, en memoria, que no se escribe en ninguna parte:
 *  1. nuestro documento (lib/datos/q-ready-rosetta.json) firmado: válido; alterado en un byte: no; con
 *     otra llave: no; vencido: firma bien pero «no vigente»; llaves en otro dominio: no.
 *  2. la ruta: sin el secreto, 503 (no se sirve un documento sin firma); con el secreto, el validador
 *     del sitio acepta el documento por URL y rechaza el alterado pegado.
 *  3. lo declarado contra lo medido: un borde declarado pq_hybrid que no acepta el híbrido «no calza».
 *  4. el documento propio no está vencido (aviso 30 días antes) y ningún archivo versionado trae una
 *     llave privada Ed25519.
 *  MUTACIÓN: verificarFirma que no verifica → el alterado pasa → grita.
 *   node scripts/check-qready-wellknown.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
// El límite por IP usa la caché del borde (caches.default), que en node no existe: una caché vacía.
globalThis.caches ??= { default: { match: async () => null, put: async () => {} } };
const W = await import("../public/js/qready-wellknown.mjs");
const L = await import("../lib/qready-wellknown.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige el verificador o renueva lib/datos/q-ready-rosetta.json (expires) antes de desplegar; nunca commitea una llave privada" };

const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const DOC = JSON.parse(leer("lib/datos/q-ready-rosetta.json"));
const AHORA = "2026-11-13T12:00:00.000Z";

async function llave(kid) {
  const k = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const j = await crypto.subtle.exportKey("jwk", k.privateKey);
  return { kty: "OKP", crv: "Ed25519", x: j.x, d: j.d, kid };
}
const K1 = await llave("rq-2026-11"), K2 = await llave("rq-2026-11");
const jwks = (k) => ({ keys: [W.llavePublica(k, k.kid)] });

// ---------------------------------------------------------------- 1 · firmar y verificar
const firmado = await W.firmar(DOC, K1);
const v1 = await W.validar(firmado, jwks(K1), AHORA);
igual([v1.valido, v1.vigente, v1.errores], [true, true, []], "nuestro documento firmado: válido y vigente");
igual(firmado.signature.value.length, 86, "la firma: 64 bytes en base64url sin relleno");
const alterado = JSON.parse(JSON.stringify(firmado)); alterado.migration.target_date = "2026-12-31";
igual((await W.validar(alterado, jwks(K1), AHORA)).valido, false, "GRITO: alterado en un campo → no válido");
const alteradoKid = JSON.parse(JSON.stringify(firmado)); alteradoKid.signature.keys = "https://rosettaquantum.com/otra.json";
igual((await W.validar(alteradoKid, jwks(K1), AHORA)).valido, false, "GRITO: cambiar signature.keys (firmado) rompe la firma");
igual((await W.validar(firmado, jwks(K2), AHORA)).valido, false, "GRITO: verificado con otra llave del mismo kid → no válido");
const vVencido = await W.validar(firmado, jwks(K1), "2027-06-01T00:00:00.000Z");
igual([vVencido.valido, vVencido.vigente, vVencido.firma.ok], [false, false, true], "vencido: la firma está bien, pero no es vigente ni válido");
const ajeno = await W.firmar({ ...DOC, signature: { ...DOC.signature, keys: "https://otro-dominio.example/keys.json" } }, K1);
igual(W.validarForma(ajeno, AHORA).some((e) => /mismo dominio/.test(e)), true, "las llaves en otro dominio → error de forma");
const decimal = await W.firmar({ ...DOC, x_score: 1.5 }, K1);
igual(W.validarForma(decimal, AHORA).some((e) => /decimales/.test(e)), true, "v0 no admite decimales (la canónica no sería JCS)");
igual(W.validarForma({ ...firmado, expires: "2028-12-31T00:00:00Z" }, AHORA).some((e) => /más de 366 días/.test(e)), true, "expires a más de un año → error");
// canónica: el orden de las claves no cambia lo firmado
const reordenado = Object.fromEntries(Object.entries(firmado).reverse());
igual((await W.validar(reordenado, jwks(K1), AHORA)).valido, true, "SILENCIO: el mismo documento con las claves en otro orden sigue válido");
// MUTACIÓN: un verificador que no verifica
await conMutante(new URL("public/js/qready-wellknown.mjs", raiz), "try { if (await crypto.subtle.verify({ name: \"Ed25519\" }, await importarPublica(k), firma, datos)) return { ok: true, kid: k.kid }; }",
  "try { return { ok: true, kid: k.kid }; }",
  async (M) => igual((await M.validar(alterado, jwks(K1), AHORA)).valido, true, "MUTACIÓN: con verificarFirma que no verifica, el alterado pasa y el guardia lo ve"));

// ---------------------------------------------------------------- 2 · las rutas
const envCon = { QREADY_FIRMA_JWK: JSON.stringify(K1) };
const pedir = async (env, ruta, init) => { const url = new URL("https://rosettaquantum.com" + ruta); return L.manejarWellKnown(new Request(url, init), env, url); };
igual((await pedir({}, "/.well-known/q-ready")).status, 503, "sin el secreto: 503, no se sirve un documento sin firma");
const r = await pedir(envCon, "/.well-known/q-ready");
const servido = await r.json();
igual([r.status, r.headers.get("content-type"), servido.signature.kid], [200, "application/json; charset=utf-8", "rq-2026-11"], "con el secreto: 200, JSON, kid del secreto");
const llaves = await (await pedir(envCon, "/.well-known/q-ready-keys.json")).json();
igual([llaves.keys.length, "d" in llaves.keys[0], llaves.keys[0].x === K1.x], [1, false, true], "las llaves publicadas: sólo la pública (sin «d»)");
const valUrl = await (await pedir(envCon, "/api/qready/well-known/validar", { method: "POST", body: JSON.stringify({ url: "rosettaquantum.com" }) })).json();
igual([valUrl.valido, valUrl.vigente], [true, Date.parse(DOC.expires) > Date.now()], "validador por URL: nuestro documento es válido");
const valMal = await (await pedir(envCon, "/api/qready/well-known/validar", { method: "POST", body: JSON.stringify({ json: JSON.stringify({ ...servido, owner: "Otra" }) }) })).json();
igual([valMal.valido, valMal.errores.some((e) => /firma/.test(e))], [false, true], "validador con JSON pegado y alterado: no válido, y dice que es la firma");
const valBasura = await (await pedir(envCon, "/api/qready/well-known/validar", { method: "POST", body: JSON.stringify({ json: "{no es json" }) }));
igual(valBasura.status, 400, "validador: lo que no es JSON → 400");

// ---------------------------------------------------------------- 3 · lo declarado contra lo medido
igual(L.cruzar(DOC, { borde: { soporta: false }, certificado: { ok: true, algoritmo: "EC" } }).estado, "no_calza", "un borde declarado pq_hybrid que no acepta el híbrido: no calza");
igual(L.cruzar(DOC, { borde: { soporta: true }, certificado: { ok: true, algoritmo: "EC" } }).estado, "calza_o_sin_dato", "borde declarado y medido con híbrido: calza");
igual(L.cruzar(DOC, null).estado, "sin_dato", "sin medición: «sin dato», nunca «calza»");

// ---------------------------------------------------------------- 3 bis · el lector en inglés no recibe español
// Los mensajes se generan de verdad (documentos rotos a propósito y el validador por la ruta) y se
// traducen con la tabla de qready-textos.mjs; ninguno puede quedar con español.
{
  const { validadorEn } = await import("../public/js/qready-textos.mjs");
  const ES = /[áéíóúñ«»]|\b(falta|debe|uno de|fecha|lista|venció|llaves?|firma|tiene que|no es|respondió|pegado|escriba|mande|pedido|demasiad)/i;
  const roto = { q_ready: "9", domain: "no dominio", contact: [], owner: 3, inventory: { status: "x", as_of: "ayer" }, migration: {}, providers: [{ role: "x", status: "y", target_date: "z" }],
    expires: "mañana", signature: { alg: "RSA", value: "x", keys: "http://otro.example/k" }, n: 1.5 };
  const mensajes = [...W.validarForma(roto, AHORA), ...W.validarForma({ ...firmado, expires: "2020-01-01T00:00:00Z" }, AHORA), ...W.validarForma({ ...firmado, expires: "2030-01-01T00:00:00Z" }, AHORA),
    ...W.validarForma(null), ...(await W.validar(alterado, jwks(K1), AHORA)).errores, ...(await W.validar(firmado, null, AHORA)).errores,
    ...(await W.validar({ ...firmado, signature: { ...firmado.signature, kid: "otro" } }, jwks(K1), AHORA)).errores];
  for (const ruta of [{ json: "{no" }, { url: "no es dominio" }, {}]) {
    const j = await (await pedir(envCon, "/api/qready/well-known/validar", { method: "POST", body: JSON.stringify(ruta) })).json(); mensajes.push(j.error);
  }
  mensajes.push("llaves: este servidor no tiene llave configurada", "no se pudo leer https://x.example/.well-known/q-ready: respondió 302 (redirección): el documento se sirve directo",
    "no se pudo leer https://x.example/.well-known/q-ready: sin respuesta en 8 s", "no se pudo leer https://x.example/.well-known/q-ready: más de 64 KB");
  const conEspanol = mensajes.map(validadorEn).filter((m) => ES.test(m));
  igual(conEspanol, [], `los ${mensajes.length} mensajes del validador llegan en inglés a /q-ready/spec`);
  igual(ES.test(validadorEn("firma: un mensaje nuevo sin traducir")), true, "GRITO: un mensaje nuevo sin entrada en la tabla queda en español y el detector lo ve");
}

// ---------------------------------------------------------------- 4 · el documento propio y la llave privada
const dias = (Date.parse(DOC.expires) - Date.now()) / 864e5;
if (dias <= 0) fallas.push(`lib/datos/q-ready-rosetta.json venció (${DOC.expires}): renovarlo, con OK de Nicholas`);
else if (dias < 30) console.warn(`  aviso: lib/datos/q-ready-rosetta.json vence en ${Math.floor(dias)} días (${DOC.expires})`);
const archivos = execSync("git ls-files -z", { encoding: "utf8", cwd: new URL(".", raiz) }).split("\0").filter((f) => f && /\.(json|jsonc|mjs|js|ts|md|txt|env|vars|toml|sql)$/i.test(f));
const privada = /"crv"\s*:\s*"Ed25519"[^}]{0,400}"d"\s*:\s*"[A-Za-z0-9_-]{40,}"|"d"\s*:\s*"[A-Za-z0-9_-]{40,}"[^}]{0,400}"crv"\s*:\s*"Ed25519"/;
const conPrivada = archivos.filter((f) => { try { return privada.test(readFileSync(new URL(f, raiz), "utf8")); } catch { return false; } });
igual(conPrivada, [], "ningún archivo versionado trae una llave privada Ed25519");
igual(privada.test(JSON.stringify(K1)), true, "el detector de llave privada grita con un JWK privado real");

if (fallas.length) { console.error("check-qready-wellknown: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-qready-wellknown: ok (${casos} casos · firmado pasa, alterado/otra llave/vencido fallan · 503 sin secreto · sin llave privada en el repo · 1 mutación grita)`);
