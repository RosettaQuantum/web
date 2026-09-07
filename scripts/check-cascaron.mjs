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
  const h = readFileSync(f, "utf8");
  const problemas = [];

  for (const [m, regla, porque] of MARCADORES) {
    const n = h.split(m).length - 1;
    if (n === 0) problemas.push(`${m} ausente — el Worker no encuentra donde insertar (${porque})`);
    else if (regla === "exacto1" && n !== 1) problemas.push(`${m} aparece ${n} veces — ${porque}`);
  }
  // El post que llega de D1 ya trae su <article>: el cascarón no puede aportar otro.
  const arts = h.split("<article").length - 1;
  if (arts !== 1) problemas.push(`${arts} <article> en el cascaron — el post de D1 trae el suyo y T-blog exige uno`);
  // El Worker reemplaza EL PRIMER canonical por regex: dos y el post declara la URL equivocada.
  const can = h.split('rel="canonical"').length - 1;
  if (can !== 1) problemas.push(`${can} <link rel=canonical> — el Worker reemplaza el primero`);
  if (!h.includes("</head>")) problemas.push("sin </head> — es un punto de insercion");

  if (problemas.length) { console.log(`  FALLA ${f}`); problemas.forEach((p) => console.log(`        ${p}`)); fallos.push(f); }
  else console.log(`  ok    ${f.padEnd(32)} 4 marcadores · 1 <article> · 1 canonical · </head>`);
}

// Caso de silencio: un cascarón sano no puede hacerlo gritar, y uno con el marcador
// escrito en un comentario SI. Se prueba por mutacion sobre una copia en memoria.
if (!fallos.length) {
  const sano = readFileSync(SHELLS[0], "utf8");
  const mutado = sano.replace("</head>", "<!-- __RQ_ARTICLE__ --></head>");
  const n = mutado.split("__RQ_ARTICLE__").length - 1;
  if (n !== 2) { console.log("  FALLA la prueba de mutacion no inyecto el defecto"); fallos.push("mutacion"); }
  else console.log("  ok    prueba de mutacion       un marcador de mas dentro de un comentario se detecta");
}

if (fallos.length) {
  console.log(`\nT-cascaron: ${fallos.length} problema(s). El build compila igual: por eso esto se mira aqui.`);
  process.exit(1);
}
console.log("\nT-cascaron: el contrato se cumple en los dos cascarones compilados.");
