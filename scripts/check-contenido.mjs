/**
 * T-guardia — la mina nº1 del catastro, desarmada.
 *
 * QUE VIGILA
 * ----------
 * `run_worker_first` es una lista blanca escrita a mano. Si una ruta que necesita
 * inyeccion desde D1 no esta en la lista, Cloudflare sirve el archivo estatico y el
 * codigo del Worker NO SE EJECUTA: la pagina sale con el HTML de build, sin error, sin
 * log y sin ningun test rojo.
 *
 * El ensayo del commit 1 lo midio: quitando "/clases" del preview, /clases/ paso de
 * 212.235 a 30.557 bytes —perdio el 86%— y el CI TERMINO EN VERDE. El deploy funciono,
 * P0 paso (mira /, /v1/state y un post, no /clases) y nadie grito.
 *
 * COMO
 * ----
 * Para CADA ruta de `run_worker_first`, contra el preview y contra produccion:
 *   1. un MARCADOR que solo existe si la inyeccion corrio (no "responde 200");
 *   2. el TAMAÑO dentro de +-25% del de produccion.
 *
 * DOS DECISIONES QUE IMPORTAN
 * ---------------------------
 * a) La lista de rutas de REFERENCIA se lee de `git show main:wrangler.jsonc`, NO del
 *    archivo de trabajo. Esto no es un detalle: la primera version leia el archivo local
 *    y la prueba de grito la reprobo. Al quitar "/clases" del preview, el guardia dejo de
 *    VIGILAR /clases —paso de 9 rutas a 8— y reporto verde sobre las 8 restantes. Era
 *    ciego a exactamente el defecto que existe para cazar, porque el error editaba tambien
 *    su propia lista de tareas. La referencia tiene que ser lo que produccion inyecta HOY,
 *    y eso vive en main, que es lo desplegado.
 *    Ademas se exige que la lista del preview CUBRA la de main: una ruta que desaparece
 *    de run_worker_first es el defecto, no una tarea menos.
 * b) La referencia es PRODUCCION VIVA, no numeros escritos aqui. Un umbral horneado
 *    envejece y un dia aprueba una pagina rota porque el numero quedo viejo.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

// Quien actua esta señal.
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no fusiona a main: una ruta sin inyeccion en el preview es la mina nº1 armada, y en produccion no avisa nadie",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
const PROD = (process.env.PROD_URL || "https://rosettaquantum.com").replace(/\/+$/, "");
const TOL = Number(process.env.TOLERANCIA || 0.25);

if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const faltanEnLista = [];

// Marcador por ruta: que cadena existe SOLO si el Worker corrio. Las rutas que no
// aparecen aca se cubren igual por tamaño, y se declaran como tales.
const MARCADORES = {
  "/blog/":          { patron: /href="\/blog\/[a-z0-9-]+\/"/g, que: "enlaces a post desde D1" },
  "/es/blog/":       { patron: /href="\/blog\/[a-z0-9-]+\/"/g, que: "enlaces a post desde D1" },
  "/clases/":        { patron: /Oracular/g,                    que: "categorias del catalogo D1" },
  "/es/clases/":     { patron: /Oracular/g,                    que: "categorias del catalogo D1" },
  "/llms.txt":       { patron: /\/blog\//g,                    que: "entradas anexadas por el Worker" },
  "/rss.xml":        { patron: /<item>/g,                      que: "items anexados desde D1" },
  "/sitemap-0.xml":  { patron: /<url>/g,                       que: "urls, incluidas las de D1" },
  "/v1/state":       { patron: /"corridas_selladas"/g,         que: "estado medido desde D1" },
  "/mcp":            { patron: /"nombre"/g,                    que: "herramientas del servidor MCP" },
};

function listaDe(texto, ruta) {
  const cfg = JSON.parse(texto.replace(/^\s*\/\/.*$/gm, ""));
  return ruta === "preview"
    ? (cfg?.env?.preview?.assets?.run_worker_first ?? [])
    : (cfg?.assets?.run_worker_first ?? []);
}

async function rutasDeWrangler() {
  // La REFERENCIA es main: lo que produccion inyecta hoy. El archivo local puede estar
  // justamente roto, y un guardia que lee su lista del archivo bajo prueba es ciego.
  // main puede no existir como rama local (en CI el checkout trae solo la rama actual;
  // en un worktree, main esta tomado por otro arbol). Se prueban las dos formas y se
  // ABORTA si ninguna resuelve: sin referencia, este guardia no puede opinar.
  let refTexto = null;
  for (const ref of ["origin/main", "main"]) {
    try { refTexto = execSync(`git show ${ref}:wrangler.jsonc`, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }); break; } catch { /* siguiente */ }
  }
  if (!refTexto) {
    console.error("ABORTA: no se pudo leer wrangler.jsonc de origin/main ni de main.");
    console.error("Sin la referencia de produccion, el guardia seria ciego al defecto que caza.");
    process.exit(1);
  }
  const deMain = listaDe(refTexto, "produccion");
  const dePreview = listaDe(readFileSync("wrangler.jsonc", "utf8"), "preview");

  // Rutas RETIRADAS a proposito por un 301 (commit 10). Salir de run_worker_first es
  // legitimo SOLO si la ruta ya no sirve pagina sino redireccion: por eso no basta con
  // declararlas, hay que comprobar que el 301 existe de verdad. Una ruta que
  // "se retiro" y en realidad devuelve la pagina vieja seria la mina nº1 con permiso.
  const RETIRADAS = { "/clases": "/library", "/clases/": "/library", "/es/clases": "/es/biblioteca", "/es/clases/": "/es/biblioteca" };
  for (const [r, destino] of Object.entries(RETIRADAS)) {
    if (dePreview.includes(r)) continue; // sigue en la lista: se comprueba como las demas
    const res = await esperar(PREVIEW + r, (x) => x.status === 301);
    const loc = res.headers.get("location") || "";
    if (res.status !== 301 || !loc.endsWith(destino)) {
      console.log(`  FALLA ${r.padEnd(16)} retirada de run_worker_first pero devuelve ${res.status} ${loc || "(sin Location)"} — se esperaba 301 a ${destino}`);
      faltanEnLista.push(r);
    } else {
      console.log(`  ok    ${r.padEnd(16)} retirada con 301 -> ${destino}`);
    }
  }

  const faltan = deMain.filter((r) => !dePreview.includes(r) && !(r in RETIRADAS));
  if (faltan.length) {
    console.log(`  FALLA run_worker_first del preview NO cubre a main`);
    faltan.forEach((r) => console.log(`        falta: ${r}  — produccion la inyecta y el preview no`));
    faltanEnLista.push(...faltan);
  }

  const lista = deMain;
  // Las entradas con comodin (/v1/*) no son URLs: se prueban por su representante.
  const vistas = new Set();
  const rutas = [];
  for (const r of lista) {
    let u = r.includes("*") ? (r === "/v1/*" ? "/v1/state" : null) : r;
    if (u === "/v1") u = "/v1/state";
    if (!u) continue;
    if (!u.endsWith("/") && !u.includes(".") && u !== "/v1/state" && u !== "/mcp") u += "/";
    if (!vistas.has(u)) { vistas.add(u); rutas.push(u); }
  }
  return rutas;
}


// Reintento corto. NO es para tapar un fallo: es porque el manifiesto de ASSETS y el
// Worker no llegan al borde en el mismo instante. Medido en el CI del commit 10: en la
// MISMA corrida, /clases devolvio 307 (el asset viejo, que ya no existe en el build) y
// /clases/ devolvio 301 (el Worker nuevo). Segundos despues, las dos daban 301.
// Un guardia que falla a ratos es peor que no tenerlo: la gente aprende a re-lanzarlo.
async function esperar(url, ok, intentos = 10, ms = 3000) {
  let ultimo = null;
  for (let i = 0; i < intentos; i++) {
    ultimo = await fetch(url, { redirect: "manual", headers: { "x-rq-check": "1" } });
    if (ok(ultimo)) return ultimo;
    if (i < intentos - 1) await new Promise((r) => setTimeout(r, ms));
  }
  return ultimo;
}

async function medir(base, ruta) {
  try {
    const r = await fetch(base + ruta, { redirect: "follow", headers: { "x-rq-check": "1" } });
    const t = await r.text();
    return { code: r.status, bytes: t.length, cuerpo: t };
  } catch (e) { return { code: 0, bytes: 0, cuerpo: "", error: String(e).slice(0, 60) }; }
}

const rutas = await rutasDeWrangler();
console.log(`preview:    ${PREVIEW}`);
console.log(`referencia: ${PROD}`);
console.log(`rutas de run_worker_first (leidas de wrangler.jsonc): ${rutas.length}\n`);

const fallos = [...faltanEnLista];
for (const ruta of rutas) {
  const [p, q] = await Promise.all([medir(PREVIEW, ruta), medir(PROD, ruta)]);
  const m = MARCADORES[ruta];
  const cP = m ? (p.cuerpo.match(m.patron) || []).length : null;
  const cQ = m ? (q.cuerpo.match(m.patron) || []).length : null;
  const razon = q.bytes > 0 ? p.bytes / q.bytes : 0;
  const dentro = razon >= 1 - TOL && razon <= 1 + TOL;

  const problemas = [];
  if (p.code !== 200) problemas.push(`preview ${p.code}`);
  if (q.code !== 200) problemas.push(`produccion ${q.code} (referencia inservible)`);
  if (m && cP === 0) problemas.push(`SIN MARCADOR: 0 ${m.que} — la inyeccion no corrio`);
  if (m && cQ > 0 && cP > 0 && cP < cQ * (1 - TOL)) problemas.push(`marcador escaso: ${cP} vs ${cQ} en produccion`);
  if (!dentro) problemas.push(`tamaño ${p.bytes} vs ${q.bytes} (${(razon * 100).toFixed(0)}%, fuera de ±${TOL * 100}%)`);

  const etiqueta = m ? `${cP}/${cQ} ${m.que}` : "sin marcador declarado — solo tamaño";
  if (problemas.length) {
    console.log(`  FALLA ${ruta.padEnd(16)} ${p.bytes} vs ${q.bytes} bytes · ${etiqueta}`);
    problemas.forEach((x) => console.log(`        ${x}`));
    fallos.push(ruta);
  } else {
    console.log(`  ok    ${ruta.padEnd(16)} ${p.bytes} vs ${q.bytes} bytes (${(razon * 100).toFixed(0)}%) · ${etiqueta}`);
  }
}

if (fallos.length) {
  console.log(`\nT-guardia: ${fallos.length} de ${rutas.length} rutas sin contenido inyectado.`);
  console.log("Es la mina nº1: en produccion esto no avisa nadie. NO fusionar.");
  process.exit(1);
}
console.log(`\nT-guardia: las ${rutas.length} rutas de run_worker_first sirven contenido inyectado.`);
