#!/usr/bin/env node
/**
 * Chequeo del archivador de algoritmos. Falla cerrado.
 *
 * POR QUE EXISTE
 * --------------
 * "Comprueba que ninguna fila afirme algo sin cita" escrito en un encargo no es un
 * control: si un dia deja de mirar, nadie se entera. Esto lo mueve a codigo, y el
 * modo --self-test lo obliga a gritar contra defectos reales inyectados a proposito.
 * Sin esa parte, un chequeo que siempre pasa es indistinguible de uno que ya no mira.
 *
 * QUE VIGILA
 * ----------
 *  1. Ninguna fila del catalogo afirma nada sin `fuente_url`.
 *  2. El catalogo no encoge en silencio (denominador contra la meta sellada).
 *  3. `evidencia_rosetta.medido=true` solo si hay receta real en el ledger.
 *  4. El catalogo NUNCA usa el vocabulario prohibido (garantizado / certificado /
 *     ventaja probada por nosotros).
 *  5. Los endpoints del ledger que ya existian siguen respondiendo — api.js es
 *     compartido y este archivador no puede romperlos.
 *  6. Toda promesa verificable que hace la API se puede ejercer hasta el final.
 *
 * Uso:
 *   node scripts/check-quantum-catalog.mjs                    # contra produccion
 *   node scripts/check-quantum-catalog.mjs --base http://…    # contra otro origen
 *   node scripts/check-quantum-catalog.mjs --self-test        # se obliga a gritar
 */

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "https://rosettaquantum.com";
const SELF = args.includes("--self-test");

let pasaron = 0, fallaron = 0;
const fallos = [];
function ok(nombre) { pasaron++; console.log(`  ok   ${nombre}`); }
function mal(nombre, detalle) {
  fallaron++; fallos.push(`${nombre}: ${detalle}`);
  console.log(`  FALLA ${nombre}\n         ${detalle}`);
}
function comprobar(nombre, cond, detalle) { cond ? ok(nombre) : mal(nombre, detalle); }

// Vocabulario que el producto tiene prohibido. No es estilo: es la diferencia entre
// catalogar y prometer. Se busca como palabra, no como subcadena, para no marcar
// "certificado" dentro de "certificado de transparencia" y demas falsos positivos.
const PROHIBIDO = [
  /\bspeedup garantizado\b/i,
  /\bventaja garantizada\b/i,
  /\bgarantiza\w*\s+(?:ventaja|speedup|aceleraci)/i,
  /\bcertificad\w+\s+por\s+Rosetta\b/i,
  /\bRosetta\s+certifica\b/i,
];

// -------------------------------------------------- los validadores, aislados

/** Toda fila del catalogo tiene que citar de donde salio. */
export function validarCitas(items) {
  const sin = items.filter(a => !a.fuente_url || !a.declarado_por);
  return sin.length ? `${sin.length} de ${items.length} filas sin cita: ${sin.slice(0, 3).map(a => a.id).join(", ")}` : null;
}

/** `medido:true` exige recetas de verdad. Afirmar evidencia vacia es el peor fallo posible. */
export function validarEvidencia(items) {
  const mentirosas = items.filter(a =>
    a.evidencia_rosetta && a.evidencia_rosetta.medido === true &&
    !(Array.isArray(a.evidencia_rosetta.recetas) && a.evidencia_rosetta.recetas.length));
  return mentirosas.length ? `${mentirosas.length} fila(s) declaran medicion sin receta: ${mentirosas.map(a => a.id).join(", ")}` : null;
}

/** El vocabulario prohibido no entra ni por una descripcion. */
export function validarVocabulario(texto) {
  const hits = PROHIBIDO.filter(re => re.test(texto)).map(re => String(re));
  return hits.length ? `vocabulario prohibido: ${hits.join(" · ")}` : null;
}

/** El catalogo no puede encoger sin que alguien lo decida. */
export function validarDenominador(devueltos, totalDeclarado, minimo) {
  if (totalDeclarado < minimo) return `el catalogo declara ${totalDeclarado}, el minimo acordado es ${minimo}`;
  if (devueltos > totalDeclarado) return `devuelve ${devueltos} pero declara un total de ${totalDeclarado}`;
  return null;
}

// ------------------------------------------------------------- modo self-test

if (SELF) {
  console.log("SELF-TEST — cada validador tiene que gritar contra un defecto real:\n");
  comprobar("validarCitas grita si falta la cita",
    validarCitas([{ id: "x", declarado_por: null, fuente_url: null }]) !== null,
    "no grito con una fila sin fuente_url");
  comprobar("validarCitas calla con datos buenos",
    validarCitas([{ id: "x", declarado_por: "Zoo", fuente_url: "https://a" }]) === null,
    "grito con datos correctos (falso positivo)");
  comprobar("validarEvidencia grita si se declara medicion vacia",
    validarEvidencia([{ id: "x", evidencia_rosetta: { medido: true, recetas: [] } }]) !== null,
    "no grito con medido=true y cero recetas");
  comprobar("validarEvidencia calla con 'no medido'",
    validarEvidencia([{ id: "x", evidencia_rosetta: { medido: false } }]) === null,
    "grito con un 'no medido' honesto (falso positivo)");
  comprobar("validarVocabulario grita con 'speedup garantizado'",
    validarVocabulario("ofrecemos speedup garantizado") !== null, "no grito");
  comprobar("validarVocabulario calla con texto honesto",
    validarVocabulario("speedup declarado por la fuente; Rosetta no lo midio") === null,
    "grito con texto honesto (falso positivo)");
  comprobar("validarDenominador grita si el catalogo encogio",
    validarDenominador(3, 3, 55) !== null, "no grito con un catalogo de 3 contra el minimo");
  comprobar("validarDenominador calla con el catalogo entero",
    validarDenominador(74, 74, 70) === null, "grito con 74 de 74 (falso positivo)");

  console.log(`\nself-test: ${pasaron} pasaron, ${fallaron} fallaron`);
  process.exit(fallaron ? 1 : 0);
}

// ------------------------------------------------------------ chequeo en vivo

console.log(`Chequeando el archivador contra ${BASE}\n`);

async function traer(ruta) {
  // OJO trampa conocida de este proyecto: las rutas exactas del Worker no aceptan
  // query string arbitrario. Se piden tal cual, sin cache-buster.
  //
  // Y redirect:"manual" a proposito. El Worker redirige a rosettaquantum.com todo
  // host que no reconoce; con el seguimiento automatico este chequeo apuntaba a un
  // origen de prueba y terminaba midiendo PRODUCCION sin avisar — verde por estar
  // mirando otra cosa, que es el fallo dominante de este proyecto. Ahora grita.
  const r = await fetch(BASE + ruta, { redirect: "manual", headers: { "User-Agent": "rosetta catalog check" } });
  if (r.status >= 300 && r.status < 400) {
    const destino = r.headers.get("location") || "(sin Location)";
    mal(`GET ${ruta} redirige fuera del origen probado`,
      `${BASE}${ruta} -> ${r.status} ${destino}. Se detiene: seguir el salto mediria otro sitio.`);
    process.exit(1);
  }
  const txt = await r.text();
  let js = null;
  try { js = JSON.parse(txt); } catch (e) {}
  return { status: r.status, js, txt };
}

// 1. el listado
const alg = await traer("/v1/algorithms");
comprobar("GET /v1/algorithms responde 200", alg.status === 200, `respondio ${alg.status}`);
if (alg.js) {
  const items = alg.js.items || [];
  comprobar("el listado trae denominador",
    typeof alg.js.total_catalogo === "number" && typeof alg.js.devueltos === "number",
    "faltan total_catalogo / devueltos");
  const d = validarDenominador(items.length, alg.js.total_catalogo || 0, 70);
  comprobar("el catalogo no encogio", d === null, d || "");
  const c = validarCitas(items);
  comprobar("toda fila cita su fuente", c === null, c || "");
  const e = validarEvidencia(items);
  comprobar("nadie declara medicion que no tiene", e === null, e || "");
  const v = validarVocabulario(alg.txt);
  comprobar("sin vocabulario prohibido", v === null, v || "");
  comprobar("el aviso catalogo-vs-ledger va en la respuesta",
    /no es una medicion de Rosetta|NO una medicion/i.test(alg.txt), "falta el aviso");
  comprobar("la procedencia declara el sha256 de la instantanea",
    !!(alg.js.procedencia && /^[0-9a-f]{64}$/.test(alg.js.procedencia.instantanea_sha256 || "")),
    "falta o es invalido procedencia.instantanea_sha256");

  // 6. la promesa se ejerce hasta el final: la fuente citada tiene que abrir.
  const fuenteUrl = alg.js.procedencia && alg.js.procedencia.fuente_url;
  if (fuenteUrl) {
    try {
      const rf = await fetch(fuenteUrl, { headers: { "User-Agent": "rosetta catalog check" } });
      comprobar("la fuente citada en procedencia abre de verdad", rf.ok, `${fuenteUrl} -> ${rf.status}`);
    } catch (err) { mal("la fuente citada en procedencia abre de verdad", String(err)); }
  }
}

// 2. filtro por categoria
const cat = await traer("/v1/algorithms?categoria=ONML");
comprobar("el filtro por categoria funciona",
  cat.status === 200 && cat.js && cat.js.items.length > 0 &&
  cat.js.items.every(a => a.categoria_id === "ONML"),
  `status ${cat.status}, ${cat.js ? cat.js.items.length : 0} items`);

// 3. la ficha
const uno = await traer("/v1/algorithms/quantum-approximate-optimization");
comprobar("la ficha de un algoritmo responde", uno.status === 200 && uno.js && uno.js.id,
  `status ${uno.status}`);
if (uno.js && uno.js.evidencia_rosetta) {
  comprobar("QAOA aparece con las recetas selladas que si tenemos",
    uno.js.evidencia_rosetta.medido === true && uno.js.evidencia_rosetta.recetas.length >= 1,
    "QAOA deberia cruzar con al menos una receta del ledger");
}
const inexistente = await traer("/v1/algorithms/no-existe-este-algoritmo");
comprobar("un id inexistente da 404", inexistente.status === 404, `dio ${inexistente.status}`);

// 4. categorias y fuentes
const cats = await traer("/v1/categories");
comprobar("GET /v1/categories responde con las 4 categorias",
  cats.status === 200 && cats.js && (cats.js.categorias || []).length >= 4,
  `status ${cats.status}`);

const src = await traer("/v1/sources");
comprobar("GET /v1/sources responde 200", src.status === 200, `respondio ${src.status}`);
if (src.js) {
  const items = src.js.items || [];
  comprobar("las fuentes traen denominador",
    typeof src.js.total_catalogo === "number", "falta total_catalogo");
  comprobar("toda fuente declara el codigo HTTP medido de su enlace",
    items.every(f => f.enlace && (typeof f.enlace.http_status === "number")),
    "hay fuentes sin http_status medido");
  const rotas = items.filter(f => f.enlace.http_status >= 400 && !f.enlace.nota);
  comprobar("ninguna fuente publica un enlace roto sin explicarlo",
    rotas.length === 0,
    `${rotas.length} rota(s): ${rotas.slice(0, 3).map(f => f.id + " -> " + f.enlace.http_status).join(", ")}`);
}

// 5. REGRESION: api.js es compartido; el ledger tiene que seguir intacto.
console.log("\n  -- regresion del ledger (api.js es compartido) --");
for (const ruta of ["/v1", "/v1/state", "/v1/runs", "/v1/verdicts", "/v1/prereg",
                    "/v1/predictions", "/v1/manifests", "/v1/recipes", "/v1/search?q=portfolio"]) {
  const r = await traer(ruta);
  comprobar(`GET ${ruta} sigue respondiendo 200`, r.status === 200, `respondio ${r.status}`);
}
const st = await traer("/v1/state");
comprobar("el titular honesto del ledger sigue en pie (0 victorias medidas)",
  !!(st.js && st.js.estado_medido && st.js.estado_medido.victorias_cuanticas_medidas === 0),
  "cambio victorias_cuanticas_medidas — si es real, hay que actualizar este chequeo a mano");

// 6. MCP: las tools nuevas tienen que estar anunciadas y funcionar.
const mcpRes = await fetch(BASE + "/mcp", {
  method: "POST", redirect: "manual", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
const mcpJs = await mcpRes.json().catch(() => null);
const nombres = mcpJs && mcpJs.result ? (mcpJs.result.tools || []).map(t => t.name) : [];
comprobar("MCP anuncia buscar_algoritmo_cuantico", nombres.includes("buscar_algoritmo_cuantico"),
  `tools: ${nombres.join(", ") || "(ninguna)"}`);
comprobar("MCP anuncia listar_fuentes_cuanticas", nombres.includes("listar_fuentes_cuanticas"),
  `tools: ${nombres.join(", ") || "(ninguna)"}`);
comprobar("MCP conserva las 4 tools del ledger",
  ["estado_del_archivo", "buscar_evidencia", "ver_archivo", "listar_por_tipo"].every(n => nombres.includes(n)),
  `tools: ${nombres.join(", ")}`);

const call = await fetch(BASE + "/mcp", {
  method: "POST", redirect: "manual", headers: { "content-type": "application/json" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "buscar_algoritmo_cuantico", arguments: { consulta: "portafolio" } } }),
});
const callJs = await call.json().catch(() => null);
comprobar("la tool MCP nueva devuelve resultados",
  !!(callJs && callJs.result && callJs.result.content && callJs.result.content[0]),
  JSON.stringify(callJs).slice(0, 200));

console.log(`\n${pasaron} pasaron, ${fallaron} fallaron`);
if (fallaron) { console.log("\nFALLOS:\n - " + fallos.join("\n - ")); process.exit(1); }
