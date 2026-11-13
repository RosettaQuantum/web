/**
 * El PDF del informe nacional, impreso de la pagina.
 *
 * POR QUE EXISTE
 * --------------
 * El PDF de agosto salio de Chrome sin ventana imprimiendo la pagina -se ve en
 * los metadatos del archivo: `HeadlessChrome`, `Skia/PDF`- pero ese paso se hizo
 * A MANO y no quedo escrito en ninguna parte. Un entregable que depende de que
 * alguien recuerde los pasos no se puede repetir ni comprobar, y la edicion
 * siguiente lo descubre tarde.
 *
 * LO QUE COMPRUEBA, Y POR QUE NO ALCANZA CON QUE EL ARCHIVO EXISTA
 * ---------------------------------------------------------------
 * Imprimir una pagina web falla hacia el ruido: sale un PDF, pesa, abre, y
 * puede estar en blanco, con los fondos oscuros en blanco, o -el peor caso-
 * traer las cifras de la edicion ANTERIOR porque el `dist` que se imprimio es
 * viejo. Las tres fallan sin fallar.
 *
 * Asi que antes de imprimir se le pregunta a la PAGINA, que es lo que se va a
 * imprimir, si trae las cifras de la edicion que se pidio: se leen del JSON de
 * la edicion y se buscan en el texto renderizado. Si falta una, no se escribe el
 * PDF. Despues se comprueba que el binario sea un PDF de verdad y cuantas
 * paginas trae: un PDF de una pagina donde deberian ir ocho es un fallo.
 *
 * LO QUE NO CUBRE, declarado: no lee el texto DEL PDF, lee el de la pagina antes
 * de imprimir. Si Chrome imprimiera mal una pagina que esta bien, esto no lo ve;
 * para eso esta el conteo de paginas y el peso, que son burdos a proposito.
 *
 * IMPRIMIR UN BORRADOR, y por que el script lo orquesta
 * -----------------------------------------------------
 * La pagina publica la ultima edicion PUBLICADA (src/lib/informe-elegir.mjs), asi
 * que un borrador no se renderiza con solo dejarlo en la carpeta: hay que
 * apartar las publicadas, construir, imprimir y devolver todo a su lugar. Eso es
 * exactamente el tipo de baile que el mes pasado se hizo a mano y no quedo
 * escrito. Aqui va con `--borrador`, con un `finally` que restituye la carpeta y
 * reconstruye, pase lo que pase.
 *
 * El PDF que sale lleva el cartel de borrador y `noindex`, porque es la misma
 * pagina: no es un adelanto maquillado de la edicion publicada, es el borrador.
 *
 * Uso:
 *   node scripts/build-informe-pdf.mjs                     # sirve dist/ y imprime
 *   node scripts/build-informe-pdf.mjs --url https://…     # imprime un sitio vivo
 *   node scripts/build-informe-pdf.mjs --borrador ruta.json
 *   node scripts/build-informe-pdf.mjs --salida ruta.pdf
 */
import { createServer } from "node:http";
import { execFileSync } from "node:child_process";
import { copyFileSync, rmSync, renameSync } from "node:fs";
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync, mkdirSync } from "node:fs";
import { join, extname, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
// La regla de QUÉ edición se publica se importa, no se copia.
import { elegirEdicion } from "../src/lib/informe-elegir.mjs";
import { abrirChrome } from "./lib/chrome.mjs";

// `new URL(...).pathname` deja la ruta PERCENT-ENCODED, y «Rosetta Quantum»
// llega como «Rosetta%20Quantum»: un ENOENT con una ruta que se ve bien.
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(RAIZ, "dist");
const EDICIONES = join(RAIZ, "src", "data", "informe-pqc");
const RUTA_PAGINA = "/informe-pqc/";

const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css",
  ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml",
  ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".woff2": "font/woff2", ".woff": "font/woff", ".xml": "application/xml",
  ".txt": "text/plain; charset=utf-8", ".ico": "image/x-icon" };

/** Un servidor estatico sobre `dist`, sin dependencias. */
function servir(dir) {
  const srv = createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    let f = join(dir, p);
    if (p.endsWith("/")) f = join(f, "index.html");
    if (!existsSync(f) && existsSync(f + ".html")) f = f + ".html";
    if (!existsSync(f) || statSync(f).isDirectory()) { res.statusCode = 404; return res.end("404"); }
    res.setHeader("content-type", TIPOS[extname(f)] || "application/octet-stream");
    res.end(readFileSync(f));
  });
  return new Promise(r => srv.listen(0, "127.0.0.1", () => r({ srv, puerto: srv.address().port })));
}

/**
 * La edición que la página muestra. La regla NO se reescribe aquí: se importa de
 * `src/lib/informe-elegir.mjs`, que es la que usa la página.
 *
 * Tenía su propia copia -«el slug más alto»- y el 13-nov-2026 las dos reglas se
 * contradijeron en silencio: este script anunciaba «la página debería mostrar
 * 2026-11» mientras la página mostraba agosto, porque la regla de verdad elige
 * la última PUBLICADA. Dos definiciones de lo mismo ya divergieron antes en este
 * proyecto; ésta duró veinte minutos.
 */
function edicionVigente(previsualizar = null) {
  const archivos = readdirSync(EDICIONES).filter(f => /^\d{4}-\d{2}\.json$/.test(f))
    .sort().reverse();                       // de la más reciente a la más antigua
  if (!archivos.length) throw new Error(`no hay ediciones en ${EDICIONES}`);
  const ediciones = archivos.map(f => ({
    slug: f.replace(/\.json$/, ""),
    d: JSON.parse(readFileSync(join(EDICIONES, f), "utf8")),
  }));
  const { actual } = elegirEdicion(ediciones, { previsualizar });
  return { nombre: actual.slug + ".json", doc: actual.d };
}

/**
 * Las cifras que tienen que aparecer en la pagina, sacadas del JSON de la
 * edicion. Solo los titulares con valor: una hoja en `null` es «no medido» y
 * exigirla seria exigir que la pagina pinte algo que no existe.
 */
function cifrasEsperadas(doc) {
  const exigidas = [], sinValor = [];
  for (const t of doc.titulares || []) {
    if (t.v === null || t.v === undefined) { sinValor.push(t.id); continue; }
    // Se busca el numero tal como se escribe en es-CL (29.794) y tambien crudo:
    // la pagina puede formatearlo de las dos maneras y no se adivina cual.
    const n = Number(t.v);
    const formas = [String(t.v)];
    if (Number.isFinite(n) && Math.abs(n) >= 1000) formas.push(n.toLocaleString('es-CL'));
    exigidas.push({ id: t.id, formas });
  }
  return { exigidas, sinValor };
}

/**
 * «La pagina declara una edicion anterior y no comparo contra nada».
 *
 * Vive como funcion para poder ejercerla: metida dentro de `main` solo se la
 * habria visto pasar, y un chequeo que solo se ha visto pasar no se sabe si mira
 * algo.
 */
export function comparacionAusente(doc, chips) {
  if (!doc.anterior || !chips.length) return false;
  return chips.every(x => /l[ií]nea base/i.test(x));
}

/**
 * Los dos estados MEDIDOS el 13-nov-2026 sobre el HTML construido de verdad, no
 * inventados: imprimiendo el borrador con las publicadas apartadas de la carpeta,
 * los siete chips decian «linea base»; con `RQ_INFORME_PREVIEW` y las publicadas
 * en su lugar, los siete traen variacion.
 */
function autoprueba() {
  let casos = 0, fallas = 0;
  const c = (t, ok) => { casos++; if (!ok) fallas++; console.log(`  ${ok ? "ok  " : "FALLA"} ${t}`); };
  const conAnterior = { anterior: "2026-08" };
  const roto = ["línea base", "línea base", "línea base", "línea base",
                "línea base", "línea base", "línea base"];
  const sano = ["+1", "+3%", "+2%", "+1%", "sin cambio", "+15138", "+4%"];
  c("grita con los 7 chips en «linea base» (el estado medido con las publicadas apartadas)",
    comparacionAusente(conAnterior, roto) === true);
  c("se calla con los 7 chips medidos de hoy", comparacionAusente(conAnterior, sano) === false);
  c("se calla si basta UN chip con variacion (no exige que comparen todos)",
    comparacionAusente(conAnterior, [...roto.slice(1), "+4%"]) === false);
  c("se calla en la primera edicion, que no tiene con que comparar",
    comparacionAusente({ anterior: null }, roto) === false);
  c("se calla si la pagina no pinta chips (no inventa una queja sobre nada)",
    comparacionAusente(conAnterior, []) === false);
  console.log(`\n${casos} casos · ${fallas} fallas`);
  return fallas;
}

async function main(slugPrevisualizado = null) {
  const args = process.argv.slice(2);
  const leer = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const salida = resolve(leer("--salida", join(RAIZ, "informe-pqc.pdf")));
  const urlExterna = leer("--url", null);

  const { nombre, doc } = edicionVigente(slugPrevisualizado);
  const { exigidas, sinValor } = cifrasEsperadas(doc);
  console.log(`edicion que la pagina deberia mostrar: ${nombre} (numero ${doc.numero}, ` +
              `borrador ${doc.borrador})`);
  console.log(`cifras exigidas en la pagina: ${exigidas.length} · ` +
              `sin valor, no exigidas: ${sinValor.join(", ") || "ninguna"}`);

  let srv = null, base = urlExterna;
  if (!base) {
    if (!existsSync(DIST)) throw new Error(`no existe ${DIST}: corre primero \`npm run build\``);
    const s = await servir(DIST);
    srv = s.srv;
    base = `http://127.0.0.1:${s.puerto}`;
    console.log(`sirviendo dist/ en ${base}`);
  }

  const chrome = await abrirChrome({ ancho: 1280, alto: 1600 });
  try {
    const url = base.replace(/\/$/, "") + RUTA_PAGINA;
    const visto = await chrome.evaluar(url, () => ({
      titulo: document.title,
      texto: (document.body.innerText || "").replace(/\s+/g, " "),
      alto: document.body.scrollHeight,
      noindex: !!document.querySelector('meta[name="robots"][content*="noindex"]'),
      // Los chips de variación de las fichas, para saber si la página comparó
      // de verdad contra la edición anterior o si salió toda en «línea base».
      chips: [...document.querySelectorAll(".tiles .tile .delta")].map(e => e.textContent.trim()),
    }));
    console.log(`pagina: «${visto.titulo}» · ${visto.alto} px de alto · ` +
                `noindex ${visto.noindex ? "si" : "no"}`);

    const faltan = exigidas.filter(e => !e.formas.some(f => visto.texto.includes(f)));
    if (faltan.length) {
      console.error(`\nNO IMPRIMO. La pagina no muestra ${faltan.length} de las ` +
                    `${exigidas.length} cifras de ${nombre}:`);
      for (const f of faltan) console.error(`  ${f.id}: esperaba ${f.formas.join(" o ")}`);
      console.error(`\n  Lo mas probable es que \`dist/\` sea de otra edicion. ` +
                    `Corre \`npm run build\` y vuelve.`);
      process.exitCode = 1;
      return;
    }
    console.log(`las ${exigidas.length} cifras de la edicion estan en la pagina`);

    /* Y que la comparación exista, cuando tiene con qué comparar.
     *
     * Esto nació de un PDF que salió bien y salía mal: imprimiendo el borrador
     * con las publicadas apartadas de la carpeta, la página no tenía edición
     * anterior y los SIETE chips decían «línea base». El archivo pesaba, abría,
     * traía las cifras correctas — y ni una comparación. Falla hacia el ruido,
     * que es la que no se nota. */
    const sinComparar = visto.chips.filter(x => /l[ií]nea base/i.test(x)).length;
    if (comparacionAusente(doc, visto.chips)) {
      console.error(`\nNO IMPRIMO. La edicion declara anterior «${doc.anterior}» y los ` +
                    `${sinComparar} chips de variacion dicen «linea base»: la pagina no encontro ` +
                    `con que comparar.`);
      console.error(`  Para imprimir un borrador, las ediciones publicadas tienen que ` +
                    `seguir en src/data/informe-pqc/ y la eleccion va por ` +
                    `RQ_INFORME_PREVIEW (lo hace --borrador).`);
      process.exitCode = 1;
      return;
    }
    console.log(`comparacion contra «${doc.anterior || "ninguna"}»: ` +
                `${visto.chips.length - sinComparar} de ${visto.chips.length} chips con variacion`);

    const pdf = await chrome.imprimir(url);
    // Un PDF de verdad empieza con %PDF-. Y las paginas se cuentan por los
    // objetos /Type /Page, que es burdo y suficiente para distinguir «ocho
    // paginas» de «una en blanco».
    const cabecera = pdf.subarray(0, 5).toString("latin1");
    if (cabecera !== "%PDF-") throw new Error(`lo impreso no es un PDF: empieza con «${cabecera}»`);
    const paginas = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
    if (paginas < 2) throw new Error(`el PDF trae ${paginas} pagina(s): la pagina mide ` +
                                     `${visto.alto} px, asi que una sola es un fallo`);
    writeFileSync(salida, pdf);
    console.log(`\n${salida}`);
    console.log(`  ${(pdf.length / 1024 / 1024).toFixed(2)} MB · ${paginas} paginas · ` +
                `edicion ${nombre}` + (doc.borrador ? "  (BORRADOR)" : ""));
  } finally {
    await chrome.cerrar();
    if (srv) srv.close();
  }
}

/**
 * Pone el borrador en la carpeta, construye PREVISUALIZANDOLO, corre `fn`, y
 * devuelve todo a su lugar.
 *
 * La primera version apartaba las ediciones publicadas para que la pagina no
 * tuviera otra que elegir. Funcionaba, y el PDF salia SIN UNA SOLA COMPARACION:
 * con la carpeta vacia de publicadas, `anterior` quedaba en null y los siete
 * chips decian «linea base» — medido sobre el HTML construido, no supuesto. Un
 * informe cuya gracia es comparar, impreso sin comparar.
 *
 * Ahora las publicadas se quedan donde estan y la edicion se elige con
 * `RQ_INFORME_PREVIEW`, que es un parametro explicito de `elegirEdicion`. El
 * `finally` saca el borrador, comprueba que la carpeta quedo igual, y reconstruye
 * SIN la variable: dejar `dist` mostrando un borrador es la mitad de la trampa
 * que ya costo una vez.
 */
async function conElBorrador(ruta, fn) {
  const slug = (ruta.match(/(\d{4}-\d{2})\.json$/) || [])[1];
  if (!slug) throw new Error(`«${ruta}» no se llama AAAA-MM.json`);
  const doc = JSON.parse(readFileSync(ruta, "utf8"));
  if (doc.borrador !== true) {
    throw new Error(`${ruta} no dice \`borrador: true\`. Si ya esta publicada, ` +
                    `imprimela sin --borrador.`);
  }
  const antes = readdirSync(EDICIONES).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort();
  if (antes.includes(slug + ".json")) {
    throw new Error(`ya hay un ${slug}.json en src/data/informe-pqc/: no lo piso. ` +
                    `Sacalo o imprime sin --borrador.`);
  }
  const destino = join(EDICIONES, slug + ".json");
  try {
    copyFileSync(ruta, destino);
    console.log(`previsualizando ${slug} junto a ${antes.join(", ")} (para que la ` +
                `comparacion contra la anterior exista)`);
    execFileSync("npx", ["astro", "build"], {
      cwd: RAIZ, stdio: "pipe", env: { ...process.env, RQ_INFORME_PREVIEW: slug },
    });
    return await fn(slug);
  } finally {
    rmSync(destino, { force: true });
    const quedan = readdirSync(EDICIONES).filter(f => /^\d{4}-\d{2}\.json$/.test(f)).sort();
    console.log(`carpeta restituida: ${quedan.join(", ")}`);
    if (quedan.join() !== antes.join()) {
      throw new Error(`la carpeta NO quedo como estaba: esperaba ${antes.join(", ")}`);
    }
    try {
      execFileSync("npx", ["astro", "build"], { cwd: RAIZ, stdio: "pipe" });
      console.log("dist/ reconstruido con la edicion publicada");
    } catch { console.error("  OJO: no pude reconstruir dist/ — corre \`npm run build\`"); }
  }
}

if (process.argv.includes("--autoprueba")) process.exit(autoprueba() ? 1 : 0);

const elBorrador = (() => { const i = process.argv.indexOf("--borrador");
  return i >= 0 ? resolve(process.argv[i + 1]) : null; })();
const correr = elBorrador ? () => conElBorrador(elBorrador, main) : main;
correr().catch(e => { console.error(`\n${e.message}`); process.exit(1); });
