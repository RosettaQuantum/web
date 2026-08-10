#!/usr/bin/env node
/**
 * Tests del motor de graficos.
 *
 * La mitad que importa no es "el SVG se genera": es que **los guardias griten**.
 * Un `throw` que nunca se prueba con el caso que debe atrapar es indistinguible de
 * un `throw` que alguien borro. Cada regla del modulo tiene aca su caso positivo
 * (tiene que lanzar) y su caso negativo (no puede lanzar con datos buenos), porque
 * un falso positivo retiene trabajo bueno y eso es peor que dejar pasar un caso.
 *
 * Uso: node scripts/test-charts.mjs
 */

import { escala, marcas, dominio, lineas, barras, barrasRango, cifra, grafico, num, numCorto, margenY, esc } from "../src/lib/charts.js";

let ok = 0, mal = 0;
const fallos = [];
function prueba(nombre, fn) {
  try { fn(); ok++; console.log(`  ok    ${nombre}`); }
  catch (e) { mal++; fallos.push(`${nombre}: ${e.message}`); console.log(`  FALLA ${nombre}\n          ${e.message}`); }
}
function igual(a, b, msg) { if (a !== b) throw new Error(`${msg || ""} esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); }
function cierto(c, msg) { if (!c) throw new Error(msg || "no se cumplio"); }
/** El caso positivo: la funcion TIENE que lanzar, y el mensaje tiene que explicar por que. */
function grita(fn, fragmento) {
  let lanzo = null;
  try { fn(); } catch (e) { lanzo = e; }
  if (!lanzo) throw new Error("no lanzo, y tenia que lanzar");
  if (fragmento && !lanzo.message.toLowerCase().includes(fragmento.toLowerCase()))
    throw new Error(`lanzo pero el mensaje no explica por que: "${lanzo.message}" (esperaba mencionar "${fragmento}")`);
}

const BASE = { titular: "El campeón clásico gana en las tres escalas medidas.", cuerpo: "<svg/>", fuente: "Ledger RQ", n: 174 };

console.log("\n— escalas y marcas —");
prueba("escala mapea extremos", () => {
  const s = escala([0, 10], [0, 100]);
  igual(s(0), 0); igual(s(10), 100); igual(s(5), 50);
});
prueba("escala no divide por cero con dominio plano", () => {
  const s = escala([5, 5], [0, 100]);
  cierto(Number.isFinite(s(5)), "dio un valor no finito");
});
prueba("marcas son numeros redondos", () => {
  const m = marcas([0, 97]);
  cierto(m.length >= 3, "muy pocas marcas: " + m.join(","));
  cierto(m.every(v => Number.isFinite(v)), "hay marcas no finitas");
  igual(m[0], 0, "la primera marca");
});
prueba("marcas aguantan un dominio de un solo punto", () => {
  igual(marcas([7, 7]).length, 1);
});

console.log("\n— linea multiserie —");
prueba("dibuja una linea por serie y la etiqueta AL FINAL", () => {
  const svg = lineas({
    categorias: ["2019", "2020", "2021"],
    series: [{ nombre: "cuántico", valores: [1, 2, 3] }, { nombre: "clásico", valores: [3, 3, 3] }],
  });
  igual((svg.match(/<polyline/g) || []).length, 2, "polilineas");
  cierto(svg.includes(">cuántico<"), "falta la etiqueta de serie al final de la linea");
  cierto(svg.includes(">clásico<"), "falta la segunda etiqueta");
  cierto(!/<(g class="leyenda"|legend)/.test(svg), "no deberia haber leyenda: la etiqueta va en la linea");
});
prueba("tolera huecos (null) sin romper la polilinea", () => {
  const svg = lineas({ categorias: ["a", "b", "c"], series: [{ nombre: "s", valores: [1, null, 3] }] });
  cierto(svg.includes("<polyline"), "no dibujo la linea");
  cierto(!svg.includes("NaN"), "se colo un NaN en el path");
});
prueba("marca el tramo estimado y lo dice con la palabra", () => {
  const svg = lineas({
    categorias: ["2024", "2025", "2030"], estimadoDesde: "2030",
    series: [{ nombre: "s", valores: [1, 2, 3] }],
  });
  cierto(svg.includes("estimado"), "no marco el tramo estimado");
  cierto(svg.includes("<rect"), "no dibujo la banda del tramo estimado");
});
prueba("la anotacion de delta afirma la comparacion", () => {
  const svg = lineas({
    categorias: ["2023", "2024"], series: [{ nombre: "s", valores: [10, 29] }],
    anotacion: { desde: 0, hasta: 1, serie: 0, texto: "+19 pp" },
  });
  cierto(svg.includes("+19 pp"), "no dibujo la anotacion");
});
prueba("GRITA si una serie no tiene nombre", () =>
  grita(() => lineas({ categorias: ["a"], series: [{ valores: [1] }] }), "nombre"));
prueba("GRITA si una serie tiene menos valores que categorias", () =>
  grita(() => lineas({ categorias: ["a", "b", "c"], series: [{ nombre: "s", valores: [1, 2] }] }), "categorias"));
prueba("GRITA si no hay ningun valor", () =>
  grita(() => lineas({ categorias: ["a"], series: [{ nombre: "s", valores: [null] }] }), "valores"));
prueba("NO grita con datos buenos", () => {
  lineas({ categorias: ["a", "b"], series: [{ nombre: "s", valores: [1, 2] }] });
});

console.log("\n— el eje no corta etiquetas (defecto visto a ojo el 9-ago) —");
// Caso REAL: eje logaritmico de 10 a 1.000.000.000. Con el margen fijo de 52 px el
// eje imprimia "000.000" — el numero recortado por la izquierda. El test se escribe
// contra ese grafico, no contra un ejemplo comodo.
prueba("el margen crece con la etiqueta mas larga", () => {
  const angosto = margenY(["10", "100"]);
  const ancho = margenY(["1.000.000.000"]);
  cierto(ancho > angosto, `no crecio: ${angosto} vs ${ancho}`);
  cierto(ancho >= "1.000.000.000".length * 7, "el margen no alcanza para la etiqueta");
});
prueba("un eje log de 9 ordenes de magnitud no recorta", () => {
  const svg = lineas({
    categorias: ["2012", "2025"], log: true,
    series: [{ nombre: "requerido", valores: [1e9, 1e6] }, { nombre: "disponible", valores: [10, 1180] }],
  });
  // ninguna etiqueta del eje puede empezar con separador de miles: eso es un recorte
  const etiquetas = [...svg.matchAll(/text-anchor="end"[^>]*>([^<]+)</g)].map(m => m[1]);
  cierto(etiquetas.length > 0, "el eje no imprimio ninguna etiqueta");
  const recortadas = etiquetas.filter(e => /^[.,]/.test(e) || /^0{3}/.test(e));
  cierto(recortadas.length === 0, `etiquetas recortadas: ${recortadas.join(", ")} (todas: ${etiquetas.join(" | ")})`);
  // y el texto tiene que caber: x del texto = margen - 8, y el margen sale del calculo
  const xs = [...svg.matchAll(/<text x="([\d.]+)"[^>]*text-anchor="end"/g)].map(m => Number(m[1]));
  cierto(xs.every(x => x > 30), `alguna etiqueta arranca demasiado a la izquierda: ${xs.join(",")}`);
});
prueba("numCorto abrevia las magnitudes grandes", () => {
  igual(numCorto(1e9), "1 MM");
  igual(numCorto(2.5e6), "2,5 M");
  igual(numCorto(20000), "20 k");
  igual(numCorto(54), "54");
});

console.log("\n— rangos —");
prueba("una barra de rango se dibuja de minimo a maximo", () => {
  const svg = barrasRango({ items: [{ etiqueta: "Química", rango: [450, 800] }] });
  cierto(svg.includes("450–800"), "no imprimio el rango con guion largo");
  cierto((svg.match(/<line/g) || []).length >= 2, "faltan los topes del rango");
});
prueba("un valor medido se distingue de un rango", () => {
  const conRango = barrasRango({ items: [{ etiqueta: "a", rango: [1, 2] }] });
  const medido = barrasRango({ items: [{ etiqueta: "a", valor: 2 }] });
  cierto(conRango !== medido, "un rango y un punto se dibujan igual");
});
prueba("GRITA si no hay items", () => grita(() => barrasRango({ items: [] }), "items"));
prueba("GRITA si ningun item trae valor ni rango", () =>
  grita(() => barrasRango({ items: [{ etiqueta: "a" }] }), "valor"));

console.log("\n— ficha de cifra —");
prueba("una cifra medida se imprime sola", () => {
  cierto(cifra({ valor: 54, etiqueta: "corridas selladas" }).includes(">54<"), "no imprimio el valor");
});
prueba("una cifra con rango imprime la banda", () => {
  cierto(cifra({ rango: [1.3, 2.7], etiqueta: "valor", dec: 1, estimado: true }).includes("1,3–2,7"),
    "no imprimio la banda con coma decimal");
});
prueba("GRITA si una cifra se declara estimada y no trae rango", () =>
  grita(() => cifra({ valor: 54, etiqueta: "x", estimado: true }), "rango"));
prueba("GRITA si falta la etiqueta", () => grita(() => cifra({ valor: 1 }), "etiqueta"));

console.log("\n— el envoltorio falla cerrado —");
prueba("GRITA si el grafico no declara fuente", () =>
  grita(() => grafico({ ...BASE, fuente: undefined }), "procedencia"));
prueba("GRITA si el grafico no declara n", () =>
  grita(() => grafico({ ...BASE, n: undefined }), "denominador"));
prueba("GRITA si el titular rotula el tema en vez de afirmar", () =>
  grita(() => grafico({ ...BASE, titular: "Resultados de la corrida" }), "afirmar"));
prueba("GRITA si no hay cuerpo", () => grita(() => grafico({ ...BASE, cuerpo: null }), "cuerpo"));
prueba("NO grita con un grafico completo, y publica su procedencia", () => {
  const h = grafico({ ...BASE, numero: 3, subtitulo: "percentiles", notas: ["Presupuesto igual en ambos lados."], fecha: "2026-08-09", hash: "dee7e76b5f19096e" });
  cierto(h.includes("Fuente: Ledger RQ"), "no publico la fuente");
  cierto(h.includes("n = 174"), "no publico el denominador");
  cierto(h.includes("dee7e76b5f19"), "no publico el hash");
  cierto(h.includes("<ol class=\"rq-notas\">"), "no publico las notas");
});
prueba("n acepta una explicacion cuando no aplica un numero", () => {
  cierto(grafico({ ...BASE, n: "serie completa" }).includes("n = serie completa"), "rechazo un n explicado");
});

prueba("la linea de umbral entra en el eje aunque quede fuera de los datos", () => {
  // El caso real: los rho del coarse-graining llegan a 0,54 y el umbral
  // pre-registrado es 0,90. Si el umbral no entra al dominio, la linea que dice si
  // se cumplio o no queda pegada al borde o no se ve.
  const svg = lineas({ categorias: ["2", "4"], series: [{ nombre: "KRAS", valores: [0.54, 0.47] }],
                       referencia: { valor: 0.9, etiqueta: "pre-registered threshold" } });
  cierto(svg.includes("pre-registered threshold"), "no dibujo la etiqueta del umbral");
  cierto(svg.includes("stroke-dasharray"), "el umbral no se distingue de una serie");
  const marcasEje = [...svg.matchAll(/text-anchor="end" font-size="11"[^>]*>([^<]+)</g)].map(x => x[1]);
  cierto(marcasEje.some(m => parseFloat(m.replace(",", ".")) >= 0.9),
    `el eje no llega al umbral: ${marcasEje.join(" ")}`);
  // y la linea no puede quedar pegada al borde superior, donde su etiqueta se recorta
  const yRef = Number(svg.match(/stroke-dasharray="5 3"\/>/) ? svg.match(/<line x1="[\d.]+" y1="([\d.]+)"[^>]*stroke-dasharray/)[1] : NaN);
  cierto(yRef > 14, `la linea de umbral quedo a ${yRef}px del techo: su etiqueta se recorta`);
});

prueba("dominio estira el eje hasta la siguiente marca", () => {
  // Con [0, 0,95] marcas() se queda en 0,75 y el techo del grafico queda sin
  // etiquetar: lo alto del grafico flota sin referencia.
  const [lo, hi, vals] = dominio([0, 0.95]);
  igual(lo, 0);
  cierto(hi >= 0.95, `el techo quedo en ${hi}`);
  cierto(vals[vals.length - 1] >= 0.95, `la ultima marca quedo en ${vals[vals.length - 1]}`);
});
prueba("dominio no toca un rango que ya termina en marca", () => {
  const [, hi, vals] = dominio([0, 100]);
  igual(hi, 100); igual(vals[vals.length - 1], 100);
});

prueba("dos lineas que terminan juntas no dejan los rotulos encima", () => {
  // El caso real: en el coarse-graining "c-Myc" y "Cardiac myosin" terminaban a
  // 0,7882 y 0,7846 y salieron impresos uno sobre otro, ilegibles, en el entregable.
  const svg = lineas({ categorias: ["2", "4"], series: [
    { nombre: "c-Myc", valores: [0.51, 0.7882] },
    { nombre: "Cardiac myosin", valores: [0.88, 0.7846] }] });
  const ys = [...svg.matchAll(/<text x="[\d.]+" y="([\d.]+)" font-size="12"/g)].map(m => Number(m[1]));
  igual(ys.length, 2);
  cierto(Math.abs(ys[0] - ys[1]) >= 12, `los rotulos quedaron a ${Math.abs(ys[0] - ys[1]).toFixed(1)}px`);
});

console.log("\n— barras verticales —");
const BARRAS = { categorias: ["KRAS", "ABL1", "MYC"], series: [{ nombre: "p", valores: [0.52, 0.41, 0.40] }] };
prueba("barras dibuja una barra por categoria", () => {
  const svg = barras(BARRAS);
  igual((svg.match(/<rect /g) || []).length, 3);
});
prueba("barras exige categorias", () => grita(() => barras({ series: BARRAS.series }), "categorias"));
prueba("barras exige series", () => grita(() => barras({ categorias: ["a"] }), "series"));
prueba("barras exige que una serie tenga nombre", () =>
  grita(() => barras({ categorias: ["a"], series: [{ valores: [1] }] }), "nombre"));
prueba("barras grita si la serie no calza con las categorias", () =>
  grita(() => barras({ categorias: ["a", "b"], series: [{ nombre: "s", valores: [1] }] }), "categorias"));
prueba("barras grita si ninguna serie trae valores", () =>
  grita(() => barras({ categorias: ["a"], series: [{ nombre: "s", valores: [null] }] }), "valores"));
// El caso que importa del reporte: los cuatro rho son NEGATIVOS. Una barra negativa
// dibujada hacia arriba miente sobre el signo, que es justo el hallazgo.
prueba("una barra negativa se dibuja bajo el cero, con su linea de cero", () => {
  const svg = barras({ categorias: ["KRAS"], series: [{ nombre: "rho", valores: [-0.62] }] });
  const rect = svg.match(/<rect x="[\d.]+" y="([\d.]+)" width="[\d.]+" height="([\d.]+)"/);
  cierto(rect && Number(rect[2]) > 0, "la barra negativa quedo sin alto");
  cierto((svg.match(/stroke-width="1"\/>/g) || []).length >= 1, "no dibujo la linea del cero");
});
prueba("la linea de referencia sale con su etiqueta", () => {
  const svg = barras({ ...BARRAS, referencia: { valor: 0.05, etiqueta: "significance threshold" } });
  cierto(svg.includes("stroke-dasharray"), "la referencia no es punteada");
  cierto(svg.includes("significance threshold"), "la referencia no trae etiqueta");
});
prueba("con una sola serie no dibuja leyenda; con dos, si", () => {
  cierto(!barras(BARRAS).includes("rq-leyenda") && (barras(BARRAS).match(/<rect /g) || []).length === 3,
    "una serie sola dibujo de mas");
  const dos = barras({ categorias: ["a"], series: [{ nombre: "uno", valores: [1] }, { nombre: "dos", valores: [2] }] });
  cierto(dos.includes("uno") && dos.includes("dos"), "no rotulo las dos series");
});
prueba("barras escapa las etiquetas", () =>
  cierto(barras({ categorias: ["<b>"], series: [{ nombre: "s", valores: [1] }] }).includes("&lt;b&gt;"),
    "dejo pasar una etiqueta"));

console.log("\n— idioma de la envoltura —");
prueba("en ingles rotula Figure y Source, no Grafico y Fuente", () => {
  const h = grafico({ ...BASE, numero: 1, lang: "en" });
  cierto(h.includes("Figure 1") && h.includes("Source:"), "no uso los rotulos ingleses");
  cierto(!h.includes("Gráfico") && !h.includes("Fuente:"), "dejo rotulos en espanol");
});
prueba("sin idioma sigue en espanol", () =>
  cierto(grafico({ ...BASE, numero: 1 }).includes("Gráfico 1"), "cambio el idioma por omision"));
// El guardia no puede aflojarse por cambiar de idioma: es la regla, no el rotulo.
prueba("en ingles el titular tambien tiene que afirmar", () =>
  grita(() => grafico({ ...BASE, lang: "en", titular: "Significance by target" }), "afirmar"));
prueba("en ingles la fuente y el n siguen siendo obligatorios", () => {
  grita(() => grafico({ ...BASE, lang: "en", fuente: undefined }), "fuente");
  grita(() => grafico({ ...BASE, lang: "en", n: undefined }), "n");
});

console.log("\n— higiene —");
prueba("esc neutraliza HTML en las etiquetas", () => {
  cierto(!esc('<img src=x onerror=1>').includes("<"), "dejo pasar una etiqueta");
  cierto(lineas({ categorias: ["<b>"], series: [{ nombre: "<i>", valores: [1] }] }).includes("&lt;i&gt;"),
    "el nombre de serie no se escapo");
});
prueba("num usa coma decimal en espanol y punto en ingles", () => {
  igual(num(2.7, 1), "2,7");
  igual(num(2.7, 1, "en"), "2.7");
});
// El caso real: el eje de p-valores del reporte de Cleveland. "0,05" en un documento
// ingles se lee como otra cosa, y ahi el umbral ES el hallazgo.
prueba("el eje de un grafico en ingles no trae comas decimales", () => {
  const svg = barras({ categorias: ["KRAS"], series: [{ nombre: "p", valores: [0.52] }],
                       dec: 2, lang: "en", referencia: { valor: 0.05, etiqueta: "threshold" } });
  const etiquetas = [...svg.matchAll(/>([^<]*\d[^<]*)</g)].map(x => x[1]);
  cierto(etiquetas.some(e => /^\d+\.\d+$/.test(e)), `no hay etiqueta decimal: ${etiquetas.join(" ")}`);
  cierto(!etiquetas.some(e => /\d,\d/.test(e)), `quedo una coma decimal: ${etiquetas.join(" ")}`);
  // y el reverso, para que el test no pase por mirar el idioma equivocado
  const es = barras({ categorias: ["KRAS"], series: [{ nombre: "p", valores: [0.52] }], dec: 2 });
  cierto([...es.matchAll(/>([^<]*\d[^<]*)</g)].some(x => /\d,\d/.test(x[1])),
    "el grafico en espanol tampoco usa coma: el test no esta probando el idioma");
});
prueba("el SVG no trae dependencias externas", () => {
  const svg = lineas({ categorias: ["a", "b"], series: [{ nombre: "s", valores: [1, 2] }] });
  cierto(!/https?:\/\//.test(svg), "se colo una URL externa en el SVG");
});

console.log(`\n${ok} pasaron, ${mal} fallaron`);
if (mal) { console.log("\nFALLOS:\n - " + fallos.join("\n - ")); process.exit(1); }
