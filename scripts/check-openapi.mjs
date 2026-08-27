#!/usr/bin/env node
/**
 * Chequeo de la especificacion OpenAPI. Falla cerrado.
 *
 * POR QUE EXISTE
 * --------------
 * "Mantengan la especificacion al dia" es una instruccion en prosa, y una
 * instruccion en prosa no es un control: el dia que alguien agregue un endpoint y
 * no lo documente, nadie se entera. Aca eso vive en codigo.
 *
 * QUE COMPARA — tres listas que tienen que coincidir:
 *   1. Las rutas `/v1/...` que el ENRUTADOR atiende de verdad (leidas del codigo).
 *   2. Las que declara `CATALOGO` en api.js.
 *   3. Las que la especificacion SERVIDA publica en produccion.
 * Si una ruta esta en el codigo y no en la especificacion —o al reves— es una lista
 * que vive en dos lugares, y ya divergieron tres veces en este proyecto.
 *
 * Y ademas ejerce la promesa: cada ruta declarada se pide EN VIVO. Una
 * especificacion que documenta un endpoint que responde 404 pide confianza en vez
 * de darla, que es exactamente lo que nos paso con /api-docs.
 *
 * OJO: por defecto apunta a PRODUCCION a proposito. Contra un dev local con la D1
 * a medio sembrar, las rutas del ledger fallan por falta de datos y no por un
 * defecto — no aflojes el chequeo por eso; corre el local para lo estructural y
 * este contra produccion para la promesa.
 *
 * Uso:
 *   node scripts/check-openapi.mjs [--base https://…] [--self-test]
 */

import { readFileSync } from "node:fs";
import { CATALOGO } from "../api.js";
import { esperarRutas, esperarVersion } from "./lib/esperar.mjs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const args = process.argv.slice(2);
const BASE = args.includes("--base") ? args[args.indexOf("--base") + 1] : "https://rosettaquantum.com";
const SELF = args.includes("--self-test");
const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");

let pasaron = 0, fallaron = 0, saltados = 0;

/**
 * El bloque del documento no se puede contar de antemano, y decirlo es el arreglo.
 *
 * TRES INTENTOS, y los tres son la misma leccion. Primero escribi `= 26`, sacado del `grep` de
 * subcadenas que este proyecto tiene documentado como «contar lineas con grep no es contar
 * cosas». Despues lo hice contarse solo desde la fuente y dio **5**, porque cuenta LLAMADAS y la
 * mayoria de las comprobaciones estan **dentro de un bucle por ruta**. El numero real de aquel
 * dia era 31 —produccion ejercio 37 y con el documento roto quedaron 6—, **pero manana es otro**:
 * depende de cuantas rutas declare la especificacion.
 *
 * O sea que **la cantidad no existe como constante**, y las dos veces que puse una estaba
 * inventando precision dentro del arreglo de un guardia que existe para no ocultar ausencias.
 *
 * Asi que no se afirma un numero: se afirma que **un bloque entero no se ejerció**, que es lo
 * verdadero y lo que hay que ver en el resumen. Un total sin denominador no es un resultado —y
 * aqui el denominador es dato de ejecucion, no de codigo.
 */
const BLOQUES_NO_EJERCIDOS = 1;
const fallos = [];
const ok = n => { pasaron++; console.log(`  ok    ${n}`); };
const mal = (n, d) => { fallaron++; fallos.push(`${n}: ${d}`); console.log(`  FALLA ${n}\n          ${d}`); };
const comprobar = (n, c, d) => (c ? ok(n) : mal(n, d));

/**
 * Rutas que el enrutador atiende de verdad, leidas del codigo fuente.
 *
 * Se comparan FORMAS, no nombres de parametro: `/v1/archive/{}` y no
 * `/v1/archive/{id}`. La primera version normalizaba todo a `{id}` y marcaba como
 * "documentada y no atendida" a `/v1/structures/{pdb}` — un FALSO POSITIVO, que es
 * peor que no mirar: retiene trabajo bueno y entrena a ignorar el chequeo.
 *
 * La forma conserva la aridad, que es lo que si importa: un patron con un grupo
 * opcional atiende DOS formas — `/v1/propagate/{}` y `/v1/propagate/{}/{}` — y las
 * dos tienen que estar declaradas.
 */
export function formaDeRuta(ruta) {
  return ruta.replace(/\{[^}]*\}/g, "{}");
}

export function rutasDelCodigo(fuente) {
  const rutas = new Set();
  // literales: if (p === "/v1/algo")
  for (const m of fuente.matchAll(/p === "(\/v1[^"]*)"/g)) {
    const r = m[1].replace(/\/$/, "");
    if (r) rutas.add(r);
  }
  // patrones: p.match(/^\/v1\/propagate\/([^/]+)(?:\/([^/]+))?\/?$/)
  //
  // Se escanea a mano en vez de con un regex sobre el regex: la version anterior
  // usaba [^)]*? y se cortaba en el primer parentesis, que es el de ([^/]+). Los
  // self-tests la atraparon antes de que llegara a produccion.
  const MARCA = "p.match(/^\\/v1\\/";
  let i = 0;
  while ((i = fuente.indexOf(MARCA, i)) >= 0) {
    const desde = i + MARCA.length;
    const hasta = fuente.indexOf("$/", desde);
    if (hasta < 0) { i = desde; continue; }
    const cuerpo = fuente.slice(desde, hasta);
    const base = (cuerpo.match(/^(\w+)/) || [])[1];
    if (base) {
      // Se recorren los SEGMENTOS, no se cuentan capturas.
      //
      // La version anterior contaba `([^/]+)` y armaba `/v1/base` + "/{}"×n, asi que un
      // segmento LITERAL despues de una captura desaparecia: `/v1/archive/([^/]+)/raw`
      // salia como `/v1/archive/{}` y el chequeo declaraba «documentada y no atendida»
      // una ruta que el enrutador si atiende. Un falso positivo retiene trabajo bueno y
      // ensena a ignorar el chequeo.
      //
      // Va en DOS pasos porque mi primer intento de caminar los segmentos de una sola
      // pasada rompio los casos simples: el `\/?$` final quedaba como un segmento "?"
      // y el grupo opcional se partia por la mitad. Primero se saca el grupo opcional,
      // despues se camina lo que queda.
      let resto = cuerpo.slice(base.length);
      const opcionales = (resto.match(/\(\?:[\s\S]*?\)\?/g) || []).length;
      resto = resto.replace(/\(\?:[\s\S]*?\)\?/g, "");     // fuera el opcional
      resto = resto.replace(/\\\/\?$/, "");                  // fuera la barra final opcional
      let fija = `/v1/${base}`;
      for (const seg of resto.split("\\/").filter(x => x !== "" && x !== "?")) {
        if (/\(\[\^\/\]\+\)/.test(seg)) { fija += "/{}"; continue; }
        const literal = seg.replace(/[()?]/g, "").trim();
        if (literal) fija += "/" + literal;
      }
      rutas.add(fija);
      for (let k = 1; k <= opcionales; k++) rutas.add(fija + "/{}".repeat(k));
    }
    i = hasta;
  }
  return [...rutas].map(formaDeRuta).sort();
}

/** Las rutas que declara el CATALOGO, leidas del mismo archivo. */
export function rutasDelCatalogo(fuente) {
  const ini = fuente.indexOf("export const CATALOGO = [");
  if (ini < 0) throw new Error("no se encontro CATALOGO en api.js");
  const fin = fuente.indexOf("\n];", ini);
  const bloque = fuente.slice(ini, fin);
  return [...bloque.matchAll(/\{\s*ruta:\s*"([^"]+)"/g)].map(m => m[1]).sort();
}

/** La diferencia entre dos listas, en las dos direcciones. */
export function diferencia(a, b) {
  const soloA = a.filter(x => !b.includes(x));
  const soloB = b.filter(x => !a.includes(x));
  return { soloA, soloB, calzan: !soloA.length && !soloB.length };
}

if (SELF) {
  console.log("SELF-TEST — los comparadores tienen que gritar contra un defecto real:\n");
  comprobar("rutasDelCodigo encuentra los literales",
    rutasDelCodigo('if (p === "/v1/state") x;').includes("/v1/state"), "no la encontro");
  comprobar("rutasDelCodigo normaliza los parametros a una FORMA",
    rutasDelCodigo('p.match(/^\\/v1\\/archive\\/([^/]+)\\/?$/)').includes("/v1/archive/{}"),
    "no normalizo el parametro");
  // El falso positivo real: el catalogo dice {pdb} y el codigo capturaba {id}.
  comprobar("un parametro con otro nombre NO da falso positivo",
    diferencia(rutasDelCodigo('p.match(/^\\/v1\\/structures\\/([^/]+)\\/?$/)'),
               ["/v1/structures/{pdb}"].map(formaDeRuta)).calzan,
    "marco como divergencia dos formas iguales con distinto nombre de parametro");
  // El defecto real: un segmento literal DESPUES de una captura desaparecia.
  comprobar("un segmento literal despues de la captura no se pierde",
    rutasDelCodigo('p.match(/^\\/v1\\/archive\\/([^/]+)\\/raw\\/?$/)').includes("/v1/archive/{}/raw"),
    `dio ${JSON.stringify(rutasDelCodigo('p.match(/^\\/v1\\/archive\\/([^/]+)\\/raw\\/?$/)'))}`);
  comprobar("y la ruta sin el literal NO se declara sola",
    !rutasDelCodigo('p.match(/^\\/v1\\/archive\\/([^/]+)\\/raw\\/?$/)').includes("/v1/archive/{}"),
    "invento una ruta que el enrutador no atiende");

  // Un grupo opcional atiende DOS formas y las dos tienen que estar declaradas.
  comprobar("un grupo opcional produce las dos formas",
    (() => { const r = rutasDelCodigo('p.match(/^\\/v1\\/propagate\\/([^/]+)(?:\\/([^/]+))?\\/?$/)');
      return r.includes("/v1/propagate/{}") && r.includes("/v1/propagate/{}/{}"); })(),
    "no produjo las dos formas");
  comprobar("rutasDelCatalogo lee las rutas declaradas",
    rutasDelCatalogo('export const CATALOGO = [\n{ ruta: "/v1/x", resumen: "y" },\n];').includes("/v1/x"),
    "no leyo el catalogo");
  comprobar("diferencia grita si al codigo le sobra una ruta",
    !diferencia(["/v1/a", "/v1/b"], ["/v1/a"]).calzan, "no detecto la ruta sin documentar");
  comprobar("diferencia grita si a la especificacion le sobra una ruta",
    !diferencia(["/v1/a"], ["/v1/a", "/v1/b"]).calzan, "no detecto la ruta documentada que no existe");
  comprobar("diferencia calla cuando calzan",
    diferencia(["/v1/a", "/v1/b"], ["/v1/b", "/v1/a"]).calzan, "grito con listas iguales");
  console.log(`\nself-test: ${pasaron} pasaron, ${fallaron} fallaron, ${saltados} bloque(s) no ejercido(s)`);
  process.exit(fallaron ? 1 : 0);
}

console.log(`Chequeando la especificacion contra ${BASE}\n`);

// Este chequeo tambien espera. Corria despues del otro y daba el deploy por
// propagado — pero el edge no propaga a todos los colos a la vez, asi que pegaba
// en uno con el Worker viejo y caia con produccion correcta.
const ESPERA = args.includes("--esperar") ? Number(args[args.indexOf("--esperar") + 1]) : 0;
await esperarVersion(BASE, process.env.GITHUB_SHA, ESPERA);
await esperarRutas(BASE, CATALOGO.map(e => {
  let r = e.ruta;
  for (const m of e.ruta.matchAll(/\{(\w+)\}/g)) {
    const v = e.ejemplo && e.ejemplo[m[1]];
    if (!v) return null;
    r = r.replace(m[0], encodeURIComponent(v));
  }
  return r === "/v1/search" ? "/v1/search?q=portfolio" : r;
}).filter(Boolean), ESPERA);

const fuente = readFileSync(join(RAIZ, "api.js"), "utf8");
const enCodigo = rutasDelCodigo(fuente);
const enCatalogoCrudo = rutasDelCatalogo(fuente);
const enCatalogo = [...new Set(enCatalogoCrudo.map(formaDeRuta))].sort();

console.log(`  el enrutador atiende ${enCodigo.length} rutas · el catalogo declara ${enCatalogo.length}`);
const d1 = diferencia(enCodigo, enCatalogo);
comprobar("toda ruta del enrutador esta en el catalogo", !d1.soloA.length,
  `sin documentar: ${d1.soloA.join(", ")}`);
comprobar("el catalogo no declara rutas que el enrutador no atiende", !d1.soloB.length,
  `documentadas y no atendidas: ${d1.soloB.join(", ")}`);

const r = await fetch(BASE + "/v1/openapi.json", { redirect: "manual", headers: { "x-rq-check": "1" } });
comprobar("GET /v1/openapi.json responde 200", r.status === 200, `respondio ${r.status}`);
let doc = null;
let porQueNoSeLeyo = null;
try { doc = await r.json(); } catch (e) { porQueNoSeLeyo = String(e).split("\n")[0]; }

// EL DEFECTO QUE ESTO ARREGLA, reproducido el 2026-08-27 con un servidor que devuelve 200 y un
// cuerpo que no parsea —el caso real de un CDN sirviendo su pagina de error con status 200—:
//
//     6 pasaron, 0 fallaron        EXIT=0
//     comprobaciones del documento que corrieron: 0
//
// `doc` quedaba en `null`, el `if (doc)` se saltaba entero, y **las 26 comprobaciones de adentro
// no se ejecutaban ni se contaban**. Verde con cobertura cero, sobre la especificacion que es
// nuestro contrato publico. Y la unica que si corria —«responde 200»— PASABA, porque el problema
// no era el status.
//
// Es la §5 quater 4: un chequeo que no se pudo ejercer entra al resumen. **Verde no es lo mismo
// que cubierto.** Ahora no se puede saltar: si el documento no se lee, es un FALLO con su motivo.
if (!doc) {
  mal("la especificacion servida se puede leer como JSON",
    `respondio ${r.status} pero el cuerpo no parsea${porQueNoSeLeyo ? ` (${porQueNoSeLeyo})` : ""}. ` +
    `todas las comprobaciones del documento NO se ejecutaron —son un bloque entero, con un bucle ` +
    `por ruta, asi que no tienen un numero fijo—. Esto no es un verde: es una ausencia.`);
  saltados += BLOQUES_NO_EJERCIDOS;
}

if (doc) {
  comprobar("declara la version de OpenAPI", /^3\./.test(doc.openapi || ""), `openapi = ${doc.openapi}`);
  comprobar("declara el servidor", (doc.servers || []).some(s => s.url === BASE.replace(/\/$/, "")) || !!(doc.servers || [])[0],
    "no declara servers");
  const enSpecCrudo = Object.keys(doc.paths || {}).sort();
  const enSpec = [...new Set(enSpecCrudo.map(formaDeRuta))].sort();
  console.log(`  la especificacion servida publica ${enSpec.length} rutas`);
  const d2 = diferencia(enCatalogo, enSpec);
  comprobar("la especificacion servida calza con el catalogo del codigo", d2.calzan,
    `solo en el codigo: ${d2.soloA.join(", ")} · solo en la especificacion: ${d2.soloB.join(", ")}`);

  // La promesa se ejerce: cada ruta documentada tiene que responder.
  console.log("\n  -- cada ruta documentada responde de verdad --");
  let vivas = 0;
  for (const ruta of enSpecCrudo) {
    const e = (doc.paths[ruta].get || {});
    let url = ruta;
    for (const par of (e.parameters || []).filter(p => p.in === "path")) {
      if (!par.example) { mal(`GET ${ruta}`, `el parametro {${par.name}} no trae ejemplo, no se puede ejercer`); url = null; break; }
      url = url.replace(`{${par.name}}`, encodeURIComponent(par.example));
    }
    if (url === null) continue;
    if (ruta === "/v1/search") url += "?q=portfolio";   // parametro obligatorio
    const rr = await fetch(BASE + url, { redirect: "manual", headers: { "User-Agent": "rosetta openapi check", "x-rq-check": "1" } });
    if (rr.status === 200) vivas++;
    comprobar(`GET ${url}`, rr.status === 200, `respondio ${rr.status}`);
  }
  console.log(`  => ${vivas} de ${enSpecCrudo.length} rutas documentadas responden 200`);

  // Cobertura de esquemas: se declara, no se finge.
  const conEsquema = enSpecCrudo.filter(p => {
    const s = ((doc.paths[p].get || {}).responses || {})["200"];
    const esq = s && s.content && s.content["application/json"] && s.content["application/json"].schema;
    return esq && (esq.$ref || esq.properties);
  }).length;
  console.log(`\n  cobertura de esquemas: ${conEsquema} de ${enSpecCrudo.length}`);
  comprobar("el documento declara su propia cobertura de esquemas",
    new RegExp(`${conEsquema} de ${enSpecCrudo.length}`).test((doc.info || {}).description || ""),
    `la descripcion no declara "${conEsquema} de ${enSpecCrudo.length}"`);
}

// La especificacion tiene que estar enlazada donde un agente la busca.
console.log("\n  -- enlazada donde se busca --");
for (const [ruta, que] of [["/llms.txt", "llms.txt"], ["/api-docs/", "/api-docs"], ["/v1", "el indice de /v1"]]) {
  const rr = await fetch(BASE + ruta, { redirect: "manual", headers: { "x-rq-check": "1" } });
  const txt = await rr.text();
  comprobar(`${que} enlaza la especificacion`, txt.includes("/v1/openapi.json"),
    `no aparece /v1/openapi.json en ${ruta} (status ${rr.status})`);
}

console.log(`\n${pasaron} pasaron, ${fallaron} fallaron, ${saltados} bloque(s) NO EJERCIDO(S)`);
if (saltados) console.log("Un chequeo que no se pudo ejercer no es un verde: es una ausencia (CLAUDE.md §5 quater 4).");
if (fallaron) { console.log("\nFALLOS:\n - " + fallos.join("\n - ")); process.exit(1); }
