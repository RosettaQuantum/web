#!/usr/bin/env node
/**
 * rosetta-ficha/1 y los tres ajustes del 13-nov-2026 (encargo de Nicholas, por Cowork).
 *
 * POR QUÉ EXISTE. La ficha es un protocolo: un agente la imprime tal cual y una persona la lee igual
 * venga de donde venga. El modo de fallo es mudo: una sección que cambia de lugar, un ID que se
 * renumera o un «->» que pasa a «→» no rompe nada y rompe el protocolo. Y los ajustes son de los que
 * se pierden en silencio: un nombre de pruebas de un tercero que vuelve a salir completo, un .py
 * comparado con la banca chilena, o «Medir X» de vuelta en falta_para_A.
 *
 *  1. SNAPSHOT del markdown canónico con 3 fotos fijas (scripts/fixtures/ficha/: A, F y sin correo,
 *     en es y en). Falla si cambia una sola línea: el orden, un ID o la sintaxis. Para aceptar un
 *     cambio A PROPÓSITO: node scripts/check-ficha.mjs --actualizar, y se revisa el diff.
 *     El validador de sintaxis (validarMarkdown) calla con las 6 y GRITA con cada mutación del texto.
 *     MUTACIÓN en el código: un título de sección sin el punto → el snapshot y el validador gritan.
 *  2. AJUSTE 1: falta_para_A sólo trae acciones sobre hallazgos medidos, con su nota; lo no medido va
 *     en no_medido (máx. 5 ejemplos, enmascarados). Grito: 20 nombres sin sondear no entran a falta_para_A.
 *  3. AJUSTE 2: el país sale del TLD y sólo CL se compara. MUTACIÓN: comparar sin mirar el país → grita.
 *  4. AJUSTE 3: con el código real de /v1/medicion (respuestas grabadas) y el esquema REAL en SQLite:
 *     sin verificar, NINGÚN nombre sensible completo en el JSON; verificado en producción, completos;
 *     verificado sólo en el modo de prueba del preview, enmascarados. Los conteos no cambian.
 *     MUTACIONES: la consulta sin «entorno = produccion», o el enmascarado apagado → grita.
 *  5. Una sola definición: la API, el MCP y get_qready_grade usan presentacion() de ficha.mjs; nadie
 *     escribe su propio markdown. Las herramientas que la traen lo dicen en su descripción.
 *   node scripts/check-ficha.mjs [--actualizar]
 */
import { registerHooks } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const Fi = await import("../public/js/ficha.mjs");
const N = await import("../public/js/qex-nucleo.mjs");
const A = await import("../lib/medicion-agentes.mjs");
const V = await import("../lib/qready-verificado.mjs");
const { FICHA } = await import("../public/js/qready-textos.mjs");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "corrige public/js/ficha.mjs (una sola definición) o acepta el snapshot con --actualizar revisando el diff, antes de desplegar; nunca deja salir nombres completos de un dominio no verificado" };

const ACTUALIZAR = process.argv.includes("--actualizar");
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const clon = (x) => JSON.parse(JSON.stringify(x));
const sinComentarios = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const FX = "scripts/fixtures/ficha/";
const CASOS = ["a", "f", "sin-correo"];
const fixture = (c) => JSON.parse(leer(`${FX}${c}.json`));

// ---------------------------------------------------------------- 1 · snapshot y sintaxis
function primeraDiferencia(a, b) {
  const la = a.split("\n"), lb = b.split("\n");
  for (let i = 0; i < Math.max(la.length, lb.length); i++) if (la[i] !== lb[i]) return `línea ${i + 1}: esperaba «${lb[i] ?? "(nada)"}», dio «${la[i] ?? "(nada)"}»`;
  return null;
}
const render = (M, c, idioma) => { const { foto, ctx } = fixture(c); return M.markdownDe(M.armarFicha(foto, { ...ctx, idioma })); };
const letras = {};
for (const c of CASOS) for (const idioma of ["es", "en"]) {
  const md = render(Fi, c, idioma), ruta = `${FX}${c}.${idioma}.md`;
  if (ACTUALIZAR) writeFileSync(new URL(ruta, raiz), md);
  if (!existsSync(new URL(ruta, raiz))) { fallas.push(`${ruta} no existe: corra con --actualizar y revise el archivo`); continue; }
  const dif = primeraDiferencia(md, leer(ruta));
  igual(dif, null, `snapshot ${ruta}`);
  igual(Fi.validarMarkdown(md, idioma), [], `silencio: ${ruta} cumple la sintaxis rosetta-ficha/1`);
  letras[c] = N.explicarNota(fixture(c).foto).nota;
}
igual(letras, { a: "A", f: "F", "sin-correo": "B" }, "las tres fotos fijas: una A, una F y una sin correo (B)");
// el caso F ejerce lo que tiene que ejercer: alertas GRAVE y MEDIA, acciones con y sin efecto, no medido
const mdF = render(Fi, "f", "es");
igual(["| A1 | GRAVE |", "| MEDIA |", "| -> ", "| no cambia la nota |", "| RQ.S.06 | no cambia la nota |", "crt.sh no respondió; se usó Cert Spotter", "sin índice para Paraguay"].filter((t) => !mdF.includes(t)), [],
  "el caso F ejerce GRAVE, MEDIA, efecto, «no cambia la nota», el correo medido, la fuente caída y el país sin índice");
igual(/staging\.|staging \|/.test(mdF), false, "el caso F (no verificado) no imprime el nombre de pruebas completo");
igual(render(Fi, "a", "es").includes("| legacy |"), true, "el caso A (verificado) imprime los nombres completos");
igual(render(Fi, "sin-correo", "es").includes("| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |"), true, "sin MX publicado es una medición, no un «sin dato»");

// GRITO: cada mutación del texto la ve el validador
const base = render(Fi, "f", "es");
const cambiar = (de, a) => { if (!base.includes(de)) throw new Error(`mutación de texto que no entra: ${de}`); return base.replace(de, a); };
const MUT = {
  "secciones 3 y 4 cambiadas de lugar": base.replace("## 3. Alertas", "## 3. TMP").replace("## 4. Qué hacer", "## 3. Alertas").replace("## 3. TMP", "## 4. Qué hacer"),
  "un ID con otro formato": cambiar("| RQ.S.03 |", "| RQ.S.3 |"),
  "un ID que salta": cambiar("| RQ.S.08 |", "| RQ.S.10 |"),
  "sin la sección No medido": base.replace(/## 5\. No medido\n[\s\S]*?\n\n/, ""),
  "alertas fuera de orden": cambiar("| A4 | MEDIA |", "| A4 | GRAVE |"),
  "alerta mal numerada": cambiar("| A2 |", "| A3 |"),
  "nivel inventado": cambiar("| A1 | GRAVE |", "| A1 | ALTA |"),
  "acción mal numerada": cambiar("| H2 |", "| H7 |"),
  "efecto con flecha unicode": cambiar("| -> ", "| → "),
  "huella completa": cambiar("Huella CT: ", "Huella CT: " + "a".repeat(64) + " "),
  "pie sin la URL": base.replace(/ · https:\/\/rosettaquantum\.com\/\S+\n$/, "\n"),
  "un emoji": cambiar("## 1. Veredicto", "## 1. Veredicto \u{1F512}"),
  "decimales": cambiar("75/100", "75.5/100"),
  "tipo inventado": cambiar("| modelo |", "| estimado |"),
  "encabezado distinto": cambiar("# Ficha Rosetta", "# Ficha"),
};
for (const [q, md] of Object.entries(MUT)) igual(Fi.validarMarkdown(md).length > 0, true, `MUTACIÓN de texto: ${q} → el validador grita`);

// MUTACIÓN en el código: el título de sección sin el punto
await conMutante(new URL("public/js/ficha.mjs", raiz), 'out.push("", `## ${s.n}. ${s.titulo}`);', 'out.push("", `## ${s.n} ${s.titulo}`);', async (M) => {
  const md = render(M, "f", "es");
  igual(primeraDiferencia(md, leer(`${FX}f.es.md`)) !== null, true, "MUTACIÓN: «## 3 Alertas» → el snapshot grita");
  igual(M.validarMarkdown(md).length > 0, true, "MUTACIÓN: «## 3 Alertas» → el validador grita");
});
// MUTACIÓN: las alertas MEDIA antes que las GRAVE
await conMutante(new URL("public/js/ficha.mjs", raiz), '...x.graves.map((a) => ({ ...a, nivel_nota: "grave" })),', "",
  async (M) => igual(primeraDiferencia(render(M, "f", "es"), leer(`${FX}f.es.md`)) !== null, true, "MUTACIÓN: sin las alertas graves → el snapshot grita"));

// ---------------------------------------------------------------- 2 · ajuste 1: acciones y no medido
{
  const { foto } = fixture("f");
  const x = N.explicarNota(foto);
  const j = Fi.notaParaJson(x, Fi.analizar(foto, x), { dominio: foto.dominio });
  igual(j.falta_para_A.map((h) => [h.id, h.codigo, h.resuelve, h.sube_a]),
    [["H1", "sacar_ambientes_pruebas", ["A1"], "B"], ["H2", "baja_legado", ["A3"], null], ["H3", "correo_fuera_de_443", ["A4"], "A"], ["H4", "plan_certificado_pq", ["A2"], null]],
    "falta_para_A del caso F: acciones medidas, en orden, con la nota a la que sube (calculada, no escrita)");
  igual(j.falta_para_A.map((h) => h.hosts.join()).join("|").includes("staging."), false, "falta_para_A enmascara los nombres");
  // grito: 20 nombres de pruebas en el registro → 5 fuera del tope de 15; ninguno entra a falta_para_A
  const f2 = clon(foto);
  for (let i = 0; i < 20; i++) f2.ct.hosts.push({ host: `api-dev${i}.${foto.dominio}`, clases: ["no_productivo"], profundo: false, etiqueta_estricta: true, ultimo_not_before: "", ultimo_not_after: "" });
  const x2 = N.explicarNota(f2);
  igual(x2.falta_para_A.some((f) => f.codigo === "nombre_sin_sondear"), true, "el caso ejerce la regla vieja: la nota los lista como «nombre_sin_sondear»");
  const j2 = Fi.notaParaJson(x2, Fi.analizar(f2, x2), { dominio: foto.dominio, fuentes_que_fallaron: [{ fuente: "crt.sh" }] });
  igual(j2.falta_para_A.some((h) => /sondear|medir/.test(h.codigo)), false, "grito: lo no sondeado NO entra a falta_para_A");
  igual([j2.no_medido.nombres_fuera_del_tope >= 20, j2.no_medido.ejemplos.length, j2.no_medido.ejemplos.every((e) => e.includes(Fi.MASCARA))], [true, 5, true],
    "no_medido: el conteo completo, 5 ejemplos, enmascarados");
  igual(j2.no_medido.fuentes_que_fallaron, [{ fuente: "crt.sh" }], "no_medido trae las fuentes que fallaron");
  // un dominio en A no tiene falta_para_A
  const a = fixture("a").foto, xa = N.explicarNota(a);
  igual(Fi.notaParaJson(xa, Fi.analizar(a, xa), { dominio: a.dominio, verificado: true }).falta_para_A, [], "en A no falta nada para A");
}

// ---------------------------------------------------------------- 3 · ajuste 2: el país
igual(["x.cl", "banco.com.py", "x.com", "x.io", "x.co.uk", "x.example", "x.org"].map(Fi.paisDeDominio), ["CL", "PY", null, null, "GB", null, null], "el país sale del TLD; .com, .io y .org no dicen país");
igual([Fi.comparacion("x.cl", 56, 57), Fi.comparacion("banco.com.py", 53, 57).diferencia, Fi.comparacion("x.com", 53, 57).diferencia],
  [{ pais: "CL", pais_referencia: "CL", compara: true, diferencia: -1 }, null, null], "sólo un dominio chileno se compara con la referencia chilena");
igual(Fi.notaSector("banco.com.py"), "Sin índice de referencia para Paraguay; no se compara", "sector.nota de un .py: el texto del encargo");
igual(Fi.notaSector("x.cl"), null, "un .cl no lleva nota de país");
await conMutante(new URL("public/js/ficha.mjs", raiz), "const compara = pais === PAIS_REFERENCIA && score != null", "const compara = score != null",
  async (M) => igual(M.comparacion("banco.com.py", 53, 57).diferencia !== null, true, "MUTACIÓN: comparar sin mirar el país → el .py vuelve a compararse con Chile (el guardia lo ve)"));

// ---------------------------------------------------------------- 4 · ajuste 3: nombres enmascarados
const ENC = {
  "biometrics-dev.ueno.com.py": "biometrics-d•••.ueno.com.py", "apigw-legacy.ueno.com.py": "apigw-l•••.ueno.com.py",
  "cdn-dev.ueno.com.py": "cdn-d•••.ueno.com.py", "cdn-statements-api-files-ind-dev.ueno.com.py": "cdn-statements-api-files-ind-d•••.ueno.com.py",
  "checks-cdn.ind-dev.ueno.com.py": "checks-cdn.ind-d•••.ueno.com.py", "cloud-websocket-test.ueno.com.py": "cloud-websocket-t•••.ueno.com.py",
  "openfinance-desa.banco.cl": "openfinance-d•••.banco.cl", "portal-clientes.banco.cl": "portal-•••.banco.cl",
  "banco.cl": "banco.cl", "www.banco.cl": "www.banco.cl",
};
for (const [h, esperado] of Object.entries(ENC)) igual(Fi.enmascarar(h, h.endsWith("banco.cl") ? "banco.cl" : "ueno.com.py"), esperado, `enmascarar ${h}`);

// El camino real de /v1/medicion con respuestas grabadas (python.org, 12-nov) y una F inyectada.
const CT = JSON.parse(gunzipSync(readFileSync(new URL("scripts/fixtures/medicion-agentes/ct-python.org.json.gz", raiz))).toString("utf8"));
const SONDAS = JSON.parse(leer("scripts/fixtures/medicion-agentes/sondas-python.org.json"));
const sF = clon(SONDAS); Object.assign(sF.endpoints.find((e) => e.host === "staging.python.org"), { dns_status: "NOERROR", responde_443: true, detalle: "responde; grupo x25519", http_status: 200, cname: ["staging.python.org.cdn.example"] });
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const M = { ct: async () => json(CT), sondas: async () => json(sF), correo: async () => json({ ok: true, id: "c0ffee" }) };
const ESQ = [new URL("db/qready-verificado.schema.sql", raiz), new URL("db/medicion-agentes.schema.sql", raiz)];
async function baseCon(filas) {
  const db = d1EnMemoria(...ESQ);
  for (const [dominio, entorno, publico] of filas)
    await db.prepare("INSERT INTO qready_dominios (token, dominio, sector, publico, entorno, creado_utc, verificado_en) VALUES (?1,?2,'banca',?3,?4,?5,?5)")
      .bind(V.generarToken(), dominio, publico, entorno, "2026-11-13T00:00:00.000Z").run();
  return db;
}
// Los nombres sondeados (salen del registro de certificados). Un MX NO se enmascara: es la respuesta
// pública del DNS a «¿quién recibe el correo de este dominio?» y de ella sale el proveedor; por eso
// el guardia busca el MX sólo fuera de correo.mx.
const SENSIBLES = sF.endpoints.map((e) => e.host).filter((h) => h !== "python.org" && h !== "www.python.org");
const filtrado = (cuerpo) => { const c = { ...cuerpo, correo: { ...cuerpo.correo, mx: [] } }; return SENSIBLES.filter((h) => JSON.stringify(c).includes(h)); };
async function medirCon(Mod, filas, idioma = "es") {
  const r = await Mod.medirParaAgente({ DB: await baseCon(filas) }, { dominio: "python.org", sector: "banca", idioma }, { canal: "mcp", ip: "203.0.113.5" }, null, M);
  return r.cuerpo;
}
const sinVerif = await medirCon(A, []);
igual([sinVerif.ok, sinVerif.nota?.letra, sinVerif.nombres_enmascarados], [true, "F", true], "no verificado: mide, F, y declara que enmascara");
igual(filtrado(sinVerif), [], "grito de la fuga: ningún nombre sensible completo en TODO el JSON (endpoints, alertas, falta_para_A, no_medido, CNAME, ficha)");
igual(sinVerif.endpoints.find((e) => e.host.startsWith("s"))?.cname, ["s•••.python.org.cdn.example"], "el CNAME que repite el nombre también se enmascara");
const verif = await medirCon(A, [["python.org", "produccion", 0]]);
igual([verif.nombres_enmascarados, filtrado(verif).length], [false, SENSIBLES.length], "verificado en producción: todos los nombres completos");
igual(verif.presentacion.markdown.includes("Publicación: privada"), true, "verificado pero no público: la ficha dice privada");
const prueba = await medirCon(A, [["python.org", "preview-prueba", 1]]);
igual(filtrado(prueba), [], "silencio del desenmascarado: verificado sólo en el modo de prueba del preview → enmascarado");
const publico = await medirCon(A, [["python.org", "produccion", 1]]);
igual(publico.presentacion.markdown.includes("Publicación: pública en https://rosettaquantum.com/es/verificado/python.org"), true, "verificado y público: la ficha enlaza /verificado");
// los conteos no cambian con el enmascarado
const cuenta = (c) => [c.registro_ct.nombres, c.registro_ct.sensibles, c.registro_ct.sondeados, c.endpoints.length, c.nota.alertas.length, c.nota.falta_para_A.length, c.nota.no_medido.nombres_fuera_del_tope];
igual(cuenta(sinVerif), cuenta(verif), "los conteos son los mismos enmascarado o no");
// la falla de la base enmascara (falla cerrado)
const rota = await A.medirParaAgente({ DB: { prepare: () => { throw new Error("D1 caída"); } } }, { dominio: "python.org", sector: "banca" }, { canal: "api", ip: "203.0.113.6" }, null, M);
igual(filtrado(rota.cuerpo), [], "una base que falla deja los nombres enmascarados");
// MUTACIONES
await conMutante(new URL("lib/qready-verificado.mjs", raiz), "WHERE dominio = ?1 AND entorno = 'produccion' AND verificado_en IS NOT NULL\")",
  "WHERE dominio = ?1 AND verificado_en IS NOT NULL\")", async (V2) => {
    const db = await baseCon([["python.org", "preview-prueba", 1]]);
    igual((await V2.dominioVerificado(db, "python.org")).verificado, true, "MUTACIÓN: sin «entorno = produccion», una verificación de prueba desenmascara (el guardia lo ve)");
  });
await conMutante(new URL("lib/medicion-agentes.mjs", raiz), "if (verificado || !Array.isArray(endpoints)) return endpoints;", "return endpoints;",
  async (A2) => igual(filtrado(await medirCon(A2, [])).length > 0, true, "MUTACIÓN: sin enmascarar los endpoints → la fuga se ve"));

// ---------------------------------------------------------------- 5 · una sola definición y el MCP
const p = sinVerif.presentacion;
igual([p.protocolo, p.spec, p.idioma, p.instruccion_agente, Array.isArray(p.secciones) && p.secciones.map((s) => s.clave)],
  ["rosetta-ficha/1", "https://rosettaquantum.com/protocolo/ficha", "es", FICHA.es.instruccion_agente, Fi.SECCIONES], "presentacion trae protocolo, spec, instrucción, idioma, markdown y secciones");
igual(Fi.validarMarkdown(p.markdown), [], "la ficha de /v1/medicion cumple la sintaxis");
igual(p.markdown.includes("| A1 | GRAVE | Ambiente de pruebas expuesto | s••• |"), true, "la alerta A1 de la ficha es la misma que nota.alertas[0], enmascarada");
igual(sinVerif.nota.alertas[0], { id: "A1", nivel: "grave", codigo: "ambiente_pruebas_expuesto", texto: "Ambiente de pruebas expuesto", host: "s•••.python.org" }, "nota.alertas lleva el mismo ID");
const en = await medirCon(A, [], "en");
igual([en.presentacion.idioma, Fi.validarMarkdown(en.presentacion.markdown, "en")], ["en", []], "idioma en: la ficha en inglés cumple la sintaxis");
for (const ruta of ["lib/medicion-agentes.mjs", "lib/qready-verificado.mjs", "api.js"]) {
  const t = sinComentarios(leer(ruta));
  igual(/["'`]## |Ficha Rosetta|RQ\.S\.0\d/.test(t), false, `${ruta}: no arma su propia ficha`);
}
igual(/Fi\.presentacion\(r\.foto/.test(leer("lib/medicion-agentes.mjs")) && /presentacion\(foto, \{/.test(leer("lib/qready-verificado.mjs")), true, "API/MCP y get_qready_grade llaman a presentacion() de ficha.mjs");
// get_qready_grade, con el esquema real: dominio verificado y público con su medición del servidor
{
  const db = await baseCon([["ejemplo.cl", "produccion", 1]]);
  const { foto } = fixture("a");
  await V.guardarMedicion(db, { foto, origen: "servidor" });
  const g = (await V.notaParaApi({ DB: db }, "ejemplo.cl", new URL("https://rosettaquantum.com/"))).cuerpo;
  igual([g.publicado, g.nota, g.presentacion?.protocolo, Fi.validarMarkdown(g.presentacion?.markdown || "")], [true, "A", "rosetta-ficha/1", []], "get_qready_grade: la ficha de la última medición publicada");
  igual([g.presentacion.markdown.includes("| legacy |"), g.presentacion.markdown.includes("Publicación: pública en https://rosettaquantum.com/es/verificado/ejemplo.cl"),
    g.presentacion.markdown.includes(`Huella de la foto: ${foto.sha256.slice(0, 8)}…${foto.sha256.slice(-4)}`)], [true, true, true],
    "get_qready_grade: nombres completos, enlace a la página pública y la huella de la foto publicada");
  const g3 = (await V.notaParaApi({ DB: db }, "tercero.example", new URL("https://rosettaquantum.com/"))).cuerpo;
  igual(Object.keys(g3).sort(), ["dominio", "mensaje", "nota", "ok", "publicado"], "get_qready_grade de un tercero: sin ficha, sin nada");
}
const { HERRAMIENTAS } = await import("../api.js");
for (const n of ["medir_exposicion_pqc", "get_qready_grade"]) {
  const h = HERRAMIENTAS.find((x) => x.name === n);
  igual([h.description.includes(FICHA.es.linea_mcp), JSON.stringify(h.inputSchema.properties.idioma?.enum)], [true, '["es","en"]'], `${n}: la descripción dice cómo mostrarla y acepta idioma`);
}

if (fallas.length) { console.error("check-ficha: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-ficha: ok (${casos} casos · snapshot de 3 fotos × 2 idiomas · ${Object.keys(MUT).length} mutaciones de texto y 5 de código gritan · ajustes 1, 2 y 3 contra el camino real)${ACTUALIZAR ? " · SNAPSHOTS REESCRITOS: revise el diff" : ""}`);
