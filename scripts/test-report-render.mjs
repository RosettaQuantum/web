#!/usr/bin/env node
/**
 * Tests del renderizador del informe metodologico (src/lib/informe.js).
 *
 * POR QUE EXISTE, y por que llega tarde
 * ------------------------------------
 * Este modulo tuvo tres defectos que llegaron al PDF ENTREGADO, y dos de ellos
 * sobrevivieron mas de una version porque la unica forma de verlos era generar el
 * documento completo y mirarlo con los ojos:
 *
 *  1. Los asteriscos de la negrita impresos crudos, cuando un parrafo ABRIA en
 *     negrita: "**" se confundia con una vinneta, el cierre quedaba en la linea
 *     siguiente y el regex ya no encontraba par.
 *  2. Las vinnetas de dos lineas partidas, con la continuacion caida como parrafo
 *     suelto debajo. Se comio el §7 entero — la lista de lo que el trabajo NO
 *     afirma, donde la forma de lista ES el argumento — y sobrevivio dos PDF.
 *  3. Un identificador cortado en dos lineas dentro de una tabla. Un job_id que no
 *     se puede copiar no sirve para nada, y copiarlo es la unica razon por la que
 *     esta publicado.
 *
 * Cada caso esta escrito contra el defecto REAL —el markdown que lo produjo—, no
 * contra un ejemplo inventado.
 *
 * Uso: node scripts/test-report-render.mjs
 */
import { aHtml, indice, contrastarIndice } from "../src/lib/informe.js";
import { MARCA } from "../src/lib/marca.js";
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

let ok = 0, mal = 0, saltados = 0;
const fallos = [];
/**
 * Un chequeo que no se pudo ejercer NO es un chequeo que paso. Entra al resumen con
 * su propio contador: "verde" y "cubierto" no son lo mismo, y un aviso suelto arriba
 * se pierde entre las lineas de ok.
 */
function salta(nombre, porque) { saltados++; console.log(`  SALTA ${nombre}\n          ${porque}`); }
function prueba(nombre, fn) {
  try { fn(); ok++; console.log(`  ok    ${nombre}`); }
  catch (e) { mal++; fallos.push(`${nombre}: ${e.message}`); console.log(`  FALLA ${nombre}\n          ${e.message}`); }
}
const cierto = (c, msg) => { if (!c) throw new Error(msg || "no se cumplio"); };
const igual = (a, b, msg) => { if (a !== b) throw new Error(`${msg || ""} esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const cuenta = (s, re) => (s.match(re) || []).length;

console.log("— los tres defectos que llegaron al PDF —\n");

// 1. El parrafo que abre en negrita. Texto real del §5.
prueba("un parrafo que ABRE en negrita no imprime los asteriscos", () => {
  const md = "**The score is a proximity-to-source measure wearing the costume of dynamic\nconnectivity.** And an allosteric pocket is, by definition, distal.";
  const h = aHtml(md);
  cierto(!h.includes("**"), "quedaron asteriscos crudos en la salida");
  cierto(h.includes("<strong>"), "no genero la negrita");
  igual(cuenta(h, /<li>/g), 0, "confundio la negrita con una vinneta:");
});

// 2. La vinneta de dos lineas. Texto real del §7.
prueba("una vinneta de dos lineas es UNA vinneta, no una vinneta y un parrafo", () => {
  const md = '- **Quantum crossings: zero.** A "crossing" means a quantum method beating the best\nclassical one. It did not happen.\n- **Significance against chance: none**, with p between 0.4038 and 0.5212.';
  const h = aHtml(md);
  igual(cuenta(h, /<li>/g), 2, "no agrupo las lineas de continuacion:");
  igual(cuenta(h, /<p>/g), 0, "la continuacion cayo como parrafo suelto:");
  cierto(h.includes("classical one. It did not happen."), "perdio la continuacion");
});
prueba("una linea en blanco SI cierra la lista", () => {
  const h = aHtml("- uno\n- dos\n\nUn parrafo aparte que no es continuacion de nada.");
  igual(cuenta(h, /<li>/g), 2);
  igual(cuenta(h, /<p>/g), 1, "se comio el parrafo siguiente:");
});

// 3. El identificador partido. Los siete job_id reales del §9.
prueba("una celda que es UN identificador corto se marca para no partirse", () => {
  const md = "| Role | job_id | Measured |\n|---|---|---|\n| positive control | `d9t16s7tfhrs73dtb550` | 56.8 % |";
  const h = aHtml(md);
  cierto(/<td class="nb"><code>d9t16s7tfhrs73dtb550<\/code><\/td>/.test(h),
    `la celda del identificador no quedo marcada: ${h.slice(h.indexOf("<tbody"), h.indexOf("<tbody") + 160)}`);
});
prueba("un sha256 de 71 caracteres NO se marca: ahi partir es lo correcto", () => {
  const sha = "sha256:ca916f94a138ae3b19279d045f9631be3944276b8ccb71e637b9a46963497214";
  const h = aHtml(`| file | hash |\n|---|---|\n| RUN | \`${sha}\` |`);
  cierto(h.includes(`<td><code>${sha}</code></td>`),
    "marco el hash largo como no-partible, y con eso reventaria la columna");
});
prueba("una celda con texto ademas del codigo tampoco se marca", () => {
  const h = aHtml("| a | b |\n|---|---|\n| x | ver `d9t16s7tfhrs73dtb550` en el panel |");
  cierto(!h.includes('class="nb"'), "marco una celda que no es solo un identificador");
});

// 4. La vinneta de varios parrafos. Estructura real del §8: el laboratorio la
// escribio sangrada, que es como markdown marca la continuacion, y el renderizador
// la ignoraba: los tres parrafos caian al cuerpo del documento. El texto llegaba
// entero —una revision "esta todo?" daba 200 de 200— y la estructura no.
prueba("una vinneta con parrafos sangrados los conserva DENTRO de la vinneta", () => {
  // ESTRUCTURA EXACTA DEL §8, copiada de su forma real: la vinneta siguiente viene
  // PEGADA al ultimo parrafo sangrado, sin linea en blanco. La primera version de este
  // test la puso con blanco —un ejemplo inventado— y por eso paso mientras el documento
  // real salia con una vinneta en vez de tres.
  const md = "- **The stacked arm.** We said the feature was dead.\n\n  When we moved the run to CI we found the conservation feature alive.\n\n  So the arm was not held back by a missing signal.\n- **Other groupings.** No community-based grouping was\n  tested, no blocks larger than 16.\n- **A truly prospective null.** It does not exist: the pool is\n  exhausted.";
  const h = aHtml(md);
  igual(cuenta(h, /<ul>/g), 1, "partio la lista en dos:");
  igual(cuenta(h, /<li>/g), 3, "se trago las vinnetas siguientes:");
  const primera = h.slice(h.indexOf("<li>"), h.indexOf("</li>"));
  igual(cuenta(primera, /<p>/g), 3, "la vinneta no se quedo con sus tres parrafos:");
  cierto(primera.includes("held back by a missing signal"), "solto el ultimo parrafo al cuerpo");
});
prueba("un parrafo SIN sangria despues de una lista es prosa, no continuacion", () => {
  const h = aHtml("- uno\n- dos\n\nEsto es prosa de la seccion y no pertenece a la ultima vinneta.");
  igual(cuenta(h, /<li>/g), 2);
  const ul = h.slice(h.indexOf("<ul>"), h.indexOf("</ul>"));
  cierto(!ul.includes("prosa de la seccion"), "absorbio prosa que no era de la vinneta");
  igual(cuenta(h, /<p>/g), 1, "perdio el parrafo:");
});

console.log("\n— estructura —\n");

prueba("las tablas salen con encabezado y sin la fila de guiones", () => {
  const h = aHtml("| Role | n |\n|---|---|\n| uno | 1 |\n| dos | 2 |");
  igual(cuenta(h, /<th>/g), 2);
  igual(cuenta(h, /<tr>/g), 3, "conto mal las filas (¿se colo la de guiones?):");
  cierto(!h.includes("---"), "publico la fila de guiones");
});
prueba("la seccion se identifica por su TITULO, no por su numero", () => {
  // El caso real: el documento gano tres secciones al principio y TODO se renumero.
  // Con las figuras mapeadas por numero se habrian ido a capitulos equivocados y nada
  // habria gritado, porque las secciones 4, 5 y 6 seguian existiendo.
  const vistas = [];
  const h = aHtml("## 4. Result: negative\n\ntexto\n\n## 5. Why it failed\n\notro",
    s => { vistas.push(s); return s === "Result: negative" ? ["<figure>F1</figure>"] : []; });
  cierto(vistas.includes("Result: negative"), `no paso el titulo sin numero: ${JSON.stringify(vistas)}`);
  cierto(!vistas.includes(4) && !vistas.includes("4"), "todavia pasa el numero");
  const iFig = h.indexOf("<figure>"), iSig = h.indexOf("Why it failed");
  cierto(iFig > 0 && iFig < iSig, "la figura no quedo ANTES del titulo siguiente");
});
prueba("el mismo titulo con otro numero sigue siendo la misma seccion", () => {
  const v6 = [], v4 = [];
  aHtml("## 6. Result: negative\n\ntexto", s => { v6.push(s); return []; });
  aHtml("## 4. Result: negative\n\ntexto", s => { v4.push(s); return []; });
  igual(JSON.stringify(v6), JSON.stringify(v4), "renumerar la seccion cambio su identidad:");
});
prueba("un bloque de codigo no se interpreta como markdown", () => {
  const h = aHtml("```bash\npython3 tools/verify_seals.py <file>\n```");
  cierto(h.includes("<pre><code>"), "no genero el bloque");
  cierto(h.includes("&lt;file&gt;"), "no escapo el argumento entre angulos");
});
prueba("el HTML de la fuente se escapa", () => {
  const h = aHtml("Un parrafo con <img src=x onerror=1> adentro.");
  cierto(!h.includes("<img"), "dejo pasar una etiqueta");
});
prueba("los enlaces markdown se convierten", () => {
  cierto(aHtml("Ver [el protocolo](https://example.org/P.md) aqui.")
    .includes('<a href="https://example.org/P.md">el protocolo</a>'), "no convirtio el enlace");
});

console.log("\n— el indice que trae el documento —\n");

prueba("el contraste calla cuando el indice calza con las secciones", () => {
  const md = "## 1. Uno\n\n### Contents\n\n| | |\n|---|---|\n| 1 | Uno |\n| 2 | Dos |\n| | Sin numero |\n\n## 2. Dos\n\n## Sin numero";
  const c = contrastarIndice(md);
  igual(c.faltan.length, 0, `faltan: ${c.faltan.join("|")}`);
  igual(c.sobran.length, 0, `sobran: ${c.sobran.join("|")}`);
  igual(c.enIndice.length, 3, "no leyo la fila con la primera celda vacia:");
});
prueba("grita si el documento gana una seccion y el indice queda viejo", () => {
  const md = "### Contents\n\n| | |\n|---|---|\n| 1 | Uno |\n\n## 1. Uno\n\n## 2. Dos";
  const c = contrastarIndice(md);
  igual(c.faltan.length, 1, "no vio la seccion sin entrada:");
  cierto(c.faltan[0].includes("Dos"), `esperaba Dos, dio ${c.faltan[0]}`);
});
prueba("grita si el indice nombra una seccion que ya no existe", () => {
  const md = "### Contents\n\n| | |\n|---|---|\n| 1 | Uno |\n| 2 | Fantasma |\n\n## 1. Uno";
  const c = contrastarIndice(md);
  igual(c.sobran.length, 1, "no vio la entrada sin seccion:");
});
prueba("renumerar no cuenta como diferencia: se compara el titulo", () => {
  const md = "### Contents\n\n| | |\n|---|---|\n| 6 | El resultado |\n\n## 4. El resultado";
  const c = contrastarIndice(md);
  igual(c.faltan.length + c.sobran.length, 0, "el numero distinto se conto como divergencia:");
});

console.log("\n— la linea de marca —\n");

/**
 * Los dos acentos de la marca, anclados.
 *
 * Este test NO elige una paleta: fija la que ya esta decidida y medida. Nicholas pidio
 * el documento "como el de julio", y el de julio son estos valores — leidos del SVG
 * VECTORIAL, no cuentagoteados de un render. Los cinco que circularon por los mensajes
 * daban CERO usos en el archivo: salian de contar pixeles de un pixmap a 60 dpi, donde
 * el suavizado corre cada valor una o dos unidades y un color de 5 usos ni sobrevive.
 *
 * Si este test grita, la pregunta correcta NO es "que color nuevo pongo": es si alguien
 * cambio la marca a proposito. El original esta en `marca/pagina1-julio.svg`.
 *
 * Los otros ocho colores de julio son tokens del sitio (--basalt-2, --faint y compania)
 * y no se fijan aca: ya tienen su guardia y fijarlos dos veces los haria divergir.
 */
const ACENTOS = {
  dorado: { valor: "#a6812f", usos: 37,  donde: "filetes, logo, acentos" },
  teal:   { valor: "#2c8c80", usos: 362, donde: "la Q, datos, enlaces" },
};
for (const [nombre, a] of Object.entries(ACENTOS)) {
  prueba(`el acento ${nombre} es el de julio (${a.valor})`, () => {
    igual(MARCA[nombre], a.valor,
      `el ${nombre} de la marca cambio. El valor de julio es ${a.valor}, medido sobre ` +
      `marca/pagina1-julio.svg (${a.usos} usos, ${a.donde}). Si el cambio es a proposito, ` +
      `muevelo aqui y en src/lib/marca.js a la vez; si no, esto es la marca desarmandose.`);
  });
}
// Y contra el archivo del que salieron: un test que compara dos constantes del mismo
// repo se cae solo el dia que alguien las cambia juntas.
//
// El vector pesa 2,9 MB —mas de la mitad de este repo— asi que lo que vive aca es su
// CENSO de colores con el sha256 del archivo. Con eso el chequeo corre SIEMPRE, tambien
// en CI, en vez de saltarse; y cuando el SVG esta presente se comprueba ademas que el
// censo sigue siendo suyo. Quitar la condicion de salto vale mas que reportarla bien.
const RAIZ_T = dirname(fileURLToPath(import.meta.url));
const censo = JSON.parse(readFileSync(join(RAIZ_T, "../src/aprobado/marca/censo-julio.json"), "utf8"));

prueba("los acentos existen en el censo del vector de julio", () => {
  for (const [nombre, a] of Object.entries(ACENTOS)) {
    const n = censo.colores[a.valor] || 0;
    igual(n, a.usos, `${nombre} ${a.valor} en el censo de ${censo.archivo}:`);
  }
});
prueba("los valores que circulaban NO existen en el vector", () => {
  // El caso positivo del censo: si manana alguien lo regenera mal y estos aparecen,
  // el censo dejo de ser el de julio.
  for (const c of ["#a6812e", "#2b8b80", "#efe8d9", "#f5f1e7", "#979692"]) {
    igual(censo.colores[c] || 0, 0, `${c} aparece en el censo y no deberia:`);
  }
});
{
  const svg = join(RAIZ_T, "../../../marca/pagina1-julio.svg");
  if (!existsSync(svg)) {
    salta("el censo sigue siendo del SVG que declara", "el vector no esta en este clon (el censo si se comprobo)");
  } else {
    prueba("el censo sigue siendo del SVG que declara", () => {
      const sha = createHash("sha256").update(readFileSync(svg)).digest("hex");
      igual(sha, censo.sha256, `${censo.archivo} cambio; el censo quedo viejo:`);
    });
  }
}

console.log("\n— indice —\n");

prueba("el indice sale de los ## del documento, no de una lista aparte", () => {
  const i = indice("# T\n\n## 1. Uno\n\ntexto\n\n## 2. Dos\n\n## How to verify this document");
  igual(cuenta(i, /<li>/g), 3, "no listo todas las secciones:");
  cierto(i.includes("Uno") && i.includes("How to verify"), "perdio una seccion");
  cierto(!i.includes("# T"), "metio el titulo del documento como seccion");
});
prueba("el indice separa el numero del titulo, y aguanta secciones sin numero", () => {
  const i = indice("## 9. The same circuit\n## How to verify this document");
  cierto(/<span class="idx-n">9<\/span><span class="idx-t">The same circuit/.test(i), "no separo el numero");
  cierto(/<span class="idx-n"><\/span><span class="idx-t">How to verify/.test(i), "no manejo la seccion sin numero");
});
prueba("un documento sin secciones no publica un indice vacio", () => {
  igual(indice("# Solo un titulo\n\ntexto"), "", "publico un indice sin nada adentro");
});

console.log(`\n${ok} pasaron, ${mal} fallaron, ${saltados} saltados`);
if (mal) { console.log("\nFALLOS:\n - " + fallos.join("\n - ")); process.exit(1); }
