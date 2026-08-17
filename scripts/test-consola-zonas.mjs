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
const BASE = join(RAIZ, "public/consola/consola.css");

/** Devuelve la lista de fallos. Vacia = todo bien. */
export function revisar(html, js, zonas, base = "") {
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
      else {
        // Regla 5: con tildes. Escribi "El panorama del dia: que cambio..." arrastrando el
        // estilo sin acentos de los COMENTARIOS del codigo, y ese texto lo lee un cliente.
        // La lista es corta y sin ambiguedad a proposito: "que"/"si"/"mas" cambian de
        // significado con el acento y darian falsos positivos, y un falso positivo aca
        // retiene texto bueno, que es peor.
        const sinTilde = (t.toLowerCase().match(
          /\b(dia|dias|historica|historico|tecnico|tecnica|decision|prediccion|maquina|maquinas|metrica|metricas|proposito|cambio en|termino|movio|aqui|asi|tambien|numero|estan|ademas|version|edicion|medicion|tamano|espanol)\b/g) || []);
        if (sinTilde.length) malos.push(`«${z.id}» tiene texto sin tildes en ${campo}: ${sinTilde.join(", ")}`);
      }
    }
  }

  // Regla 6: la hoja base pelea, y no se ve leyendo el HTML.
  //
  // La consola hereda consola.css de otro contexto, donde `.barra` era una barra de
  // progreso de 4 px con overflow:hidden. Al reusar ese nombre para el contenedor del
  // filtro, el buscador y el DENOMINADOR de las corridas quedaron recortados a una linea
  // — invisible leyendo el markup, porque el markup estaba bien.
  //
  // Se marcan solo las clases que la base restringe EN TAMANO (height, width, max-*,
  // overflow:hidden) y que la pagina no vuelve a definir. Es un conjunto chico a
  // proposito: precision sobre cobertura, porque un falso positivo aqui retiene trabajo
  // bueno. No dice "esto esta mal": dice "esta clase trae un tamano de otro contexto,
  // decide a proposito".
  // Los comentarios se quitan ANTES de leer, y esto ya me mordio dos veces hoy: el
  // comentario que EXPLICA por que el contenedor no puede llamarse `.barra` contiene la
  // palabra `.barra`, asi que el guardia la contaba como redefinida y se callaba. Un
  // instrumento que lee la explicacion del defecto en vez del codigo aprueba el defecto.
  const propias = new Set([...(html.match(/<style>[\s\S]*?<\/style>/) || [""])[0]
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .matchAll(/\.([a-z0-9-]+)/g)].map(m => m[1]));
  const usadas = new Set([...html.matchAll(/class="([^"]+)"/g)].flatMap(m => m[1].split(/\s+/)));
  for (const m of (base || "").matchAll(/([^{}]+)\{([^}]*)\}/g)) {
    const cuerpo = m[2];
    if (!/(^|;)\s*(height|max-height|max-width|width)\s*:/.test(cuerpo) && !/overflow\s*:\s*hidden/.test(cuerpo)) continue;
    for (const sel of m[1].split(",")) {
      const c = (sel.trim().match(/^\.([a-z0-9-]+)$/i) || [])[1];
      if (c && usadas.has(c) && !propias.has(c)) {
        malos.push(`«.${c}» viene de la hoja base con un tamaño de otro contexto (${cuerpo.trim().split(";")[0]}) y la consola la usa sin redefinirla`);
      }
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
const base = readFileSync(BASE, "utf8");
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
    // El caso REAL que se me escapo, con el texto tal como lo escribi.
    ["texto sin tildes", null, null, z => ({ ...z, DECLARADAS: z.DECLARADAS.map(d => d.id === "despacho"
      ? { ...d, proposito: "El panorama del dia: que cambio en el archivo desde ayer." } : d) }), "sin tildes"],
    ["clase con tamaño de la hoja base", h => h.replace('class="barra-filtro"', 'class="barra"'), null, null, "tamaño de otro contexto"],
    // EL CASO PARADOJICO, y el unico que exige SILENCIO: un archivo donde los defectos
    // estan DESCRITOS en un comentario y NO estan en el codigo. Si el guardia grita aqui,
    // esta leyendo prosa — que es como se equivoco dos veces mientras lo escribia. No se
    // le ocurre a nadie hasta que muerde.
    ["prosa que describe defectos, sin defectos", h => h.replace("<style>", `<style>
  /* NOTA: este contenedor NO puede llamarse .barra ni .rail, y el pie no debe declarar
     /v1/inventada. Tampoco se escribe «51 de 72» a mano. Nada de esto esta en el codigo:
     esto es la explicacion, no el defecto. */`), null, null, null],
    ["ruta pedida y no declarada", null, j => j.replace('pedir("/v1/state")', 'pedir("/v1/secreta")'), null, "el código pide /v1/secreta"],
    ["ruta declarada y no pedida", h => h.replace("<code>/v1/state</code>", "<code>/v1/inventada</code>"), null, null, "el pie declara /v1/inventada"],
  ];
  let ok = 0, mal = 0;
  // Primero el caso positivo: el archivo REAL tiene que pasar. Sin esto, un guardia roto
  // que grita con todo tambien "aprobaria" el self-test.
  const propio = revisar(html, js, zonas, base);
  if (propio.length === 0) { ok++; console.log("  ok   el archivo real pasa"); }
  else { mal++; console.log(`  FALLA el archivo real no pasa:\n         ${propio.join("\n         ")}`); }

  for (const [nombre, mh, mj, mz, esperado] of casos) {
    const fallos = revisar(mh ? mh(html) : html, mj ? mj(js) : js, mz ? mz(zonas) : zonas, base);
    if (esperado === null) {
      // Caso de silencio: el guardia NO tiene que decir nada.
      if (fallos.length === 0) { ok++; console.log(`  ok   se calla con: ${nombre}`); }
      else { mal++; console.log(`  FALLA gritó con prosa: ${nombre}\n         dijo: ${fallos.join(" | ")}`); }
      continue;
    }
    const grito = fallos.find(f => f.includes(esperado));
    if (grito) { ok++; console.log(`  ok   grita con: ${nombre}`); }
    else { mal++; console.log(`  FALLA no gritó con: ${nombre}\n         dijo: ${fallos.join(" | ") || "(nada)"}`); }
  }
  console.log(`\nself-test: ${ok} pasaron, ${mal} fallaron`);
  process.exit(mal ? 1 : 0);
}

const fallos = revisar(html, js, zonas, base);
if (fallos.length) {
  console.error("Las zonas de la consola no cuadran:\n  - " + fallos.join("\n  - "));
  process.exit(1);
}
console.log(`  ok: ${zonas.CON_DATOS.length} zonas con datos y ${zonas.DECLARADAS.length} declaradas, todas con su riel, su sección y su hueco`);
