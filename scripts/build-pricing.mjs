#!/usr/bin/env node
/**
 * Arma las paginas de precios LEYENDO el texto aprobado, no transcribiendolo.
 *
 * POR QUE EXISTE
 * --------------
 * Tres reglas del proyecto se cruzan aca:
 *
 * 1. "Los documentos no pasan por el contexto del modelo: se corrompen en silencio."
 *    El caso real fue `micrositio` -> `micrositio` con la i acentuada: mismo largo,
 *    invisible a cualquier chequeo de tamano. Si alguien teclea el texto aprobado en
 *    un .astro, nadie puede probar despues que lo publicado es lo que Nicholas leyo.
 *    Aca el .astro se GENERA desde el .md aprobado, y el sha256 del archivo fuente
 *    queda escrito en la pagina generada.
 *
 * 2. "No se vende ventaja cuantica mientras el contador diga cero." El texto declara
 *    "0 victorias cuanticas medidas" / "0 measured quantum wins". Ese 0 NO se copia:
 *    se pide a /v1/state y si no coincide, este armador ABORTA. Es el chequeo del
 *    450+ aplicado a la pagina que Paddle va a revisar.
 *
 * 3. Un texto aprobado se ancla a SU VERSION, no a su nombre de archivo. Mientras se
 *    armaba la cara espanola, el documento cambio debajo —le entraron un producto
 *    nuevo y otro correo de contacto— y sin el ancla se habrian publicado los dos en
 *    silencio, con la firma "texto aprobado" encima.
 *
 * LAS DOS CARAS
 * -------------
 * La inglesa se verifica ademas contra el documento tabulado que Nicholas leyo
 * (`pricing-en-tabulado.md`): cada fragmento tiene que aparecer ALLI, palabra por
 * palabra. El .md ingles es una reorganizacion de esa columna, no una redaccion
 * nueva, y el verificador es lo que lo prueba.
 *
 * Uso:
 *   node scripts/build-pricing.mjs             # genera las dos caras
 *   node scripts/build-pricing.mjs --verificar  # no escribe: compara con lo que hay
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const VERIFICAR = process.argv.includes("--verificar");

/**
 * Frases del texto aprobado que NO salen, con su motivo. Hoy: ninguna.
 *
 * Las dos que estuvieron aca se fueron por donde corresponde, y las dos tardaron lo
 * mismo que tardo en existir su respaldo:
 *
 *  - "del orden de mil analisis por dolar, y lo medimos" — no habia codigo que
 *    produjera la cifra. Ahora lo hay: `costos.analisis_por_dolar()` en quantum-run
 *    (23f2d3e) da 173.076, medido el 2026-08-10 sobre los 4 blancos de Cleveland a
 *    precio de lista de t3.medium. Se corrio antes de restaurarla: "del orden de mil"
 *    se queda 173x corto, o sea conservador. OJO: el tiempo se midio en el Mac y el
 *    precio es de una t3.medium — la cifra mezcla dos maquinas.
 *
 *  - los nombres de Cleveland Clinic, Airbus, E.ON, HSBC y VW — Nicholas no habia
 *    leido esa redaccion. La aprobo el 2026-08-10, y ademas quedaron respaldados:
 *    `src/aprobado/fuentes-terceros.json` guarda la fuente y un chequeo la ejerce
 *    contra el mundo, no solo contra nosotros.
 *
 * Si algo vuelve a retenerse, va aca con su motivo, no en la cabeza de nadie.
 */
const RETENIDO = [];

const IDIOMAS = [
  {
    lang: "es",
    fuente: "src/aprobado/pricing.es.md",
    salida: "src/pages/es/precios.astro",
    aprobado: "4df54c6e83422bf9720f1c63efa3f9540041a30a6ae6885d3311db4dcedb3891",
    // Revision anterior: edcb8bc3… Trajo la fila "Programa de Medicion" y el correo
    // hi@ -> hello@, las dos confirmadas por Nicholas. hello@ esta verificado contra
    // su panel de Cloudflare: la regla existe y el catch-all esta en Drop, o sea que
    // un correo a hi@ se perdia sin rebote.
    contador: /\*\*(\d+) victorias cuánticas medidas\*\*/,
    titulo: "Precios — Rosetta Q",
    descripcion: "Medimos bajo sello y publicamos los negativos. Precios de exploración, experimento completo y Q-Ready.",
    alt: "/pricing",
    relativo: "../../",
  },
  {
    lang: "en",
    fuente: "src/aprobado/pricing.en.md",
    salida: "src/pages/pricing.astro",
    aprobado: "91b3c462a669e62bfcd4bbd982d407573c868aa24cd72dcb73d91f30d5c73ebf",
    contador: /\*\*(\d+) measured quantum wins\*\*/,
    titulo: "Pricing — Rosetta Q",
    descripcion: "We measure under seal and publish the negatives. Pricing for exploration, full experiments and Q-Ready.",
    alt: "/es/precios",
    relativo: "../",
    // La columna inglesa que Nicholas leyo. Cada fragmento del .md tiene que estar
    // ALLI, palabra por palabra: es lo que prueba que esto es su texto reorganizado y
    // no una redaccion nueva mia.
    tabulado: "src/aprobado/pricing-en-tabulado.md",
  },
];

// El estado se pide UNA vez y sirve a las dos caras: son la misma afirmacion.
const state = await (await fetch("https://rosettaquantum.com/v1/state")).json();
const medido = state.estado_medido.victorias_cuanticas_medidas;

const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enlinea = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  // Cualquier casilla del dominio, no una escrita a mano: el correo YA cambio una
  // vez (hi@ -> hello@) y un enlace clavado al anterior habria quedado mandando la
  // unica via de contacto de la pagina a una casilla que se descarta en silencio.
  .replace(/\b([a-z0-9._%+-]+@rosettaquantum\.com)\b/g, '<a href="mailto:$1">$1</a>');

function tabla(filas) {
  const celdas = f => f.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const cab = celdas(filas[0]);
  const cuerpo = filas.slice(2).map(celdas);
  const th = cab.map(c => `<th>${enlinea(c)}</th>`).join("");
  const tr = cuerpo.map(f => `<tr>${f.map((c, i) =>
    `<td class="${i === 0 ? "q" : i === f.length - 1 ? "p" : "d"}">${enlinea(c)}</td>`).join("")}</tr>`).join("\n        ");
  return `<div class="tabla-scroll"><table>\n        <thead><tr>${th}</tr></thead>\n        <tbody>\n        ${tr}\n        </tbody>\n      </table></div>`;
}

/**
 * Todo fragmento de texto del .md ingles tiene que aparecer en el tabulado aprobado.
 *
 * Los separadores de miles se normalizan antes de comparar, y esa es la UNICA
 * desviacion: en la cara inglesa los precios van con coma (US$24,900) porque
 * "US$24.900" en ingles se lee como veinticuatro con nueve — un error de mil veces
 * sobre un precio, en la pagina donde alguien pone plata.
 */
function verificarContraTabulado(texto, rutaTabulado) {
  const tab = readFileSync(join(RAIZ, rutaTabulado), "utf8");
  // Se comparan PALABRAS, no marcado: los ### de un titulo y los ** de una negrita
  // son estructura, y el tabulado los escribe distinto por ser una tabla. Lo que
  // tiene que calzar letra por letra es el texto que lee una persona.
  const norm = s => s
    .replace(/(\d)[.,](\d{3})\b/g, "$1$2")
    .replace(/[#*>]/g, "")
    .replace(/\s+/g, " ").trim();
  const tabN = norm(tab);
  const fragmentos = texto
    .split("\n")
    .flatMap(l => /^\|/.test(l) ? l.replace(/^\||\|$/g, "").split("|") : [l.replace(/^[>\-\s]+/, "")])
    .map(x => x.trim())
    .filter(x => x.length > 30 && !/^\|?[-:| ]+\|?$/.test(x));
  const perdidos = fragmentos.filter(f => !tabN.includes(norm(f)));
  if (perdidos.length) {
    console.error(`ABORTA: ${perdidos.length} de ${fragmentos.length} fragmentos ingleses no estan en el texto aprobado.`);
    for (const p of perdidos.slice(0, 3)) console.error(`  falta: "${p.slice(0, 90)}…"`);
    process.exit(1);
  }
  return fragmentos.length;
}

let cambios = 0;
for (const L of IDIOMAS) {
  const rutaFuente = join(RAIZ, L.fuente);
  const md = readFileSync(rutaFuente, "utf8");
  const SHA = createHash("sha256").update(readFileSync(rutaFuente)).digest("hex");
  console.log(`\n  [${L.lang}] ${L.fuente}`);
  if (SHA !== L.aprobado) {
    console.error(`ABORTA: el texto fuente no es la revision aprobada.\n` +
      `  aprobado: sha256:${L.aprobado}\n  en disco: sha256:${SHA}\n` +
      `  Alguien edito el documento. Publicar esto seria publicar texto que nadie aprobo.`);
    process.exit(1);
  }

  const desde = md.indexOf("## El texto propuesto");
  const hasta = md.indexOf("\n---\n", desde);
  if (desde < 0 || hasta < 0) { console.error("no encontre el bloque de texto aprobado"); process.exit(1); }
  let texto = md.slice(desde + "## El texto propuesto".length, hasta);

  for (const r of RETENIDO) {
    if (!texto.includes(r.frase)) {
      console.error(`ABORTA: la retencion no calza con el texto — cambio el documento.\n  buscaba: ${r.frase.slice(0, 60)}…`);
      process.exit(1);
    }
    texto = texto.replace(r.frase, r.reemplazo);
    console.log(`  retenido: "${r.frase.split("\n")[0].slice(0, 58)}…" (${r.motivo})`);
  }

  if (L.tabulado) {
    const n = verificarContraTabulado(texto, L.tabulado);
    console.log(`  tabulado: ${n} fragmentos, todos presentes palabra por palabra`);
  }

  const declarado = (texto.match(L.contador) || [])[1];
  if (declarado === undefined) { console.error("ABORTA: el texto ya no declara el contador de victorias"); process.exit(1); }
  if (Number(declarado) !== medido) {
    console.error(`ABORTA: la pagina dice ${declarado} y /v1/state mide ${medido}.`);
    process.exit(1);
  }
  console.log(`  contador: la pagina dice ${declarado} y /v1/state mide ${medido} — calzan`);

  const bloques = [];
  let i = 0;
  const lineas = texto.split("\n");
  while (i < lineas.length) {
    const l = lineas[i];
    if (/^### /.test(l)) { bloques.push(`<h2>${enlinea(l.slice(4))}</h2>`); i++; continue; }
    if (/^\|/.test(l)) { const f = []; while (i < lineas.length && /^\|/.test(lineas[i])) f.push(lineas[i++]); bloques.push(tabla(f)); continue; }
    if (/^> /.test(l) || l === ">") {
      const cita = []; while (i < lineas.length && /^>/.test(lineas[i])) cita.push(lineas[i++].replace(/^> ?/, ""));
      // parrafos separados por linea en blanco; los items de lista van a <ul>
      let acc = [], salida = [], lista = [];
      const cerrar = () => { if (acc.length) { salida.push(`<p>${enlinea(acc.join(" "))}</p>`); acc = []; }
                             if (lista.length) { salida.push(`<ul>${lista.map(x => `<li>${enlinea(x)}</li>`).join("")}</ul>`); lista = []; } };
      for (const c of cita) {
        if (!c.trim()) { cerrar(); continue; }
        if (/^- /.test(c)) { if (acc.length) cerrar(); lista.push(c.slice(2)); }
        else if (lista.length && /^\s+/.test(c)) lista[lista.length - 1] += " " + c.trim();
        else acc.push(c.trim());
      }
      cerrar();
      bloques.push(`<blockquote>${salida.join("\n        ")}</blockquote>`);
      continue;
    }
    i++;
  }

  const cuerpo = bloques.join("\n\n      ");
  const pagina = `---
// GENERADO por scripts/build-pricing.mjs — no editar a mano.
//
// El texto sale de ${L.fuente}, aprobado por Nicholas, leido por el armador y no
// tecleado por nadie: asi lo publicado es demostrablemente lo aprobado. Para
// cambiarlo se edita el .md, se mueve el sha del armador y se regenera.
//
// texto fuente sha256: ${SHA}
import BaseLayout from '${L.relativo}layouts/BaseLayout.astro';
import css from '${L.relativo}styles/pages/precios.css?raw';
---
<BaseLayout
  title="${L.titulo}"
  description="${L.descripcion}"
  lang="${L.lang}"
  altUrl="${L.alt}"
  pageCss={css}>
  <article class="article wrap precios">
      ${cuerpo}

      <p class="sello-fuente">${L.lang === "es"
        ? "Texto publicado desde su documento aprobado"
        : "Published from its approved source document"} ·
        <code>sha256:${SHA.slice(0, 16)}…</code></p>
  </article>
</BaseLayout>
`;

  const rutaSalida = join(RAIZ, L.salida);
  if (VERIFICAR) {
    if (readFileSync(rutaSalida, "utf8") !== pagina) {
      console.error(`FALLA: ${L.salida} no coincide con el texto aprobado.\n` +
        "       Alguien edito el .astro a mano, o cambio el .md sin regenerar.");
      process.exit(1);
    }
    console.log(`  ok: ${L.salida} coincide con el texto aprobado`);
  } else {
    writeFileSync(rutaSalida, pagina);
    cambios++;
    console.log(`  escrita ${L.salida} — ${bloques.length} bloques`);
  }
}
if (!VERIFICAR) console.log(`\n  ${cambios} de ${IDIOMAS.length} caras generadas`);
