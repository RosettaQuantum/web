#!/usr/bin/env node
/**
 * La rúbrica maestra del QEX y de la nota (18-nov-2026) dice lo que hace el código. Si divergen, el
 * build se detiene.
 *
 * POR QUÉ EXISTE. El defecto real que la abrió: yu-track.com salió D, con TLS 1.3, y lo único escrito
 * sobre la D (el comentario del núcleo, servido en /js/qex-nucleo.mjs) decía que era sólo para TLS 1.2 o
 * anterior. La regla había cambiado el 16-nov; la prosa no. Una tabla escrita a mano envejece así, sin
 * avisar. Aquí la tabla se GENERA de las constantes (public/js/rubrica-qex.mjs) y este guardia comprueba
 * las dos direcciones:
 *
 *  1. LO PUBLICADO = LO GENERADO. Se regenera en memoria y se compara byte a byte con
 *     public/data/rubrica-qex.{json,es.csv,en.csv} y docs/textos-provisorios-rubrica.md. Una constante
 *     cambiada (un −30 que pasa a −25) sin regenerar → grita y dice el comando.
 *  2. LA CONSTANTE = LO QUE HACE LA FUNCIÓN. Se sondea cada función en su umbral y un paso antes:
 *     certificadosValor, higiene, edgeValor, irec (renormalización, tope, redondeo al par). Una regla
 *     cambiada a mano dentro de la función, con la constante intacta → grita.
 *  3. LA ESCALA = explicarNota. ESCALA_NOTA (lo que se publica) tiene que dar la MISMA letra que
 *     explicarNota (lo que decide) en TODAS las combinaciones de hechos: 20.736 fotos sintéticas
 *     (grave, alta, ambiente publicado, sin evidencia, sin sondear, borde, TLS 1.3, registro, dimensión,
 *     well-known, inventario, medias). Y las alertas que emite explicarNota son las de ALERTAS_NOTA, con
 *     su nivel. Cubre las 9 reglas de la escala.
 *  4. Las normas citadas siguen citadas en el archivo del repo que la rúbrica nombra.
 *  5. MUTACIONES (grito): una constante cambiada sin regenerar; la función cambiada con la constante
 *     intacta; la D del 16-nov cambiada en explicarNota; la misma regla borrada de la escala; el umbral de
 *     la dimensión. SILENCIO: el árbol sin tocar pasa (la corrida misma).
 *   node scripts/check-rubrica-qex.mjs
 */
import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
// lib/informe-envivo.mjs importa "cloudflare:sockets": aquí no se abre ningún socket.
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
import { createHash } from "node:crypto";
const N = await import("../public/js/qex-nucleo.mjs");
const R = await import("../public/js/rubrica-qex.mjs");
const B = await import("./build-rubrica-qex.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta, antes de desplegar", hace: "regenera la rúbrica (node scripts/build-rubrica-qex.mjs) si cambió una constante a propósito, o corrige la función o la escala que se apartó; nunca publica una rúbrica que el código no produce" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const NUCLEO = new URL("public/js/qex-nucleo.mjs", raiz);
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const sha = (t) => createHash("sha256").update(t).digest("hex");

// ---------------------------------------------------------------- 1 · lo publicado = lo generado
const PUBLICADOS = [["public/data/rubrica-qex.es.csv", (g) => g.csv.es], ["public/data/rubrica-qex.en.csv", (g) => g.csv.en],
  ["public/data/rubrica-qex.json", (g) => g.json], ["docs/textos-provisorios-rubrica.md", (g) => g.md]];
function divergencias(g) {
  const out = [];
  for (const [ruta, de] of PUBLICADOS) {
    let antes = null; try { antes = leer(ruta); } catch { out.push(`${ruta} no existe`); continue; }
    if (antes !== de(g)) {
      const a = antes.split(/\r?\n/), b = de(g).split(/\r?\n/);
      const i = a.findIndex((l, k) => l !== b[k]);
      out.push(`${ruta} no es lo que genera el código (primera línea distinta: ${i + 1})`);
    }
  }
  return out;
}
const g = B.generar();
const div = divergencias(g);
igual(div, [], "lo publicado = lo que genera el código (si cambió una regla a propósito: node scripts/build-rubrica-qex.mjs)");

// la huella del JSON y las de los CSV
const J = JSON.parse(leer("public/data/rubrica-qex.json"));
{ const { sha256, ...resto } = J; igual(sha256, sha(N.canon(resto)), "rubrica-qex.json: su sha256 cubre el JSON sin ese campo"); }
igual([J.csv.es.sha256, J.csv.en.sha256], [sha(leer("public/data/rubrica-qex.es.csv")), sha(leer("public/data/rubrica-qex.en.csv"))], "el JSON declara el sha256 real de cada CSV");
igual([J.rige.qex, J.rige.nota], [N.VERSION_QEX, N.VERSION_NOTA], "la rúbrica declara las versiones vigentes del núcleo");

// ---------------------------------------------------------------- 2 · la constante = lo que hace la función
function sondearFunciones(M) {
  const RC = M.REGLA_CERTIFICADOS, RH = M.REGLA_HIGIENE, RE = M.REGLA_EDGE, out = [];
  const ok = (a, b, q) => { if (JSON.stringify(a) !== JSON.stringify(b)) out.push(`${q}: la constante dice ${JSON.stringify(b)}, la función da ${JSON.stringify(a)}`); };
  const cert = (algoritmo, bits) => M.certificadosValor({ ok: true, algoritmo, bits });
  // QEX-1.2: la constante (fuerza mínima, valores) contra la función, en el umbral y un paso antes
  ok([cert("RSA", 2048), cert("RSA", 2047), cert("EC", RC.fuerza_min * 2), cert("EC", RC.fuerza_min * 2 - 1), cert("ML-DSA", 128), M.certificadosValor({ ok: false }), M.certificadosValor(null)],
    [RC.aprobada, RC.bajo, RC.aprobada, RC.bajo, RC.pq, null, null], "certificados QEX-1.2: umbral de fuerza RSA y de curva, ML-DSA, sin certificado = null");
  // QEX-1.0 sigue leyéndose con su regla (las fotos guardadas)
  const R10 = M.REGLAS_CERTIFICADOS["QEX-1.0"], c10 = (algoritmo, bits) => M.certificadosValor({ ok: true, algoritmo, bits }, "QEX-1.0");
  ok([c10("RSA", R10.rsa_bits), c10("RSA", R10.rsa_bits - 1), c10("EC", R10.curva_bits), c10("EC", R10.curva_bits - 1)],
    [R10.supera, R10.minimo, R10.supera, R10.minimo], "certificados QEX-1.0 (fotos guardadas): su umbral de tamaño");
  ok(M.higiene(false, {}), RH.base, "higiene: base");
  ok(M.higiene(null, {}), RH.base, "higiene: TLS 1.3 sin dato no descuenta");
  ok(M.higiene(true, null), RH.base + RH.sin_tls13, "higiene: sin TLS 1.3, sin registro");
  for (const k of ["no_productivo", "infra_expuesta", "legado"]) {
    ok(M.higiene(false, { [k]: RH[k].desde }), RH.base + RH[k].puntos, `higiene: ${k} en el umbral (${RH[k].desde})`);
    ok(M.higiene(false, { [k]: RH[k].desde - 1 }), RH.base, `higiene: ${k} un paso antes del umbral`);
    ok(M.higiene(false, null), RH.base, `higiene: sin registro no descuenta ${k}`);
  }
  const todo = { no_productivo: 99, infra_expuesta: 99, legado: 99 };
  ok(M.higiene(true, todo), Math.max(RH.piso, RH.base + RH.sin_tls13 + RH.no_productivo.puntos + RH.infra_expuesta.puntos + RH.legado.puntos), "higiene: los cuatro descuentos juntos");
  ok([M.edgeValor(true), M.edgeValor(false), M.edgeValor(null)], [RE.soporta, RE.no_soporta, null], "borde");
  const P = M.PESOS;
  ok(Math.round(Object.values(P).reduce((a, b) => a + b, 0) * 1e9) / 1e9, 1, "los pesos suman 1");
  ok(M.irec({ certificados: 100, higiene: 100, hndl: 100, edge: 100 }), M.TOPE, "irec: el tope");
  const d = { certificados: null, higiene: 60, hndl: 12, edge: 100 };
  ok(M.irec(d), M.redondearPar((60 * P.higiene + 12 * P.hndl + 100 * P.edge) / (P.higiene + P.hndl + P.edge)), "irec: renormaliza sobre los pesos medidos");
  ok([M.redondearPar(56.5), M.redondearPar(57.5), M.redondearPar(56.4)], [56, 58, 56], "redondeo al par");
  return out;
}
for (const f of sondearFunciones(N)) fallas.push(f); casos++;

// la referencia: RQ.S.04 publica los valores de la tabla, uno por sector
const REF = JSON.parse(leer(B.REFERENCIA_ARCHIVO));
const f04 = g.es.filas.find((f) => f.id === "RQ.S.04");
igual(Object.values(REF.verticales).every((v) => f04.regla.includes(`${v.nombre} ${v.hndl}`)), true, "RQ.S.04 publica el valor HNDL de cada sector de la referencia");
igual(g.es.filas.filter((f) => /^RQ\.S\.04\.\d$/.test(f.id)).every((f) => f.metodo.includes(REF.hndl_edicion || REF.edicion) && /no está publicada/.test(f.metodo)), true,
  "RQ.S.04.1 a .3 declaran: tabla fijada en la edición del modelo HNDL (hndl_edicion, 24-nov-2026); la derivación no está publicada");

// ---------------------------------------------------------------- 3 · ESCALA_NOTA = explicarNota
const DOM = "ejemplo.cl";
function fotoSintetica(M, c) {
  const eps = [], hosts = [];
  const ep = (sub, extra = {}) => { const host = `${sub}.${DOM}`; eps.push({ host, clases: M.clasesDe(host), responde_443: true, hibrido: true, http_status: null, http_consultado: null, ...extra }); hosts.push({ host, clases: M.clasesDe(host) }); };
  if (c.grave === "pruebas") ep("staging", { http_status: 200, http_consultado: true });
  if (c.alta) ep("vpn");
  if (c.techo === "sin_consultar") ep("dev", { http_consultado: false });
  if (c.techo === "403") ep("uat", { http_status: 403, http_consultado: true });
  if (c.sinEvidencia) ep("api", { hibrido: false });
  if (c.medias) { ep("mail"); ep("old"); }
  if (c.sinSondear) hosts.push({ host: `backup.${DOM}`, clases: M.clasesDe(`backup.${DOM}`) });
  return { esquema: M.ESQUEMA_FOTO, dominio: DOM, www: `www.${DOM}`, medido_utc: "2026-11-18T12:00:00.000Z",
    certificado: { ok: true, algoritmo: "RSA", bits: 2048, not_after: c.grave === "certificado" ? "2026-01-01" : "2027-12-31" },
    endpoints: eps, borde: { soporta: c.principal }, tls13: c.tls13,
    ct: c.ct ? { hosts, conteos: {} } : null,
    qex: { dimensiones: { certificados: c.sinDim ? null : 75, higiene: 60, hndl: 12, edge: 100 } } };
}
function* combinaciones() {
  for (const grave of [null, "certificado", "pruebas"]) for (const alta of [false, true]) for (const techo of [null, "sin_consultar", "403"])
  for (const sinEvidencia of [false, true]) for (const sinSondear of [false, true]) for (const principal of [true, false, null])
  for (const tls13 of [true, false, null]) for (const ct of [true, false]) for (const sinDim of [false, true])
  for (const wk of [false, true]) for (const inv of [false, true]) for (const medias of [false, true])
    yield { grave, alta, techo, sinEvidencia, sinSondear, principal, tls13, ct, sinDim, medias, extras: { well_known_valido: wk, inventario_verificado: inv } };
}
function compararEscala(M) {
  let n = 0; const malas = [], reglas = new Set(), alertasMal = new Set();
  const nivelDe = new Map(M.ALERTAS_NOTA.map((a) => [a.codigo, a.nivel]));
  for (const c of combinaciones()) {
    n++;
    const x = M.explicarNota(fotoSintetica(M, c), c.extras);
    const e = M.notaPorEscala(x, c.extras);
    reglas.add(e.regla);
    if (e.nota !== x.nota) { if (malas.length < 3) malas.push({ c: { ...c, extras: undefined, ...c.extras }, explicarNota: x.nota, escala: e.nota, regla: e.regla }); else malas.push(null); }
    for (const [nivel, lista] of [["grave", x.graves], ["alta", x.altas], ["media", x.medias]])
      for (const a of lista) if (nivelDe.get(a.codigo) !== nivel) alertasMal.add(`${a.codigo}:${nivel}`);
  }
  return { n, malas, reglas, alertasMal: [...alertasMal] };
}
const cmp = compararEscala(N);
igual(cmp.malas.length, 0, `ESCALA_NOTA da la misma letra que explicarNota en ${cmp.n} combinaciones (primeras distintas: ${JSON.stringify(cmp.malas.slice(0, 2))})`);
igual(cmp.n, 20736, "la grilla de hechos completa");
igual(N.ESCALA_NOTA.map((e) => e.regla).filter((r) => !cmp.reglas.has(r)), [], "las 9 reglas de la escala se ejercen en la grilla");
igual(cmp.alertasMal, [], "cada alerta que emite explicarNota está en ALERTAS_NOTA con el mismo nivel");
igual(N.ALERTAS_NOTA.filter((a) => a.techo_b).map((a) => a.codigo).sort(), [...N.MEDIAS_CON_TECHO_B].sort(), "las medias con techo B son las mismas en la escala y en explicarNota");
igual(Object.keys(N.VERSIONES_NOTA).includes(N.VERSION_NOTA), true, "la versión vigente de la nota está en VERSIONES_NOTA");
const desdes = [...N.ESCALA_NOTA, ...N.ALERTAS_NOTA, ...N.CONDICIONES_A].map((e) => e.desde.split(" ")[0]);
igual(desdes.filter((d) => !(d in N.VERSIONES_NOTA)), [], "cada «rige desde» de la escala nombra una versión de la nota que existe");
// el caso real: TLS 1.3, sin candado nuevo, con una alerta alta → D (regla aprobada el 16-nov), y la escala lo dice
{ const x = N.explicarNota(fotoSintetica(N, { principal: false, tls13: true, alta: true, ct: true }));
  igual([x.nota, N.notaPorEscala(x).regla], ["D", "sin_candado_con_alta"], "TLS 1.3 + sin candado nuevo + alerta alta = D, por la regla «sin_candado_con_alta»"); }

// ---------------------------------------------------------------- 4 · las normas siguen citadas donde se dice
for (const [k, n] of Object.entries(R.NORMAS)) igual(leer(n.citada_en).includes(n.busca), true, `norma ${k}: «${n.busca}» sigue citada en ${n.citada_en}`);

// ---------------------------------------------------------------- 4 bis · el tope de nombres: UNA definición (18-nov)
// El tope que publica la rúbrica (RQ.S.09.7 y «Qué nombres se sondean») es el que aplican /api/sondas y el
// pedido al VPS: los dos lo importan de qex-nucleo. Se prueba por comportamiento, no por texto.
{
  const IE = await import("../lib/informe-envivo.mjs"), SV = await import("../lib/sonda-tls-vps.mjs");
  const T = N.MAX_SONDEADOS, nombres = (n) => Array.from({ length: n }, (_, i) => `n${i}.ejemplo.cl`);
  const pide = async (n) => { const r = await IE.manejarSondas(new Request("https://x/api/sondas", { method: "POST", body: JSON.stringify({ dominio: "ejemplo.cl", sensibles: nombres(n) }) }), {});
    return [r.status, (await r.json()).error || null]; };
  igual(await pide(T + 1), [400, `Como máximo ${T} endpoints por medición.`], `/api/sondas rechaza ${T + 1} nombres con el tope del núcleo (${T})`);
  const fallidos = nombres(T + 5).map((host) => ({ host, ip: ["192.0.2.1"], responde_443: false, detalle: "sin respuesta TLS en 443" }));
  igual(SV.pedidoParaVps({ dominio: "ejemplo.cl", www: "www.ejemplo.cl", borde: null, certificado: null, endpoints: fallidos }).hosts.length, T, `el pedido al VPS se corta en el tope del núcleo (${T})`);
  const f97 = g.es.filas.find((f) => f.id === "RQ.S.09.7"), sondeo = g.es.pat.find((f) => f.id === "PAT.sondeo");
  igual([f97.metodo.includes(`hasta ${T} nombres`), sondeo.regla.includes(`hasta ${T} nombres`)], [true, true], "la rúbrica publica ese mismo tope");
}

// ---------------------------------------------------------------- 4 ter · la llave según NIST IR 8547 (QEX-1.2, 18-nov)
// Anclado a la FUENTE, no a la constante: IR 8547 final, tabla 2 (docs/fuentes/regla-llave-2026-11-18.md),
// pone a RSA ≥ 112, ECDSA ≥ 112 y EdDSA ≥ 128 bits en la misma fila: «Deprecated after 2030 / Disallowed
// after 2035». Por eso RSA-2048, RSA-3072, RSA-4096, P-256, P-384 y Ed25519 tienen que valer LO MISMO, y
// RSA-1024 (bajo 112) menos; un certificado ML-DSA (tabla 3) más. La regla de agosto (RSA-4096 y P-384 = 100)
// no pasa esto: grita.
function reglaLlave(M) {
  const v = (algoritmo, bits) => M.certificadosValor({ ok: true, algoritmo, bits });
  const clasicas = [v("RSA", 2048), v("RSA", 3072), v("RSA", 4096), v("EC", 256), v("EC", 384), v("Ed25519", 256)];
  return { iguales: new Set(clasicas).size === 1 && clasicas[0] != null, bajoMenos: v("RSA", 1024) < clasicas[0], pqMas: v("ML-DSA", 192) > clasicas[0] };
}
igual(reglaLlave(N), { iguales: true, bajoMenos: true, pqMas: true }, "IR 8547: toda llave clásica aprobada vale lo mismo; bajo 112 bits vale menos; ML-DSA vale más");
igual([N.fuerzaClasica({ ok: true, algoritmo: "RSA", bits: 2048 }), N.fuerzaClasica({ ok: true, algoritmo: "RSA", bits: 3072 }), N.fuerzaClasica({ ok: true, algoritmo: "EC", bits: 256 }),
  N.fuerzaClasica({ ok: true, algoritmo: "EC", bits: 384 }), N.fuerzaClasica({ ok: true, algoritmo: "RSA", bits: 1024 })], [112, 128, 128, 192, 80], "fuerza clásica = SP 800-57, tabla 2");
igual(readFileSync(new URL("docs/fuentes/regla-llave-2026-11-18.md", raiz), "utf8").includes("Deprecated after 2030"), true, "la fuente copiada trae la fila de IR 8547");
// el lector de la hoja: una llave ML-DSA-65 de verdad (Node.js con OpenSSL 3.5) y una Ed25519, dentro de una hoja mínima
{
  const IE = await import("../lib/informe-envivo.mjs");
  const { generateKeyPairSync } = await import("node:crypto");
  const len = (n) => (n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255]);
  const tlvB = (tag, ...partes) => { const c = Buffer.concat(partes.map((p) => Buffer.from(p))); return Buffer.concat([Buffer.from([tag, ...len(c.length)]), c]); };
  const oidB = (o) => { const p = o.split(".").map(Number), b = [p[0] * 40 + p[1]];
    for (const x of p.slice(2)) { const s = []; let y = x; do { s.unshift(y & 127); y >>= 7; } while (y); b.push(...s.map((z, i) => (i < s.length - 1 ? z | 128 : z))); }
    return tlvB(0x06, b); };
  const nombre = (cn) => tlvB(0x30, tlvB(0x31, tlvB(0x30, oidB("2.5.4.3"), tlvB(0x0c, Buffer.from(cn)))));
  const hoja = (spki, firmaOid) => { const alg = tlvB(0x30, oidB(firmaOid));
    const tbs = tlvB(0x30, tlvB(0xa0, tlvB(0x02, [2])), tlvB(0x02, [1]), alg, nombre("prueba"), tlvB(0x30, tlvB(0x17, Buffer.from("261101000000Z")), tlvB(0x17, Buffer.from("271101000000Z"))), nombre("prueba.example"), spki);
    return new Uint8Array(tlvB(0x30, tbs, alg, tlvB(0x03, [0, 1, 2, 3]))); };
  // Llaves post-cuánticas REALES, generadas una vez con Node 24 (OpenSSL 3.5) y guardadas como fixture: el Node
  // del CI (22.x) no sabe generarlas y el guardia se caía (19-nov, corrida del deploy de 189f523). Se leen del archivo.
  const fixturePQ = (n) => readFileSync(new URL(`scripts/fixtures/llaves-pq/${n}.spki.der`, raiz));
  const ml = fixturePQ("ml-dsa-65");
  const h = IE.leerHoja(hoja(ml, "2.16.840.1.101.3.4.3.18"));
  igual([h.algoritmo, h.curva, h.bits, h.firma, N.certificadosValor({ ok: true, ...h })], ["ML-DSA", "ML-DSA-65", 192, "ml-dsa-65", N.REGLA_CERTIFICADOS.pq],
    "una hoja con llave ML-DSA-65 real se lee ML-DSA (OID 2.16.840.1.101.3.4.3.18 del CSOR) y vale lo de un certificado post-cuántico");
  // Una por familia de IR 8547 tabla 3, todas a `pq` (18-nov-2026). ML-DSA y SLH-DSA con llaves REALES de Node.js
  // (OpenSSL 3.5); HSS/LMS, XMSS y XMSS^MT con una llave CONSTRUIDA con el OID de RFC 9802/9708 (ni Node ni
  // OpenSSL generan esas llaves): prueba el OID, no el formato de la llave.
  const spkiOid = (o) => tlvB(0x30, tlvB(0x30, oidB(o)), tlvB(0x03, [0, 0, 0, 0, 1]));
  const familias = [
    ["ML-DSA", fixturePQ("ml-dsa-65"), "2.16.840.1.101.3.4.3.18"],
    ["SLH-DSA", fixturePQ("slh-dsa-sha2-128s"), "2.16.840.1.101.3.4.3.20"],
    ["HSS/LMS", spkiOid("1.2.840.113549.1.9.16.3.17"), "1.2.840.113549.1.9.16.3.17"],
    ["XMSS", spkiOid("1.3.6.1.5.5.7.6.34"), "1.3.6.1.5.5.7.6.34"],
    ["XMSS^MT", spkiOid("1.3.6.1.5.5.7.6.35"), "1.3.6.1.5.5.7.6.35"],
  ];
  const porFamilia = (M) => familias.map(([fam, spki, o]) => { const x = IE.leerHoja(hoja(spki, o)); return [fam, x.algoritmo, M.certificadosValor({ ok: true, ...x })]; });
  igual(porFamilia(N), familias.map(([fam]) => [fam, fam, N.REGLA_CERTIFICADOS.pq]), "cada familia post-cuántica de IR 8547 tabla 3 se reconoce y vale lo de un certificado post-cuántico");
  igual([...new Set(Object.values(IE.FIRMAS_PQ_OID).map((x) => x[0]))].sort(), [...N.FIRMAS_PQ].sort(), "las familias del lector (OID) son las del núcleo, ni más ni menos");
  igual(Object.values(IE.FIRMAS_PQ_OID).filter((x) => x[0] === "SLH-DSA").map((x) => x[2]).every((f) => [128, 192, 256].includes(f)), true, "SLH-DSA: fuerza 128/192/256 según su juego (IR 8547 tabla 3)");
  const fuente = readFileSync(new URL("docs/fuentes/regla-llave-2026-11-18.md", raiz), "utf8");
  igual(["id-ml-dsa-65 OBJECT IDENTIFIER ::= { sigAlgs 18 }", "id-slh-dsa-sha2-128s OBJECT IDENTIFIER ::= { sigAlgs 20 }", "smime(16) alg(3) 17 }", "security(5) mechanisms(5) pkix(7) algorithms(6) 34 }", "security(5) mechanisms(5) pkix(7) algorithms(6) 35 }"].every((x) => fuente.includes(x)), true,
    "cada OID de prueba está en la fuente copiada (CSOR, RFC 9802, RFC 9708)");
  await conMutante(NUCLEO, 'export const FIRMAS_PQ = Object.freeze(["ML-DSA", "SLH-DSA", "HSS/LMS", "XMSS", "XMSS^MT"]);', 'export const FIRMAS_PQ = Object.freeze(["ML-DSA"]);', async (M) => {
    igual(porFamilia(M).every(([, , v]) => v === M.REGLA_CERTIFICADOS.pq), false, "MUTACIÓN: reconocer sólo ML-DSA → SLH-DSA, LMS y XMSS dejan de valer 100 (grita)");
  });
  const ed = generateKeyPairSync("ed25519").publicKey.export({ type: "spki", format: "der" });
  const he = IE.leerHoja(hoja(ed, "1.3.101.112"));
  igual([he.algoritmo, N.certificadosValor({ ok: true, ...he }), N.certificadosValor({ ok: true, ...he }, "QEX-1.0")], ["Ed25519", N.REGLA_CERTIFICADOS.aprobada, null],
    "Ed25519: con QEX-1.2 vale como toda llave clásica aprobada (antes, sin dato)");
}
// ---- EL CASO CRUZADO (18-nov-2026): la ÚNICA definición compartida entre el Python del informe
// (armar_indice.dim_certificados) y este JS. Copia byte a byte de
// Projects/Rosetta Quantum/caso-cruzado-regla-llave-2026-11-18.json en docs/fuentes/, con este sha256:
export const CASO_CRUZADO = "docs/fuentes/caso-cruzado-regla-llave-2026-11-18.json";
export const CASO_CRUZADO_SHA256 = "29bdb761cf4e7fde5bd8c67e8d28601c323ba7f8ba901333f284cf278a500a7a";
// (18-nov-2026, 2ª versión) Cada caso trae LAS DOS representaciones: la nuestra (algoritmo + parametros + bits)
// y la del Python (key_type + key_bits). Ninguno de los dos lados infiere la del otro: aquí se usa sólo la
// nuestra, sin adaptador. La familia desconocida no está en el archivo (lo declara su «no_cubre»).
const certDe = (c) => (c.ok === false ? { ok: false } : { ok: true, algoritmo: c.algoritmo, curva: c.parametros, bits: c.bits });
export function casoCruzado(M, casos) {
  return casos.map((c) => { const v = M.certificadosValor(certDe(c), "QEX-1.2"); return v === c.puntaje ? null : `${c.llave}: esperado ${c.puntaje}, dio ${v}`; }).filter(Boolean);
}
const CC_TEXTO = readFileSync(new URL(CASO_CRUZADO, raiz));
const CC = JSON.parse(CC_TEXTO.toString("utf8"));
igual(sha(CC_TEXTO), CASO_CRUZADO_SHA256, "el caso cruzado es la copia exacta del archivo compartido (sha256)");
igual([CC.version, CC.casos.length], ["QEX-1.2", 14], "el caso cruzado declara QEX-1.2 y trae sus 14 casos");
igual(CC.casos.find((c) => c.llave === "P-224") && N.certificadosValor(certDe(CC.casos.find((c) => c.llave === "P-224")), "QEX-1.2"), 75, "P-224 (el borde del umbral, ahora en el archivo compartido) da 75");
igual(casoCruzado(N, CC.casos), [], `certificadosValor(…, "QEX-1.2") reproduce el caso cruzado, caso por caso (${CC.casos.length})`);
// lo demás que el archivo declara de nuestro lado: la fuerza clásica y la regla de agosto
igual(CC.casos.filter((c) => N.fuerzaClasica(certDe(c)) !== c.fuerza_clasica || N.certificadosValor(certDe(c), "QEX-1.0") !== c.puntaje_qex_1_0).map((c) => c.llave), [],
  "fuerzaClasica y la regla QEX-1.0 dan lo que declara cada caso");

// una foto guardada QEX-1.0 con RSA-4096 contra una nueva QEX-1.2 con la MISMA llave: la comparación no marca «cambió»
{
  const base = { esquema: N.ESQUEMA_FOTO, dominio: "ejemplo.cl", certificado: { ok: true, algoritmo: "RSA", bits: 4096 }, endpoints: [], borde: {}, proveedores: {} };
  const dim = { certificados: 100, higiene: 60, hndl: 12, edge: 100 };
  const f10 = { ...base, qex: N.qex(dim, "QEX-1.0") }, f12 = { ...base, qex: N.qex({ ...dim, certificados: N.certificadosValor(base.certificado) }) };
  const c = N.comparar(f10, f12), est = (k) => c.items.find((x) => x.k === k).estado;
  igual([est("certificados"), est("score"), c.metodo], ["se_mantiene", "se_mantiene", { antes: "QEX-1.0", ahora: N.VERSION_QEX, releida: true }],
    "foto QEX-1.0 vs QEX-1.2 con la misma llave: se mantiene, y se declara que la anterior se releyó");
  const c2 = N.comparar(f12, f12);
  igual(c2.metodo.releida, false, "misma versión: no se relee nada");
}

// ---------------------------------------------------------------- 5 · mutaciones
await conMutante(new URL("lib/informe-envivo.mjs", raiz), "const MAX_SENSIBLES = MAX_SONDEADOS;", "const MAX_SENSIBLES = 15 + 1;", async (M) => {
  const r = await M.manejarSondas(new Request("https://x/api/sondas", { method: "POST", body: JSON.stringify({ dominio: "ejemplo.cl", sensibles: Array.from({ length: N.MAX_SONDEADOS + 1 }, (_, i) => `n${i}.ejemplo.cl`) }) }), {}).catch(() => null);
  igual(r != null && r.status === 400, false, "MUTACIÓN: /api/sondas con su propio tope escrito a mano → deja pasar más de lo que la rúbrica dice (grita)");
});
await conMutante(NUCLEO, 'export const VERSION_QEX = "QEX-1.2";', 'export const VERSION_QEX = "QEX-1.0";', async (M) => {
  igual(reglaLlave(M).iguales, false, "MUTACIÓN: volver a la regla de agosto (RSA-4096 y P-384 = 100) → IR 8547 grita");
});
await conMutante(NUCLEO, "  return f >= minimo ? R.aprobada : R.bajo;", "  return R.aprobada;", async (M) => {
  const r = casoCruzado(M, CC.casos);
  console.log(`  mutación «sin la rama de < 112 bits» → el caso cruzado dice: ${r.join(" · ")}`);
  igual(r, ["RSA-1024: esperado 0, dio 75"], "MUTACIÓN: borrar la rama de < 112 bits → el caso cruzado grita «RSA-1024: esperado 0, dio 75»");
});
await conMutante(NUCLEO, "  return f >= minimo ? R.aprobada : R.bajo;", "  return f >= minimo ? (f >= 192 ? R.pq : R.aprobada) : R.bajo;", async (M) => {
  igual(reglaLlave(M).iguales, false, "MUTACIÓN: premiar una llave clásica más grande (P-384) → IR 8547 grita");
});
await conMutante(NUCLEO, "  if (!q.dimensiones || q.version === version) return q;", "  return q;", async (M) => {
  const base = { esquema: M.ESQUEMA_FOTO, dominio: "ejemplo.cl", certificado: { ok: true, algoritmo: "RSA", bits: 4096 }, endpoints: [], borde: {}, proveedores: {} };
  const dim = { certificados: 100, higiene: 60, hndl: 12, edge: 100 };
  const c = M.comparar({ ...base, qex: M.qex(dim, "QEX-1.0") }, { ...base, qex: M.qex({ ...dim, certificados: M.certificadosValor(base.certificado) }) });
  igual(c.items.find((x) => x.k === "certificados").estado === "cambio", true, "MUTACIÓN: sin releer la foto anterior → un cambio de método se lee «cambió» (grita)");
});
await conMutante(NUCLEO, "  sin_tls13: -30,", "  sin_tls13: -25,", async (M) => {
  igual(divergencias(B.generar({ N: M })).length > 0, true, "MUTACIÓN: la constante −30 pasa a −25 sin regenerar → la rúbrica publicada ya no es la del código (grita)");
});
await conMutante(NUCLEO, "if (sinTls13 === true) base += R.sin_tls13;", "if (sinTls13 === true) base += R.sin_tls13 + 5;", async (M) => {
  igual(sondearFunciones(M).length > 0, true, "MUTACIÓN: la función descuenta 25 con la constante en −30 → el sondeo grita");
});
await conMutante(NUCLEO, "if ((ct.infra_expuesta || 0) >= R.infra_expuesta.desde) base += R.infra_expuesta.puntos;", "if ((ct.infra_expuesta || 0) > R.infra_expuesta.desde) base += R.infra_expuesta.puntos;", async (M) => {
  igual(sondearFunciones(M).length > 0, true, "MUTACIÓN: umbral «más de 3» en la función → el sondeo grita");
});
await conMutante(NUCLEO, 'else if (principal === false) out.nota = out.altas.length ? "D" : "C";', 'else if (principal === false) out.nota = "C";', async (M) => {
  igual(compararEscala(M).malas.length > 0, true, "MUTACIÓN: explicarNota deja de dar D a «sin candado + alerta alta» → la escala publicada ya no coincide (grita)");
});
await conMutante(NUCLEO, '  { regla: "sin_candado_con_alta", nota: "D", desde: "QREADY-NOTA-0", si: (h) => h.principal === false && h.altas > 0 },\n', "", async (M) => {
  igual(compararEscala(M).malas.length > 0, true, "MUTACIÓN: la regla D «sin candado + alerta alta» se borra de la escala → grita");
});
await conMutante(NUCLEO, "export const NOTA_DIMENSION_MINIMA = 0.25;", "export const NOTA_DIMENSION_MINIMA = 0.4;", async (M) => {
  igual(divergencias(B.generar({ N: M })).length > 0, true, "MUTACIÓN: el umbral de la dimensión pasa a 0,4 → la rúbrica publicada ya no es la del código (grita)");
});

for (const f of fallas) console.log("  FALLA " + f);
console.log(fallas.length ? `check-rubrica-qex: ${fallas.length} falla(s) de ${casos} casos` :
  `check-rubrica-qex: ok (${casos} casos · publicado = generado · funciones = constantes · escala = explicarNota en ${cmp.n} combinaciones · tope de nombres una sola definición · la llave según IR 8547 · caso cruzado con el informe · 12 mutaciones gritan)`);
process.exit(fallas.length ? 1 : 0);
