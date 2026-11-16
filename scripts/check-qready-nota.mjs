#!/usr/bin/env node
/**
 * Q-Ready Verified, fase 1 (13-nov-2026): la nota A+…F es UNA función, la misma en la página y en el
 * servidor, y ninguna nota con nombre de un tercero sale publicada.
 *
 * POR QUÉ EXISTE. La nota se lee en cinco lugares (página, /v1/medicion y MCP, cron, sello, página
 * pública). El modo de fallo es mudo: una copia de la regla en la página o en el servidor da DOS letras
 * para el mismo dominio y ninguna parece rota. Y el error caro es otro: una consulta que olvida
 * «verificado Y público» publica la nota de un tercero que nunca la pidió.
 *
 * Contra el terreno, no contra ejemplos inventados:
 *  1. notaQEX con FOTOS REALES armadas con armarFoto desde respuestas grabadas de producción
 *     (scripts/fixtures/medicion-agentes/ y scripts/fixtures/qready/), y los casos borde del encargo
 *     derivados de ellas: certificado vencido, TLS 1.2, ambiente de pruebas expuesto, X25519MLKEM768
 *     sólo en el sitio principal, y el borde que no se pudo medir (null nunca es «no»).
 *  2. Página y servidor: la página llama a N.explicarNota y no escribe su propia letra; el servidor
 *     devuelve la misma letra que la página con los mismos insumos. MUTACIÓN: un servidor con su propia
 *     regla → el comparador grita.
 *  3. Persistencia: la medición guardada recalcula la nota en el servidor; una foto adulterada no entra.
 *  4. La compuerta de /verificado, con el esquema REAL en SQLite: sin verificar o sin «público» → 404 con
 *     el texto pedido; una medición de la página nunca se muestra. MUTACIÓN: la consulta sin «publico = 1»
 *     → la nota de un tercero sale publicada → grita.
 *  5. (16-nov-2026, QREADY-NOTA-2) Qué se sondea. EL DEFECTO REAL: openfinance-desa.<banco>.cl existe y
 *     responde 403 desde internet, y el banco salía A: «desa» no está en PAT y el nombre NUNCA se
 *     sondeaba. Los casos son los nombres reales con el dominio enmascarado. Ambientes de pruebas en
 *     español o inglés entran al sondeo PRIMERO; certificados.*, api.*, preferencias.* no. MUTACIONES:
 *     sin la señal, sin la prioridad (orden alfabético con el tope de 15) o sin «desa» → grita.
 *  6. (16-nov-2026, decisión del dueño) Un ambiente de pruebas que responde 403 en la raíz está
 *     «publicado con el acceso bloqueado»: alerta MEDIA, no F. 2xx, 3xx y 401 son abiertos → F; sin
 *     código HTTP, F como hasta hoy (precisión). Casos reales: openfinance-desa da 403 (el banco queda
 *     B); staging da 301 (F) y serverless-staging 403 (media). MUTACIONES: la excepción ancha (≥ 300)
 *     o ausente → grita.
 *  7. (17-nov-2026, decisión del dueño) El GET a la raíz SÓLO con el dueño verificado (la compuerta de
 *     /verificado, entorno producción). Sin verificar NO se pide la página (fetch espiado) y el ambiente
 *     de pruebas que completa el saludo TLS es media «publicado», con techo de B. Con dueño verificado,
 *     sí se pide. MUTACIÓN: quitar la condición de verificación → el espía ve el GET → grita.
 *   node scripts/check-qready-nota.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const N = await import("../public/js/qex-nucleo.mjs");
const A = await import("../lib/medicion-agentes.mjs");
const V = await import("../lib/qready-verificado.mjs");
const { textos } = await import("../public/js/qready-textos.mjs");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige la regla en qex-nucleo.mjs (una sola) o la compuerta de lib/qready-verificado.mjs antes de desplegar; nunca publica una nota sin verificado+público" };

const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const clon = (x) => JSON.parse(JSON.stringify(x));
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---------------------------------------------------------------- insumos reales grabados
const REF = JSON.parse(leer("public/data/qex-referencia-2026-08.json"));
const CT_PY = JSON.parse(gunzipSync(readFileSync(new URL("scripts/fixtures/medicion-agentes/ct-python.org.json.gz", raiz))).toString("utf8"));
const SONDAS_PY = JSON.parse(leer("scripts/fixtures/medicion-agentes/sondas-python.org.json"));
const CT_RQ = JSON.parse(gunzipSync(readFileSync(new URL("scripts/fixtures/qready/ct-rosettaquantum.com.json.gz", raiz))).toString("utf8"));
const SONDAS_RQ = JSON.parse(leer("scripts/fixtures/qready/sondas-rosettaquantum.com.json"));

async function foto(dominio, ctResp, sondas, medido = "2026-11-12T17:34:15.418Z") {
  const ct = ctResp ? await N.ctDesdeServidor(ctResp, 0) : null;
  const { foto } = N.armarFoto({ dominio, www: "www." + dominio, vertical: "banca", medido, ct, sondas, referencia: REF, origen: "guardia" });
  return await N.sellarFoto(foto);
}
const saludoAlerta = { grupo: null, hrr: null, alerta: "alert 2/70", error: null, ms: 1 };
const conEndpoint = (s, host, cambios) => { const x = clon(s); const e = x.endpoints.find((y) => y.host === host); Object.assign(e, cambios); return x; };

// ---------------------------------------------------------------- 1 · notaQEX con fotos reales
const base = await foto("python.org", CT_PY, SONDAS_PY);
const xb = N.explicarNota(base);
igual(xb.nota, "B", "python.org real: candado nuevo en el sitio, legacy.python.org responde sin evidencia → B");
igual(xb.hechos.sin_evidencia_hibrido.includes("legacy.python.org"), true, "python.org real: declara qué nombre no tiene evidencia");
igual(xb.medias.map((m) => m.codigo).sort(), ["certificado_sin_plan", "correo_responde_443", "nombre_sin_dueno"], "python.org real: alertas medias (no bajan la letra)");
igual(N.notaQEX(base), xb.nota, "notaQEX = explicarNota(...).nota");

// certificado vencido el día de la medición → F
const sVencido = clon(SONDAS_PY); sVencido.certificado.not_after = "2026-11-01T00:00:00Z";
igual(N.notaQEX(await foto("python.org", CT_PY, sVencido)), "F", "borde: certificado vencido → F");
// vence el mismo día de la medición: todavía vigente
const sHoy = clon(SONDAS_PY); sHoy.certificado.not_after = "2026-11-12T23:00:00Z";
igual(N.notaQEX(await foto("python.org", CT_PY, sHoy)), "B", "silencio: vence el día de la medición, no está vencido");
// TLS 1.2: los tres saludos TLS 1.3 reciben alerta 70 → sin TLS 1.3, sin híbrido → D
const s12 = clon(SONDAS_PY);
s12.borde.saludos = { A_como_navegador: saludoAlerta, B_solo_hibrido: saludoAlerta, C_eleccion_libre: saludoAlerta };
s12.borde.veredicto = { conectado: true, soporta: false, pide_mejora: false, elige: false };
igual(N.notaQEX(await foto("python.org", CT_PY, s12)), "D", "borde: sólo TLS 1.2 → D");
// ambiente de pruebas expuesto: staging.python.org respondiendo en 443 → F
const sPrueba = conEndpoint(SONDAS_PY, "staging.python.org", { dns_status: "NOERROR", ip: ["192.0.2.10"], responde_443: true, detalle: "responde; grupo x25519" });
const xPrueba = N.explicarNota(await foto("python.org", CT_PY, sPrueba));
igual([xPrueba.nota, xPrueba.graves[0]?.codigo, xPrueba.graves[0]?.host], ["F", "ambiente_pruebas_expuesto", "staging.python.org"], "borde: ambiente de pruebas expuesto → F");
// X25519MLKEM768 sólo en el sitio principal (el caso real) → B; con evidencia en todos los que responden → A
let sTodos = conEndpoint(SONDAS_PY, "legacy.python.org", { detalle: "responde; grupo X25519MLKEM768" });
sTodos = conEndpoint(sTodos, "mail.python.org", { detalle: "responde; grupo X25519MLKEM768" });
const fTodos = await foto("python.org", CT_PY, sTodos);
igual(N.notaQEX(fTodos), "A", "borde: candado nuevo en el principal y en todos los nombres que responden → A");
igual(N.notaQEX(fTodos, { well_known_valido: true }), "A", "A+ no sale sin inventario verificado");
igual(N.notaQEX(fTodos, { well_known_valido: true, inventario_verificado: true }), "A+", "A+ con /.well-known/q-ready válido e inventario verificado");
igual(N.notaQEX(base, { well_known_valido: true, inventario_verificado: true }), "B", "A+ no salta desde B");
// «desa»/«homolog» (SENAL_PRUEBA) que responden: ambiente de pruebas expuesto (aprobado el 13-nov)
const sDesa = clon(SONDAS_PY); sDesa.endpoints.push({ host: "openfinance-desa.python.org", medido_utc: SONDAS_PY.medido_utc, dns_status: "NOERROR", ip: ["192.0.2.20"], cname: [], responde_443: true, detalle: "responde; grupo x25519" });
igual(N.notaQEX(await foto("python.org", CT_PY, sDesa)), "F", "un nombre «desa» que responde → F (misma señal que la página)");
// el saludo B por nombre (13-nov): hibrido true en todos los que responden → A; uno en false → B
let sB = conEndpoint(SONDAS_PY, "legacy.python.org", { hibrido: true }); sB = conEndpoint(sB, "mail.python.org", { hibrido: true });
igual(N.notaQEX(await foto("python.org", CT_PY, sB)), "A", "saludo B por nombre: todos soportan → A");
igual(N.notaQEX(await foto("python.org", CT_PY, conEndpoint(sB, "mail.python.org", { hibrido: false }))), "B", "saludo B por nombre: uno no soporta → B");
igual(xb.no_evaluado, [], "«protocolo antiguo» salió de la tabla: nada queda sin evaluar");
// sin superficie (registro caído) nunca A
igual(N.notaQEX(await foto("python.org", null, sTodos)), "B", "sin registro de certificados no hay A (no se sabe qué nombres hay)");
// TLS 1.3 sin híbrido → C; con infraestructura sensible expuesta → D
const sSinHib = clon(SONDAS_PY);
sSinHib.borde.saludos.B_solo_hibrido = saludoAlerta; sSinHib.borde.saludos.C_eleccion_libre = { ...SONDAS_PY.borde.saludos.A_como_navegador };
sSinHib.borde.veredicto = { conectado: true, soporta: false, pide_mejora: false, elige: false };
igual(N.notaQEX(await foto("python.org", CT_PY, sSinHib)), "C", "TLS 1.3 sin candado nuevo → C");
// el borde que no se pudo medir: sin nota, NUNCA C ni D (null es «no medido»)
const sCorte = clon(SONDAS_PY);
const corte = { grupo: null, hrr: null, alerta: null, error: "Stream was cancelled.", ms: 9 };
sCorte.borde.saludos = { A_como_navegador: corte, B_solo_hibrido: corte, C_eleccion_libre: corte };
sCorte.borde.veredicto = { conectado: false, soporta: null, pide_mejora: null, elige: null };
const xCorte = N.explicarNota(await foto("python.org", CT_PY, sCorte));
igual([xCorte.nota, xCorte.motivo], [null, "borde_no_medido"], "borde sin respuesta → sin nota (null ≠ no)");
// rosettaquantum.com REAL: está detrás de Cloudflare y el Worker no puede abrirle sockets
const fRq = await foto("rosettaquantum.com", CT_RQ, SONDAS_RQ, SONDAS_RQ.medido_utc);
const xRq = N.explicarNota(fRq);
// (QREADY-NOTA-2.1) el certificado tampoco se leyó: «Certificados y PKI» sin medir también falta para A
igual([xRq.nota, xRq.motivo, xRq.falta_para_A.map((f) => f.codigo)], [null, "borde_no_medido", ["medir_borde", "dimension_sin_medir"]], "rosettaquantum.com real: sin nota, y lo que falta lo dice");
// cada código que puede salir tiene su texto en los dos idiomas
for (const lang of ["es", "en"]) {
  const T = textos(lang);
  for (const n of N.NOTAS) if (!T.nota_lectura[n]) fallas.push(`${lang}: falta la lectura de la nota ${n}`);
  for (const c of ["resolver_certificado_vencido", "resolver_ambiente_pruebas_expuesto", "activar_tls13", "medir_borde", "hibrido_en_principal", "cerrar_infraestructura_expuesta", "hibrido_en_nombre", "superficie_no_disponible", "nombre_sin_sondear"])
    if (typeof T.falta[c] !== "function") fallas.push(`${lang}: falta el texto de «${c}»`);
  for (const c of ["certificado_vencido", "ambiente_pruebas_expuesto", "ambiente_pruebas_publicado_bloqueado", "ambiente_pruebas_publicado", "infraestructura_expuesta", "certificado_sin_plan", "nombre_sin_dueno", "correo_responde_443"])
    if (!T.alerta[c]) fallas.push(`${lang}: falta el texto de la alerta «${c}»`);
}
// la regla de los saludos: soporta se lee SÓLO de B. Un endpoint que contestó x25519 en el saludo A es «sin evidencia».
igual([N.hibridoEnEndpoint({ responde_443: true, detalle: "responde; grupo x25519" }), N.hibridoEnEndpoint({ responde_443: true, detalle: "responde; grupo X25519MLKEM768" }), N.hibridoEnEndpoint({ responde_443: null })],
  [null, true, null], "un endpoint sin el híbrido elegido es «sin evidencia», nunca «no»");

// ---------------------------------------------------------------- 5 · qué se sondea (QREADY-NOTA-2)
igual(N.VERSION_NOTA, "QREADY-NOTA-2.1", "la nota cambió resultados el 16-nov: versión 2, y 2.1 con B1 (pendiente de aprobación)");
// grito: los nombres reales (dominio enmascarado) y la lista aprobada, como segmento o con guion
const PRUEBAS = ["openfinance-desa.banco.cl", "staging.rastreo.example", "test.rastreo.example", "serverless-staging.rastreo.example",
  "api-desarrollo.x.cl", "app-development.x.cl", "dev2.x.cl", "homologacion.x.cl", "homolog.x.cl", "hml.x.cl", "certificacion.x.cl",
  "qa.x.cl", "uat1.x.cl", "stg.x.cl", "stage.x.cl", "testing.x.cl", "prueba.x.cl", "pruebas.x.cl", "preprod.x.cl", "sandbox.x.cl",
  "demo.x.cl", "desarrollo.x.cl", "pre.fx.banco.cl"];
for (const h of PRUEBAS) igual(N.esAmbientePruebas(h), true, `grito: ${h} es un ambiente de pruebas`);
// silencio: precisión antes que cobertura («cert» sola y «pre» sola no cuentan)
const NO_PRUEBAS = ["certificados.banco.cl", "api.banco.cl", "preferencias.x.cl", "www.banco.cl", "latest.x.cl", "devops.x.cl",
  "contest.x.cl", "desarrollos.x.cl", "testimonios.x.cl", "cert.x.cl", "demostracion.x.cl", "presente.x.cl"];
for (const h of NO_PRUEBAS) igual(N.esAmbientePruebas(h), false, `silencio: ${h} no es un ambiente de pruebas`);
// PAT y la higiene NO cambian: openfinance-desa sigue sin clase de agosto (el QEX-1.0 es el de agosto)
igual(N.clasesDe("openfinance-desa.banco.cl"), [], "PAT no cambió: «desa» no entra a las clases del QEX");
igual(N.higiene(false, N.conteos(["openfinance-desa.banco.cl", "www.banco.cl"])), 70, "la higiene no cuenta la señal nueva");
// el sondeo: los nombres de pruebas entran PRIMERO, aunque 16 nombres sensibles vayan antes en el alfabeto
const hostsDe = (hs, d) => N.hostsCT(N.nombresCT([{ name_value: hs.join("\n"), not_before: "2026-01-01", not_after: "2027-01-01" }], d), d);
const muchos = Array.from({ length: 16 }, (_, i) => `mail.zona${String(i).padStart(2, "0")}.banco.cl`);
const hBanco = hostsDe([...muchos, "openfinance-desa.banco.cl", "certificados.banco.cl", "api.banco.cl", "www.banco.cl"], "banco.cl");
async function sondeoBanco(Nm) { return Nm.nombresASondear(hBanco).pedidos; }
const pBanco = await sondeoBanco(N);
igual([pBanco.length, pBanco[0]], [N.MAX_SONDEADOS, "openfinance-desa.banco.cl"], "caso real: openfinance-desa entra primero al sondeo, aunque haya 16 sensibles antes en el alfabeto");
igual(pBanco.some((h) => /^(certificados|api|www)\./.test(h)), false, "silencio: certificados.*, api.* y www.* no entran como pruebas");
const hRastreo = hostsDe(["rastreo.example", "www.rastreo.example", "assets.rastreo.example", "staging.rastreo.example", "test.rastreo.example", "serverless-staging.rastreo.example", "serverless.rastreo.example"], "rastreo.example");
igual(N.nombresASondear(hRastreo).pedidos.sort(), ["serverless-staging.rastreo.example", "staging.rastreo.example", "test.rastreo.example"], "caso real: staging, test y serverless-staging se sondean; serverless y assets no");
// la nota: el nombre de pruebas en el registro y SIN sondear no deja dar A; sondeado y respondiendo, F
const ctDesa = { ...CT_PY, texto: JSON.stringify([...JSON.parse(CT_PY.texto), { name_value: "openfinance-desa.python.org", not_before: "2026-01-01T00:00:00", not_after: "2027-01-01T00:00:00" }]) };
const fSinSondear = N.explicarNota(await foto("python.org", ctDesa, sTodos));
igual([fSinSondear.nota, fSinSondear.hechos.sensibles_sin_sondear], ["B", ["openfinance-desa.python.org"]], "nombre de pruebas en el registro y sin sondear: no hay A, y se dice cuál falta");
const fDesa = N.explicarNota(await foto("python.org", ctDesa, sDesa));
igual([fDesa.nota, fDesa.graves.map((g) => g.host)], ["F", ["openfinance-desa.python.org"]], "sondeado y respondiendo: F, con el nombre en las alertas graves");
// MUTACIONES en qex-nucleo.mjs
const NUCLEO = new URL("public/js/qex-nucleo.mjs", raiz);
await conMutante(NUCLEO, "const pruebas = hosts.filter((h) => esAmbientePruebas(h.host)).map((h) => h.host);", "const pruebas = [];",
  async (M) => igual((await sondeoBanco(M)).includes("openfinance-desa.banco.cl"), false, "MUTACIÓN: sin la señal en el sondeo, openfinance-desa no se sondea (el defecto del 16-nov)"));
await conMutante(NUCLEO, "pedidos: todos.slice(0, MAX_SONDEADOS) };", "pedidos: [...todos].sort().slice(0, MAX_SONDEADOS) };",
  async (M) => igual((await sondeoBanco(M)).includes("openfinance-desa.banco.cl"), false, "MUTACIÓN: sin prioridad (orden alfabético con el tope), openfinance-desa queda fuera"));
await conMutante(NUCLEO, "(desa|desarrollo|", "(desarrollo|",
  async (M) => igual(M.esAmbientePruebas("openfinance-desa.banco.cl"), false, "MUTACIÓN: sin «desa» en la señal, el caso real no se marca"));

// ---------------------------------------------------------------- 6 · 403 = publicado con el acceso bloqueado
const desaCon = (http_status) => { const x = clon(sDesa); const e = x.endpoints.find((y) => y.host === "openfinance-desa.python.org");
  if (http_status !== undefined) e.http_status = http_status; return x; };
async function bloqueo(Nm, http_status) {
  const ct = await Nm.ctDesdeServidor(ctDesa, 0);
  const { foto: f } = Nm.armarFoto({ dominio: "python.org", www: "www.python.org", vertical: "banca", medido: "2026-11-12T17:34:15.418Z", ct, sondas: desaCon(http_status), referencia: REF, origen: "guardia" });
  const x = Nm.explicarNota(f);
  return { nota: x.nota, graves: x.graves.map((g) => g.codigo), medias: x.medias.filter((m) => m.host === "openfinance-desa.python.org").map((m) => m.codigo) };
}
// caso real del banco: openfinance-desa responde 403 → media, el banco queda B (no tiene híbrido en ese nombre)
igual(await bloqueo(N, 403), { nota: "B", graves: [], medias: ["ambiente_pruebas_publicado_bloqueado"] }, "silencio de la F: 403 → alerta media «publicado con el acceso bloqueado», nota B");
for (const c of [200, 301, 302, 401])
  igual(await bloqueo(N, c), { nota: "F", graves: ["ambiente_pruebas_expuesto"], medias: [] }, `grito: ${c} es un ambiente de pruebas abierto → F`);
igual((await bloqueo(N, undefined)).nota, "F", "sin código HTTP (foto anterior o sonda sin código): F como hasta hoy");
igual((await bloqueo(N, 404)).nota, "F", "404 en la raíz: el servidor está ahí sirviendo → F (la excepción es sólo 403)");
// caso real del dominio de rastreo: staging 301 → F aunque serverless-staging dé 403
igual(N.explicarNota({ esquema: N.ESQUEMA_FOTO, medido_utc: "2026-11-16T00:00:00Z", certificado: {}, borde: { soporta: true }, tls13: true, ct: null,
  endpoints: [{ host: "staging.rastreo.example", clases: ["no_productivo"], responde_443: true, http_status: 301 },
    { host: "serverless-staging.rastreo.example", clases: ["no_productivo"], responde_443: true, http_status: 403 }] }).graves.map((g) => g.host),
  ["staging.rastreo.example"], "caso real: staging (301) es grave y serverless-staging (403) no");
// la sonda pide el código sin seguir redirecciones, y sin código devuelve null (nunca inventa 403)
const I = await import("../lib/informe-envivo.mjs");
const logGuardia = console.log; console.log = (...x) => { if (!/"sonda":"get_raiz"/.test(String(x[0]))) logGuardia(...x); };   // la línea de evidencia del GET, callada aquí
let pedido = null;
igual(await I.codigoHttp("x.example", async (u, o) => { pedido = { u, redirect: o.redirect, method: o.method }; return new Response(null, { status: 301, headers: { location: "https://y/" } }); }),
  { http_status: 301, http_error: null }, "la sonda devuelve el 301 tal cual");
igual(pedido, { u: "https://x.example/", redirect: "manual", method: "GET" }, "GET a la raíz sin seguir redirecciones");
igual((await I.codigoHttp("x.example", async () => { throw new Error("handshake"); })).http_status, null, "sin respuesta HTTP: null, no un código inventado");
// sólo a los que respondieron, y DESPUÉS de los saludos (en paralelo se quedaba en cola sin código: 16-nov)
const preguntados = [];
const eps = await I.conCodigoHttp([{ host: "a.example", responde_443: true }, { host: "b.example", responde_443: false }, { host: "c.example", responde_443: true }],
  async (u) => { preguntados.push(u); return new Response(null, { status: u.includes("a.") ? 403 : 200 }); });
igual([preguntados.sort(), eps.map((e) => e.http_status)], [["https://a.example/", "https://c.example/"], [403, null, 200]], "el código se pide sólo a los nombres que respondieron");
igual(/completarConVps\([\s\S]*?\);[\s\S]{0,1200}?await endpointsConRaiz\(env, dominio, endpoints1\);/.test(leer("lib/informe-envivo.mjs")), true, "manejarSondas pide el código después de los saludos y del VPS");
// techo de B (decisión del dueño, 16-nov): con candado nuevo en TODOS los nombres —también en el 403, como
// el caso real del banco— la alerta «publicado con el acceso bloqueado» deja B, nunca A; las otras medias no.
const sTecho = (() => { const x = desaCon(403); for (const e of x.endpoints) if (e.responde_443 === true) e.hibrido = true; return x; })();
async function conTecho(Nm, sondas) {
  const ct = await Nm.ctDesdeServidor(ctDesa, 0);
  const { foto: f } = Nm.armarFoto({ dominio: "python.org", www: "www.python.org", vertical: "banca", medido: "2026-11-12T17:34:15.418Z", ct, sondas, referencia: REF, origen: "guardia" });
  return Nm.explicarNota(f);
}
const xTecho = await conTecho(N, sTecho);
igual([xTecho.nota, xTecho.falta_para_A.map((f) => [f.codigo, f.host])], ["B", [["resolver_ambiente_pruebas_expuesto", "openfinance-desa.python.org"]]],
  "grito: 403 con candado nuevo en todo → B por el techo, y dice qué falta para A");
const xSB = N.explicarNota(await foto("python.org", CT_PY, sB));
igual([xSB.nota, xSB.medias.map((m) => m.codigo).sort()], ["A", ["certificado_sin_plan", "correo_responde_443", "nombre_sin_dueno"]], "silencio del techo: certificado_sin_plan, legado y correo en 443 (medias) NO bajan la A");
// MUTACIÓN: sin el techo, el banco del caso real vuelve a A
await conMutante(NUCLEO, "&& sinEvidencia.length === 0 && !techoB) out.nota = \"A\";", "&& sinEvidencia.length === 0) out.nota = \"A\";",
  async (M) => igual((await conTecho(M, sTecho)).nota, "A", "MUTACIÓN: sin el techo de B, un ambiente de pruebas bloqueado deja A (el guardia lo ve)"));
// MUTACIONES: la excepción ancha (3xx pasa a media) o ausente (403 da F)
await conMutante(NUCLEO, "export const pruebasBloqueado = (e) => !!e && e.http_status === 403;", "export const pruebasBloqueado = (e) => !!e && e.http_status >= 300;",
  async (M) => igual((await bloqueo(M, 301)).nota !== "F", true, "MUTACIÓN: con la excepción ancha, un 301 deja de dar F (el guardia lo ve)"));
await conMutante(NUCLEO, "export const pruebasBloqueado = (e) => !!e && e.http_status === 403;", "export const pruebasBloqueado = (e) => false;",
  async (M) => igual((await bloqueo(M, 403)).nota, "F", "MUTACIÓN: sin la excepción, el 403 vuelve a dar F (el guardia lo ve)"));

// ---------------------------------------------------------------- 7 · el GET sólo con dueño verificado
const INF = new URL("lib/informe-envivo.mjs", raiz);
async function sondeoRaiz(Inf, { verificado, publico = true, entorno = "produccion", dbRota = false }) {
  const db = d1EnMemoria(ESQUEMA_V);
  if (verificado !== null) await db.prepare("INSERT INTO qready_dominios (token, dominio, sector, publico, entorno, creado_utc, verificado_en) VALUES (?1,'banco.example','banca',?2,?3,?4,?5)")
    .bind(V.generarToken(), publico ? 1 : 0, entorno, "2026-11-17T00:00:00Z", verificado ? "2026-11-17T00:00:00Z" : null).run();
  const espia = [];
  const fetchEspia = async (u) => { espia.push(String(u)); return new Response(null, { status: 403 }); };
  const env = { DB: dbRota ? { prepare: () => { throw new Error("base caída"); } } : db };
  const eps = [{ host: "openfinance-desa.banco.example", responde_443: true, hibrido: true }, { host: "mail.banco.example", responde_443: false }];
  const r = await Inf.endpointsConRaiz(env, "banco.example", eps, fetchEspia);
  return { gets: espia, getPermitido: r.getPermitido, endpoints: r.endpoints };
}
const ESQUEMA_V = new URL("db/qready-verificado.schema.sql", raiz);
const logOriginal = console.log; console.log = () => {};
const sinVerif = await sondeoRaiz(I, { verificado: false });
const verif = await sondeoRaiz(I, { verificado: true });
const casos7 = { nadie: await sondeoRaiz(I, { verificado: null }), privado: await sondeoRaiz(I, { verificado: true, publico: false }),
  prueba: await sondeoRaiz(I, { verificado: true, entorno: "preview-prueba" }), rota: await sondeoRaiz(I, { verificado: true, dbRota: true }) };
console.log = logOriginal;
igual([sinVerif.gets, sinVerif.getPermitido, sinVerif.endpoints[0].http_consultado, sinVerif.endpoints[0].http_status], [[], false, false, null],
  "grito: sin dueño verificado NO se pide la página (el espía no ve ningún GET)");
for (const [k, v] of Object.entries(casos7)) igual(v.gets, [], `grito: ${k} (sin fila / verificado no público / entorno de prueba / base caída) → sin GET`);
igual([verif.gets, verif.getPermitido, verif.endpoints[0].http_status], [["https://openfinance-desa.banco.example/"], true, 403],
  "silencio: con dueño verificado sí se pide, sólo al nombre que respondió");
igual(/endpointsConRaiz\(env, dominio, endpoints1\)/.test(sinComentarios(leer("lib/informe-envivo.mjs"))), true, "manejarSondas pasa por endpointsConRaiz");
// la nota sin consultar: media «publicado» con techo de B (aun con candado nuevo en todo); y sin el campo, como antes
const sSinConsultar = (() => { const x = clon(sTecho); for (const e of x.endpoints) if (e.responde_443 === true) e.http_consultado = false; for (const e of x.endpoints) delete e.http_status; return x; })();
const xSC = await conTecho(N, sSinConsultar);
igual([xSC.nota, xSC.graves, xSC.medias.filter((m) => m.host === "openfinance-desa.python.org").map((m) => m.codigo)], ["B", [], ["ambiente_pruebas_publicado"]],
  "grito: sin consultar, el ambiente que completa el saludo es media «publicado» y la nota queda en B");
igual((await bloqueo(N, undefined)).nota, "F", "silencio: una foto sin el campo (anterior al 17-nov) se lee como antes");
// MUTACIÓN: quitar la condición de verificación → el espía ve el GET
await conMutante(INF, "return { getPermitido, endpoints: getPermitido ? await conCodigoHttp(endpoints, fetchImpl)", "return { getPermitido, endpoints: true ? await conCodigoHttp(endpoints, fetchImpl)",
  async (M) => { console.log = () => {}; const m = await sondeoRaiz(M, { verificado: false }); console.log = logOriginal;
    igual(m.gets.length > 0, true, "MUTACIÓN: sin la condición de verificación, el espía ve el GET a un dominio sin dueño verificado"); });

// ---------------------------------------------------------------- 2 · página y servidor: una sola función
const pag = sinComentarios(leer("public/js/medicion-envivo.mjs"));
igual(/N\.explicarNota\(fotoHoy\)/.test(pag), true, "la página calcula la nota con N.explicarNota(fotoHoy)");
const letraPropia = (t) => /=\s*["'](A\+|[ABCDF])["']/.test(t) || /\?\s*["'](A\+|[ABCDF])["']\s*:/.test(t);
igual(letraPropia(pag), false, "la página no asigna letras por su cuenta");
igual(letraPropia('const nota = tls13 ? "C" : "D";'), true, "el detector de letra propia grita con una regla escrita en la página");
// la señal de pruebas también es una sola: ninguna copia de la lista fuera de qex-nucleo.mjs
const listaPropia = (t) => /\b(desa|staging|homolog)\|/.test(t);
for (const ruta of ["public/js/medicion-envivo.mjs", "lib/medicion-agentes.mjs", "lib/qready-verificado.mjs", "lib/ct-registro.mjs"])
  igual(listaPropia(sinComentarios(leer(ruta))), false, `${ruta}: no escribe su propia lista de ambientes de pruebas`);
igual(listaPropia("const P = /(desa|qa)/;"), true, "el detector de lista propia grita con una copia de la señal");
igual(/N\.esAmbientePruebas\b/.test(pag), true, "la página marca los ambientes de pruebas con N.esAmbientePruebas");
for (const ruta of ["src/pages/q-ready/medicion/index.astro", "src/pages/es/q-ready/medicion/index.astro"])
  igual(["mv-letra", "mv-letra-t", "mv-letra-lee", "mv-letra-caja"].every((id) => leer(ruta).includes(`id="${id}"`)), true, `${ruta}: tiene los ids de la letra`);

function manejadores() {
  return { ct: async () => json(CT_PY), sondas: async () => json(SONDAS_PY), correo: async () => json({ ok: true, id: "c0ffee" }) };
}
const dbNula = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
async function letraServidor(mod) {
  const r = await mod.medirParaAgente({ DB: dbNula }, { dominio: "python.org", sector: "banca" }, { canal: "api", ip: "203.0.113.9" }, null, manejadores());
  return r.cuerpo.nota?.letra;
}
const errorOriginal = console.error; console.error = () => {};
const letraPagina = N.notaQEX(await foto("python.org", CT_PY, SONDAS_PY, "2026-11-12T00:00:00.000Z"));
igual(await letraServidor(A), letraPagina, "silencio: el servidor da la misma letra que la página con los mismos insumos");
const sinSector = await A.medirParaAgente({ DB: dbNula }, { dominio: "python.org" }, { canal: "api", ip: "203.0.113.9" }, null, manejadores());
igual(sinSector.cuerpo.nota, null, "sin sector no hay foto y no se inventa una letra");
// MUTACIÓN: el servidor con su propia regla (sin la foto)
await conMutante(new URL("lib/medicion-agentes.mjs", raiz), "const x = N.explicarNota(r.foto);",
  'const x = { ...N.explicarNota(r.foto), nota: r.d.borde?.veredicto?.soporta ? "A" : "C" };',
  async (M) => igual((await letraServidor(M)) !== letraPagina, true, "MUTACIÓN: un servidor con regla propia → el comparador ve otra letra"));
console.error = errorOriginal;

// ---------------------------------------------------------------- 3 · persistencia
const ESQUEMA = new URL("db/qready-verificado.schema.sql", raiz);
{
  const db = d1EnMemoria(ESQUEMA);
  const g = await V.guardarMedicion(db, { foto: base, origen: "pagina" });
  igual([g.ok, g.nota, g.ya_estaba], [true, "B", false], "guarda una foto íntegra y recalcula la nota en el servidor");
  const g2 = await V.guardarMedicion(db, { foto: base, origen: "pagina" });
  igual([g2.ok, g2.ya_estaba, g2.id], [true, true, g.id], "la misma huella no se duplica, y la base confirma que ya estaba");
  const adulterada = { ...clon(base), qex: { ...base.qex, score: 84 } };
  igual((await V.guardarMedicion(db, { foto: adulterada, origen: "pagina" })).ok, false, "una foto adulterada (huella que no calza) no entra");
  const fila = await db.prepare("SELECT nota, qex, origen, sha256 FROM qready_mediciones WHERE id = ?1").bind(g.id).first();
  igual([fila.nota, fila.qex, fila.origen, fila.sha256], ["B", base.qex.score, "pagina", base.sha256], "la fila guardada: nota, QEX, origen y huella");
  igual((await V.guardarMedicion({ prepare: () => ({ bind: () => ({ first: async () => null }) }) }, { foto: base, origen: "pagina" })).ok, false, "una base que no confirma la fila no cuenta como guardada");
}

// ---------------------------------------------------------------- 4 · la compuerta de /verificado
const SHELL = '<html><head><link rel="canonical" href="x"><meta name="robots" content="noindex"></head><body>__QV_BODY__</body></html>';
const envCon = (db) => ({ DB: db, ASSETS: { fetch: async () => new Response(SHELL, { status: 200 }) } });
const TOKENS = { paper: "#F4F5F1", panel: "#FBFBF9", ink: "#16181B", "ink-60": "#4A4E48", line: "#D9DBD6", verdict: "#0C7268", pending: "#8A6520", alert: "#B4432F" };
const ahora = "2026-11-13T00:00:00.000Z";
async function sembrar(db, { dominio, verificado, publico, entorno = "produccion" }) {
  const token = V.generarToken();
  await db.prepare("INSERT INTO qready_dominios (token, dominio, sector, publico, entorno, creado_utc, verificado_en) VALUES (?1,?2,'banca',?3,?4,?5,?6)")
    .bind(token, dominio, publico ? 1 : 0, entorno, ahora, verificado ? ahora : null).run();
  return token;
}
async function pedir(V2, db, ruta) {
  const url = new URL("https://rosettaquantum.com" + ruta);
  return await V2.manejarVerificado(new Request(url), envCon(db), url, null, { tokens: TOKENS });
}
async function compuerta(V2) {
  const db = d1EnMemoria(ESQUEMA);
  await sembrar(db, { dominio: "tercero.example", verificado: false, publico: true });
  await sembrar(db, { dominio: "privado.example", verificado: true, publico: false });
  await sembrar(db, { dominio: "prueba.example", verificado: true, publico: true, entorno: "preview-prueba" });
  await sembrar(db, { dominio: "publico.example", verificado: true, publico: true });
  // una medición de la página del dominio público, y otra del tercero: ninguna se muestra
  const fPag = { ...clon(base), dominio: "publico.example" }; const fPagSell = await N.sellarFoto((({ sha256, ...r }) => r)(fPag));
  await V2.guardarMedicion(db, { foto: fPagSell, origen: "pagina" });
  const fTer = await N.sellarFoto((({ sha256, ...r }) => r)({ ...clon(base), dominio: "tercero.example" }));
  await V2.guardarMedicion(db, { foto: fTer, origen: "servidor" });
  const out = {};
  for (const d of ["tercero.example", "privado.example", "prueba.example", "publico.example", "nadie.example"]) {
    const r = await pedir(V2, db, `/es/verificado/${d}`);
    out[d] = { status: r.status, html: await r.text() };
  }
  const sello = await pedir(V2, db, "/sello/tercero.example.svg");
  out.sello = { estado: sello.headers.get("x-qready-estado"), svg: await sello.text() };
  out.api = (await V2.notaParaApi({ DB: db }, "tercero.example", new URL("https://rosettaquantum.com/"))).cuerpo;
  return out;
}
const T = textos("es");
const c = await compuerta(V);
for (const d of ["tercero.example", "privado.example", "prueba.example", "nadie.example"]) {
  igual(c[d].status, 404, `${d}: no verificado/no público/de prueba → 404`);
  igual(c[d].html.includes(T.no_activado), true, `${d}: el 404 dice «${T.no_activado}»`);
  igual(c[d].html.includes(d), false, `${d}: el 404 no repite el dominio ni ningún dato suyo`);
}
igual(c["publico.example"].status, 200, "verificado y público → 200");
igual(c["publico.example"].html.includes(T.pag_sin_medicion), true, "la medición de la PÁGINA no se publica: el dominio público aparece sin medición");
igual([c.sello.estado, /font-size="32"/.test(c.sello.svg)], ["no-verificado", false], "sello de un tercero: neutro, sin letra");
igual([c.api.publicado, c.api.nota, Object.keys(c.api).sort()], [false, null, ["dominio", "mensaje", "nota", "ok", "publicado"]], "API/MCP de un tercero: nada más que «no publicado»");
// MUTACIÓN: la compuerta sin «publico = 1» → la nota de un tercero que no la publicó sale publicada
await conMutante(new URL("lib/qready-verificado.mjs", raiz), "AND verificado_en IS NOT NULL AND publico = 1 LIMIT 1", "AND verificado_en IS NOT NULL LIMIT 1",
  async (M) => { const m = await compuerta(M); igual(m["privado.example"].status, 200, "MUTACIÓN: sin «publico = 1», el guardia ve la página de un dominio que no la publicó"); });
await conMutante(new URL("lib/qready-verificado.mjs", raiz), "AND verificado_en IS NOT NULL AND publico = 1 LIMIT 1", "AND publico = 1 LIMIT 1",
  async (M) => { const m = await compuerta(M); igual([m["tercero.example"].status, m.sello.estado], [200, "verificado"], "MUTACIÓN: sin «verificado», la nota de un tercero no verificado sale en la página y en el sello"); });
await conMutante(new URL("lib/qready-verificado.mjs", raiz), "AND origen = 'servidor' ORDER BY", "ORDER BY",
  async (M) => { const m = await compuerta(M); igual(m["publico.example"].html.includes(T.pag_sin_medicion), false, "MUTACIÓN: sin «origen = servidor», una foto mandada por el navegador se publica"); });

if (fallas.length) { console.error("check-qready-nota: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-qready-nota: ok (${casos} casos · python.org real = ${xb.nota}, rosettaquantum.com real = sin nota · página = servidor · compuerta verificado+público con SQL real · ambientes de pruebas primero en el sondeo · 403 = media con techo B · GET sólo con dueño verificado · 11 mutaciones gritan)`);
