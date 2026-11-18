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
  ok([cert("RSA", RC.rsa_bits), cert("RSA", RC.rsa_bits - 1), cert("EC", RC.curva_bits), cert("EC", RC.curva_bits - 1), M.certificadosValor({ ok: false }), M.certificadosValor(null)],
    [RC.supera, RC.minimo, RC.supera, RC.minimo, null, null], "certificados: umbral RSA y de curva, sin certificado = null");
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
igual(g.es.filas.filter((f) => /^RQ\.S\.04\.\d$/.test(f.id)).every((f) => f.metodo.includes(REF.edicion) && /no está publicada/.test(f.metodo)), true,
  "RQ.S.04.1 a .3 declaran: tabla fijada en la edición de la referencia; la derivación no está publicada");

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

// ---------------------------------------------------------------- 5 · mutaciones
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
  `check-rubrica-qex: ok (${casos} casos · publicado = generado · funciones = constantes · escala = explicarNota en ${cmp.n} combinaciones · 6 mutaciones gritan)`);
process.exit(fallas.length ? 1 : 0);
