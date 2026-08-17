#!/usr/bin/env node
/**
 * El guardia de las zonas de la consola.
 *
 * QUE VIGILA Y POR QUE CADA COSA
 * ------------------------------
 * 1. Riel y secciones se corresponden. Un boton sin seccion deja la pantalla EN BLANCO al
 *    hacer clic —sin error, porque navegar() solo esconde y muestra—, y una pantalla vacia
 *    sin explicacion es indistinguible de "no hay datos".
 * 2. Cada zona declarada tiene su hueco `#z-<id>` en el HTML. Si falta, `pintarDeclaradas`
 *    hace `continue` y la zona sale con el titulo y NADA debajo: se lee como un olvido,
 *    que es justo lo contrario de declararla.
 * 3. Ninguna declaracion lleva cifras escritas a mano. Un "51 de 72" pegado en el texto
 *    envejece la proxima vez que sellamos algo, y un numero viejo en esta pantalla es el
 *    defecto que la pantalla dice no cometer. Las cifras salen de `medicion()`, en vivo.
 * 4. El pie declara EXACTAMENTE las rutas que el codigo pide. Ese pie es una afirmacion
 *    verificable —"todo esto sale de la API, en vivo"— y las afirmaciones verificables de
 *    este proyecto se comprueban solas o no valen.
 *
 * Se ejerce con --self-test, que rompe cada regla a proposito y exige que grite. Un
 * guardia que nunca se vio fallar no es un guardia: es una linea que da confianza.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const HTML = join(RAIZ, "public/consola/index.html");
const JS = join(RAIZ, "public/consola/consola.js");

/** Devuelve la lista de fallos. Vacia = todo bien. */
export function revisar(html, js, zonas) {
  const malos = [];
  const { CON_DATOS, DECLARADAS } = zonas;

  const botones = [...html.matchAll(/data-v="([^"]+)"/g)].map(m => m[1]);
  const secciones = [...html.matchAll(/<section class="vista" id="v-([^"]+)"/g)].map(m => m[1]);

  for (const b of botones) if (!secciones.includes(b)) malos.push(`el riel lleva a «${b}» y no existe <section id="v-${b}">`);
  for (const s of secciones) if (!botones.includes(s)) malos.push(`la sección «${s}» existe y ningún botón del riel lleva a ella`);

  const declaradas = DECLARADAS.map(z => z.id);
  for (const id of [...CON_DATOS, ...declaradas]) {
    if (!botones.includes(id)) malos.push(`«${id}» está en zonas.js y no está en el riel`);
  }

  for (const z of DECLARADAS) {
    if (!html.includes(`id="z-${z.id}"`)) malos.push(`la zona declarada «${z.id}» no tiene su hueco <div id="z-${z.id}">`);
    for (const campo of ["proposito", "falta"]) {
      const t = (z[campo] || "").trim();
      if (!t) malos.push(`«${z.id}» no dice ${campo}`);
      // Regla 3: los digitos van medidos, no escritos.
      else if (/\d/.test(t)) malos.push(`«${z.id}» tiene una cifra escrita a mano en ${campo}: «${t.match(/[^.]*\d[^.]*/)[0].trim()}»`);
    }
  }

  // Regla 4: el pie contra el codigo. Se comparan los dos conjuntos, en los dos sentidos.
  const pie = (html.match(/<p class="fuente">([\s\S]*?)<\/p>/) || ["", ""])[1];
  // `${...}` y `<id>` son el MISMO agujero escrito en dos lenguajes; se normalizan a uno.
  const norm = r => r.replace(/\$\{[^}]*\}|\{[^}]*\}|<[^>]*>/g, "<id>").replace(/\?.*$/, "");
  // Los comentarios se quitan ANTES de buscar: consola.js explica `/v1/...` en su cabecera,
  // y contar esa mencion como una ruta pedida hacia gritar al guardia contra si mismo.
  const codigo = js.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const declaradasPie = new Set([...pie.matchAll(/<code>(\/v1\/[^<]+)<\/code>/g)]
    .map(m => norm(m[1].replace(/&lt;/g, "<").replace(/&gt;/g, ">"))));
  const pedidasJs = new Set([...codigo.matchAll(/["'`](\/v1\/[^"'`\s]*)["'`]/g)].map(m => norm(m[1])));
  for (const r of pedidasJs) if (!declaradasPie.has(r)) malos.push(`el código pide ${r} y el pie no lo declara`);
  for (const r of declaradasPie) if (!pedidasJs.has(r)) malos.push(`el pie declara ${r} y el código no lo pide`);

  return malos;
}

const html = readFileSync(HTML, "utf8");
const js = readFileSync(JS, "utf8");
const zonas = await import(join(RAIZ, "public/consola/zonas.js"));

if (process.argv.includes("--self-test")) {
  // Cada caso ROMPE una regla y exige el grito. El texto esperado se compara por
  // fragmento: si el mensaje cambia, el caso falla y alguien lo mira.
  const casos = [
    ["botón sin sección", h => h.replace('<button data-v="mapa" class="z-decl">Mapa</button>',
      '<button data-v="mapa" class="z-decl">Mapa</button><button data-v="fantasma">Fantasma</button>'), null, null, "«fantasma» y no existe"],
    ["sección sin botón", h => h.replace('<section class="vista" id="v-mapa"', '<section class="vista" id="v-huerfana"'), null, null, "ningún botón del riel lleva a ella"],
    ["zona sin su hueco", h => h.replace('id="z-mapa"', 'id="z-mapa-mal"'), null, null, "no tiene su hueco"],
    ["cifra escrita a mano", null, null, z => ({ ...z, DECLARADAS: z.DECLARADAS.map(d => d.id === "boveda" ? { ...d, falta: "Faltan 3 endpoints de escritura." } : d) }), "cifra escrita a mano"],
    ["zona muda", null, null, z => ({ ...z, DECLARADAS: z.DECLARADAS.map(d => d.id === "boveda" ? { ...d, falta: "" } : d) }), "no dice falta"],
    ["ruta pedida y no declarada", null, j => j.replace('pedir("/v1/state")', 'pedir("/v1/secreta")'), null, "el código pide /v1/secreta"],
    ["ruta declarada y no pedida", h => h.replace("<code>/v1/state</code>", "<code>/v1/inventada</code>"), null, null, "el pie declara /v1/inventada"],
  ];
  let ok = 0, mal = 0;
  // Primero el caso positivo: el archivo REAL tiene que pasar. Sin esto, un guardia roto
  // que grita con todo tambien "aprobaria" el self-test.
  const base = revisar(html, js, zonas);
  if (base.length === 0) { ok++; console.log("  ok   el archivo real pasa"); }
  else { mal++; console.log(`  FALLA el archivo real no pasa:\n         ${base.join("\n         ")}`); }

  for (const [nombre, mh, mj, mz, esperado] of casos) {
    const fallos = revisar(mh ? mh(html) : html, mj ? mj(js) : js, mz ? mz(zonas) : zonas);
    const grito = fallos.find(f => f.includes(esperado));
    if (grito) { ok++; console.log(`  ok   grita con: ${nombre}`); }
    else { mal++; console.log(`  FALLA no gritó con: ${nombre}\n         dijo: ${fallos.join(" | ") || "(nada)"}`); }
  }
  console.log(`\nself-test: ${ok} pasaron, ${mal} fallaron`);
  process.exit(mal ? 1 : 0);
}

const fallos = revisar(html, js, zonas);
if (fallos.length) {
  console.error("Las zonas de la consola no cuadran:\n  - " + fallos.join("\n  - "));
  process.exit(1);
}
console.log(`  ok: ${zonas.CON_DATOS.length} zonas con datos y ${zonas.DECLARADAS.length} declaradas, todas con su riel, su sección y su hueco`);
