/**
 * Una cifra sin medir se pinta «no medido», y nunca como cero, vacío o `null`.
 *
 * EL DEFECTO REAL QUE LO MOTIVA (13-nov-2026). La edición de noviembre trae
 * `titulares[4].v` en `null` —«Proveedores de core con fecha», que se revisa a
 * mano y este mes no se revisó—. La página llamaba `n.toLocaleString('es-CL')`
 * sin preguntar, así que **el build entero reventaba** con «Cannot read
 * properties of null». Y la compuerta de la máquina venía diciendo desde agosto
 * «mientras estén en null, la página tiene que pintarlas como no medido»: era
 * una promesa sin nada detrás. Nadie la ejerció porque agosto no tenía ninguna
 * cifra sin medir, así que el defecto estuvo tres meses sin tener con qué
 * aparecer.
 *
 * QUÉ COMPRUEBA
 *   1. Ninguna ficha queda con el valor vacío, ni dice «null», «NaN» o
 *      «undefined» — las tres formas de que una ausencia se cuele como texto.
 *   2. Cada titular con valor en el JSON muestra ESE número en la página.
 *   3. Cada titular sin valor muestra la marca de no medido, y NO un número:
 *      un cero en lugar de «no medido» es la ausencia disfrazada de valor, y en
 *      esta métrica además se leería como «ningún proveedor publicó fecha».
 *
 * Y SE PRUEBA POR MUTACIÓN (`--autoprueba`): sobre el HTML construido de verdad,
 * quitarle la marca tiene que hacerlo gritar. Un chequeo que sólo se ha visto
 * pasar no se sabe si mira algo.
 *
 * LO QUE NO CUBRE: lee el HTML, no la pantalla. No ve si «no medido» desborda la
 * ficha ni de qué color sale — eso sólo se atrapa mirando.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
// La regla de QUÉ edición se publica se importa, no se copia.
import { elegirEdicion } from "../src/lib/informe-elegir.mjs";

export const CONSUMIDOR = {
  quien: "sesion Q-Ready medicion",
  hace: "si una ficha no dice «no medido» donde falta la medicion, arregla el paso 7 o la pagina antes de imprimir el PDF y de publicar la edicion",
};

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDICIONES = join(RAIZ, "src", "data", "informe-pqc");
const PAGINA = join(RAIZ, "dist", "informe-pqc", "index.html");
const MARCA = "no medido";
const BASURA = ["null", "NaN", "undefined"];

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
function edicionVigente() {
  const archivos = readdirSync(EDICIONES).filter(f => /^\d{4}-\d{2}\.json$/.test(f))
    .sort().reverse();                       // de la más reciente a la más antigua
  if (!archivos.length) throw new Error(`no hay ediciones en ${EDICIONES}`);
  const ediciones = archivos.map(f => ({
    slug: f.replace(/\.json$/, ""),
    d: JSON.parse(readFileSync(join(EDICIONES, f), "utf8")),
  }));
  const { actual } = elegirEdicion(ediciones);
  return { nombre: actual.slug + ".json", doc: actual.d };
}

const texto = x => x.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").trim();

/**
 * Las fichas de UN bloque `.tiles`.
 *
 * Dos trampas, las dos pisadas al escribir esto:
 *   - `class="tile[^"]*"` también calza `class="tiles"` —el contenedor—, porque
 *     la `s` entra en el comodín. La clase se pide completa.
 *   - la página tiene DOS bloques `.tiles` y el panel de titulares es uno solo;
 *     contando los dos salían 21 fichas para 8 titulares.
 */
function fichasDe(bloque) {
  const out = [];
  const re = /<div class="tile(?: [^"]*)?">([\s\S]*?)<\/div>/g;
  let m;
  while ((m = re.exec(bloque))) {
    const b = m[1];
    const k = (b.match(/<span class="k">([\s\S]*?)<\/span>/) || [])[1] || "";
    const v = (b.match(/<span class="v[^"]*">([\s\S]*?)<\/span>/) || [])[1] || "";
    out.push({ k: texto(k), v: texto(v), crudo: b });
  }
  return out;
}

/**
 * Las fichas de los titulares, emparejadas POR SU ETIQUETA y no por su posición
 * ni por el bloque que las contiene.
 *
 * Primero intenté acotar el bloque `.tiles` con una expresión regular y salió
 * mal dos veces: `class="tile[^"]*"` calzaba también el contenedor `tiles`, y
 * cerrar el bloque en `</div></div>` dejaba fuera la última ficha. Emparejar
 * por etiqueta no necesita saber dónde empieza ni termina el panel, y si una
 * etiqueta no aparece se dice cuál, en vez de comparar en silencio contra otra.
 */
function fichas(html, doc) {
  const todas = fichasDe(html);
  const etiqueta = f => f.k.replace(/\s*\*$/, "").trim();
  const out = [];
  for (const t of doc.titulares || []) {
    const f = todas.find(x => etiqueta(x) === (t.k || "").trim());
    out.push({ titular: t, ficha: f || null });
  }
  return { emparejadas: out, total: todas.length };
}

function revisar(html, doc) {
  const quejas = [];
  const { emparejadas, total } = fichas(html, doc);
  const fs_ = emparejadas.map(e => e.ficha).filter(Boolean);
  for (const { titular: t, ficha: f } of emparejadas) {
    if (!f) {
      quejas.push(`no encuentro la ficha del titular «${t.id}» («${t.k}»)`);
      continue;
    }
    if (!f.v) { quejas.push(`la ficha «${f.k}» no muestra ningún valor`); continue; }
    for (const bas of BASURA) {
      if (f.v.includes(bas)) quejas.push(`la ficha «${f.k}» muestra «${bas}» como valor`);
    }
    const sinMedir = t.v === null || t.v === undefined;
    if (sinMedir) {
      if (!f.v.toLowerCase().includes(MARCA)) {
        quejas.push(`«${t.id}» no está medido y la ficha muestra «${f.v}» en vez de «${MARCA}»`);
      }
      if (/\d/.test(f.v)) {
        quejas.push(`«${t.id}» no está medido y la ficha muestra un número: «${f.v}»`);
      }
    } else {
      const n = Number(t.v);
      const formas = [String(t.v)];
      if (Number.isFinite(n) && Math.abs(n) >= 1000) formas.push(n.toLocaleString("es-CL"));
      if (!formas.some(x => f.v.includes(x))) {
        quejas.push(`«${t.id}» vale ${formas.join(" o ")} y la ficha muestra «${f.v}»`);
      }
    }
  }
  return { quejas, fichas: fs_, total };
}

function main() {
  if (!existsSync(PAGINA)) {
    console.error(`no existe ${PAGINA}: este chequeo corre despues del build`);
    process.exit(1);
  }
  const html = readFileSync(PAGINA, "utf8");
  const { nombre, doc } = edicionVigente();
  const auto = process.argv.includes("--autoprueba");

  const { quejas, fichas: fs_, total } = revisar(html, doc);
  const sinMedir = (doc.titulares || []).filter(t => t.v === null || t.v === undefined);
  console.log(`informe ${nombre} · ${fs_.length} de ${(doc.titulares||[]).length} titulares emparejados (${total} fichas en la página) · ` +
              `${sinMedir.length} sin medir (${sinMedir.map(t => t.id).join(", ") || "ninguna"})`);
  for (const q of quejas) console.log(`  ✗ ${q}`);
  if (!quejas.length) console.log(`  ✓ ninguna ficha vacía, con basura, ni con un número ` +
                                  `donde va «${MARCA}»`);

  if (!auto) {
    if (quejas.length) process.exit(1);
    if (!sinMedir.length) {
      console.log(`  (esta edición no tiene cifras sin medir, así que la regla 3 no ` +
                  `se ejerció: no es lo mismo que pasar)`);
    }
    return;
  }

  // --- Autoprueba: grito y silencio, sobre el HTML construido de verdad ----
  //
  // Los casos de la regla 3 NO dependen de que la edicion viva tenga un hueco.
  // La primera version si dependia, y salia roja cuando la publicada era agosto
  // -que no tiene ninguna cifra sin medir-: una autoprueba roja por diseño
  // enseña a mirar el rojo y seguir. Aca el hueco se fabrica sobre el documento
  // real, que es lo que de verdad varia entre ediciones; el HTML sigue siendo el
  // construido, no uno inventado.
  let casos = 0, fallas = 0;
  const c = (t, ok) => { casos++; if (!ok) fallas++; console.log(`  ${ok ? "✓" : "✗"} ${t}`); };
  console.log("\nautoprueba:");
  c("se calla con la página construida tal como está", quejas.length === 0);

  const conValor = (doc.titulares || []).find(t => t.v !== null && t.v !== undefined);
  if (!conValor) throw new Error("la edicion no trae ningun titular con valor: no hay con que probar");
  const fichaDe = t => fs_.find(x => x.k.replace(/\s*\*$/, "").trim() === (t.k || "").trim());

  // REGLA 3, el defecto que importa: el documento dice «sin medir» y la pagina
  // muestra un numero. Es el caso que el 13-nov hacia reventar el build; con la
  // pagina arreglada y el dato en null, lo correcto es que grite.
  const docNull = JSON.parse(JSON.stringify(doc));
  docNull.titulares.find(t => t.id === conValor.id).v = null;
  const q3 = revisar(html, docNull).quejas;
  c(`grita si «${conValor.id}» no está medido y la ficha muestra su número: ` +
    `${q3.find(x => x.includes("un número")) || "NO GRITO"}`,
    q3.some(x => x.includes("un número")));

  // Y el silencio de esa misma regla: con la marca puesta, se calla. Si gritara
  // tambien aqui, no estaria mirando la marca sino cualquier diferencia.
  const f = fichaDe(conValor);
  const conMarca = f ? html.replace(f.crudo, f.crudo.replace(
    `<span class="v">${f.v}</span>`, `<span class="v sin-medir">${MARCA}</span>`)) : html;
  const q3b = revisar(conMarca, docNull).quejas;
  c(`y se calla cuando la ficha dice «${MARCA}»: ${q3b[0] || "sin quejas"}`,
    q3b.length === 0);

  // MUTACION sobre la marca: quitarla tiene que volver a gritar.
  const sinMarca = conMarca.replace(new RegExp(MARCA, "i"), "");
  c("grita si se le quita la marca a esa misma ficha",
    revisar(sinMarca, docNull).quejas.length > 0);

  // REGLA 2: una cifra medida que la pagina deja de mostrar.
  const roto = f ? html.replace(f.crudo, f.crudo.replace(f.v, "")) : html;
  c(`grita si «${conValor.id}» deja de mostrar su número`,
    revisar(roto, doc).quejas.length > 0);

  // REGLA 1: basura colada como valor.
  const basura = f ? html.replace(f.crudo, f.crudo.replace(f.v, "null")) : html;
  c("grita si una ficha muestra «null» como valor",
    revisar(basura, doc).quejas.some(x => x.includes("«null»")));

  // Y el caso de la edicion viva, informado y no afirmado.
  if (!sinMedir.length) {
    console.log(`  (la edición publicada no trae cifras sin medir; los casos de ` +
                `arriba fabrican el hueco sobre el documento, así que la regla 3 ` +
                `sí queda ejercida)`);
  }

  console.log(`\n${casos} casos · ${fallas} fallas`);
  process.exit(fallas ? 1 : 0);
}

main();
