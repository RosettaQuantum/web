/**
 * El panel «Banco tipo» muestra las cifras de ESTA edición, no las del mes pasado.
 *
 * POR QUÉ EXISTE
 * --------------
 * Medido el 16-nov-2026. El panel se presenta así:
 *
 *   «El panel siguiente es una organización tipo del sector banca, construida
 *    con las medianas reales de las medidas en esta edición.»
 *   «Banco tipo · perfil de exposición — medianas reales · n = 12»
 *
 * y SEIS de sus siete cifras eran literales escritos en el `.astro`. Sólo el
 * QEX salía del dato. Contra noviembre: 76 hosts contra 212 medidos, máximo del
 * sector 378 contra 1403, profundos 14 contra 36, no productivos 4 contra 6,
 * infra 2 contra 3, y «6/12» cuando la vertical trae 17 organizaciones.
 *
 * Eran ciertas en agosto. Es la tercera vez de la misma familia —«mediana 41» en
 * una etiqueta, «mediana 40» en el recuadro de verificación, y esto—: un número
 * escrito a mano al lado de un archivo que se recalcula cada mes. La diferencia
 * aquí es DÓNDE estaba: en la única sección escrita para quien compra, y el 76
 * contra 212 enseña un tercio de la superficie real, en la dirección de hacer el
 * problema más chico.
 *
 * Ahora las siete salen del bloque `vertical_tipo` que deriva el paso 7, y este
 * guardia comprueba que lo rendido sea exactamente eso.
 *
 * LO QUE NO SE PUEDE DERIVAR, y por eso se exige que salga «no medido»:
 * `proveedores_sin_fecha`. Nunca se midió qué proveedores usa una organización
 * —el paso 5c mide 11 fichas de catálogo, no quién usa cuál—, así que viaja en
 * null. El «3» que decía la tile no salía de ningún dato. Una clave que falta no
 * es un cero.
 *
 * LA EDICIÓN SIN EL BLOQUE. Agosto está publicada y su JSON no se toca, así que
 * no trae `vertical_tipo` y el panel cae a los literales, que para ESA edición
 * son sus propias medianas. Este guardia lo acepta y lo dice: con una edición
 * sin el bloque no afirma nada sobre el panel, igual que G5 con la fija.
 *
 * LO QUE NO CUBRE: no mira si las medianas están bien calculadas —eso es G1 en
 * el corpus—, sólo que la página muestre las que la edición trae. Y no mira el
 * resto del panel: la frase de arriba y los rótulos de las tiles son texto
 * aprobado y los vigila `check-grep` por otro lado.
 */
export const CONSUMIDOR = {
  quien: "sesion Q-Ready medicion",
  hace: "si el panel deja de calzar con `vertical_tipo`, arregla la plantilla de la pagina antes de imprimir el PDF; si la edicion no trae el bloque, el panel cae a los literales de agosto y eso se declara, no se aprueba",
};
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { elegirEdicion } from "../src/lib/informe-elegir.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDICIONES = join(RAIZ, "src", "data", "informe-pqc");
const PAGINA = join(RAIZ, "dist", "informe-pqc", "index.html");
const SIN_MEDIR = "no medido";

const texto = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
  .replace(/\s+/g, " ").trim();

const esCL = (n) => n.toLocaleString("es-CL");

/**
 * El trozo de HTML del panel, o null si no está.
 *
 * Contando la profundidad de `div`, no buscando el primer `</div>`: la primera
 * versión de esto cortaba el panel después de la primera tile, así que el
 * guardia pasaba por no ver las otras seis cifras. Un recorte silencioso se lee
 * igual que un panel correcto, y su propio caso de silencio lo delató.
 */
export function panelDe(html) {
  const i = html.indexOf("Banco tipo");
  if (i < 0) return null;
  // desde el título hacia adelante: el `meta` con la base viene después, y las
  // tiles después de él. Dos versiones anteriores de esto cortaban antes de las
  // tiles y el guardia pasaba sin ver seis de las siete cifras — su propio caso
  // de silencio lo delató las dos veces.
  const t = html.indexOf('class="tiles"', i);
  if (t < 0) return null;
  const abre = html.lastIndexOf("<div", t);
  let d = 0;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = abre;
  for (let m; (m = re.exec(html)); ) {
    d += m[0] === "</div>" ? -1 : 1;
    if (d === 0) return html.slice(i, m.index + m[0].length);
  }
  return html.slice(i);
}

/**
 * Qué tiene que decir el panel para una edición con bloque.
 * Devuelve [{que, espera}] — `espera` es la cadena que debe aparecer.
 */
export function esperado(vt) {
  return [
    { que: "la base del panel", espera: `n = ${vt.n}` },
    { que: "hosts descubiertos", espera: esCL(vt.hostnames) },
    { que: "máximo del sector", espera: esCL(vt.hostnames_max) },
    { que: "subdominios profundos", espera: esCL(vt.profundos) },
    { que: "ambientes no productivos", espera: esCL(vt.no_productivo) },
    { que: "infra sensible", espera: esCL(vt.infra_expuesta) },
    { que: "posición en su sector", espera: `${vt.posicion}/${vt.n}` },
    { que: "proveedores sin fecha",
      espera: vt.proveedores_sin_fecha === null || vt.proveedores_sin_fecha === undefined
        ? SIN_MEDIR : esCL(vt.proveedores_sin_fecha) },
  ];
}

/** [problemas, lineas] */
export function revisar(html, doc) {
  const vt = doc.vertical_tipo;
  const panel = panelDe(html);
  if (!panel) return [["no encuentro el panel «Banco tipo» en la página"], []];
  const t = texto(panel);
  if (!vt) {
    return [[], [`la edición ${doc.edicion ?? ""} no trae \`vertical_tipo\`: el panel ` +
                 `cae a los literales y este guardia NO afirma nada sobre él.`]];
  }
  const problemas = [], lineas = [];
  for (const { que, espera } of esperado(vt)) {
    if (t.includes(espera)) lineas.push(`  ✓ ${que}: «${espera}»`);
    else problemas.push(`el panel no dice ${que} = «${espera}» (lo que trae la edición)`);
  }
  // Y lo que NO puede quedar: los literales de agosto dentro de una edición que
  // sí trae el bloque. Un 76 que sobreviva al lado de un 212 es el defecto.
  const VIEJOS = ["n = 12", "6/12"];
  for (const v of VIEJOS) {
    if (t.includes(v) && !esperado(vt).some((e) => e.espera === v)) {
      problemas.push(`el panel todavía trae el literal de agosto «${v}»`);
    }
  }
  return [problemas, lineas];
}

function edicionVigente() {
  const archivos = readdirSync(EDICIONES).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().reverse();
  const ediciones = archivos.map((f) => ({ slug: f.replace(/\.json$/, ""),
    d: JSON.parse(readFileSync(join(EDICIONES, f), "utf8")) }));
  const { actual } = elegirEdicion(ediciones, { previsualizar: process.env.RQ_INFORME_PREVIEW || null });
  // El DOCUMENTO, no el envoltorio: la primera version pasaba `{slug, d}` a
  // `revisar`, que no encontraba `vertical_tipo` y declaraba el hueco para
  // TODA edicion. Un guardia que siempre se declara saltado no vigila nada.
  return { nombre: actual.slug, doc: actual.d };
}

/** Una página sintética, armada con las MISMAS cadenas que la real. */
function banco(vt) {
  const e = esperado(vt);
  const tile = (k, v, sub) =>
    `<div class="tile"><span class="k">${k}</span><span class="v">${v}</span><span class="sub">${sub}</span></div>`;
  return `<div class="panel"><div class="panel-h"><h3>Banco tipo · perfil de exposición</h3>` +
    `<span class="meta">medianas reales · ${e[0].espera}</span></div><div class="tiles">` +
    tile("Hosts descubiertos", e[1].espera, `máximo del sector: ${e[2].espera}`) +
    tile("Subdominios profundos", e[3].espera, "sin dueño identificable") +
    tile("Ambientes no productivos", e[4].espera, "con certificado público emitido") +
    tile("Infra sensible publicada", e[5].espera, "VPN, admin o webmail") +
    tile("Posición en su sector", e[6].espera, "mediana exacta de banca") +
    tile("Proveedores sin fecha", e[7].espera, "definen su ruta crítica") +
    `</div></div>`;
}

function autoprueba() {
  let casos = 0, fallas = 0;
  const c = (nombre, cond, detalle) => {
    casos++; if (!cond) fallas++;
    console.log(`  ${cond ? "ok  " : "FALLA"} ${nombre}`);
    if (!cond && detalle) for (const d of detalle) console.log(`        ${d}`);
  };
  const vt = { id: "banca", n: 15, n_indice: 17, qex: 56, hostnames: 212,
               hostnames_max: 1403, profundos: 36, no_productivo: 6,
               infra_expuesta: 3, posicion: 8, proveedores_sin_fecha: null };
  const doc = { edicion: "2026-11", vertical_tipo: vt };

  const bueno = banco(vt);
  c("SILENCIO · el panel que dice lo que trae la edición pasa",
    revisar(bueno, doc)[0].length === 0, revisar(bueno, doc)[0]);

  // GRITO 1 · el defecto real, con sus números reales
  const agosto = bueno.replace(">212<", ">76<").replace("1.403", "378")
    .replace(">36<", ">14<").replace(">6<", ">4<").replace(">3<", ">2<")
    .replace("n = 15", "n = 12").replace("8/15", "6/12");
  const p1 = revisar(agosto, doc)[0];
  c(`GRITO · los literales de agosto en una edición de noviembre (${p1.length} problemas)`,
    p1.length >= 6);
  c("  y nombra la cifra que la edición trae",
    p1.some((x) => x.includes("212")) && p1.some((x) => x.includes("n = 15")));

  // GRITO 2 · una sola cifra movida
  c("GRITO · una sola cifra que no calza",
    revisar(bueno.replace(">212<", ">213<"), doc)[0].length === 1);

  // GRITO 3 · el null convertido en numero
  const cero = bueno.replace(`>${SIN_MEDIR}<`, ">0<");
  c("GRITO · «no medido» publicado como 0",
    revisar(cero, doc)[0].some((x) => x.includes(SIN_MEDIR)));
  c("SILENCIO · con la cifra medida, el mismo lugar no grita",
    revisar(banco({ ...vt, proveedores_sin_fecha: 10 }),
            { ...doc, vertical_tipo: { ...vt, proveedores_sin_fecha: 10 } })[0].length === 0);

  // la edicion sin el bloque: declara el hueco, no aprueba
  const [pb, lb] = revisar(bueno, { edicion: "2026-08" });
  c("SALTADO · sin el bloque no afirma nada sobre el panel",
    pb.length === 0 && lb.some((l) => l.includes("NO afirma")));

  // sin panel en la pagina
  c("GRITO · la página sin el panel",
    revisar("<p>otra cosa</p>", doc)[0].length === 1);

  // el formateo de miles, que es de donde salio «1.403»
  c("las cifras de cuatro digitos van con punto de miles",
    esperado(vt)[2].espera === "1.403");

  console.log(`\n  ${casos} casos · ${fallas} fallas`);
  return fallas;
}

function main() {
  if (process.argv.includes("--autoprueba")) process.exit(autoprueba() ? 1 : 0);
  if (!existsSync(PAGINA)) {
    console.log("check-informe-panel: no hay dist/informe-pqc/index.html, nada que revisar");
    return;
  }
  if (autoprueba()) {
    console.error("check-informe-panel: la autoprueba falla; no reviso la página.");
    process.exit(1);
  }
  const { nombre, doc } = edicionVigente();
  const [problemas, lineas] = revisar(readFileSync(PAGINA, "utf8"), doc);
  console.log(`panel «Banco tipo» de ${nombre}:`);
  for (const l of lineas) console.log(l);
  for (const p of problemas) console.error(`  ✗ ${p}`);
  if (problemas.length) process.exit(1);
  // SALTADO, no «paso». Decir el visto bueno cuando no se comprobo nada es el
  // defecto que esta casa ya pago: verde no es lo mismo que cubierto.
  if (!doc.vertical_tipo) {
    console.log(`  SALTADO · ${nombre} no trae \`vertical_tipo\`, asi que no afirmo ` +
                `nada sobre sus siete cifras. No es un visto bueno.`);
    return;
  }
  console.log("  ✓ el panel muestra las cifras de esta edición");
}

main();
