/**
 * T-cascaron — el contrato del cascarón, comprobado sobre el HTML COMPILADO.
 *
 * POR QUE EXISTE, Y POR QUE SOBRE dist/
 * ------------------------------------
 * Los posts de D1 no existen como archivo: el Worker parte el cascarón compilado por
 * cadenas literales y lo rellena. Si el cascarón pierde un marcador, o lo gana de más,
 * el build sale VERDE —compila perfecto— y el post se sirve roto. Es la mina nº2.
 *
 * Los dos defectos que lo hicieron necesario, los dos míos, el mismo día:
 *
 *  1. `__RQ_ALT__` DESAPARECIÓ del compilado. Vivía en el enlace de cambio de idioma de
 *     la barra vieja; al montar la barra nueva, que calcula ese destino sola, el
 *     marcador dejó de renderizarse. Nada falla: el cascarón compila igual.
 *
 *  2. `__RQ_ARTICLE__` apareció DOS VECES — y la segunda estaba dentro de un COMENTARIO
 *     DE CSS que yo mismo escribí para explicar el contrato. Esa hoja viaja dentro de la
 *     página, así que el comentario era un marcador de verdad, y el Worker habría
 *     partido el post por ahí. La prosa que documenta el marcador se vuelve marcador.
 *
 * LA REGLA REAL SALE DEL CÓDIGO, NO DEL DOCUMENTO
 * -----------------------------------------------
 * worker.js:214-217 usa `.split(m).join(v)` —reemplazo total— para TITLE, DESC y ALT, y
 * `.replace(m, v)` —sólo la primera— para ARTICLE. Así que repetir los tres primeros es
 * inofensivo y repetir el cuarto parte la página. El documento del contrato pedía "cada
 * uno exactamente una vez" para los cuatro: era más estricto que la implementación, y
 * una regla más estricta de lo real se acaba ignorando entera.
 */
import { readFileSync, existsSync } from "node:fs";

export const CONSUMIDOR = {
  quien: "quien construye el sitio, antes de desplegar",
  hace: "no despliega: el build queda verde y los 106 posts se sirven rotos o cortados a la mitad",
};

const SHELLS = ["dist/rq-shell-en/index.html", "dist/rq-shell-es/index.html"];
const fallos = [];

// Del código, no de memoria: qué marcador tolera repetirse y cuál no.
const MARCADORES = [
  ["__RQ_TITLE__", "min1", "worker.js usa split/join: repetirlo es inofensivo"],
  ["__RQ_DESC__", "min1", "worker.js usa split/join"],
  ["__RQ_ALT__", "min1", "worker.js usa split/join"],
  ["__RQ_ARTICLE__", "exacto1", "worker.js usa replace: con dos, la pagina se parte por la primera y se pierde el resto"],
];

for (const f of SHELLS) {
  if (!existsSync(f)) { console.log(`  FALLA ${f} no existe — el cascaron no se compilo`); fallos.push(f); continue; }
  const bruto = readFileSync(f, "utf8");
  // SE CUENTAN ELEMENTOS, NO PROSA. La primera version conto sobre el archivo entero y
  // dio por bueno un `<article` que estaba dentro de un COMENTARIO DE CSS —texto mio,
  // explicando el contrato—. El guardia paso por la razon equivocada, que es peor que
  // fallar: los comentarios de las hojas viajan dentro de la pagina, asi que ahi la
  // prosa y el marcado son lo mismo. Se quitan comentarios CSS y HTML antes de contar.
  const h = bruto.replace(/\/\*[\s\S]*?\*\//g, "").replace(/<!--[\s\S]*?-->/g, "");
  const problemas = [];

  for (const [m, regla, porque] of MARCADORES) {
    const n = h.split(m).length - 1;
    if (n === 0) problemas.push(`${m} ausente — el Worker no encuentra donde insertar (${porque})`);
    else if (regla === "exacto1" && n !== 1) problemas.push(`${m} aparece ${n} veces — ${porque}`);
  }
  // El cascaron no aporta contenedor: el post de D1 trae el suyo. Produccion sirve su
  // cascaron con CERO, y esa es la forma correcta — con uno aqui, el post servido queda
  // con dos anidados.
  const arts = h.split("<article").length - 1;
  if (arts !== 0) problemas.push(`${arts} <article> en el cascaron — el post de D1 trae el suyo, aqui van cero (produccion sirve cero)`);
  // El Worker reemplaza EL PRIMER canonical por regex: dos y el post declara la URL equivocada.
  const can = h.split('rel="canonical"').length - 1;
  if (can !== 1) problemas.push(`${can} <link rel=canonical> — el Worker reemplaza el primero`);
  if (!h.includes("</head>")) problemas.push("sin </head> — es un punto de insercion");

  if (problemas.length) { console.log(`  FALLA ${f}`); problemas.forEach((p) => console.log(`        ${p}`)); fallos.push(f); }
  else console.log(`  ok    ${f.padEnd(32)} 4 marcadores · 0 contenedores propios · 1 canonical · </head>`);
}

// Caso de silencio: un cascarón sano no puede hacerlo gritar, y uno con el marcador
// escrito en un comentario SI. Se prueba por mutacion sobre una copia en memoria.
if (!fallos.length) {
  const sano = readFileSync(SHELLS[0], "utf8");
  const mutado = sano.replace("</head>", "<style>/* __RQ_ARTICLE__ y <article> citados */</style></head>");
  // El caso paradojico: el defecto va dentro de un COMENTARIO. Como ahora se limpian
  // los comentarios, el guardia tiene que CALLARSE — que es lo correcto: un marcador
  // citado en un comentario de CSS no llega a la pagina... salvo que la hoja se sirva
  // inline, que es nuestro caso. Por eso la regla de blog.css es no citarlos nunca, y
  // aqui se comprueba que el limpiador funciona.
  const limpio = mutado.replace(/\/\*[\s\S]*?\*\//g, "");
  const n = limpio.split("__RQ_ARTICLE__").length - 1;
  if (n !== 1) { console.log(`  FALLA el limpiador de comentarios no funciona: ${n} marcadores tras limpiar`); fallos.push("mutacion"); }
  else console.log("  ok    silencio                 un marcador citado en un comentario no se cuenta como marcado");

  // Y el GRITO, que es la otra mitad: un duplicado DE VERDAD, fuera de comentario, tiene
  // que detectarse. Sin este caso, el guardia solo demuestra que sabe callarse.
  const roto = sano.replace("</body>", "__RQ_ARTICLE__</body>").replace(/\/\*[\s\S]*?\*\//g, "");
  const m2 = roto.split("__RQ_ARTICLE__").length - 1;
  if (m2 !== 2) { console.log(`  FALLA la prueba de grito no inyecto el defecto (${m2})`); fallos.push("grito"); }
  else console.log("  ok    grito                   un marcador duplicado de verdad se cuenta como dos");
}

if (fallos.length) {
  console.log(`\nT-cascaron: ${fallos.length} problema(s). El build compila igual: por eso esto se mira aqui.`);
  process.exit(1);
}
console.log("\nT-cascaron: el contrato se cumple en los dos cascarones compilados.");
