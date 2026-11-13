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
igual([xRq.nota, xRq.motivo, xRq.falta_para_A.map((f) => f.codigo)], [null, "borde_no_medido", ["medir_borde"]], "rosettaquantum.com real: sin nota, y lo que falta lo dice");
// cada código que puede salir tiene su texto en los dos idiomas
for (const lang of ["es", "en"]) {
  const T = textos(lang);
  for (const n of N.NOTAS) if (!T.nota_lectura[n]) fallas.push(`${lang}: falta la lectura de la nota ${n}`);
  for (const c of ["resolver_certificado_vencido", "resolver_ambiente_pruebas_expuesto", "activar_tls13", "medir_borde", "hibrido_en_principal", "cerrar_infraestructura_expuesta", "hibrido_en_nombre", "superficie_no_disponible", "nombre_sin_sondear"])
    if (typeof T.falta[c] !== "function") fallas.push(`${lang}: falta el texto de «${c}»`);
  for (const c of ["certificado_vencido", "ambiente_pruebas_expuesto", "infraestructura_expuesta", "certificado_sin_plan", "nombre_sin_dueno", "correo_responde_443"])
    if (!T.alerta[c]) fallas.push(`${lang}: falta el texto de la alerta «${c}»`);
}
// la regla de los saludos: soporta se lee SÓLO de B. Un endpoint que contestó x25519 en el saludo A es «sin evidencia».
igual([N.hibridoEnEndpoint({ responde_443: true, detalle: "responde; grupo x25519" }), N.hibridoEnEndpoint({ responde_443: true, detalle: "responde; grupo X25519MLKEM768" }), N.hibridoEnEndpoint({ responde_443: null })],
  [null, true, null], "un endpoint sin el híbrido elegido es «sin evidencia», nunca «no»");

// ---------------------------------------------------------------- 2 · página y servidor: una sola función
const pag = sinComentarios(leer("public/js/medicion-envivo.mjs"));
igual(/N\.explicarNota\(fotoHoy\)/.test(pag), true, "la página calcula la nota con N.explicarNota(fotoHoy)");
const letraPropia = (t) => /=\s*["'](A\+|[ABCDF])["']/.test(t) || /\?\s*["'](A\+|[ABCDF])["']\s*:/.test(t);
igual(letraPropia(pag), false, "la página no asigna letras por su cuenta");
igual(letraPropia('const nota = tls13 ? "C" : "D";'), true, "el detector de letra propia grita con una regla escrita en la página");
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
await conMutante(new URL("lib/medicion-agentes.mjs", raiz), "nota: notaParaAgente(N.explicarNota(r.foto))",
  'nota: notaParaAgente({ ...N.explicarNota(r.foto), nota: r.d.borde?.veredicto?.soporta ? "A" : "C" })',
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
console.log(`check-qready-nota: ok (${casos} casos · python.org real = ${xb.nota}, rosettaquantum.com real = sin nota · página = servidor · compuerta verificado+público con SQL real · 4 mutaciones gritan)`);
