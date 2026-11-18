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
// a, f, sin-correo: fotos de ejemplo; rastreo y rastreob: desde las respuestas crudas del MCP de producción
// del 16-nov (la ficha aprobada y el defecto B1), con el dominio enmascarado (ver generar-rastreo.mjs).
const CASOS = ["a", "f", "sin-correo", "rastreo", "rastreob"];
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
igual(letras, { a: "A", f: "F", "sin-correo": "B", rastreo: "F", rastreob: "B" }, "las fotos fijas: una A, dos F (una con ALTA), una sin correo (B) y la de B1 (B)");
// el caso F ejerce lo que tiene que ejercer: alertas GRAVE y MEDIA, acciones con y sin efecto, no medido
const mdF = render(Fi, "f", "es");
igual(["| A1 | GRAVE |", "| MEDIA |", "| -> ", "| no cambia |", "| RQ.S.06 | no cambia |", "| Publicar security.txt | — | no cambia |", "crt.sh no respondió; se usó Cert Spotter", "sin índice para Paraguay",
  "## 01 Veredicto", "· desde afuera, sin instalar nada", "4022 cert.", "Versiones: QEX-1.0 · QREADY-NOTA-2.1", "Con H1 a H3 hechos"].filter((t) => !mdF.includes(t)), [],
  "el caso F ejerce GRAVE, MEDIA, efecto, «no cambia», el correo medido, la fuente caída, el país sin índice y el formato de la ficha aprobada");
igual(/staging\.|staging \|/.test(mdF), false, "el caso F (no verificado) no imprime el nombre de pruebas completo");
igual(render(Fi, "a", "es").includes("| legacy.ejemplo.cl |"), true, "el caso A (verificado) imprime los nombres completos");
igual(render(Fi, "rastreo", "es").includes("| A2 | ALTA | Infraestructura sensible que responde |"), true, "el caso real de la ficha aprobada trae su ALTA");
igual(render(Fi, "sin-correo", "es").includes("| RQ.S.06 | Correo post-cuántico | sin MX publicado | medido |"), true, "sin MX publicado es una medición, no un «sin dato»");

// Ningún texto renderizado dice «undefined», «NaN» ni «null» (17-nov-2026). EL DEFECTO: el documento que
// aprobó el dueño mostraba «mediana 1 undefined (undefined orgs…) undefined está NaN puntos» y «de los
// undefined servidores»: una función de texto llamada con argumentos de menos. Se revisa cada ficha
// (es/en; markdown, HTML de la página y HTML del PDF) y el documento de textos.
const VACIO = /\b(undefined|NaN|null)\b/;
const vacios = (t) => (String(t).match(new RegExp(VACIO.source, "g")) || []);
// un correo con 4 de 5 MX medidos: ejerce `no_medido.correo_mx` (el texto del defecto)
const fParcial = (() => { const fx = fixture("f"); return { foto: fx.foto, ctx: { ...fx.ctx, correo: { estado: "hecho",
  resultado: { ...fx.ctx.correo.resultado, mx_publicados: ["a", "b", "c", "d", "e"] } } } }; })();
function rendersDe(M) {
  const out = [];
  for (const [c, fx] of [...CASOS.map((c) => [c, fixture(c)]), ["f-mx-parcial", fParcial]]) for (const idioma of ["es", "en"]) {
    const fi = M.armarFicha(fx.foto, { ...fx.ctx, idioma });
    out.push([`${c}.${idioma}.md`, M.markdownDe(fi)], [`${c}.${idioma}.html`, M.htmlDe(fi)], [`${c}.${idioma}.pdf.html`, M.htmlDe(fi, { documento: true })]);
  }
  return out;
}
const sucios = (M) => rendersDe(M).filter(([, t]) => vacios(t).length).map(([n, t]) => `${n}: ${vacios(t).join(",")}`);
igual(sucios(Fi), [], "silencio: ninguna ficha renderizada (5 fotos + correo parcial, es/en, markdown/HTML/PDF) dice undefined, NaN ni null");
igual(rendersDe(Fi).find(([n]) => n === "f-mx-parcial.es.md")[1].includes("Uno de los 5 servidores de correo no se midió."), true, "el caso del correo parcial ejerce correo_mx con su total");
igual(rendersDe(Fi).find(([n]) => n === "a.es.md")[1].includes("Referencia: mediana banca 57 (12 orgs, edición 2026-08). ejemplo.cl está 1 punto abajo."), true,
  "referencia de un .cl: «mediana banca 57 (12 orgs, edición 2026-08). ejemplo.cl está 1 punto abajo.»");
await conMutante(new URL("public/js/ficha.mjs", raiz), "foto.referencia.n_sector, foto.referencia.edicion, dominio, cmp.diferencia)", "foto.referencia.n_sector, foto.referencia.edicion, cmp.diferencia)",
  async (M) => igual(sucios(M).length > 0, true, "MUTACIÓN: `referencia` con un argumento de menos → «undefined está NaN puntos» → el guardia grita"));
await conMutante(new URL("public/js/ficha.mjs", raiz), "F.no_medido.correo_mx(publicados - cm.total, publicados)", "F.no_medido.correo_mx(publicados - cm.total)",
  async (M) => igual(sucios(M).some((x) => x.startsWith("f-mx-parcial")), true, "MUTACIÓN: `correo_mx` sin el total → «de los undefined» → el guardia grita"));
// el documento de textos que se aprueba: desde «## Ficha · es» (lo de arriba es prosa que nombra el defecto)
const { generarTextos } = await import("./textos-ficha.mjs");
const docVacios = (t) => vacios(t.slice(t.indexOf("## Ficha · es")).replace(/\bnull (significa|means|y «sin dato»|and “no data”)/g, ""));
igual(docVacios(generarTextos()), [], "silencio: el documento de textos no dice undefined, NaN ni null (fuera de las frases aprobadas que explican null)");
await conMutante(new URL("scripts/textos-ficha.mjs", raiz), '  correo_mx: [[1, 5], [2, 5]],\n', "",
  async (M) => igual(docVacios(M.generarTextos()).length > 0, true, "MUTACIÓN: el generador sin los datos de ejemplo de correo_mx → «undefined» → el guardia grita"));

// GRITO: cada mutación del texto la ve el validador
const base = render(Fi, "f", "es");
const cambiar = (de, a) => { if (!base.includes(de)) throw new Error(`mutación de texto que no entra: ${de}`); return base.replace(de, a); };
const MUT = {
  "secciones 3 y 4 cambiadas de lugar": base.replace("## 03 Alertas", "## 03 TMP").replace("## 04 Qué hacer", "## 03 Alertas").replace("## 03 TMP", "## 04 Qué hacer"),
  "sección sin el cero": cambiar("## 03 Alertas", "## 3 Alertas"),
  "un ID con otro formato": cambiar("| RQ.S.03 |", "| RQ.S.3 |"),
  "un ID que salta": cambiar("| RQ.S.08 |", "| RQ.S.10 |"),
  "sin la sección No medido": base.replace(/## 05 No medido\n[\s\S]*?\n\n/, ""),
  "alertas fuera de orden": cambiar("| A4 | MEDIA |", "| A4 | GRAVE |"),
  "alerta mal numerada": cambiar("| A2 |", "| A3 |"),
  "nivel inventado": cambiar("| A1 | GRAVE |", "| A1 | URGENTE |"),
  "acción mal numerada": cambiar("| H2 |", "| H7 |"),
  "efecto con flecha unicode": cambiar("| -> ", "| → "),
  "huella completa": cambiar("Huella CT: ", "Huella CT: " + "a".repeat(64) + " "),
  "pie distinto": base.replace(/medición independiente\n$/, "medición propia\n"),
  "un emoji": cambiar("## 01 Veredicto", "## 01 Veredicto \u{1F512}"),
  "decimales": cambiar("75/100", "75.5/100"),
  "tipo inventado": cambiar("| modelo |", "| estimado |"),
  "encabezado distinto": cambiar("# Ficha Rosetta", "# Ficha"),
};
for (const [q, md] of Object.entries(MUT)) igual(Fi.validarMarkdown(md).length > 0, true, `MUTACIÓN de texto: ${q} → el validador grita`);

// MUTACIÓN en el código: el título de sección sin el punto
await conMutante(new URL("public/js/ficha.mjs", raiz), "const titulo = (i) => `## ${num2(i + 1)} ${F.secciones[i]}`;", "const titulo = (i) => `## ${i + 1}. ${F.secciones[i]}`;", async (M) => {
  const md = render(M, "f", "es");
  igual(primeraDiferencia(md, leer(`${FX}f.es.md`)) !== null, true, "MUTACIÓN: «## 3. Alertas» → el snapshot grita");
  igual(M.validarMarkdown(md).length > 0, true, "MUTACIÓN: «## 3. Alertas» → el validador grita");
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

// ---------------------------------------------------------------- 2a · B1: una dimensión pesada sin medir no deja A (QREADY-NOTA-2.1)
{
  const fx = fixture("rastreob");
  const x = N.explicarNota(fx.foto);
  igual([fx.nota_en_produccion, x.nota, x.no_evaluado, x.falta_para_A.map((f) => f.codigo)],
    ["A", "B", [{ dimension: "certificados", peso: 0.4 }], ["dimension_sin_medir"]],
    "B1 (respuesta real de producción): salía A con «Certificados y PKI» en null; ahora B, y la dimensión va en no_evaluado");
  igual(Fi.lecturaDe(x, fx.foto), "Su sitio ya usa el candado post-cuántico, pero no se pudo leer su certificado.", "B1: la lectura dice la causa");
  const md = render(Fi, "rastreob", "es");
  igual([md.includes("Certificados y PKI no se pudo medir"), md.includes("| RQ.S.02 | Certificados y PKI | sin dato | no medido |")], [true, true], "B1: la ficha lo declara en 02 y en 05");
  igual(N.explicarNota(fixture("a").foto).nota, "A", "silencio: sin dimensiones faltantes, la A no se toca");
  const f10 = clon(fixture("a").foto); f10.qex.dimensiones.edge = null;
  igual(N.explicarNota(f10).nota, "A", "silencio: falta sólo el borde (peso 0,10): la regla no aplica");
  await conMutante(new URL("public/js/qex-nucleo.mjs", raiz), 'if (out.nota === "A" && sinDim.length) out.nota = "B";', "",
    async (M) => igual(M.explicarNota(fx.foto).nota, "A", "MUTACIÓN: sin la regla 2.1, el caso real vuelve a salir A (el guardia lo ve)"));
}

// ---------------------------------------------------------------- 2a' · RQ.S.13, reservados y la versión de método de cada valor
{
  const fx = fixture("f"), fi = Fi.armarFicha(fx.foto, fx.ctx);
  igual([Object.keys(fi.indicadores), Fi.RESERVADOS.some((id) => id in fi.indicadores)], [Fi.CATALOGO_COMPLETO, false], "el bloque trae RQ.S.00-09 y 13, nunca los reservados 10-12");
  igual([fi.indicadores["RQ.S.13"].valor, fi.indicadores["RQ.S.13"].tipo, fi.indicadores["RQ.S.13"].valor === fx.foto.ct.conteos.hostnames], [77, "medido", true], "RQ.S.13 = nombres en el registro (no cuántos responden)");
  igual(render(Fi, "f", "es").includes("RQ.S.13"), false, "la ficha impresa no muestra RQ.S.13");
  igual(Fi.CATALOGO_COMPLETO.map((id) => [id, typeof fi.indicadores[id].metodo === "string" && fi.indicadores[id].metodo.length > 0]).filter(([, ok]) => !ok), [],
    "cada valor declara su versión de método");
  igual(["RQ.S.01", "RQ.S.02", "RQ.S.03", "RQ.S.04", "RQ.S.05"].map((id) => fi.indicadores[id].metodo), Array(5).fill("QEX-1.0"), "RQ.S.01 a 05: metodo QEX-1.0");
  igual(fi.indicadores["RQ.S.00"].metodo, N.VERSION_NOTA, "RQ.S.00: metodo = versión de la nota");
}

// ---------------------------------------------------------------- 2a'' · «publicado» sin GET (main 7786413): alerta MEDIA, acción y lectura
{
  const fx = fixture("f"), fP = clon(fx.foto);
  Object.assign(fP.endpoints.find((e) => e.host.startsWith("staging.")), { http_status: null, http_consultado: false });
  const x = N.explicarNota(fP), fi = Fi.armarFicha(fP, fx.ctx);
  igual([x.nota, fi.alertas.filter((a) => a.codigo === "ambiente_pruebas_publicado").map((a) => a.nivel)], ["B", ["MEDIA"]], "sin GET: el ambiente de pruebas que saluda es MEDIA (techo B), no F");
  const h = fi.acciones.find((a) => a.codigo === "retirar_ambientes_publicados");
  igual([!!h, h && /^Retirar de internet s•••#?[0-9a-f]*\.ejemplo\.com\.py$/.test(h.accion)], [true, true], "tiene su acción, con el nombre enmascarado");
  igual(fi.veredicto.lectura.includes("tiene un ambiente de pruebas publicado"), true, "la lectura dice la causa del techo");
  igual([vacios(Fi.markdownDe(fi)), Fi.validarMarkdown(Fi.markdownDe(fi))], [[], []], "la ficha es válida y sin vacíos");
}

// ---------------------------------------------------------------- 2b · nivel ALTA y la lectura por motivo
{
  const { foto, ctx } = fixture("f");
  const fA = clon(foto); fA.endpoints.push({ host: "vpn." + foto.dominio, clases: ["infra_expuesta"], dns_status: "NOERROR", responde_443: true, hibrido: false });
  for (const idioma of ["es", "en"]) {
    const md = Fi.markdownDe(Fi.armarFicha(fA, { ...ctx, idioma }));
    igual([Fi.validarMarkdown(md, idioma), md.includes(`| A2 | ${idioma === "en" ? "HIGH" : "ALTA"} |`)], [[], true], `ALTA (${idioma}): entre GRAVE y MEDIA, y la ficha es válida`);
  }
  igual(Fi.validarMarkdown(base.replace("| A4 | MEDIA |", "| A4 | ALTA |")).length > 0, true, "MUTACIÓN de texto: ALTA después de MEDIA → el validador grita");
  igual(Fi.NIVELES, ["GRAVE", "ALTA", "MEDIA", "INFO"], "los cuatro niveles, en orden");
  const lee = (f) => Fi.lecturaDe(N.explicarNota(f), f);
  igual(lee(foto), "Su sitio ya usa el candado post-cuántico, pero tiene un ambiente de pruebas expuesto a internet.", "lectura F: la causa real");
  const fB = clon(foto); Object.assign(fB.endpoints.find((e) => e.host.startsWith("staging.")), { http_status: 403 });
  igual(lee(fB), "Su sitio ya usa el candado post-cuántico, pero tiene un ambiente de pruebas publicado y 2 nombres que responden no muestran el candado nuevo.",
    "lectura B por techo: el ambiente bloqueado, y el mismo nombre no se cuenta dos veces");
  const fC = clon(fA); fC.borde.soporta = false; fC.endpoints = fC.endpoints.filter((e) => !e.host.startsWith("staging."));
  igual(lee(fC), "Su sitio todavía no usa el candado post-cuántico y tiene un nombre de infraestructura sensible que responde.", "lectura D: sin candado y con infraestructura");
  igual(lee(fixture("a").foto), FICHA.es.lectura_motivo ? (await import("../public/js/qready-textos.mjs")).textos("es").nota_lectura.A : null, "lectura A: el texto aprobado");
  igual(sinComentarios(leer("lib/medicion-agentes.mjs")).includes("lectura: Fi.lecturaDe(x, foto, lang)"), true, "el JSON (nota.lectura) dice la misma lectura que la ficha");
}

// ---------------------------------------------------------------- 2c · la página pinta con el mismo nombrador
{
  const pag = sinComentarios(leer("public/js/medicion-envivo.mjs"));
  igual(/nombre = nombrador\(dominio, s\.nombres_completos === true,/.test(pag), true, "la página arma el nombrador con la respuesta del servidor (verificado → completos)");
  const sueltos = [...pag.matchAll(/esc\((?:x|e|a|h|f)\.host\)/g)].length;
  igual(sueltos, 0, "la página no pinta ningún nombre sin pasar por nombre()");
  igual(/esc\(x\.host\)/.test("`<code>${esc(x.host)}</code>`"), true, "el detector de nombre suelto grita con el patrón viejo");
  const sondas = sinComentarios(leer("lib/informe-envivo.mjs"));
  igual(/const \{ verificado: nombres_completos, publico: pagina_publica \} = await dominioVerificado\(env\.DB, dominio\);/.test(sondas) && /nombres_completos,/.test(sondas), true, "/api/sondas dice si el dominio está verificado (la misma consulta que la API)");
}

// ---------------------------------------------------------------- 3 · ajuste 2: el país
igual(["x.cl", "banco.com.py", "x.com", "x.io", "x.co.uk", "x.example", "x.org"].map(Fi.paisDeDominio), ["CL", "PY", null, null, "GB", null, null], "el país sale del TLD; .com, .io y .org no dicen país");
igual([Fi.comparacion("x.cl", 56, 57), Fi.comparacion("banco.com.py", 53, 57).diferencia, Fi.comparacion("x.com", 53, 57).diferencia],
  [{ pais: "CL", pais_fuente: "tld", pais_referencia: "CL", compara: true, diferencia: -1 }, null, null], "sólo un dominio chileno se compara con la referencia chilena (sin ficha ni país declarado, el del TLD; el orden completo: check-pais-ficha)");
igual(Fi.notaSector("banco.com.py"), "Sin índice de referencia para Paraguay; no se compara", "sector.nota de un .py: el texto del encargo");
igual(Fi.notaSector("x.cl"), null, "un .cl no lleva nota de país");
await conMutante(new URL("public/js/ficha.mjs", raiz), "const compara = pais === PAIS_REFERENCIA && score != null", "const compara = score != null",
  async (M) => igual(M.comparacion("banco.com.py", 53, 57).diferencia !== null, true, "MUTACIÓN: comparar sin mirar el país → el .py vuelve a compararse con Chile (el guardia lo ve)"));

// ---------------------------------------------------------------- 4 · ajuste 3: nombres enmascarados
const ENC = {
  "biometrics-dev.ueno.com.py": "biometrics-d•••.ueno.com.py", "apigw-legacy.ueno.com.py": "apigw-l•••.ueno.com.py",
  "cdn-dev.ueno.com.py": "cdn-d•••.ueno.com.py", "cdn-statements-api-files-ind-dev.ueno.com.py": "cdn-statements-api-files-ind-d•••.ueno.com.py",
  "checks-cdn.ind-dev.ueno.com.py": "check•••.ueno.com.py", "cloud-websocket-test.ueno.com.py": "cloud-websocket-t•••.ueno.com.py",
  "2a57j78hsrstljvqlux8inqlkmoufug.proxy.shs-dev.ueno.com.py": "2a57j78hsrstljv•••.ueno.com.py",
  "argocd.pruebadelivery.data-legacy.ueno.com.py": "arg•••.ueno.com.py",
  "openfinance-desa.banco.cl": "openfinance-d•••.banco.cl", "portal-clientes.banco.cl": "portal-•••.banco.cl",
  "banco.cl": "banco.cl", "www.banco.cl": "www.banco.cl",
};
for (const [h, esperado] of Object.entries(ENC)) igual(Fi.enmascarar(h, h.endsWith("banco.cl") ? "banco.cl" : "ueno.com.py"), esperado, `enmascarar ${h}`);
// sólo el primer label: nada del resto del subdominio queda a la vista
igual(Object.entries(ENC).filter(([h, m]) => m !== h && m.split(Fi.MASCARA)[0].includes(".")).map(([h]) => h), [], "lo visible es sólo (parte de) el primer label");
// nombres distintos que quedan iguales: sufijo corto y estable; uno solo, sin sufijo; verificado, completos
{
  const hs = ["all-dev.x.com.py", "all-dev2.x.com.py", "all-desa.x.com.py", "biometrics-dev.x.com.py"];
  const v = Fi.nombrador("x.com.py", false, hs), w = Fi.nombrador("x.com.py", false, [...hs].reverse());
  const m = hs.map(v);
  igual([new Set(m.slice(0, 3)).size, m.slice(0, 3).every((x) => /^all-d•••#[0-9a-f]{2,8}\.x\.com\.py$/.test(x)), m[3]], [3, true, "biometrics-d•••.x.com.py"],
    "tres nombres que chocan llevan sufijos distintos (all-d•••#xx); el que no choca, ninguno");
  igual(hs.map(w), m, "el sufijo es estable: no depende del orden");
  igual(Fi.nombrador("x.com.py", true, hs)("all-dev.x.com.py"), "all-dev.x.com.py", "verificado: el nombre completo");
  igual(m.some((x) => hs.some((h) => x.includes(h.split(".")[0]) && h.split(".")[0].length > 6)), false, "el sufijo no revela el nombre");
}

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
// la foto de python.org que arma el servidor (registro + sondeados), para saber qué nombre le toca
function fixtureFotoPy() {
  const mapa = N.nombresCT(JSON.parse(CT.texto), "python.org");
  return { dominio: "python.org", ct: { hosts: N.hostsCT(mapa, "python.org") }, endpoints: sF.endpoints };
}
const SENSIBLES = sF.endpoints.map((e) => e.host).filter((h) => h !== "python.org" && h !== "www.python.org");
const filtrado = (cuerpo) => { const c = { ...cuerpo, correo: { ...cuerpo.correo, mx: [] } }; return SENSIBLES.filter((h) => JSON.stringify(c).includes(h)); };
async function medirCon(Mod, filas, idioma = "es") {
  const r = await Mod.medirParaAgente({ DB: await baseCon(filas) }, { dominio: "python.org", sector: "banca", idioma }, { canal: "mcp", ip: "203.0.113.5" }, null, M);
  return r.cuerpo;
}
const sinVerif = await medirCon(A, []);
igual([sinVerif.ok, sinVerif.nota?.letra, sinVerif.nombres_enmascarados], [true, "F", true], "no verificado: mide, F, y declara que enmascara");
igual(filtrado(sinVerif), [], "grito de la fuga: ningún nombre sensible completo en TODO el JSON (endpoints, alertas, falta_para_A, no_medido, CNAME, ficha)");
// staging y stage chocan en «s•••»: cada uno lleva su sufijo (el mismo en endpoints, alertas y ficha)
const sStaging = Fi.nombradorDeFoto(fixtureFotoPy(), false)("staging.python.org");
igual(/^s•••#[0-9a-f]{2,8}\.python\.org$/.test(sStaging), true, `staging.python.org → ${sStaging}`);
igual(sinVerif.endpoints.find((e) => e.host === sStaging)?.cname, [`${sStaging}.cdn.example`], "el CNAME que repite el nombre también se enmascara, con el mismo sufijo");
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

// ---------------------------------------------------------------- 4b · /api/sondas cerrado (17-nov-2026)
// A quien no es dueño verificado, /api/sondas le devuelve los nombres enmascarados y su posición; la página
// los reasocia con los nombres que ella pidió. La foto, su huella y su nota tienen que salir IGUALES.
{
  const I = await import("../lib/informe-envivo.mjs");
  const pedidosPy = sF.endpoints.map((e) => e.host);
  const pedidosConRuido = ["OTRO.AJENO.CL", ...pedidosPy];             // un nombre ajeno que el servidor descarta
  const tercero = I.sondasParaTercero(sF.endpoints, pedidosConRuido, "python.org", "www.python.org");
  igual(SENSIBLES.filter((h) => JSON.stringify(tercero).includes(h)), [], "grito de la fuga: /api/sondas a un tercero no trae ningún nombre sensible completo");
  igual(tercero.map((e) => e.i), pedidosPy.map((_, k) => k + 1), "cada nombre trae su posición en la lista TAL COMO SE PIDIÓ (con el ajeno descartado)");
  const devueltos = Fi.reasociar(tercero, pedidosConRuido, true);
  igual(devueltos.map((e) => e.host), pedidosPy, "la página reasocia cada nombre por su posición");
  const REFp = JSON.parse(leer("public/data/qex-referencia-2026-08.json"));
  const fotoDe = async (endpoints) => { const ct = await N.ctDesdeServidor(CT, 0);
    return await N.sellarFoto(N.armarFoto({ dominio: "python.org", www: "www.python.org", vertical: "banca", medido: "2026-11-12T17:34:15.418Z", ct,
      sondas: { ...sF, endpoints }, referencia: REFp, origen: "guardia" }).foto); };
  const fCompleta = await fotoDe(sF.endpoints), fReasociada = await fotoDe(devueltos);
  // el CNAME queda enmascarado (la página no lo pidió): fuera de eso, la foto es la misma
  const sinCname = (f) => ({ ...f, sha256: null, endpoints: f.endpoints.map((e) => ({ ...e, cname: null })) });
  igual([JSON.stringify(sinCname(fReasociada)) === JSON.stringify(sinCname(fCompleta)), N.explicarNota(fReasociada).nota, N.explicarNota(fReasociada).graves.map((g) => g.host)],
    [true, N.explicarNota(fCompleta).nota, N.explicarNota(fCompleta).graves.map((g) => g.host)], "la foto reasociada da la misma nota, las mismas alertas y los mismos nombres");
  igual(Fi.reasociar(sF.endpoints, pedidosPy, false), sF.endpoints, "silencio: al dueño verificado no se le toca nada");
  let lanzo = false; try { Fi.reasociar(tercero.map(({ i, ...e }) => e), pedidosPy, true); } catch { lanzo = true; }
  igual(lanzo, true, "falla cerrado: una respuesta enmascarada sin posiciones no arma una foto con nombres enmascarados");
  const src = sinComentarios(leer("lib/informe-envivo.mjs"));
  igual([/const enmascarados = !interno && !nombres_completos;/.test(src), /endpoints: enmascarados \? sondasParaTercero\(endpoints, pedidos, dominio, www\) : endpoints/.test(src)], [true, true],
    "/api/sondas enmascara salvo dueño verificado o llamada interna");
  igual(/env, \{ interno: true \}\)\);/.test(sinComentarios(leer("lib/medicion-agentes.mjs"))), true, "la medición del servidor (agentes y cron) pide los nombres completos (interno)");
  igual(/s\.endpoints = reasociar\(s\.endpoints, pedidos, s\.nombres_enmascarados === true\);/.test(sinComentarios(leer("public/js/medicion-envivo.mjs"))), true, "la página reasocia antes de armar su foto");
  await conMutante(new URL("lib/informe-envivo.mjs", raiz), "return enmascararEndpoints(endpoints, ver).map(", "return endpoints.map(",
    async (M) => igual(SENSIBLES.some((h) => JSON.stringify(M.sondasParaTercero(sF.endpoints, pedidosConRuido, "python.org", "www.python.org")).includes(h)), true,
      "MUTACIÓN: /api/sondas sin enmascarar → la fuga se ve"));
}

// ---------------------------------------------------------------- 5 · una sola definición y el MCP
const p = sinVerif.presentacion;
igual([p.protocolo, p.spec, p.idioma, p.instruccion_agente, Object.keys(p.ficha || {})],
  ["rosetta-ficha/1", "https://rosettaquantum.com/protocolo/ficha", "es", FICHA.es.instruccion_agente,
    ["protocolo", "idioma", "dominio", "encabezado", "veredicto", "indicadores", "puntos_qex", "alertas", "acciones", "no_medido", "evidencia", "limites", "pie", "url_dominio"]],
  "presentacion trae protocolo, spec, instrucción, idioma, markdown y el bloque ficha");
igual(Fi.validarMarkdown(p.markdown), [], "la ficha de /v1/medicion cumple la sintaxis");
igual(p.markdown.includes(`| A1 | GRAVE | Ambiente de pruebas expuesto | ${sStaging} |`), true, "la alerta A1 de la ficha es la misma que nota.alertas[0], enmascarada");
igual(sinVerif.nota.alertas[0], { id: "A1", nivel: "grave", codigo: "ambiente_pruebas_expuesto", texto: "Ambiente de pruebas expuesto", host: sStaging }, "nota.alertas lleva el mismo ID");
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
  igual([g.presentacion.markdown.includes("| legacy.ejemplo.cl |"), g.presentacion.markdown.includes("Publicación: pública en https://rosettaquantum.com/es/verificado/ejemplo.cl"),
    g.presentacion.markdown.includes(`Huella de la foto: ${foto.sha256.slice(0, 8)}…${foto.sha256.slice(-4)}`)], [true, true, true],
    "get_qready_grade: nombres completos, enlace a la página pública y la huella de la foto publicada");
  const g3 = (await V.notaParaApi({ DB: db }, "tercero.example", new URL("https://rosettaquantum.com/"))).cuerpo;
  igual(Object.keys(g3).sort(), ["dominio", "mensaje", "nota", "ok", "publicado"], "get_qready_grade de un tercero: sin ficha, sin nada");
}
// ---------------------------------------------------------------- 6 · las superficies: web, sello y PDF salen de la misma ficha
{
  const fx = fixture("rastreo"), ficha = Fi.armarFicha(fx.foto, fx.ctx);
  const h = Fi.htmlDe(ficha);
  igual([...h.matchAll(/<span class="rf-num">(\d\d)<\/span>/g)].map((m) => m[1]), ["01", "02", "03", "04", "05", "06", "07"], "htmlDe: las 7 secciones 01..07, en orden");
  igual(Fi.CATALOGO.every((id) => h.includes(`>${id}<`) || h.includes(`${id} · `)), true, "htmlDe: los IDs RQ.S.00 a 09");
  igual([h.includes("staging."), h.includes("s•••.rastreo.example")], [false, true], "htmlDe: no verificado → enmascarado");
  const sello = Fi.htmlDe(ficha, { secciones: ["veredicto", "indicadores"] });
  igual([...sello.matchAll(/<span class="rf-num">(\d\d)<\/span>/g)].map((m) => m[1]), ["01", "02"], "htmlDe para el sello: sólo 01 y 02");
  const mala = { ...ficha, veredicto: { ...ficha.veredicto, lectura: "<script>alert(1)</script>" } };
  igual([Fi.htmlDe(mala).includes("<script>"), Fi.htmlDe(mala).includes("&lt;script&gt;")], [false, true], "htmlDe escapa todo el texto");
  const doc = Fi.htmlDe(ficha, { documento: true, marca: "<svg></svg>" });
  igual([doc.startsWith("<!doctype html>"), /@page\{size:A4/.test(doc), (doc.match(/class="rf-top"/g) || []).length, doc.includes('data-protocolo="rosetta-ficha/1"')], [true, true, 2, true],
    "documento A4 (PDF): página, dos cabeceras (una por página) y la marca del protocolo");
  // la página de medición pinta ESA ficha (y nada propio)
  const pag = sinComentarios(leer("public/js/medicion-envivo.mjs"));
  igual(/caja\.innerHTML = htmlDe\(armarFicha\(foto, \{ idioma: IDIOMA, verificado: s\.nombres_completos === true,/.test(pag) && /pintarFicha\(fotoHoy, s, co\);/.test(pag), true,
    "la página de medición pinta la ficha con armarFicha + htmlDe, con la foto sellada");
  for (const r of ["src/pages/es/q-ready/medicion/index.astro", "src/pages/q-ready/medicion/index.astro"])
    igual(leer(r).includes('id="mv-ficha"'), true, `${r}: tiene la caja de la ficha`);
  // /verificado/<dominio>: 01 y 02 de la ficha, con el esquema real
  const cuerpo = V.cuerpoVerificado({ lang: "es", dominio: "ejemplo.cl", fila: { verificado_en: "2026-11-13T00:00:00Z", inventario_verificado_en: null },
    mediciones: [{ fecha: fixture("a").foto.medido_utc, nota: "A", qex: 56, sha256: fixture("a").foto.sha256, foto_json: JSON.stringify(fixture("a").foto) }] });
  igual([[...cuerpo.matchAll(/<span class="rf-num">(\d\d)<\/span>/g)].map((m) => m[1]), cuerpo.includes(">RQ.S.09<"), cuerpo.includes(`class="rf-lvl`)],
    [["01", "02"], true, false], "/verificado: muestra 01 y 02 de la ficha (sin alertas ni acciones)");
  // el PDF: el Worker arma la ficha del trabajo (con el correo medido y la verificación) y el VPS sólo la convierte
  const E = await import("../lib/envio-informe.mjs");
  const dbE = (verificado) => ({ prepare: (sql) => ({ bind: () => ({ first: async () => /qready_dominios/.test(sql) ? { publico: verificado ? 1 : null }
    : /sondas_correo/.test(sql) ? { estado: "hecho", resultado: JSON.stringify(fixture("f").ctx.correo.resultado) } : null }) }) });
  const ff = fixture("f").foto;
  const t1 = await E.fichaDelTrabajo({ DB: dbE(false) }, { dominio: ff.dominio, foto: ff, correo_id: "c" }, "<svg></svg>");
  igual([t1.ficha_html.includes('data-protocolo="rosetta-ficha/1"'), t1.ficha_html.includes("0/4 MX"), t1.ficha_html.includes("staging."), t1.lectura === Fi.lecturaDe(N.explicarNota(ff), ff)],
    [true, true, false, true], "PDF: la ficha del trabajo lleva el correo medido, enmascara sin verificar y la lectura es la de la ficha");
  const t2 = await E.fichaDelTrabajo({ DB: dbE(true) }, { dominio: ff.dominio, foto: ff, correo_id: null });
  igual(t2.ficha_html.includes("staging.ejemplo.com.py"), true, "PDF: dueño verificado → nombres completos");
  igual(/const \{ ficha_html, lectura \} = await fichaDelTrabajo\(env, /.test(sinComentarios(leer("lib/envio-informe.mjs"))), true, "la cola del informe entrega ficha_html al VPS");
  igual(/def html_de_trabajo|PROTOCOLO = 'data-protocolo="rosetta-ficha\/1"'/.test(leer("vps/sonda-correo/informe_pdf.py")) && !/def html_informe/.test(leer("vps/sonda-correo/informe_pdf.py")), true,
    "el VPS convierte la ficha y ya no arma su propio informe");
}

const { HERRAMIENTAS } = await import("../api.js");
for (const n of ["medir_exposicion_pqc", "get_qready_grade"]) {
  const h = HERRAMIENTAS.find((x) => x.name === n);
  igual([h.description.includes(FICHA.es.linea_mcp), JSON.stringify(h.inputSchema.properties.idioma?.enum)], [true, '["es","en"]'], `${n}: la descripción dice cómo mostrarla y acepta idioma`);
}

if (fallas.length) { console.error("check-ficha: FALLA\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`check-ficha: ok (${casos} casos · snapshot de ${CASOS.length} fotos × 2 idiomas · ${Object.keys(MUT).length + 1} mutaciones de texto y 10 de código gritan · sin undefined, NaN ni null · web, sello y PDF de la misma ficha · ajustes 1, 2 y 3 contra el camino real)${ACTUALIZAR ? " · SNAPSHOTS REESCRITOS: revise el diff" : ""}`);
