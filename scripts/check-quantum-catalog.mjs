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

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CATALOGO } from "../api.js";
import { esperarRutas, esperarVersion } from "./lib/esperar.mjs";
import { pyDumps, parseConLiterales } from "./lib/sello.mjs";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
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

// UNA SOLA LISTA de superficies criticas. Antes habia dos —la de la espera y la
// de los chequeos— y ya divergieron tres veces: cada pagina nueva se agregaba a
// los chequeos y nadie se acordaba de la espera, asi que el CI caia en rojo con
// produccion correcta. Una lista que vive en dos lugares ya divergio (§5bis).
export const RUTAS_CRITICAS = [
  // Las paginas se listan a mano — son pocas y no salen de ningun catalogo.
  "/", "/es/",
  "/clases/", "/es/clases/",
  "/cleveland/", "/es/cleveland/",
  "/llms.txt", "/api-docs/",
  // Las rutas de API se DERIVAN del catalogo de api.js. Escribirlas aparte fue el
  // error que tumbo el CI cuatro veces: la lista existia, pero cada endpoint nuevo
  // habia que acordarse de agregarlo. Ahora agregar un endpoint lo mete solo en la
  // espera de propagacion y en los chequeos.
  ...CATALOGO.map(e => {
    let r = e.ruta;
    for (const m of e.ruta.matchAll(/\{(\w+)\}/g)) {
      const v = e.ejemplo && e.ejemplo[m[1]];
      if (!v) return null;              // sin ejemplo no se puede ejercer
      r = r.replace(m[0], encodeURIComponent(v));
    }
    return r === "/v1/search" ? "/v1/search?q=portfolio" : r;
  }).filter(Boolean),
];

const ESPERA_MAX = args.includes("--esperar") ? Number(args[args.indexOf("--esperar") + 1]) : 0;
await esperarVersion(BASE, process.env.GITHUB_SHA, ESPERA_MAX);
await esperarRutas(BASE, RUTAS_CRITICAS, ESPERA_MAX);

async function traer(ruta) {
  // OJO trampa conocida de este proyecto: las rutas exactas del Worker no aceptan
  // query string arbitrario. Se piden tal cual, sin cache-buster.
  //
  // Y redirect:"manual" a proposito. El Worker redirige a rosettaquantum.com todo
  // host que no reconoce; con el seguimiento automatico este chequeo apuntaba a un
  // origen de prueba y terminaba midiendo PRODUCCION sin avisar — verde por estar
  // mirando otra cosa, que es el fallo dominante de este proyecto. Ahora grita.
  const r = await fetch(BASE + ruta, { redirect: "manual", headers: { "User-Agent": "rosetta catalog check", "x-rq-check": "1" } });
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
      const rf = await fetch(fuenteUrl, { headers: { "User-Agent": "rosetta catalog check", "x-rq-check": "1" } });
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
// Un error cacheado sobrevive al arreglo. Ya paso: un 404 de antes del deploy se
// quedo cinco minutos en un colo y hacia parecer rota una ruta que ya funcionaba.
const cab404 = await fetch(BASE + "/v1/algorithms/no-existe-este-algoritmo", { redirect: "manual" });
comprobar("el 404 no se cachea",
  /no-store|max-age=0/.test(cab404.headers.get("cache-control") || ""),
  `Cache-Control: ${cab404.headers.get("cache-control")}`);
comprobar("el 404 ofrece por donde seguir",
  !!(inexistente.js && inexistente.js.prueba && inexistente.js.prueba.busqueda),
  "el 404 no trae alternativas");

// Los alias por sigla tienen que resolver TODOS. Un alias que apunta a un id que
// ya no existe devuelve 404 y nadie se entera: la lista de alias vive en el codigo
// y el catalogo en la base, o sea que son dos listas que pueden divergir.
const aliasDeclarados = (inexistente.js && inexistente.js.prueba && inexistente.js.prueba.alias_disponibles) || [];
comprobar("la API declara sus alias", aliasDeclarados.length > 0, "no declara alias_disponibles");
let aliasRotos = [];
for (const a of aliasDeclarados) {
  const r = await traer("/v1/algorithms/" + encodeURIComponent(a));
  if (r.status !== 200 || !r.js || !r.js.resuelto_por_alias) aliasRotos.push(`${a} -> ${r.status}`);
}
comprobar(`los ${aliasDeclarados.length} alias resuelven a una ficha real`,
  aliasRotos.length === 0, `rotos: ${aliasRotos.join(", ")}`);

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

// 4 bis. La pagina: tiene que salir de D1, no del cascaron construido.
// El cascaron responde 200 igual aunque la base no conteste, asi que mirar el
// codigo HTTP no prueba nada: lo que lo prueba es la cabecera que el Worker
// escribe con el numero de filas que efectivamente inyecto.
console.log("\n  -- la pagina /clases/ sale de D1 --");
for (const [ruta, idioma] of [["/clases/", "en"], ["/es/clases/", "es"]]) {
  const r = await fetch(BASE + ruta, { redirect: "manual", headers: { "User-Agent": "rosetta catalog check", "x-rq-check": "1" } });
  const cab = r.headers.get("x-rq-archivador") || "(sin cabecera)";
  const html = await r.text();
  comprobar(`GET ${ruta} responde 200`, r.status === 200, `respondio ${r.status}`);
  comprobar(`${ruta} declara haber inyectado filas desde D1`,
    /^d1:(\d+)$/.test(cab) && Number(cab.split(":")[1]) >= 70,
    `X-RQ-Archivador: ${cab}`);
  const pintados = (html.match(/class="qitem"/g) || []).length;
  const declarados = Number((cab.match(/^d1:(\d+)$/) || [])[1] || 0);
  // Dos totales que deben coincidir: lo que la cabecera dice haber inyectado y
  // lo que realmente quedo en el HTML.
  comprobar(`${ruta} pinta tantas fichas como declara`, pintados === declarados,
    `cabecera dice ${declarados}, en el HTML hay ${pintados}`);
  comprobar(`${ruta} no deja el aviso de "no respondio" visible`,
    !/<p id="algoempty" class="qempty">/.test(html),
    "el parrafo de respaldo quedo visible con la lista llena");
  const v = validarVocabulario(html);
  comprobar(`${ruta} sin vocabulario prohibido`, v === null, v || "");
  comprobar(`${ruta} dice que el speedup lo declara la fuente`,
    /declarado por|declared by/i.test(html), "falta la atribucion del speedup");
}

// 4 ter. El numero publicado tiene que ser el medido.
// El "450+" vivio meses en produccion porque nadie lo comparo contra la fuente que
// citaba. Que no vuelva depende de codigo, no de que alguien se acuerde: si el
// catalogo crece y el texto no, esto grita.
console.log("\n  -- el numero publicado calza con el catalogo --");
const totalReal = (alg.js && alg.js.total_catalogo) || 0;
for (const ruta of ["/", "/es/", "/clases/", "/es/clases/"]) {
  const r = await fetch(BASE + ruta, { redirect: "manual", headers: { "User-Agent": "rosetta catalog check", "x-rq-check": "1" } });
  const html = await r.text();
  comprobar(`${ruta} no menciona el 450+ retirado`, !html.includes("450+"),
    "quedo una mencion del numero viejo");
  comprobar(`${ruta} publica el total real del catalogo (${totalReal})`,
    html.includes(String(totalReal)),
    `no aparece ${totalReal} en la pagina`);
}

// 4 quater. La corrida de Cleveland: la viz, la API y el numero del home.
console.log("\n  -- la corrida de Cleveland --");
const chal = await traer("/v1/challenges/cleveland-2026-07");
comprobar("GET /v1/challenges/{id} responde 200", chal.status === 200, `respondio ${chal.status}`);
let deltaKras = null;
if (chal.js) {
  const P = chal.js.proteinas || {};
  comprobar("la corrida trae las 4 proteínas", Object.keys(P).length === 4,
    `trae ${Object.keys(P).length}`);
  comprobar("declara que NO está validada experimentalmente",
    chal.js.validado_experimentalmente === false, "no declara el estado de validación");
  comprobar("el aviso de 'predicho, no validado' viaja en la respuesta",
    /no estan validados|no están validados/i.test(chal.txt), "falta el aviso");
  // El "Top-5" que declaraba 5 y traia 2: ahora el numero sale del dato.
  comprobar("KRAS G12C publica sus 2 sitios reales, no un top-5 fijo",
    P.KRAS_G12C && P.KRAS_G12C.sitios_predichos === 2,
    `sitios_predichos = ${P.KRAS_G12C && P.KRAS_G12C.sitios_predichos}`);
  comprobar("c-Myc declara que no hay con qué comparar",
    P.c_MYC && P.c_MYC.sitios_conocidos === 0 && P.c_MYC.hay_con_que_comparar === false,
    `sitios_conocidos = ${P.c_MYC && P.c_MYC.sitios_conocidos}`);
  comprobar("cada proteína trae su sha256",
    Object.values(P).every(p => /^[0-9a-f]{64}$/.test(p.sha256 || "")), "falta algún sello");
  // La cara EN mostraba "Miosina cardiaca" en el selector. Un rotulo en el idioma
  // equivocado no rompe nada — la pagina carga igual — y por eso vivio hasta que
  // alguien lo leyo. Las dos caras o ninguna.
  comprobar("cada proteína trae su rótulo en los dos idiomas",
    Object.values(P).every(p => p.label && p.label_en),
    `sin rótulo EN: ${Object.entries(P).filter(([, p]) => !p.label_en).map(([k]) => k).join(", ")}`);
  deltaKras = P.KRAS_G12C && P.KRAS_G12C.estadistica && P.KRAS_G12C.estadistica.pair
    ? P.KRAS_G12C.estadistica.pair.delta : null;
}

for (const [ruta, frag] of [["/cleveland/", "Notarised"], ["/es/cleveland/", "notarizada"]]) {
  const r = await traer(ruta);
  comprobar(`GET ${ruta} responde 200`, r.status === 200, `respondio ${r.status}`);
  comprobar(`${ruta} dice notarizado en el pie`, r.txt.includes(frag), "falta la palabra");
  comprobar(`${ruta} no declara un Top-5 fijo`,
    !/Top-5 sitios predichos|Top-5 predicted sites/.test(r.txt), "quedó el top-5 fijo");
  comprobar(`${ruta} aclara que el sitio conocido no entra al cálculo`,
    /nunca entra al cálculo|never enters the computation/.test(r.txt), "falta la aclaración");
  comprobar(`${ruta} no hornea los datos en el HTML`, r.txt.length < 60000,
    `pesa ${r.txt.length} caracteres: parece traer los datos horneados`);
}

// La cara EN no puede mostrar rótulos en español. Se busca el caso concreto que
// vivió publicado, no una regla vaga sobre "texto en el idioma correcto".
const chalEn = await traer("/v1/challenges/cleveland-2026-07");
if (chalEn.js) {
  const enES = Object.values(chalEn.js.proteinas || {})
    .filter(p => /Miosina|cardiaca|proteína/i.test(p.label_en || ""))
    .map(p => p.label_en);
  comprobar("los rótulos EN no quedaron en español", enES.length === 0, `en español: ${enES.join(", ")}`);
}

// El numero de la corrida y su fuente.
//
// Este guardia comparaba el texto del home contra D1 —la leccion del "450+"—, pero el
// bloque del home salio por orden de Nicholas. Mudarlo a /cleveland/ tal cual no
// funciona y vale la pena decir por que: esa pagina NO trae el numero en el HTML, lo
// pide por API al cargar. O sea que ahi no hay texto publicado que pueda divergir de
// su fuente: sale de D1 por construccion, que es mas fuerte que compararlo.
//
// Lo que si puede fallar es que alguien lo escriba a mano en la pagina "para que
// cargue mas rapido" y quede congelado. Eso es lo que se vigila ahora, mas que la API
// que la alimenta siga entregandolo.
if (deltaKras !== null) {
  const esperado = String(Math.abs(deltaKras));
  // Un `comprobar(..., true)` no es un chequeo: pasa siempre y solo hace ruido. El
  // numero tiene que ser un negativo real, que es lo que la corrida midio.
  comprobar(`la API entrega el delta de la corrida y es negativo (−${esperado})`,
    Number.isFinite(deltaKras) && deltaKras < 0, `la API dio ${deltaKras}`);
  for (const ruta of ["/cleveland/", "/es/cleveland/"]) {
    const r = await traer(ruta);
    const congelado = r.txt.includes(esperado) || r.txt.includes(esperado.replace(".", ","));
    comprobar(`${ruta} no trae el numero escrito a mano: lo pide a la API`,
      !congelado, "el numero esta en el HTML y puede quedar congelado si D1 cambia");
    comprobar(`${ruta} pide los datos de la corrida a la API`,
      /v1\/challenges/.test(r.txt), "la pagina no pide el endpoint que la alimenta");
  }
} else {
  mal("la API entrega el número de la corrida", "no se pudo leer el delta de KRAS desde la API");
}

// 4 quinquies. El lado de lectura del motor.
console.log("\n  -- el motor: estructuras y propagaciones --");
const est = await traer("/v1/structures/4OBE");
comprobar("GET /v1/structures/{pdb} responde 200", est.status === 200, `respondio ${est.status}`);
if (est.js) {
  comprobar("la estructura declara el sha256 y la URL del PDB de origen",
    /^sha256:[0-9a-f]{64}$/.test((est.js.procedencia || {}).estructura_sha256 || "") &&
    /^https?:\/\//.test((est.js.procedencia || {}).estructura_url || ""),
    `procedencia = ${JSON.stringify(est.js.procedencia)}`);
  comprobar("la estructura aclara que se derivo solo de topología",
    /solo de topologia|SOLO de topologia/i.test(est.js.aviso || ""), "falta el aviso");
}

const prop = await traer("/v1/propagate/cleveland-2026-08-ciego");
comprobar("GET /v1/propagate/{run_id} responde 200", prop.status === 200, `respondio ${prop.status}`);

// El descuadre entre lo declarado y lo real es EL defecto de la corrida de julio
// ("Top-5" con dos sitios). Se comprueba blanco por blanco, no de muestra.
const esperados = { KRAS_4OBE: 5, ABL1_1OPL: 4, MYOSIN_5TBY: 3, MYC_1NKP: 1 };
let matrizEjercida = false;
for (const [target, n] of Object.entries(esperados)) {
  const r = await traer(`/v1/propagate/cleveland-2026-08-ciego/${target}`);
  comprobar(`GET /v1/propagate/…/${target} responde 200`, r.status === 200, `respondio ${r.status}`);
  if (!r.js) continue;
  comprobar(`${target} declara que NO esta validado experimentalmente`,
    r.js.validado_experimentalmente === false, "no lo declara");
  comprobar(`${target} declara ${n} sitios y trae ${n}`,
    r.js.n_sitios_predichos === n && (r.js.sitios_predichos || []).length === n,
    `declara ${r.js.n_sitios_predichos}, trae ${(r.js.sitios_predichos || []).length}, se esperaban ${n}`);
  const m = r.js.matriz_conectividad || {};
  comprobar(`${target} sirve la matriz por referencia con firma y tamaño`,
    !!m.url && /^sha256:[0-9a-f]{64}$/.test(m.contenido_sha256 || "") && m.bytes > 0,
    `matriz = ${JSON.stringify(m).slice(0, 160)}`);
  comprobar(`${target} aclara que el hash es del contenido, no del .npz`,
    /contenido/i.test(m.como_verificar || "") || /orden de clave/i.test(m.como_verificar || ""),
    `como_verificar = ${m.como_verificar}`);

  // LA PROMESA SE EJERCE. Una URL declarada que responde 404 —o que pesa otra cosa—
  // convierte "baja el archivo y comprueba la firma" en decoracion. Se ejerce una
  // por corrida para no bajar 3,9 MB en cada chequeo, y se dice cual.
  if (!matrizEjercida && m.url) {
    matrizEjercida = true;
    try {
      const rm = await fetch(m.url, { redirect: "follow" });
      const buf = await rm.arrayBuffer();
      comprobar(`la matriz de ${target} se puede bajar de verdad`, rm.status === 200,
        `${m.url} -> ${rm.status}`);
      comprobar(`la matriz de ${target} pesa los ${m.bytes} bytes declarados`,
        buf.byteLength === m.bytes, `declara ${m.bytes}, bajo ${buf.byteLength}`);
    } catch (e) { mal(`la matriz de ${target} se puede bajar de verdad`, String(e)); }
  }
}

// 4 quater bis. El hero no le cuelga una victoria a una receta real.
//
// El recuadro ilustrativo mostraba `qlib.solve() · RQ-0012 -> 22 min ✓` contra 14h20m,
// y RQ-0012 es una receta REAL cuyo veredicto sellado (V-0012) dice `not yet`, con el
// contador global en 0 victorias. La palabra "Ilustrativo" no salvaba eso: el
// identificador era verdadero, asi que la afirmacion era falsable — y la dejabamos
// lista para que la falsen, con la API que publicamos para eso.
console.log("\n  -- el hero no afirma una victoria que el ledger desmiente --");
for (const ruta of ["/", "/es/"]) {
  const r = await traer(ruta);
  comprobar(`${ruta} no marca una victoria con ✓ en el recuadro`,
    !/22 min ✓|22 min &#10004;/.test(r.txt), "volvio el ticket de victoria");
  // El recuadro entero se elimino (decision de Nicholas). Se vigilan sus PIEZAS y
  // no su clase: quien lo reponga le va a cambiar el nombre antes que la
  // afirmacion. Los dos guardias de abajo quedaron obsoletos al sacarlo — se
  // dejan porque cubren la forma suavizada, que es como volveria.
  comprobar(`${ruta} no tiene el recuadro de la victoria ilustrativa`,
    !/clockchart|cc-fill|14h ?20m|Ilustrativo · la forma|Illustrative · the shape/.test(r.txt),
    "volvio el recuadro que vende una victoria que /v1/state desmiente");
  // El bloque de entrada a la corrida de Cleveland tambien salio del home (orden de
  // Nicholas). Se vigilan sus piezas, incluida la palabra "Cleveland": la primera
  // limpieza dejo el COMENTARIO del CSS explicandolo, y index.css se inlinea, o sea
  // que el comentario seguia publicado. Es la segunda vez que pasa lo mismo, asi que
  // esta vez lo cubre el guardia y no mi memoria. La pagina /cleveland/ no se toca:
  // ahi ese contenido es el producto.
  comprobar(`${ruta} no trae el bloque de la corrida de Cleveland`,
    !/clev-|data-clev|18[,.]01|Cleveland/.test(r.txt),
    "volvio el bloque del home, o un estilo o comentario que lo cita");
  comprobar(`${ruta} no dibuja la barra de 96% contra 4%`,
    !/data-w="96%"|data-w="4%"/.test(r.txt), "volvieron las barras de la victoria");
  comprobar(`${ruta} no le cuelga un id de receta real al recuadro`,
    !/qlib\.solve\(\)[^<]*RQ-\d{4}/.test(r.txt),
    "el recuadro volvio a citar una receta real");
}

// 4 quater bis. La pagina de precios no puede contradecir a nuestra propia API.
//
// Es la pagina que Paddle revisa y la unica del sitio donde alguien va a poner
// plata, asi que las cifras se comparan contra la fuente, no contra el recuerdo.
// El "0 victorias" es el caso del "450+" otra vez: un numero que envejece solo.
// 4 quater quinquies. La consola: ninguna cifra pegada.
//
// Es la pantalla con la que Nicholas vende en videollamada, y el archivo del que salio
// traia numeros inventados —"4 selladas", "15 de 15 rutas responden", "6 propagadores"—
// que nuestra propia API desmiente. El chequeo vigila lo unico que importa aca: que el
// HTML servido NO traiga datos, solo contenedores, y que sus fuentes respondan.
// La prosa de /v1/state tiene que afirmar sobre el MISMO conjunto que su numero.
//
// Decia "en ninguna corrida sellada... le gano al campeon clasico" mientras cuatro
// corridas selladas dicen "quantum win" en su propio campo. El numero contaba
// veredictos; la frase hablaba de corridas. Nadie lo vio porque el numero estaba bien.
console.log("\n  -- la lectura del contador dice sobre que conjunto habla --");
{
  const st = await traer("/v1/state");
  const runs = await traer("/v1/runs?limit=1000");
  const lectura = (st.js && st.js.estado_medido && st.js.estado_medido.lectura) || "";
  const marcadas = ((runs.js && runs.js.items) || [])
    .filter(c => (c.resultado || "").trim().toLowerCase() === "quantum win").length;

  comprobar("la lectura del cero habla de VEREDICTOS, no de corridas",
    /veredicto/i.test(lectura) && !/ninguna corrida sellada/i.test(lectura),
    `dice: "${lectura.slice(0, 90)}…"`);

  // Y el caso positivo que le da sentido: si algun dia no hubiera corridas marcadas, la
  // distincion daria igual. Mientras las haya, la frase NO puede hablar de corridas.
  comprobar(`hay ${marcadas} corrida(s) marcada(s) «quantum win», que es lo que hacia falsa la frase vieja`,
    marcadas > 0,
    "ya no hay corridas marcadas: revisa si la distincion sigue haciendo falta");
}

console.log("\n  -- la consola --");
{
  const c = await traer("/consola/");
  comprobar("/consola/ responde", c.status === 200, `dio ${c.status}`);
  if (c.status === 200) {
    // El cuerpo de la pagina no puede traer las cifras: llegan por fetch. Si alguna
    // aparece en el HTML servido, es que alguien la pego.
    const inventadas = ["4 selladas", "15 de 15", "6 propagadores", "3 métricas", "0 en cola"];
    const pegadas = inventadas.filter(x => c.txt.includes(x));
    comprobar("la consola no sirve las cifras inventadas del archivo base",
      pegadas.length === 0, `quedaron pegadas: ${pegadas.join(" | ")}`);
    // Y tampoco las de verdad: si el numero real esta en el HTML, quedo congelado.
    const st = await (await fetch(BASE + "/v1/state", { headers: { "x-rq-check": "1" } })).json();
    const selladas = String(st.estado_medido.corridas_selladas);
    const cuerpo = (c.txt.match(/<main>([\s\S]*?)<\/main>/) || [])[1] || "";
    comprobar(`la consola no trae el contador (${selladas}) escrito en el HTML`,
      !new RegExp(`>\\s*${selladas}\\s*<`).test(cuerpo),
      "el numero esta en el HTML servido: quedaria congelado cuando D1 cambie");
    comprobar("la consola declara de que endpoints sale lo que muestra",
      /\/v1\/state/.test(c.txt) && /\/v1\/runs/.test(c.txt) && /v1\/archive/.test(c.txt),
      "la pagina no dice de donde salen sus datos");
  }
  for (const r of ["/consola/consola.js", "/consola/consola.css", "/consola/costos.json"]) {
    const x = await traer(r);
    comprobar(`${r} responde`, x.status === 200, `dio ${x.status}`);
  }
  // Los precios de la consola tienen que ser los de costos.py, no una copia a mano.
  const pj = await traer("/consola/costos.json");
  if (pj.js) {
    comprobar("los precios declaran el archivo del que salen",
      !!(pj.js._origen && pj.js._origen.sha256), "el json no declara su origen");
    comprobar("la validez medida existe para UN dispositivo y no se inventa para el resto",
      Object.keys(pj.js.validez_medida || {}).length === 1,
      `hay ${Object.keys(pj.js.validez_medida || {}).length} validez(es) declarada(s)`);
  }
  // El endpoint que alimenta la tabla tiene que entregar TODAS las corridas.
  const runs = await traer("/v1/runs?limit=1000");
  const st2 = await (await fetch(BASE + "/v1/state", { headers: { "x-rq-check": "1" } })).json();
  comprobar(`/v1/runs entrega las ${st2.estado_medido.corridas_selladas} corridas que declara /v1/state`,
    runs.js && runs.js.items && runs.js.items.length === st2.estado_medido.corridas_selladas,
    `entrego ${runs.js && runs.js.items ? runs.js.items.length : "?"} y /v1/state declara ${st2.estado_medido.corridas_selladas}`);
}

// 4 quater quater. Las tres politicas legales, en los dos idiomas.
//
// Paddle no verifica el sitio si estas URLs no existen Y no estan enlazadas desde el.
// O sea que un footer sin ellas no es un detalle de maquetado: apaga el cobro. Por eso
// se vigilan las dos cosas — que respondan y que el footer las lleve.
console.log("\n  -- las tres politicas legales --");
{
  const LEGAL = [
    { ruta: "/terms/",         alt: "/es/terminos/",   marca: /Terms of Service/i },
    { ruta: "/privacy/",       alt: "/es/privacidad/", marca: /Privacy Policy/i },
    { ruta: "/refunds/",       alt: "/es/reembolsos/", marca: /Refund Policy/i },
    { ruta: "/es/terminos/",   alt: "/terms/",         marca: /Términos de servicio/i },
    { ruta: "/es/privacidad/", alt: "/privacy/",       marca: /Política de privacidad/i },
    { ruta: "/es/reembolsos/", alt: "/refunds/",       marca: /Política de reembolsos/i },
  ];
  for (const P of LEGAL) {
    const r = await traer(P.ruta);
    comprobar(`${P.ruta} responde`, r.status === 200, `dio ${r.status}`);
    if (r.status !== 200) continue;
    comprobar(`${P.ruta} trae su titulo`, P.marca.test(r.txt), "no encontre el titulo de la politica");
    comprobar(`${P.ruta} enlaza su cara alterna`, r.txt.includes(P.alt), `no encontre ${P.alt}`);
    // El texto va TAL CUAL: un marcador de relleno servido en la pagina que Paddle
    // revisa es peor que la ausencia deliberada de la direccion legal.
    comprobar(`${P.ruta} no sirve marcadores sin completar`,
      !/COMPLETA NICHOLAS|\bTBD\b|\[pendiente\]/.test(r.txt), "quedo un marcador en lo servido");
    comprobar(`${P.ruta} declara el sello de su texto aprobado`,
      /sha256:[0-9a-f]{16}…/.test(r.txt), "no publica el sello del documento del que sale");
  }
  // Y el footer, que es lo que Paddle mira para dar por enlazadas las politicas.
  for (const [home, esperadas] of [["/", ["/terms/", "/privacy/", "/refunds/"]],
                                   ["/es/", ["/es/terminos/", "/es/privacidad/", "/es/reembolsos/"]]]) {
    const r = await traer(home);
    const faltan = esperadas.filter(u => !r.txt.includes(`href="${u}"`));
    comprobar(`el footer de ${home} enlaza las tres politicas`,
      faltan.length === 0, `faltan en el footer: ${faltan.join(", ")}`);
  }
}

console.log("\n  -- precios: las dos caras, contra la API y contra el mundo --");
{
  const st = await (await fetch(BASE + "/v1/state", { headers: { "x-rq-check": "1" } })).json();
  const medido = st.estado_medido.victorias_cuanticas_medidas;
  const F = JSON.parse(readFileSync(join(RAIZ, "src/aprobado/fuentes-terceros.json"), "utf8"));

  const CARAS = [
    { ruta: "/es/precios/", idioma: "es",
      contador: /<strong>(\d+) victorias cuánticas medidas<\/strong>/,
      negativo: /te la cobramos/, computo: /mil análisis por dólar/,
      prohibido: /auditor[ií]a/i, prohibidoQue: "«auditoría»" },
    { ruta: "/pricing/", idioma: "en",
      contador: /<strong>(\d+) measured quantum wins<\/strong>/,
      negativo: /we charge you for it just the same/, computo: /thousand analyses per dollar/,
      // En ingles la palabra prohibida es "audit": el equivalente de la regla, no su
      // traduccion literal. Un guardia que solo mira el castellano deja la mitad sin
      // vigilar, y la mitad sin vigilar es justo la que Paddle lee.
      prohibido: /\baudit(s|ing|ed)?\b/i, prohibidoQue: "«audit»" },
  ];

  for (const c of CARAS) {
    // Con barra final a proposito: TODA pagina del sitio hace 307 a la forma con
    // barra, y `traer` no sigue saltos por diseno (seguir un 301 fue como un chequeo
    // termino midiendo produccion mientras apuntaba a otro lado).
    const r = await traer(c.ruta);
    comprobar(`${c.ruta} responde`, r.status === 200, `dio ${r.status}`);
    if (r.status !== 200) continue;

    const enPagina = (r.txt.match(c.contador) || [])[1];
    comprobar(`${c.ruta} declara el contador de victorias`, enPagina !== undefined,
      "ya no aparece la cifra en la pagina");
    comprobar(`${c.ruta}: el contador (${enPagina}) es el que mide /v1/state (${medido})`,
      Number(enPagina) === medido, "la pagina y la API dicen numeros distintos");

    comprobar(`${c.ruta} no usa ${c.prohibidoQue}`, !c.prohibido.test(r.txt),
      `volvio a aparecer ${c.prohibidoQue}`);
    comprobar(`${c.ruta}: el cobro del resultado negativo va visible`,
      c.negativo.test(r.txt), "desaparecio la frase del negativo que se cobra");
    comprobar(`${c.ruta}: la cifra del computo esta publicada, ya instrumentada`,
      c.computo.test(r.txt), "desaparecio la frase del costo del computo");

    // Acotado al CUERPO: la primera version miraba el HTML entero y marcaba el boton
    // del menu y el de cerrar el modal como "camino de compra". Un falso positivo
    // retiene trabajo bueno y ensena a ignorar el chequeo.
    const cuerpo = (r.txt.match(/<article class="article wrap precios">([\s\S]*?)<\/article>/) || [])[1] || "";
    comprobar(`${c.ruta}: el chequeo mira el cuerpo`, cuerpo.length > 500,
      `no aisle el cuerpo (${cuerpo.length} caracteres)`);
    comprobar(`${c.ruta} no tiene autoservicio ni camino de compra`,
      !/<button|<form|checkout|carrito|pagar ahora|comprar|add to cart|buy\.paddle/i.test(cuerpo),
      "aparecio un camino de compra en el cuerpo");
    comprobar(`${c.ruta}: el unico llamado a la accion es el correo, cliqueable`,
      /mailto:hello@rosettaquantum\.com/.test(cuerpo), "el correo no es enlazable");
    // hello@, no hi@: la regla de reenvio existe para hello@ y el catch-all esta en
    // Drop, asi que un correo a hi@ se pierde sin rebote.
    comprobar(`${c.ruta}: el contacto es hello@, la casilla que de verdad reenvia`,
      !/\bhi@rosettaquantum\.com/.test(r.txt), "el correo de contacto no es el que recibe");
    comprobar(`${c.ruta} declara el comerciante registrado (lo exige Paddle)`,
      /Paddle\.com/.test(r.txt) && /Blue Tuna SpA/.test(r.txt), "falta la entidad legal o Paddle");

    // Nicholas aprobo nombrar a los cinco (2026-08-10): el guardia EXIGE que esten.
    const faltan = F.los_cinco.map(x => x.nombre_en_la_pagina).filter(n => !r.txt.includes(n));
    comprobar(`${c.ruta} nombra a los cinco, como se aprobo`,
      faltan.length === 0, `no aparecen: ${faltan.join(", ")}`);

    // Los rotulos internos del documento ("Encabezado"/"Tabla") salieron impresos como
    // titulos de la pagina. Nadie los leyo hasta que la mire a ojo, que es tarde para
    // la pagina que Paddle revisa.
    const titulos = [...r.txt.matchAll(/<h2>([^<]*)<\/h2>/g)].map(m => m[1].trim());
    const andamiaje = titulos.filter(t => ["Encabezado", "Tabla", "Header", "Table"].includes(t));
    comprobar(`${c.ruta} no imprime los rotulos internos del documento`,
      andamiaje.length === 0, `salieron como titulos: ${andamiaje.join(", ")}`);
    comprobar(`${c.ruta} conserva sus titulos de verdad`, titulos.length >= 4,
      `solo quedaron ${titulos.length} titulos: puede que el filtro se este comiendo alguno`);

    // Las dos caras se enlazan entre si: una pagina de precios que no ofrece su
    // propio idioma alterno es media pagina, y es la URL que Paddle revisa.
    const otra = c.idioma === "es" ? "/pricing" : "/es/precios";
    comprobar(`${c.ruta} enlaza su cara alterna`, r.txt.includes(otra),
      `no encontre el enlace a ${otra}`);
  }

  // Y la afirmacion sobre terceros se ejerce contra el mundo, no solo contra nosotros:
  // la fuente guardada tiene que SEGUIR nombrandolos. Si el programa cambia, nos
  // enteramos por aca y no por un lector.
  const fuente = F.fuentes.find(x => x.es_la_que_sostiene_la_afirmacion);
  let htmlFuente = null, motivo = "";
  for (let intento = 0; intento < 3 && htmlFuente === null; intento++) {
    try {
      const resp = await fetch(fuente.url, { redirect: "follow" });
      if (resp.ok) htmlFuente = await resp.text(); else motivo = `respondio ${resp.status}`;
    } catch (e) { motivo = "no responde"; }
    if (htmlFuente === null && intento < 2) await new Promise(res => setTimeout(res, 3000));
  }
  // Pasar en verde por no haber podido mirar es el fallo silencioso: la afirmacion se
  // queda publicada sin nadie que la sostenga.
  comprobar("la fuente de la afirmacion sobre terceros responde",
    htmlFuente !== null, `${fuente.url} — ${motivo}`);
  if (htmlFuente !== null) {
    const perdidos = F.los_cinco.filter(x => !htmlFuente.includes(x.como_lo_nombra_la_fuente));
    comprobar("la fuente SIGUE nombrando a los cinco", perdidos.length === 0,
      `ya no aparecen en ${fuente.url}: ${perdidos.map(x => x.como_lo_nombra_la_fuente).join(", ")}`);
  }
}

// 4 quater ter. Toda URL que el home cita como fuente, se ejerce.
//
// El mockup del copiloto dice "todo aqui es verificable por maquina, chequeanos
// como quieras" y citaba dos fuentes: `/evidence/RQ-0012`, que daba 404, y
// `docs.rosettaquantum.com`, un dominio que ni siquiera resuelve. Es la peor
// ubicacion posible para un enlace roto: DENTRO de la frase que invita a
// comprobarnos. Cuarta aparicion de la misma familia esta semana, asi que deja
// de depender de que alguien las abra.
console.log("\n  -- las fuentes que el home cita responden --");
{
  const r = await traer("/es/");
  const citadas = [...r.txt.matchAll(/↳ sources:([^<]+)</g)]
    .flatMap(m => m[1].split("·").map(x => x.trim()).filter(Boolean));
  comprobar("el home declara sus fuentes", citadas.length > 0, "no encontre la linea de fuentes");
  for (const cita of citadas) {
    const url = cita.startsWith("http") ? cita : "https://" + cita;
    let estado = 0;
    try { estado = (await fetch(url, { redirect: "follow", headers: { "x-rq-check": "1" } })).status; }
    catch (e) { estado = 0; }
    comprobar(`la fuente citada ${cita} responde`, estado === 200,
      `${url} -> ${estado === 0 ? "no resuelve" : estado}`);
  }
}

// 4 quinquies bis. LA PROMESA CENTRAL, EJERCIDA COMO UN TERCERO.
//
// La API dice en cada respuesta "recomputa el sha256 y compara con content_hash".
// Eso no es un adorno: es la unica razon por la que este archivo vale algo. Aca se
// reimplementa la receta canonica EN OTRO LENGUAJE —no se llama a nuestro codigo—
// y se compara contra el sello publicado. Si la receta de /api-docs fuera incorrecta
// o el sello estuviera mal, esto grita.
//
// Se descubrio escribiendo el arranque de /api-docs: mi primera version hacia
// `curl … | shasum -a 256`, el hash ingenuo del archivo entero, y NO calza — el
// content_hash vive dentro del propio archivo, asi que hashearlo completo no puede
// reproducirlo jamas. La receta real excluye `storage` y el propio content_hash.
console.log("\n  -- la promesa central: recomputar un sello --");
{
  const ARCHIVO = "PR-CLEV-001";
  const a = await traer(`/v1/archive/${ARCHIVO}`);
  comprobar(`GET /v1/archive/${ARCHIVO} responde 200`, a.status === 200, `respondio ${a.status}`);
  if (a.js && a.js.github_raw) {
    try {
      const bruto = parseConLiterales(await (await fetch(a.js.github_raw)).text());
      // convencion canonica: meta SIN content_hash + todo menos meta y storage
      const meta = { ...bruto.meta }; delete meta.content_hash;
      const cuerpo = { ...bruto }; delete cuerpo.meta; delete cuerpo.storage;
      // json.dumps(sort_keys=True, ensure_ascii=False) — separadores por defecto de Python
      const canon = pyDumps({ meta, ...cuerpo });
      const buf = new TextEncoder().encode(canon);
      const dig = await crypto.subtle.digest("SHA-256", buf);
      const mio = "sha256:" + [...new Uint8Array(dig)].map(b => b.toString(16).padStart(2, "0")).join("");
      comprobar("el sello publicado se puede recomputar desde cero",
        mio === a.js.content_hash, `recompute ${mio}, la API declara ${a.js.content_hash}`);
    } catch (e) { mal("el sello publicado se puede recomputar desde cero", String(e)); }
  }
  // Y la pagina que explica como hacerlo tiene que traer la receta, no una vaguedad.
  // Las DOS caras: Nicholas aprobo traducirla, y una receta que solo esta bien en un
  // idioma falla para la mitad de los lectores — en la pagina cuyo argumento entero es
  // que todo se puede comprobar.
  const listaMcp = await (await fetch(BASE + "/mcp", {
    method: "POST", headers: { "content-type": "application/json", "x-rq-check": "1" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
  })).json();
  const nombresMcp = (listaMcp.result?.tools || []).map(t => t.name);
  comprobar("el servidor MCP lista sus herramientas", nombresMcp.length > 0, "tools/list vino vacio");

  for (const ruta of ["/api-docs/", "/es/api-docs/"]) {
    const docs = await traer(ruta);
    comprobar(`${ruta} responde`, docs.status === 200, `dio ${docs.status}`);
    if (docs.status !== 200) continue;
    comprobar(`${ruta} publica la receta exacta del sello`,
      /sort_keys/.test(docs.txt) && /storage/.test(docs.txt) && /content_hash/.test(docs.txt),
      "la pagina no trae sort_keys + la exclusion de storage");
    comprobar(`${ruta} trae un arranque que termina en MATCH`,
      /MATCH/.test(docs.txt) && /v1\/archive\//.test(docs.txt),
      "el arranque no llega a comparar un hash");
    // La pagina decia "nine tools" en un parrafo y "four tools" —con cuatro nombres—
    // tres parrafos mas abajo, con el servidor sirviendo 9. Ahora sale del codigo, y
    // esto lo compara contra lo que el servidor responde de verdad.
    const cuenta = (docs.txt.match(/(\d+) (?:read-only tools|herramientas)/) || [])[1];
    comprobar(`${ruta} dice cuantas herramientas MCP hay (${cuenta}) y son las que sirve (${nombresMcp.length})`,
      Number(cuenta) === nombresMcp.length, "la pagina y el servidor no coinciden");
    const sinNombrar = nombresMcp.filter(n => !docs.txt.includes(n));
    comprobar(`${ruta} nombra las ${nombresMcp.length} herramientas`,
      sinNombrar.length === 0, `no aparecen: ${sinNombrar.join(", ")}`);
    const otra = ruta === "/api-docs/" ? "/es/api-docs" : "/api-docs";
    comprobar(`${ruta} enlaza su cara alterna`, docs.txt.includes(`"${otra}"`),
      `no encontre el enlace a ${otra}`);
  }
}

// 4 sexies. El contador de uso: publico, sin datos personales, y sin contarnos.
console.log("\n  -- el contador de uso --");
const uso1 = await traer("/v1/usage");
comprobar("GET /v1/usage responde 200", uso1.status === 200, `respondio ${uso1.status}`);
if (uso1.js) {
  comprobar("declara desde cuando mide",
    typeof uso1.js.midiendo_desde === "string" || uso1.js.ventana,
    "no declara la ventana: un total sin denominador no es un resultado");
  comprobar("declara explicitamente lo que NO guarda",
    /Ninguna IP/i.test(uso1.js.lo_que_no_guardamos || ""), "falta la declaracion");
  comprobar("declara los limites de la medicion",
    Array.isArray(uso1.js.limites_de_esta_medicion) && uso1.js.limites_de_esta_medicion.length >= 2,
    "no declara sus limites");
  // Ninguna ruta puede quedar guardada con su parametro real: eso reconstruiria
  // que consulto alguien, que es justo lo que la tabla no debe permitir.
  const crudas = (uso1.js.por_ruta || []).filter(r =>
    /\/v1\/(algorithms|challenges|archive|structures|propagate)\/(?!\{)/.test(r.ruta));
  comprobar("ninguna ruta se guardo con su parametro real", crudas.length === 0,
    `rutas crudas: ${crudas.map(r => r.ruta).join(", ")}`);
}
// El contador no se cachea: uno vivo servido de cache miente mientras dure.
const cabUso = await fetch(BASE + "/v1/usage", { redirect: "manual", headers: { "x-rq-check": "1" } });
comprobar("el contador no se sirve de cache",
  /no-store|max-age=0/.test(cabUso.headers.get("cache-control") || ""),
  `Cache-Control: ${cabUso.headers.get("cache-control")}`);

// EL CASO POSITIVO QUE IMPORTA: nuestros chequeos no envenenan el numero.
//
// Se mide POR RUTA y sobre `/v1/sources`, no sobre el total global. El total dejo de
// servir el 2026-08-13, cuando la consola entro en vivo: cada vez que alguien la abre
// llama a /v1/state y /v1/runs, asi que el total sube por trafico real y el chequeo
// culpaba a nuestras dos llamadas marcadas. Un chequeo que falla por algo que no es lo
// que afirma entrena a ignorarlo — y este afirma que la MARCA funciona, no que nadie
// mas use la API.
//
// /v1/sources no la llama ni la consola ni el sitio: es la unica superficie donde el
// ruido ajeno no se confunde con nuestra firma.
if (uso1.js) {
  const cuenta = (u, ruta) => ((u.por_ruta || []).find(x => x.ruta === ruta) || {}).llamadas || 0;
  const antes = cuenta(uso1.js, "/v1/sources");
  await traer("/v1/sources");
  await traer("/v1/sources");
  await new Promise(r => setTimeout(r, 1500));
  const uso2 = await traer("/v1/usage");
  const despues = cuenta(uso2.js || {}, "/v1/sources");
  comprobar("las peticiones marcadas como chequeo NO se cuentan",
    despues === antes,
    `/v1/sources paso de ${antes} a ${despues} tras 2 llamadas marcadas`);
}

// Toda ruta critica responde 200. Es la misma lista que usa la espera, importada
// de un solo lugar: si alguien agrega una pagina y la olvida aca, no existe.
console.log("\n  -- las rutas criticas responden --");
for (const ruta of RUTAS_CRITICAS) {
  const r = await traer(ruta);
  comprobar(`GET ${ruta}`, r.status === 200, `respondio ${r.status}`);
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
  method: "POST", redirect: "manual", headers: { "content-type": "application/json", "x-rq-check": "1" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
});
const mcpJs = await mcpRes.json().catch(() => null);
const nombres = mcpJs && mcpJs.result ? (mcpJs.result.tools || []).map(t => t.name) : [];
comprobar("MCP anuncia buscar_algoritmo_cuantico", nombres.includes("buscar_algoritmo_cuantico"),
  `tools: ${nombres.join(", ") || "(ninguna)"}`);
comprobar("MCP anuncia listar_fuentes_cuanticas", nombres.includes("listar_fuentes_cuanticas"),
  `tools: ${nombres.join(", ") || "(ninguna)"}`);
comprobar("MCP anuncia ver_estructura", nombres.includes("ver_estructura"),
  `tools: ${nombres.join(", ")}`);
comprobar("MCP anuncia ver_propagacion", nombres.includes("ver_propagacion"),
  `tools: ${nombres.join(", ")}`);
comprobar("MCP conserva las 4 tools del ledger",
  ["estado_del_archivo", "buscar_evidencia", "ver_archivo", "listar_por_tipo"].every(n => nombres.includes(n)),
  `tools: ${nombres.join(", ")}`);

const call = await fetch(BASE + "/mcp", {
  method: "POST", redirect: "manual", headers: { "content-type": "application/json", "x-rq-check": "1" },
  body: JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/call",
    params: { name: "buscar_algoritmo_cuantico", arguments: { consulta: "portafolio" } } }),
});
const callJs = await call.json().catch(() => null);
comprobar("la tool MCP nueva devuelve resultados",
  !!(callJs && callJs.result && callJs.result.content && callJs.result.content[0]),
  JSON.stringify(callJs).slice(0, 200));

console.log(`\n${pasaron} pasaron, ${fallaron} fallaron`);
if (fallaron) { console.log("\nFALLOS:\n - " + fallos.join("\n - ")); process.exit(1); }
