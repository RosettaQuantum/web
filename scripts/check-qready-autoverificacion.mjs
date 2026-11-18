#!/usr/bin/env node
/**
 * La nota de autoverificación de /verificado/rosettaquantum.com (18-nov-2026).
 *
 * POR QUÉ EXISTE. El A+ de rosettaquantum.com incluye una revisión de su inventario interno hecha por la
 * propia Rosetta. La página tiene que decirlo, con el texto que Nicholas aprobó («Sí, así», 18-nov), y
 * sólo ahí: un A+ nuestro sin la nota esconde que somos juez y parte; la nota en un dominio ajeno diría
 * algo falso de él.
 *
 * Contra el código que corre, con D1 EN MEMORIA y el esquema real (nunca la base de producción):
 *  · SELLO   es.md y en.md tienen el sha256 de APROBADOS.json y su aprobado_por; un byte distinto falla.
 *  · DATOS   las cifras salen de lib/datos/inventario-rosetta.json y cuadran (medidas + no medidas = filas).
 *            Con INVENTARIO_DOC=<ruta del documento aprobado> se comparan además contra él: su sha256, sus
 *            filas, y el texto renderizado contra el apartado C del documento. Sin la ruta, ese chequeo
 *            se SALTA y el resumen lo dice: el documento no está en el repositorio (describe infraestructura).
 *  · GRITO   rosettaquantum.com en A+: la nota está en /es/verificado y en /verificado, con la fecha de
 *            inventario_verificado_en. Sin los textos, la página falla en vez de mostrar el A+ sin la nota.
 *  · SILENCIO rosettaquantum.com en A (sin inventario): sin nota. Otro dominio en A+: sin nota. La nota
 *            dentro de un comentario HTML no cuenta como publicada.
 *  · MUTACIÓN la regla sin la condición del dominio; la regla que nunca la muestra; la página que no la
 *            inserta; la fecha clavada; las cifras clavadas. Cada una grita.
 *
 * QUÉ NO CUBRE. El HTML desplegado (eso es el chequeo contra producción después de la marca). Que la regla
 * Text de wrangler.jsonc empaquete los .md: se comprueba que la regla y los imports existen, no el paquete.
 *   node scripts/check-qready-autoverificacion.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const N = await import("../public/js/qex-nucleo.mjs");
const V = await import("../lib/qready-verificado.mjs");
const AV = await import("../lib/qready-autoverificacion.mjs");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta y quien marque el inventario de rosettaquantum.com", hace: "no edita los .md aprobados (un texto nuevo es un archivo nuevo con su sha256 y su aprobado_por) y corrige lib/qready-autoverificacion.mjs o la página antes de desplegar" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");
const DIR = "src/data/q-ready/autoverificacion/";
const APROBADOS = JSON.parse(leer(DIR + "APROBADOS.json"));
const DATOS = JSON.parse(leer("lib/datos/inventario-rosetta.json"));
const MD = { es: leer(DIR + "es.md"), en: leer(DIR + "en.md") };
const ESQ = [new URL("db/qready-verificado.schema.sql", raiz), new URL("db/medicion-agentes.schema.sql", raiz)];
const TOKENS = { paper: "#F4F5F1", panel: "#FBFBF9", ink: "#16181B", "ink-60": "#4A4E48", line: "#D9DBD6", verdict: "#0C7268", pending: "#8A6520", alert: "#B4432F" };
const FECHA_INV = "2026-12-01T10:00:00.000Z";   // a propósito distinta del 18-nov: una fecha clavada se nota
const fallas = [];
let casos = 0, saltados = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const lanza = (f) => { try { f(); return null; } catch (e) { return e.message; } };
const silenciar = () => { const o = [console.error, console.log]; console.error = () => {}; console.log = () => {}; return () => { [console.error, console.log] = o; }; };
// Texto visible: sin comentarios ni etiquetas (un comentario con la nota NO es la nota publicada).
const visible = (html) => html.replace(/<!--[\s\S]*?-->/g, "").replace(/<(script|style)[\s\S]*?<\/\1>/g, "").replace(/<[^>]+>/g, "")
  .replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ");
const plano = (t) => t.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();

// ---------------------------------------------------------------- 1 · el sello de los textos
for (const a of APROBADOS) {
  igual([sha(MD[a.idioma]), a.aprobado_por], [a.sha256, 'Nicholas, 18-nov-2026: "Sí, así"'], `${a.archivo}: sha256 y aprobado_por iguales a APROBADOS.json`);
}
igual(APROBADOS.map((a) => a.idioma).sort(), ["en", "es"], "un .md por idioma, ni más ni menos");
const mdMutado = MD.es.replace("juez y parte", "juez  y parte");
igual(sha(mdMutado) === APROBADOS.find((a) => a.idioma === "es").sha256, false, "MUTACIÓN: un espacio de más en es.md cambia el sha256 (el build cae)");

// ---------------------------------------------------------------- 2 · las cifras
igual([DATOS.medidas + DATOS.no_medidas === DATOS.filas, DATOS.no_medidas_filas.length === DATOS.no_medidas, /^[0-9a-f]{64}$/.test(DATOS.documento_sha256)], [true, true, true],
  "lib/datos/inventario-rosetta.json cuadra: medidas + no medidas = filas, una fila por cada no medida, huella del documento");
if (process.env.INVENTARIO_DOC && existsSync(process.env.INVENTARIO_DOC)) {
  const docB = readFileSync(process.env.INVENTARIO_DOC), doc = docB.toString("utf8");
  const filas = doc.split("\n").filter((l) => /^\| \d+ \|/.test(l));
  const nm = filas.filter((l) => l.includes("NO MEDIDO")).map((l) => Number(/^\| (\d+) \|/.exec(l)[1]));
  igual([createHash("sha256").update(docB).digest("hex"), filas.length, filas.length - nm.length, nm.length, nm],
    [DATOS.documento_sha256, DATOS.filas, DATOS.medidas, DATOS.no_medidas, DATOS.no_medidas_filas], "las cifras son las del documento aprobado (huella, filas, medidas, no medidas)");
  const bloque = (marca) => { const i = doc.indexOf(marca), j = doc.indexOf("\n> ", i); return doc.slice(j + 3, doc.indexOf("\n", j + 3)); };
  igual(AV.textoAutoverificacion(MD.es, "2026-11-18", DATOS), bloque("**ES — PROVISORIO**").replace("[AAAA-MM-DD]", "2026-11-18"), "ES renderizado = apartado C del documento, palabra por palabra");
  igual(AV.textoAutoverificacion(MD.en, "2026-11-18", DATOS), bloque("**EN — PROVISIONAL**").replace("[YYYY-MM-DD]", "2026-11-18"), "EN renderizado = apartado C del documento, palabra por palabra");
} else { saltados++; console.log("  SALTADO  comparación contra el documento aprobado (pase INVENTARIO_DOC=<ruta>; el documento no vive en el repositorio)"); }
// las cifras salen de los datos, no del código: con otros datos, otras cifras
const otros = { filas: 40, medidas: 33, no_medidas: 7 };
const tOtros = AV.textoAutoverificacion(MD.es, FECHA_INV, otros);
igual([tOtros.includes(" 40 usos"), tOtros.includes(" 33 se midieron"), tOtros.includes("Fecha de la revisión: 2026-12-01.")], [true, true, true], "con otros datos el texto dice otras cifras y otra fecha");
igual([/no es una fecha/.test(lanza(() => AV.textoAutoverificacion(MD.es, null)) ?? ""), /no da el total/.test(lanza(() => AV.textoAutoverificacion(MD.es, FECHA_INV, { filas: 38, medidas: 30, no_medidas: 7 })) ?? ""),
  /hueco \{fecha\}/.test(lanza(() => AV.textoAutoverificacion(MD.es.replace("{fecha}", "2026-11-18"), FECHA_INV)) ?? "")], [true, true, true],
  "falla cerrado: sin fecha, con cifras que no cuadran o con un hueco escrito a mano");

// ---------------------------------------------------------------- 3 · la página, por el camino real
const { foto: fa } = JSON.parse(leer("scripts/fixtures/ficha/a.json"));
const { sha256: _v, ...resto } = fa;
const fotoDe = async (d) => N.sellarFoto({ ...resto, dominio: d, www: "www." + d });
const par = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const JWK = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", par.privateKey)), kid: "rq-guardia-prueba" });
const ASSETS = { fetch: async () => new Response("", { status: 404 }) };

async function paginas(Vx, { inventario, textos = MD }) {
  const db = d1EnMemoria(...ESQ), token = V.generarToken(), d = AV.DOMINIO_PROPIO;
  await db.prepare("INSERT INTO qready_dominios (token, dominio, sector, publico, entorno, creado_utc, verificado_en, inventario_verificado_en) VALUES (?1,?2,'banca',1,'produccion',?3,?3,?4)")
    .bind(token, d, "2026-11-13T00:00:00.000Z", inventario ? FECHA_INV : null).run();
  const env = { DB: db, ASSETS, QREADY_FIRMA_JWK: JWK };
  const foto = await fotoDe(d);
  const restaurar = silenciar();
  try {
    await Vx.cronVerificados(env, { tomarFoto: async () => ({ foto }), resolver: async () => ({ estado: "respuesta", valores: [V.valorTxt(token)], detalle: "DNS NOERROR" }) });
    const out = {};
    for (const [lang, ruta] of [["es", `/es/verificado/${d}`], ["en", `/verificado/${d}`]]) {
      const url = new URL(`https://${d}${ruta}`);
      out[lang] = await (await Vx.manejarVerificado(new Request(url), env, url, null, { tokens: TOKENS, autoverificacion: textos })).text();
    }
    return out;
  } finally { restaurar(); }
}
const letra = (html) => (html.match(/<span class="qv-letra">([^<]*)<\/span>/) || [])[1] ?? null;
const esperado = (lang) => plano(AV.textoAutoverificacion(MD[lang], FECHA_INV, DATOS));
const tiene = (html, lang) => visible(html).includes(esperado(lang));

const aMas = await paginas(V, { inventario: true });
igual([letra(aMas.es), letra(aMas.en), tiene(aMas.es, "es"), tiene(aMas.en, "en"), /data-autoverificacion="2026-12-01"/.test(aMas.es)], ["A+", "A+", true, true, true],
  "GRITO: rosettaquantum.com en A+ lleva la nota en español y en inglés, con la fecha de inventario_verificado_en");
igual([visible(aMas.es).includes("{"), visible(aMas.es).includes(`${DATOS.filas} usos`), visible(aMas.en).includes(`${DATOS.filas} uses`)], [false, true, true], "sin huecos sin rellenar, con las cifras de los datos");
const sinTextos = await paginas(V, { inventario: true, textos: null }).then(() => null, (e) => e.message);
igual(/falta el texto aprobado/.test(sinTextos ?? ""), true, "GRITO: A+ nuestro sin los textos → la página falla, no muestra el A+ sin la nota");

const enA = await paginas(V, { inventario: false });
igual([letra(enA.es), tiene(enA.es, "es"), tiene(enA.en, "en"), /qv-autoverificacion/.test(enA.es + enA.en)], ["A", false, false, false], "SILENCIO: rosettaquantum.com en A no lleva la nota");
const ajena = await fotoDe("otro.example");
const extrasAmas = { inventario_verificado: true, well_known_valido: true, plan_con_fecha: true };
const medAjena = [{ fecha: ajena.medido_utc, nota: "A+", qex: 56, sha256: ajena.sha256, foto_json: JSON.stringify(ajena) }];
const htmlAjena = V.cuerpoVerificado({ lang: "es", dominio: "otro.example", fila: { dominio: "otro.example", verificado_en: "2026-11-13T00:00:00Z", inventario_verificado_en: FECHA_INV },
  mediciones: medAjena, extras: extrasAmas, autoverificacion: MD });
igual([letra(htmlAjena), /qv-autoverificacion/.test(htmlAjena), visible(htmlAjena).includes("juez y parte")], ["A+", false, false], "SILENCIO: otro dominio en A+ no lleva la nota");
igual(tiene(`<p>${"<!-- " + esperado("es") + " -->"}</p>`, "es"), false, "SILENCIO paradójico: la nota dentro de un comentario HTML no cuenta como publicada");

// ---------------------------------------------------------------- 4 · cableado (código sin comentarios)
const codigo = (r) => leer(r).replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");
const rutas = codigo("lib/qready-rutas.mjs"), wr = leer("wrangler.jsonc");
igual([/import autoverificacionEs from "\.\.\/src\/data\/q-ready\/autoverificacion\/es\.md"/.test(rutas), /import autoverificacionEn from "\.\.\/src\/data\/q-ready\/autoverificacion\/en\.md"/.test(rutas),
  /autoverificacion: \{ es: autoverificacionEs, en: autoverificacionEn \}/.test(rutas), /"type": "Text", "globs": \[[^\]]*"\*\*\/q-ready\/autoverificacion\/\*\.md"/.test(wr)], [true, true, true, true],
  "el Worker recibe los dos .md como texto (imports en qready-rutas y regla Text en wrangler.jsonc)");
igual(/juez y parte|judge and party|Somos juez|Autoverificación\.|Self-verification\./.test(codigo("lib/qready-autoverificacion.mjs") + codigo("lib/qready-verificado.mjs") + rutas), false, "ninguna frase de la nota está escrita en el código");

// ---------------------------------------------------------------- 5 · mutaciones (copias hermanas, borradas al terminar)
// cambiosAV van a lib/qready-autoverificacion.mjs; cambiosV a lib/qready-verificado.mjs, que se reescribe
// para importar la copia mutada. Cada texto a cambiar tiene que aparecer exactamente una vez.
async function mutar({ cambiosAV = [], cambiosV = [] }, prueba) {
  const aplicar = (texto, cambios) => cambios.reduce((t, [de, a]) => {
    const veces = t.split(de).length - 1;
    if (veces !== 1) throw new Error(`mutación: el texto a cambiar aparece ${veces} veces (tiene que ser 1): ${de.slice(0, 70)}`);
    return t.replace(de, () => a);
  }, texto);
  const id = `${process.pid}-${Math.random().toString(36).slice(2)}`;
  const av = new URL(`lib/.qready-autoverificacion.mutante-${id}.mjs`, raiz), v = new URL(`lib/.qready-verificado.mutante-${id}.mjs`, raiz);
  writeFileSync(av, aplicar(leer("lib/qready-autoverificacion.mjs"), cambiosAV));
  writeFileSync(v, aplicar(leer("lib/qready-verificado.mjs"), [...cambiosV, ['from "./qready-autoverificacion.mjs";', `from "./.qready-autoverificacion.mutante-${id}.mjs";`]]));
  try { return await prueba(await import(v.href), await import(av.href)); }
  finally { rmSync(av, { force: true }); rmSync(v, { force: true }); }
}
const mutaciones = [
  ["la regla sin la condición del dominio → la nota aparece en otro dominio",
    { cambiosAV: [["dominio === DOMINIO_PROPIO && nota === \"A+\"", "nota === \"A+\""]] },
    async (Vm) => /qv-autoverificacion/.test(Vm.cuerpoVerificado({ lang: "es", dominio: "otro.example", fila: { dominio: "otro.example", verificado_en: "2026-11-13T00:00:00Z", inventario_verificado_en: FECHA_INV }, mediciones: medAjena, extras: extrasAmas, autoverificacion: MD })) === false],
  ["la regla que nunca la muestra → A+ nuestro sin la nota",
    { cambiosAV: [["dominio === DOMINIO_PROPIO && nota === \"A+\"", "false"]] },
    async (Vm) => { const p = await paginas(Vm, { inventario: true }); return letra(p.es) === "A+" && tiene(p.es, "es") && tiene(p.en, "en"); }],
  ["la página que no la inserta → A+ nuestro sin la nota",
    { cambiosV: [["    + (ult && llevaAutoverificacion(dominio, ult.nota) ? htmlAutoverificacion(autoverificacion && autoverificacion[lang], fila.inventario_verificado_en) : \"\")\n", ""]] },
    async (Vm) => { const p = await paginas(Vm, { inventario: true }); return letra(p.es) === "A+" && tiene(p.es, "es"); }],
  ["la fecha clavada en 2026-11-18 → no es la de inventario_verificado_en",
    { cambiosAV: [["const fecha = String(inventarioVerificadoEn || \"\").slice(0, 10);", "const fecha = \"2026-11-18\";"]] },
    async (Vm) => { const p = await paginas(Vm, { inventario: true }); return tiene(p.es, "es"); }],
  ["las cifras clavadas (38/31/7) → no salen de los datos",
    { cambiosAV: [["const valores = { fecha, filas: datos.filas, medidas: datos.medidas, no_medidas: datos.no_medidas };", "const valores = { fecha, filas: 38, medidas: 31, no_medidas: 7 };"]] },
    async (Vm, AVm) => AVm.textoAutoverificacion(MD.es, FECHA_INV, otros).includes(" 40 usos")],
];
const salida = [];
for (const [nombre, cambios, sigueBien] of mutaciones) {
  let ok;
  try { ok = await mutar(cambios, sigueBien); }
  catch (e) { casos++; fallas.push(`MUTACIÓN: ${nombre} → no se pudo aplicar (${e.message})`); continue; }
  salida.push(`  mutante «${nombre}»: ${ok ? "el chequeo NO lo ve (guardia mudo)" : "grita"}`);
  igual(ok, false, `MUTACIÓN: ${nombre} → tiene que gritar`);
}
console.log(salida.join("\n"));
if (fallas.length) {
  console.error(`check-qready-autoverificacion: ${fallas.length} de ${casos} fallaron · ${saltados} saltados`);
  for (const f of fallas) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`check-qready-autoverificacion: ok (${casos} pasaron · 0 fallaron · ${saltados} saltados · sello es/en · A+ nuestro con nota en los 2 idiomas · A y dominio ajeno sin nota · ${mutaciones.length} de ${mutaciones.length} mutaciones gritan)`);
