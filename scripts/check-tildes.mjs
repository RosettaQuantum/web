#!/usr/bin/env node
/**
 * El español publicado lleva tildes.
 *
 * EL DEFECTO (medido el 2026-09-09, y llevaba meses vivo): de las 74 descripciones en
 * español del archivador, **0 tenian una sola tilde**. De las 40 fuentes del campo,
 * **0**. "Hallar un subgrupo oculto de un grupo conmutativo consultando una funcion que
 * es constante en cada coclase" es lo que leia un visitante en /es/biblioteca.
 *
 * No es cosmetico y no es una preferencia: es la regla de la casa (CLAUDE.md §5,
 * "español latino neutro, sin voseo, CON TILDES") y es exactamente lo que Nicholas
 * describio como "se ve roto o frankenstein y hace perder confianza".
 *
 * POR QUE NINGUNA GUARDIA LO VEIA: `check-es` pregunta si en la home española quedan
 * FRAGMENTOS EN INGLES. Un texto en español impecable salvo por las tildes pasa esa
 * pregunta entero. La ausencia de un acento no es una palabra en otro idioma.
 *
 * COMO LO COMPRUEBA: una lista de formas SIN tilde que en español no existen nunca
 * —`funcion`, `cuantica`, `correccion`, `tambien`…—. Precision sobre cobertura
 * (CLAUDE.md §2): quedan FUERA a proposito las ambiguas, donde las dos formas son
 * palabras reales y solo el contexto decide: `mas`/`más`, `si`/`sí`, `el`/`él`,
 * `publica`/`pública`, `practica`/`práctica`, `fabrica`/`fábrica`, `marco`/`marcó`,
 * `solo` (que la RAE ya no acentua). Un falso positivo retiene trabajo bueno; dejar
 * pasar `mas` cuesta una tilde.
 *
 * SU PUNTO CIEGO, declarado: mira las FUENTES en español del archivador y el español
 * que sirve la API. NO mira la tabla `rq_claims`, cuyos titulos estan en español sin
 * tildes Y ademas se muestran en la pagina inglesa — eso es un problema de idioma, no
 * de ortografia, y necesita texto nuevo aprobado antes de poder comprobarse.
 *
 * Uso:
 *   node scripts/check-tildes.mjs --self-test
 *   node scripts/check-tildes.mjs                    # archivos del repo
 *   node scripts/check-tildes.mjs --api https://...  # ademas, lo que sirve la API
 */

/** Quien actua esta senal, y que hace al recibirla. Declarado aqui, no en un documento aparte. */
export const CONSUMIDOR = {
  quien: "la sesion que edite texto en español (Main o Comercial)",
  hace: "pone las tildes en el archivo de origen, regenera db/quantum.seed.sql y lo aplica a D1",
};

import { readFileSync } from "node:fs";

/**
 * Formas sin tilde que en español NO son palabras. Si aparecen, falta el acento.
 * Deliberadamente NO estan las ambiguas: ver la cabecera.
 */
export const SIN_TILDE = [
  "algoritmica", "analogica", "aplicacion", "aqui", "automatica", "automatico",
  "bibliografia", "calculo", "canonico", "catalogo", "clasica", "clasico", "clasicos",
  "codigo", "codigos", "comite", "comparacion", "comun", "condicion", "correccion",
  "criogenica", "criptografia", "criptografica", "criptograficas", "cuantica",
  "cuanticas", "cuantico", "cuanticos", "decada", "descripcion", "despues", "detras",
  "diferenciacion", "dificil", "dinamica", "discusion", "ecuacion", "electrica",
  "electronica", "energia", "enfasis", "estandar", "estimacion", "facil", "fisica",
  "fisico", "fisicos", "formula", "fotonica", "funcion", "geometria", "hibrida",
  "informacion", "inversion", "libreria", "linea", "logica", "logico", "maquina",
  "matematica", "maximo", "mayoria", "medicion", "metodo", "metodos", "metrica",
  "metricas", "migracion", "millon", "minima", "minimo", "minimos", "mitigacion",
  "numero", "numeros", "opticas", "optimizacion", "oraculo", "organizacion",
  "particion", "patron", "polinomica", "practicamente", "prediccion", "programacion",
  "quimica", "quimico", "rapida", "rapido", "relajacion", "reproduccion", "resumen",
  "reticulos", "revision", "satisfaccion", "separacion", "simetria", "simulacion",
  "sintesis", "solidos", "solucion", "supercomputo", "supremacia", "tambien",
  "tecnica", "tecnicas", "tecnico", "tecnologia", "tecnologias", "teoria", "teorico",
  "teoricos", "termico", "termodinamicas", "topologico", "topologicos", "version",
  "vertices", "volumenes",
];

const RE = new RegExp("\\b(" + SIN_TILDE.join("|") + ")\\b", "gi");

/**
 * Devuelve SIEMPRE el denominador: cuantos textos miro y en cuantos encontro algo.
 * @param {{etiqueta: string, texto: string}[]} textos
 */
export function revisar(textos) {
  const hallazgos = [];
  for (const { etiqueta, texto } of textos) {
    const m = [...String(texto || "").matchAll(RE)].map((x) => x[0].toLowerCase());
    if (m.length) hallazgos.push({ etiqueta, palabras: [...new Set(m)] });
  }
  return { revisados: textos.length, conFalta: hallazgos.length, hallazgos };
}

// --------------------------------------------------------------------------- self-test

function selfTest() {
  let ok = 0, mal = 0;
  const p = (n, c, d = "") => { if (c) { ok++; console.log(`  ok   ${n}`); } else { mal++; console.log(`  FALLA ${n}${d ? "\n         " + d : ""}`); } };

  // CALLA con español correcto — incluidas las ambiguas, que no se tocan.
  const bien = revisar([
    { etiqueta: "a", texto: "Hallar un subgrupo oculto consultando una función constante en cada coclase." },
    { etiqueta: "b", texto: "Es la única consecuencia práctica y ya obligatoria de la amenaza cuántica." },
    { etiqueta: "c", texto: "Publica suites de benchmarks; fabrica su propio silicio; solo mide lo que corre." },
  ]);
  p("calla con español bien acentuado", bien.conFalta === 0, JSON.stringify(bien.hallazgos));
  p("no se mete con mas/si/solo/publica/fabrica/practica",
    revisar([{ etiqueta: "x", texto: "mas rapido no: mas, si, solo, publica, fabrica, practica, marco, el" }])
      .hallazgos[0].palabras.join(",") === "rapido");

  // GRITA con el texto REAL que estaba publicado el 2026-09-09.
  const real = revisar([
    { etiqueta: "abelian-hidden-subgroup", texto: "Hallar un subgrupo oculto de un grupo conmutativo consultando una funcion que es constante en cada coclase." },
    { etiqueta: "ibm-quantum", texto: "Flota de procesadores superconductores con una hoja de ruta publica de hardware." },
    { etiqueta: "google", texto: "Programa de procesadores y de correccion de errores." },
  ]);
  p("grita con el texto real que estaba publicado", real.conFalta === 2, JSON.stringify(real.hallazgos));
  p("nombra la palabra exacta", real.hallazgos[0].palabras.includes("funcion"));
  p("reporta el denominador", real.revisados === 3 && typeof real.conFalta === "number");

  console.log(`\n  ${ok} ok · ${mal} fallas`);
  return mal === 0 ? 0 : 1;
}

// ------------------------------------------------------------------------------ vivo

function delRepo() {
  const t = [];
  const alg = JSON.parse(readFileSync("db/quantum-problemas.es.json", "utf8"));
  for (const k of Object.keys(alg)) if (!k.startsWith("_")) t.push({ etiqueta: `problemas.es/${k}`, texto: alg[k] });
  for (const f of JSON.parse(readFileSync("db/quantum-sources.json", "utf8"))) {
    t.push({ etiqueta: `sources/${f.id}/que_es`, texto: f.que_es });
    t.push({ etiqueta: `sources/${f.id}/por_que_importa`, texto: f.por_que_importa });
  }
  return t;
}

async function deLaApi(base) {
  const j = async (u) => (await fetch(base + u, { headers: { accept: "application/json" } })).json();
  const t = [];
  const a = await j("/v1/algorithms?limit=200");
  for (const x of a.items || []) t.push({ etiqueta: `api/algorithms/${x.id}`, texto: x.problema });
  const s = await j("/v1/sources");
  for (const x of s.items || []) t.push({ etiqueta: `api/sources/${x.id}`, texto: `${x.que_es} ${x.por_que_importa}` });
  return t;
}

import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  if (args.includes("--self-test")) process.exit(selfTest());
  const iApi = args.indexOf("--api");
  let textos = delRepo();
  if (iApi >= 0) textos = textos.concat(await deLaApi(args[iApi + 1]));
  const r = revisar(textos);
  console.log(`tildes · ${r.revisados} textos en español revisados`);
  if (!r.conFalta) { console.log("  ok   ninguno pierde una tilde"); process.exit(0); }
  r.hallazgos.forEach((h) => console.log(`  FALTA ${h.etiqueta}: ${h.palabras.join(", ")}`));
  console.log(`\n  ${r.conFalta} de ${r.revisados} textos sin tildar.`);
  process.exit(1);
}
