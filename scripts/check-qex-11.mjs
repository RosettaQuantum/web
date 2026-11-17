#!/usr/bin/env node
/**
 * QEX-1.1: la higiene se mueve, y el QEX-1.0 publicado no cambia ni un punto (16-nov-2026).
 *
 * EL DEFECTO. En QEX-1.0 la higiene descuenta por los nombres acumulados en el registro público de
 * certificados. Caso real, grabado en scripts/fixtures/medicion-agentes/: python.org tiene en el
 * registro staging.python.org, blog-stage.python.org y ghsponsors-stage.python.org; los tres ya no
 * existen en DNS (NXDOMAIN) y aun así 1.0 le descuenta 10 de higiene por «ambiente no productivo».
 * Una organización que apaga sus ambientes de prueba no sube. QEX-1.1 (qex-nucleo.mjs, qex11) cuenta
 * sólo lo que existe y responde hoy.
 *
 * Comprueba, con las respuestas reales grabadas (las mismas de check-medicion-agentes):
 *  1. El 1.0 no cambia: el QEX-1.0 de dos dominios reales en los 12 sectores es el de antes de 1.1
 *     (tabla ORO_10, tomada de origin/main el 16-nov); la referencia publicada tiene la misma huella;
 *     la API sigue declarando QEX-1.0 en `qex`; y la foto (y la página) no traen 1.1.
 *  2. Grito: la misma organización con sus ambientes de prueba vivos y después apagados SUBE en 1.1 y
 *     NO en 1.0.
 *  3. Grito: un nombre que no se alcanzó a sondear no castiga, y se informa cuántos quedaron.
 *  3b. Grito (corrección del 16-nov): un ambiente de pruebas «-desa» que responde, con 403 o sin
 *     código HTTP (sin dueño verificado no se pide la página), descuenta en 1.1 y NO en 1.0. Defecto real: openfinance-desa.<banco>.cl respondía 403, la nota
 *     QREADY-NOTA-2 lo veía y la higiene 1.1 no; índice y nota se contradecían.
 *  4. Silencio: ambientes que siguen vivos no suben; el mismo «-desa» ya apagado no descuenta; un correo
 *     sin 443 no cuenta; DNS sin respuesta no cuenta; sin registro 1.1 = 1.0; y sin ambientes de pruebas
 *     fuera de PAT, 1.1 nunca queda bajo 1.0 con la misma medición.
 *  5. Mutaciones: cada regla rota a propósito hace gritar a una prueba de arriba.
 * Opcional: --indice <ruta a indice-agosto-2026.json> comprueba su huella y que irec lo reproduce
 * (vive fuera del repo público; sin la ruta, se declara SIN VERIFICAR, nunca aprobado).
 *   node scripts/check-qex-11.mjs [--indice ruta]
 */
import { registerHooks } from "node:module";
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const N = await import("../public/js/qex-nucleo.mjs");
const A = await import("../lib/medicion-agentes.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige qex11/superficieViva en qex-nucleo.mjs (o lo que tocó el QEX-1.0) antes de desplegar; el 1.0 publicado no se mueve sin decisión de Nicholas" };

const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const clon = (x) => JSON.parse(JSON.stringify(x));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

// ---------------------------------------------------------------- insumos reales grabados
const REF_TEXTO = leer("public/data/qex-referencia-2026-08.json");
const REF = JSON.parse(REF_TEXTO);
const gz = (r) => JSON.parse(gunzipSync(readFileSync(new URL(r, raiz))).toString("utf8"));
const CT_PY = gz("scripts/fixtures/medicion-agentes/ct-python.org.json.gz");
const SONDAS_PY = JSON.parse(leer("scripts/fixtures/medicion-agentes/sondas-python.org.json"));
const CT_RQ = gz("scripts/fixtures/qready/ct-rosettaquantum.com.json.gz");
const SONDAS_RQ = JSON.parse(leer("scripts/fixtures/qready/sondas-rosettaquantum.com.json"));
const MEDIDO = "2026-11-16T00:00:00.000Z";

async function armar(M, dominio, ctResp, sondas, vertical = "banca") {
  const ct = ctResp ? await M.ctDesdeServidor(ctResp, 0) : null;
  return M.armarFoto({ dominio, www: "www." + dominio, vertical, medido: MEDIDO, ct, sondas, referencia: REF, origen: "guardia" });
}
// El mismo nombre del registro, con otro estado de sonda.
const conEndpoint = (s, host, cambios) => { const x = clon(s); const e = x.endpoints.find((y) => y.host === host); Object.assign(e, cambios); return x; };
const sinEndpoints = (s, hosts) => { const x = clon(s); x.endpoints = x.endpoints.filter((e) => !hosts.includes(e.host)); return x; };
const VIVO = { dns_status: "NOERROR", ip: ["192.0.2.10"], cname: [], responde_443: true, detalle: "responde; grupo x25519", hibrido: false, http_status: 200 };
const PRUEBAS_PY = ["blog-stage.python.org", "ghsponsors-stage.python.org", "staging.python.org"];
// Antes de apagarlos: los tres ambientes de prueba de python.org respondiendo. Después: lo grabado (NXDOMAIN).
const ANTES = PRUEBAS_PY.reduce((s, h) => conEndpoint(s, h, VIVO), SONDAS_PY);

// ---------------------------------------------------------------- 1 · el QEX-1.0 publicado no cambia
// ORO_10: [dominio, sector, QEX-1.0, certificados, higiene, hndl, edge], calculado con origin/main
// (7212d77) antes de agregar 1.1. Si esto cambia, cambió la cifra que se publica.
const ORO_10 = [
  ["python.org", "banca", 56, 75, 50, 12, 100], ["python.org", "educacion", 62, 75, 50, 37, 100], ["python.org", "energia", 56, 75, 50, 12, 100],
  ["python.org", "fintech", 69, 75, 50, 65, 100], ["python.org", "gobierno", 56, 75, 50, 12, 100], ["python.org", "mineria", 62, 75, 50, 37, 100],
  ["python.org", "prevision", 56, 75, 50, 12, 100], ["python.org", "retail", 69, 75, 50, 65, 100], ["python.org", "salud_clinica", 56, 75, 50, 12, 100],
  ["python.org", "salud_isapre", 56, 75, 50, 12, 100], ["python.org", "seguros", 56, 75, 50, 12, 100], ["python.org", "telecom", 56, 75, 50, 12, 100],
  ["rosettaquantum.com", "banca", 41, null, 70, 12, null], ["rosettaquantum.com", "educacion", 54, null, 70, 37, null],
  ["rosettaquantum.com", "energia", 41, null, 70, 12, null], ["rosettaquantum.com", "fintech", 68, null, 70, 65, null],
  ["rosettaquantum.com", "gobierno", 41, null, 70, 12, null], ["rosettaquantum.com", "mineria", 54, null, 70, 37, null],
  ["rosettaquantum.com", "prevision", 41, null, 70, 12, null], ["rosettaquantum.com", "retail", 68, null, 70, 65, null],
  ["rosettaquantum.com", "salud_clinica", 41, null, 70, 12, null], ["rosettaquantum.com", "salud_isapre", 41, null, 70, 12, null],
  ["rosettaquantum.com", "seguros", 41, null, 70, 12, null], ["rosettaquantum.com", "telecom", 41, null, 70, 12, null],
];
// Huella de la referencia publicada (medianas por sector de la edición de agosto).
const HUELLA_REF = "054d7c22cd9309895dc6c031df86da911f45a935b38a3c5087848597c1570866";
const HUELLA_INDICE = "6bd17d8681604f0b2e855702f249895292b13af049a0af2aab119758dcde1990";

async function oro10(M) {
  const dio = [];
  for (const [dom, v] of ORO_10) {
    const { foto } = await armar(M, dom, dom === "python.org" ? CT_PY : CT_RQ, dom === "python.org" ? SONDAS_PY : SONDAS_RQ, v);
    const d = foto.qex.dimensiones;
    dio.push([dom, v, foto.qex.score, d.certificados, d.higiene, d.hndl, d.edge]);
  }
  return dio;
}
const unoCero = async (M) => { igual(await oro10(M), ORO_10, "el QEX-1.0 de dos dominios reales en los 12 sectores es el de antes de 1.1"); };
await unoCero(N);
igual(N.VERSION_QEX, "QEX-1.0", "la versión publicada sigue siendo QEX-1.0");
igual(createHash("sha256").update(REF_TEXTO).digest("hex"), HUELLA_REF, "la referencia publicada (medianas de agosto) no cambió");
{
  const { foto, detalle } = await armar(N, "python.org", CT_PY, SONDAS_PY);
  igual([foto.qex.version, detalle.q11.version], ["QEX-1.0", "QEX-1.1"], "la foto declara QEX-1.0; el detalle trae 1.1 aparte");
  igual(JSON.stringify(foto).includes("QEX-1.1") || "q11" in foto || "qex_1_1" in foto, false, "1.1 no entra a la foto (ni a su huella, ni al PDF)");
}
const pag = sinComentarios(leer("public/js/medicion-envivo.mjs"));
igual(/q11|qex11|qex_1_1|VERSION_QEX_11/.test(pag), false, "la página no muestra 1.1");

// La API: `qex` sigue siendo 1.0 y trae 1.1 en `qex_1_1`, por el mismo camino que la página.
const dbNula = { prepare: () => ({ bind: () => ({ first: async () => null }) }) };
const manejadores = (sondas) => ({ ct: async () => json(CT_PY), sondas: async () => json(sondas), correo: async () => json({ ok: true, id: "c0ffee" }) });
async function api(M, sondas = SONDAS_PY) {
  const r = await M.medirParaAgente({ DB: dbNula }, { dominio: "python.org", sector: "banca" }, { canal: "api", ip: "203.0.113.9" }, null, manejadores(sondas));
  return r.cuerpo;
}
const errorOriginal = console.error; console.error = () => {};
const apiA = async (M) => {
  const c = await api(M);
  igual([c.qex?.version, c.qex?.valor, c.qex?.dimensiones?.higiene?.valor], ["QEX-1.0", 56, 50], "API: `qex` es QEX-1.0 y no cambió");
  igual([c.qex_1_1?.version, c.qex_1_1?.publicado, c.qex_1_1?.valor, c.qex_1_1?.dimensiones?.higiene, c.qex_1_1?.diferencia_con_1_0],
    ["QEX-1.1", false, 58, 60, 2], "API: `qex_1_1` aparte, no publicado, con su versión y dimensiones");
  // La ficha rosetta-ficha/1 (bloque estructurado y markdown) declara QEX-1.0 y no trae 1.1.
  const ficha = JSON.stringify(c.presentacion ?? null);
  igual([c.presentacion != null, /QEX-1\.1|qex_1_1|q11/.test(ficha), /QEX-1\.0/.test(ficha)], [true, false, true], "la ficha sigue en QEX-1.0 y no trae 1.1");
};
await apiA(A);

// ---------------------------------------------------------------- 2 · grito: apagar los ambientes de prueba sube en 1.1, no en 1.0
async function apagar(M) {
  const a = (await armar(M, "python.org", CT_PY, ANTES)).detalle, d = (await armar(M, "python.org", CT_PY, SONDAS_PY)).detalle;
  return { h10: [a.q.dimensiones.higiene, d.q.dimensiones.higiene], q10: [a.q.score, d.q.score],
    h11: [a.q11.dimensiones.higiene, d.q11.dimensiones.higiene], q11: [a.q11.score, d.q11.score] };
}
const gritoApagar = async (M) => {
  const r = await apagar(M);
  igual([r.h10, r.q10], [[50, 50], [56, 56]], "1.0: apagar los ambientes de prueba NO mueve la higiene (el registro los guarda)");
  igual([r.h11, r.q11], [[50, 60], [56, 58]], "1.1: apagar los ambientes de prueba SUBE la higiene 10 y el QEX 2");
};
await gritoApagar(N);

// ---------------------------------------------------------------- 3 · grito: no sondeado no castiga
const gritoSinSondear = async (M) => {
  // Los tres ambientes de prueba VIVOS, pero fuera del sondeo (como si no hubieran cabido en el tope).
  const { detalle } = await armar(M, "python.org", CT_PY, sinEndpoints(ANTES, PRUEBAS_PY));
  igual([detalle.q11.dimensiones.higiene, detalle.q11.superficie.sin_sondear, detalle.q11.superficie.sin_sondear_por_clase.no_productivo],
    [60, 3, 3], "un nombre no sondeado no castiga, y se informa cuántos quedaron sin sondear");
  // Sintético con el tope de verdad: 20 nombres de infraestructura en el registro, 15 sondeados, 2 vivos.
  const dom = "ejemplo.cl";
  const hostsPat = Array.from({ length: 20 }, (_, i) => ({ host: `vpn.n${String(i).padStart(2, "0")}.${dom}` }));
  const { pedidos } = M.nombresASondear(hostsPat.map((h) => ({ ...h, clases: M.clasesDe(h.host) })));
  const eps = pedidos.map((h, i) => (i < 2 ? { host: h, ...VIVO } : { host: h, dns_status: "NXDOMAIN", responde_443: null }));
  const viva = M.superficieViva(eps, hostsPat);
  igual([pedidos.length, viva.vivo, viva.no_vigente, viva.sin_sondear, viva.conteos.infra_expuesta,
    M.higiene(false, viva.conteos), M.higiene(false, M.conteos(hostsPat.map((h) => h.host)))],
    [15, 2, 13, 5, 2, 70, 60], "tope de 15: 5 sin sondear no castigan; 2 vivos de infraestructura no llegan al umbral de 3");
};
await gritoSinSondear(N);

// ---------------------------------------------------------------- 3b · grito: «-desa» vivo descuenta en 1.1, no en 1.0
// rosettaquantum.com real (higiene 1.0 = 70, sin nombres que castiguen) con un ambiente «-desa» en el
// registro que responde 403: el caso del banco, sin nombrarlo.
const DESA = "openfinance-desa.rosettaquantum.com";
const conNombreCT = (ctResp, host) => { const x = clon(ctResp); const filas = JSON.parse(x.texto); filas.push({ ...filas[0], name_value: host }); x.texto = JSON.stringify(filas); return x; };
const conEndpointNuevo = (s, e) => { const x = clon(s); x.endpoints.push(e); return x; };
const gritoDesa = async (M) => {
  const ct = conNombreCT(CT_RQ, DESA);
  const vivo = (await armar(M, "rosettaquantum.com", ct, conEndpointNuevo(SONDAS_RQ, { host: DESA, ...VIVO, http_status: 403 }))).detalle;
  igual([M.esAmbientePruebas(DESA), M.nombresASondear(vivo.hosts).pedidos.includes(DESA)], [true, true], "«-desa» es ambiente de pruebas y se sondea");
  igual([vivo.q.dimensiones.higiene, vivo.q.score, vivo.cuentas.no_productivo], [70, 41, 0], "1.0: el «-desa» vivo NO descuenta (PAT de agosto, sin cambios)");
  igual([vivo.q11.dimensiones.higiene, vivo.q11.superficie.conteos.no_productivo, vivo.q11.historico.no_productivo, vivo.q11.score], [60, 1, 0, 36],
    "1.1: el «-desa» que responde 403 DESCUENTA 10 (en el índice, publicado es superficie)");
  const apagado = (await armar(M, "rosettaquantum.com", ct, conEndpointNuevo(SONDAS_RQ, { host: DESA, dns_status: "NXDOMAIN", ip: [], cname: [], responde_443: null, detalle: "el nombre ya no existe en DNS" }))).detalle;
  igual([apagado.q11.dimensiones.higiene, apagado.q11.superficie.no_vigente], [70, 1], "silencio: el mismo «-desa» apagado no descuenta en 1.1");
  // La nota y el índice dicen lo mismo del mismo nombre: la nota lo ve (alerta) y la higiene 1.1 lo descuenta.
  const { foto } = await armar(M, "rosettaquantum.com", ct, conEndpointNuevo(SONDAS_RQ, { host: DESA, ...VIVO, http_status: 403 }));
  const x = M.explicarNota(foto);
  igual([[...x.graves, ...x.medias].some((a) => a.host === DESA), vivo.q11.superficie.conteos.no_productivo > 0], [true, true], "nota e índice 1.1 ven el mismo ambiente de pruebas");
  // Sin dueño verificado no se pide la página (main, 17-nov): no hay código HTTP. Responder en TLS basta
  // para contar como vivo en 1.1, igual que la nota lo lee como «ambiente_pruebas_publicado».
  const sinPagina = { host: DESA, ...VIVO, http_status: null, http_consultado: false };
  const sp = (await armar(M, "rosettaquantum.com", ct, conEndpointNuevo(SONDAS_RQ, sinPagina))).detalle;
  const fsp = (await armar(M, "rosettaquantum.com", ct, conEndpointNuevo(SONDAS_RQ, sinPagina))).foto;
  igual([sp.q.dimensiones.higiene, sp.q11.dimensiones.higiene, sp.q11.superficie.conteos.no_productivo,
    [...M.explicarNota(fsp).graves, ...M.explicarNota(fsp).medias].some((a) => a.host === DESA)], [70, 60, 1, true],
    "sin código HTTP (página no consultada): el «-desa» que responde en TLS descuenta en 1.1, no en 1.0, y la nota lo ve");
};
await gritoDesa(N);

// ---------------------------------------------------------------- 4 · silencio
const silencio = async (M) => {
  const vivos = (await armar(M, "python.org", CT_PY, ANTES)).detalle;
  igual(vivos.q11.dimensiones.higiene, vivos.q.dimensiones.higiene, "silencio: ambientes de prueba que siguen vivos no suben en 1.1");
  // Correo con DNS vigente que no responde en 443: no cuenta como vivo.
  const correo = (await armar(M, "python.org", CT_PY, conEndpoint(SONDAS_PY, "mail.python.org", { responde_443: false, detalle: "sin respuesta TLS en 443 (x)" }))).detalle;
  igual([M.estadoVivo(correo.endpoints.find((e) => e.host === "mail.python.org")), correo.q11.superficie.conteos.infra_expuesta, correo.q11.superficie.sin_443],
    ["sin_443", 0, 1], "silencio: DNS vigente sin 443 no cuenta");
  const sinDns = (await armar(M, "python.org", CT_PY, conEndpoint(SONDAS_PY, "legacy.python.org", { dns_status: null, responde_443: null, ip: [] }))).detalle;
  igual([sinDns.q11.superficie.sin_dato, sinDns.q11.superficie.conteos.legado, sinDns.q11.dimensiones.higiene], [1, 0, 70],
    "silencio: DNS sin respuesta es «no medido» y no castiga");
  const sinCt = (await armar(M, "python.org", null, SONDAS_PY)).detalle;
  igual([sinCt.q11.dimensiones.higiene, sinCt.q11.score, sinCt.q11.superficie], [sinCt.q.dimensiones.higiene, sinCt.q.score, null],
    "silencio: sin registro 1.1 = 1.0 (sólo TLS)");
  for (const [n, det] of [["vivos", vivos], ["correo", correo], ["sin DNS", sinDns], ["sin registro", sinCt],
    ["apagados", (await armar(M, "python.org", CT_PY, SONDAS_PY)).detalle], ["rosettaquantum.com", (await armar(M, "rosettaquantum.com", CT_RQ, SONDAS_RQ)).detalle]])
    igual(det.q11.dimensiones.higiene >= det.q.dimensiones.higiene, true, `sin pruebas fuera de PAT, 1.1 nunca bajo 1.0 (${n})`);
};
await silencio(N);

// ---------------------------------------------------------------- 5 · mutaciones: cada una tiene que hacer gritar
const NUC = new URL("public/js/qex-nucleo.mjs", raiz), AGE = new URL("lib/medicion-agentes.mjs", raiz);
async function grita(nombre, url, de, a, prueba) {
  const antes = fallas.length, c0 = casos;
  await conMutante(url, de, a, async (M) => { try { await prueba(M); } catch (e) { fallas.push(`lanzó: ${e.message}`); } });
  const gritos = fallas.length - antes;
  fallas.length = antes; casos = c0 + 1;
  if (gritos === 0) fallas.push(`MUTACIÓN «${nombre}»: el guardia no gritó`);
}
await grita("1.1 cuenta también lo apagado", NUC, 'if (est === "vivo") conteosVivos[k]++;', 'if (est !== "sin_sondear") conteosVivos[k]++;', gritoApagar);
await grita("1.1 lee el registro histórico", NUC, "higiene(sinTls13, viva ? viva.conteos : null)", "higiene(sinTls13, viva ? cuentas : null)", gritoApagar);
await grita("no sondeado castiga", NUC, 'if (est === "vivo") conteosVivos[k]++;', 'if (est === "vivo" || est === "sin_sondear") conteosVivos[k]++;', gritoSinSondear);
await grita("vivo = DNS vigente, sin mirar el 443", NUC, 'if (e.responde_443 === true) return "vivo";', 'if (e.responde_443 === true || e.dns_status === "NOERROR") return "vivo";', silencio);
await grita("1.1 vuelve a la clase de agosto", NUC, '  if (esAmbientePruebas(host) && !k.includes("no_productivo")) k.push("no_productivo");', "", gritoDesa);
await grita("un 403 no cuenta como vivo", NUC, 'if (e.responde_443 === true) return "vivo";', 'if (e.responde_443 === true && e.http_status !== 403) return "vivo";', gritoDesa);
await grita("sin código HTTP no cuenta como vivo", NUC, 'if (e.responde_443 === true) return "vivo";', 'if (e.responde_443 === true && e.http_status != null) return "vivo";', gritoDesa);
await grita("el 1.0 adopta la señal en español", NUC, "for (const k of Object.keys(PAT)) o[k] = hosts.filter((h) => PAT[k].test(h)).length;",
  'for (const k of Object.keys(PAT)) o[k] = hosts.filter((h) => PAT[k].test(h) || (k === "no_productivo" && esAmbientePruebas(h))).length;', gritoDesa);
await grita("el 1.0 pasa a contar lo vivo", NUC, "higiene: higiene(sinTls13, cuentas),", "higiene: higiene(sinTls13, ct ? superficieViva(endpoints, hosts).conteos : null),", unoCero);
await grita("la API publica 1.1 en `qex`", AGE, "const { q, tipos, ref } = detalle;", "const { q11: q, tipos, ref } = detalle;", apiA);
console.error = errorOriginal;

// ---------------------------------------------------------------- opcional: el índice de agosto (fuera del repo)
const i = process.argv.indexOf("--indice");
let sinVerificar = "";
if (i > 0 && existsSync(process.argv[i + 1])) {
  const t = readFileSync(process.argv[i + 1]);
  igual(createHash("sha256").update(t).digest("hex"), HUELLA_INDICE, "el índice de agosto es el sellado");
  const idx = JSON.parse(t.toString("utf8"));
  igual(idx.filter((r) => N.irec(r) !== r.score).length, 0, `irec reproduce las ${idx.length} filas del índice de agosto`);
} else sinVerificar = " · índice de agosto SIN VERIFICAR (vive fuera del repo; pase --indice)";

if (fallas.length) { console.log(`check-qex-11: ${fallas.length} falla(s) de ${casos}`); for (const f of fallas) console.log("  ✗ " + f); process.exit(1); }
console.log(`check-qex-11: ok (${casos} casos: 1.0 sin cambios, apagar sube en 1.1, no sondeado no castiga, «-desa» vivo descuenta sólo en 1.1, silencios y 10 mutaciones que gritan)${sinVerificar}`);
