/**
 * La sección de la serie dice lo que el dato dice, y su prosa no envejece sola.
 *
 * POR QUÉ EXISTE
 * --------------
 * El 13-nov-2026 el titular de superficie publicaba el total recomputado de
 * noviembre con la bajada «mediana 41 por organización»: el 41 era de agosto,
 * porque un número metido dentro de un texto no lo recalcula nadie. G10 cerró
 * esa familia para las etiquetas de las fichas. Esta sección es el mismo riesgo
 * en su forma más larga: dos párrafos con SEIS cifras adentro.
 *
 * Así que los párrafos se arman desde el bloque `serie` de la edición, y este
 * guardia comprueba que lo rendido sea exactamente la plantilla aprobada
 * rellenada con las cifras de ESTE mes. Si alguien edita una palabra, grita; si
 * las cifras dejan de calzar, grita.
 *
 * EL TEXTO APROBADO, y son DOS documentos.
 *
 *   - los dos párrafos: `TEXTO-noviembre-2026-11-13.md`, aprobado el 13-nov-2026
 *     («Apruébalo y sigue»), sha256 d779df20b9e0cd13…
 *   - los ocho rótulos que los rodean —el nombre en el índice, el título, la
 *     entradilla, el del recuadro, las cuatro columnas, «sin índice» y la nota
 *     al pie—: `TEXTO-serie-2026-11-14.md`, aprobado el 14-nov-2026
 *     («Apruébalos»), sha256 9591e20cb7e90cb1…
 *
 * Los dos viven en el corpus privado y el repo público no puede depender de él
 * —esa asimetría ya está declarada—, así que la plantilla se copia aquí y los
 * hashes quedan nombrados para poder cotejarla a mano.
 *
 * Y LA PARTE QUE NO ES ARITMÉTICA. «Los certificados no se mueven» es una
 * afirmación, no un número: deja de ser cierta el mes en que se muevan. El
 * guardia la vigila con una condición declarada —serie no monótona y recorrido
 * ≤ 2 puntos— y, si deja de cumplirse, pide texto nuevo en vez de publicar una
 * frase que el cuadro de al lado desmiente.
 *
 * LO QUE NO CUBRE: lee el HTML construido, no la pantalla. No ve cómo se ve la
 * tabla ni si la celda «sin índice» cabe. Y no juzga si la serie SIGNIFICA algo:
 * sólo que lo escrito y lo medido coinciden.
 */
export const CONSUMIDOR = {
  quien: "sesion Q-Ready medicion",
  hace: "si la prosa de la serie deja de calzar con el dato, lleva el texto nuevo a Nicholas antes de publicar la edicion",
};
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { elegirEdicion } from "../src/lib/informe-elegir.mjs";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const EDICIONES = join(RAIZ, "src", "data", "informe-pqc");
const PAGINA = join(RAIZ, "dist", "informe-pqc", "index.html");

const MES_ES = { "01": "enero", "02": "febrero", "03": "marzo", "04": "abril",
  "05": "mayo", "06": "junio", "07": "julio", "08": "agosto", "09": "septiembre",
  "10": "octubre", "11": "noviembre", "12": "diciembre" };
const mesEs = (slug) => MES_ES[slug.slice(5, 7)] ?? slug;
const DIRECCION = { monotona_sube: "sube en cada tramo",
                    monotona_baja: "baja en cada tramo", no_monotona: "sube y baja" };

/** El recorrido de una serie de porcentajes: cuánto separa al mayor del menor. */
const recorrido = (v) => (v.length ? Math.max(...v) - Math.min(...v) : 0);

/** Los dos párrafos, armados desde el dato igual que los arma la página. */
export function parrafos(serie) {
  const ps = serie.puntos;
  const frase = ps
    .map((p) => `${p.hibrido.pct} % en ${mesEs(p.mes)}`)
    .reduce((acc, x, i, a) => (i === 0 ? `de ${x}` : i === a.length - 1 ? `${acc} y ${x}` : `${acc} a ${x}`), "");
  const dir = DIRECCION[serie.tendencias.hibrido.direccion] ?? "no se puede afirmar una dirección";
  return [
    `En el grupo de ${serie.conjunto_fijo} organizaciones medido los tres meses, ` +
    `el soporte del intercambio híbrido pasó ${frase}: ${dir}. Es el único ` +
    `indicador del índice que se mueve por decisión de las organizaciones y no ` +
    `por el calendario de un proveedor.`,
    `Los certificados no se mueven: ${ps.map((p) => `${p.certificados.pct} %`).join(", ")}. ` +
    `Ninguna autoridad certificadora pública emite certificados post-cuánticos, ` +
    `así que esta dimensión —el 40 % del peso— no la mueve nadie este año.`,
  ];
}

/**
 * ¿Sigue siendo cierto que «los certificados no se mueven»? Condición
 * declarada, no a ojo: la serie no es monótona y su recorrido no pasa de dos
 * puntos porcentuales.
 */
export function certificadosQuietos(serie) {
  const v = serie.puntos.map((p) => p.certificados.pct).filter((x) => x !== null && x !== undefined);
  return serie.tendencias.certificados.direccion !== "monotona_sube" &&
         serie.tendencias.certificados.direccion !== "monotona_baja" &&
         recorrido(v) <= 2;
}

const texto = (html) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ")
  .replace(/&#8212;|&mdash;/g, "—").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();

function edicionVigente() {
  const archivos = readdirSync(EDICIONES).filter((f) => /^\d{4}-\d{2}\.json$/.test(f)).sort().reverse();
  const ediciones = archivos.map((f) => ({ slug: f.replace(/\.json$/, ""),
    d: JSON.parse(readFileSync(join(EDICIONES, f), "utf8")) }));
  const { actual } = elegirEdicion(ediciones, { previsualizar: process.env.RQ_INFORME_PREVIEW || null });
  return { nombre: actual.slug, doc: actual.d };
}

export function revisar(html, doc) {
  const quejas = [];
  const serie = doc.serie;
  const plano = texto(html);
  if (!serie) {
    // Una edición sin serie no tiene que pintarla; lo que NO puede es pintar una
    // sección vacía ni dejar la de otra edición.
    if (/Tres mediciones, el mismo grupo/.test(plano)) {
      quejas.push("la edición no trae bloque `serie` y la página pinta la sección igual");
    }
    return { quejas, pintada: false };
  }
  if (!/Tres mediciones, el mismo grupo/.test(plano)) {
    quejas.push("la edición trae bloque `serie` y la página no pinta la sección");
    return { quejas, pintada: false };
  }
  for (const p of serie.puntos) {
    const mes = mesEs(p.mes);
    if (!plano.includes(mes)) quejas.push(`la tabla no nombra «${mes}»`);
    for (const [k, v] of [["híbrido", p.hibrido.pct], ["certificados", p.certificados.pct]]) {
      if (v !== null && !plano.includes(`${v}%`)) {
        quejas.push(`no encuentro «${v}%» (${k} de ${mes}) en la página`);
      }
    }
    if (p.qex_mediana.v === null && !/sin índice/i.test(plano)) {
      quejas.push(`«${mes}» no tiene mediana y la página no dice «sin índice»`);
    }
  }
  for (const esperado of parrafos(serie)) {
    if (!plano.includes(esperado)) {
      const cabeza = esperado.slice(0, 60);
      quejas.push(`la página no trae, palabra por palabra, el párrafo aprobado que ` +
                  `empieza «${cabeza}…»`);
    }
  }
  if (!certificadosQuietos(serie)) {
    quejas.push("el texto aprobado dice «Los certificados no se mueven» y este mes " +
                `sí se mueven (${serie.puntos.map((p) => p.certificados.pct).join(", ")}): ` +
                "hace falta texto nuevo, aprobado, antes de publicar");
  }
  return { quejas, pintada: true };
}

/**
 * Una edición con serie y la página que le corresponde, para cuando la
 * publicada no trae ninguna.
 *
 * La primera versión de esta autoprueba exigía que la edición VIVA trajera
 * serie, y salía roja cuando la publicada era agosto —que no la tiene—. Una
 * autoprueba roja por diseño enseña a mirar el rojo y seguir; ya lo había
 * corregido en check-informe-no-medido el día anterior y lo repetí aquí.
 *
 * La página sintética se arma CON LA MISMA FUNCIÓN que usa la real, así que lo
 * que se ejerce es la comparación, no la redacción. La cobertura sobre la página
 * de verdad la da la corrida normal, que es la que corre en postbuild.
 */
function banco() {
  const doc = {
    serie: {
      conjunto_fijo: 191,
      puntos: [
        { mes: "2026-08", hibrido: { pct: 65, base: 191 }, certificados: { pct: 3, base: 190 }, qex_mediana: { v: 57, base: 150 } },
        { mes: "2026-09", hibrido: { pct: 68, base: 191 }, certificados: { pct: 2, base: 191 }, qex_mediana: { v: null, base: null } },
        { mes: "2026-11", hibrido: { pct: 75, base: 191 }, certificados: { pct: 3, base: 190 }, qex_mediana: { v: 58, base: 191 } },
      ],
      tendencias: { hibrido: { puntos: 3, direccion: "monotona_sube" },
                    certificados: { puntos: 3, direccion: "no_monotona" } },
    },
  };
  const filas = doc.serie.puntos.map((p) =>
    `<tr><td>${mesEs(p.mes)}</td><td>${p.hibrido.pct}%</td>` +
    `<td>${p.certificados.pct}%</td>` +
    `<td>${p.qex_mediana.v ?? "<span>sin índice</span>"}</td></tr>`).join("");
  const html = `<h3>Tres mediciones, el mismo grupo</h3><table>${filas}</table>` +
    parrafos(doc.serie).map((x) => `<p>${x}</p>`).join("");
  return { doc, html };
}

function autoprueba(htmlReal, docReal) {
  let casos = 0, fallas = 0;
  const c = (t, ok) => { casos++; if (!ok) fallas++; console.log(`  ${ok ? "✓" : "✗"} ${t}`); };

  // La corrida de verdad, siempre: la página construida tal como está.
  c("se calla con la página construida tal como está",
    revisar(htmlReal, docReal).quejas.length === 0);

  // Y las mutaciones, sobre la edición viva si trae serie, o sobre el banco.
  const sintetico = !docReal.serie;
  const { doc, html } = sintetico ? banco() : { doc: docReal, html: htmlReal };
  if (sintetico) {
    console.log("  (la edición publicada no trae serie: las mutaciones corren " +
                "sobre una página armada con la misma función que la real)");
    c("y el banco de prueba se calla antes de mutarlo", revisar(html, doc).quejas.length === 0);
  }
  const clon = () => JSON.parse(JSON.stringify(doc));

  const movido = clon();
  movido.serie.puntos[0].hibrido.pct = doc.serie.puntos[0].hibrido.pct + 7;
  c("grita si una cifra del párrafo deja de calzar con el dato",
    revisar(html, movido).quejas.some((q) => q.includes("palabra por palabra")));

  const otra = clon();
  otra.serie.tendencias.hibrido.direccion = "monotona_baja";
  c("grita si la dirección de la tendencia cambia y la frase no",
    revisar(html, otra).quejas.some((q) => q.includes("palabra por palabra")));

  const movidos = clon();
  movidos.serie.puntos.forEach((p, i) => { p.certificados.pct = 3 + i * 6; });
  movidos.serie.tendencias.certificados.direccion = "monotona_sube";
  c("grita si los certificados se mueven y el texto sigue diciendo que no",
    revisar(html, movidos).quejas.some((q) => q.includes("texto nuevo")));

  c("grita si la edición trae serie y la página no la pinta",
    revisar(html.replace(/Tres mediciones, el mismo grupo/g, ""), doc).quejas.length > 0);

  const sin = clon();
  delete sin.serie;
  c("se calla con una edición que no trae serie (agosto)",
    revisar(html.replace(/Tres mediciones, el mismo grupo/g, ""), sin).quejas.length === 0);
  c("y grita si esa edición sin serie pinta la sección igual",
    revisar(html, sin).quejas.length > 0);

  c("«no se mueven» es cierto con 3, 2, 3", certificadosQuietos(doc.serie) === true);
  c("y falso con 3, 9, 15", certificadosQuietos(movidos.serie) === false);

  console.log(`\n${casos} casos · ${fallas} fallas`);
  return fallas;
}

function main() {
  if (!existsSync(PAGINA)) {
    console.error(`no existe ${PAGINA}: este chequeo corre despues del build`);
    process.exit(1);
  }
  const html = readFileSync(PAGINA, "utf8");
  const { nombre, doc } = edicionVigente();
  const { quejas, pintada } = revisar(html, doc);
  console.log(`serie de ${nombre}: ${doc.serie ? `${doc.serie.puntos.length} puntos sobre ` +
    `${doc.serie.conjunto_fijo} organizaciones` : "la edición no trae serie"}` +
    ` · sección ${pintada ? "pintada" : "no pintada"}`);
  for (const q of quejas) console.log(`  ✗ ${q}`);
  if (process.argv.includes("--autoprueba")) process.exit(autoprueba(html, doc) ? 1 : 0);
  if (quejas.length) process.exit(1);
  console.log("  ✓ la prosa y la tabla dicen lo que dice el dato");
}

main();
