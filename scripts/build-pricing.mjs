#!/usr/bin/env node
/**
 * Arma la pagina de precios LEYENDO el texto aprobado, no transcribiendolo.
 *
 * POR QUE EXISTE
 * --------------
 * Dos reglas del proyecto se cruzan aca:
 *
 * 1. "Los documentos no pasan por el contexto del modelo: se corrompen en silencio."
 *    El caso real fue `micrositio` -> `micrositio` con la i acentuada: mismo largo,
 *    invisible a cualquier chequeo de tamano. Si yo tecleo el texto aprobado en un
 *    .astro, nadie puede probar despues que lo publicado es lo que Nicholas leyo.
 *    Aca el .astro se GENERA desde `PROPUESTA-PRICING.md`, y el sha256 del archivo
 *    fuente queda escrito en la pagina generada. Lo publicado es demostrablemente
 *    el texto aprobado.
 *
 * 2. "No se vende ventaja cuantica mientras el contador diga cero."  El texto dice
 *    "0 victorias cuanticas medidas". Ese 0 NO se copia: se pide a /v1/state y si no
 *    coincide con el del texto, este armador ABORTA. Es el chequeo del 450+ aplicado
 *    a la pagina que Paddle va a revisar.
 *
 * RETENCIONES
 * -----------
 * Una frase del texto aprobado no se publica todavia, y la razon vive abajo en
 * `RETENIDO`, no en la memoria de nadie: afirma una medicion que no esta
 * instrumentada. Se retiene EN CODIGO y a la vista para que se pueda revertir con
 * una linea cuando exista el respaldo o cuando Nicholas diga que salga igual.
 *
 * Uso:
 *   node scripts/build-pricing.mjs            # genera src/pages/es/precios.astro
 *   node scripts/build-pricing.mjs --verificar # no escribe: compara con lo que hay
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
// El texto aprobado vive DENTRO del repo. La primera version lo leia de
// Projects/Rosetta Quantum/PROPUESTA-PRICING.md, fuera del clon: el paso de CI
// no encontraba el archivo y el guardia que existe para probar que lo publicado
// es lo aprobado no corria justo donde importa. Es el mismo defecto que la demo
// que vivia fuera de git. El original sigue siendo el documento de Nicholas; esta
// copia es byte-identica (mismo sha256) y se trajo con `cp`, nunca transcrita.
const FUENTE = join(RAIZ, "src/aprobado/pricing.es.md");
const SALIDA = join(RAIZ, "src/pages/es/precios.astro");
const VERIFICAR = process.argv.includes("--verificar");

/**
 * Frases del texto aprobado que NO salen todavia, con su motivo.
 *
 * "Nuestro computo cuesta casi nada: del orden de mil analisis por dolar, y lo
 * medimos." — busque el codigo que produce esa cifra y no existe: `quantum-run/
 * costos.py` mide el costo del hardware CUANTICO por medicion valida (USD/disparo
 * por proveedor), que es otra cosa. La regla del proyecto es que un numero sin el
 * codigo que lo produce se declara "no instrumentado", y esta pagina es
 * precisamente la que promete que todo se puede comprobar. Sale en cuanto haya que
 * medir, o si Nicholas decide publicarla igual.
 */
const RETENIDO = [
  { frase: "Nuestro cómputo cuesta casi nada: del orden de mil análisis por dólar, y lo medimos.\n> Así que el precio",
    reemplazo: "El precio",
    motivo: "cifra sin instrumentar; costos.py mide el hardware cuantico, no esto" },
];

/**
 * La revision EXACTA que Nicholas aprobo. No es ceremonia: mientras armaba esta
 * pagina, el documento cambio debajo —le entraron un producto nuevo de US$24.900
 * y otro correo de contacto— y sin este ancla el armador habria publicado los dos
 * cambios en silencio, con la firma "texto aprobado" encima. Un texto aprobado se
 * ancla a su version, no a su nombre de archivo.
 *
 * Para publicar una revision nueva: se aprueba, se copia el archivo (nunca se
 * transcribe) y se cambia este sha en el mismo commit.
 */
const APROBADO = "edcb8bc38748ec57cb2d83392f3a29ed8b7903b2aa4bea29f9d2795cca570440";

const md = readFileSync(FUENTE, "utf8");
const SHA = createHash("sha256").update(readFileSync(FUENTE)).digest("hex");
if (SHA !== APROBADO) {
  console.error(`ABORTA: el texto fuente no es la revision aprobada.\n` +
    `  aprobado: sha256:${APROBADO}\n  en disco: sha256:${SHA}\n` +
    `  Alguien edito el documento. Publicar esto seria publicar texto que nadie aprobo.`);
  process.exit(1);
}

// --- el texto aprobado, recortado del documento -----------------------------
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
  console.log(`  retenido: "${r.frase.split("\n")[0].slice(0, 58)}…"\n            (${r.motivo})`);
}

// --- el contador de victorias, contra la API viva ---------------------------
const declarado = (texto.match(/\*\*(\d+) victorias cuánticas medidas\*\*/) || [])[1];
if (declarado === undefined) { console.error("ABORTA: el texto ya no declara el contador de victorias"); process.exit(1); }
const state = await (await fetch("https://rosettaquantum.com/v1/state")).json();
const medido = state.estado_medido.victorias_cuanticas_medidas;
if (Number(declarado) !== medido) {
  console.error(`ABORTA: la pagina dice ${declarado} victorias y /v1/state mide ${medido}.`);
  process.exit(1);
}
console.log(`  contador: la pagina dice ${declarado} y /v1/state mide ${medido} — calzan`);

// --- markdown -> html, el subconjunto que el documento usa ------------------
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const enlinea = s => esc(s)
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\b(hi@rosettaquantum\.com)\b/g, '<a href="mailto:$1">$1</a>');

function tabla(filas) {
  const celdas = f => f.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
  const cab = celdas(filas[0]);
  const cuerpo = filas.slice(2).map(celdas);
  const th = cab.map(c => `<th>${enlinea(c)}</th>`).join("");
  const tr = cuerpo.map(f => `<tr>${f.map((c, i) =>
    `<td class="${i === 0 ? "q" : i === f.length - 1 ? "p" : "d"}">${enlinea(c)}</td>`).join("")}</tr>`).join("\n        ");
  return `<div class="tabla-scroll"><table>\n        <thead><tr>${th}</tr></thead>\n        <tbody>\n        ${tr}\n        </tbody>\n      </table></div>`;
}

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
// El texto sale de Projects/Rosetta Quantum/PROPUESTA-PRICING.md, el archivo que
// Nicholas aprobo ("partamos con ese pricing"), leido por el armador y no tecleado
// por nadie: asi lo publicado es demostrablemente lo aprobado. Para cambiarlo se
// edita el .md y se vuelve a correr el armador.
//
// texto fuente sha256: ${SHA}
import BaseLayout from '../../layouts/BaseLayout.astro';
import css from '../../styles/pages/precios.css?raw';
---
<BaseLayout
  title="Precios — Rosetta Q"
  description="Medimos bajo sello y publicamos los negativos. Precios de exploración, experimento completo y Q-Ready."
  lang="es"
  altUrl="/es/precios"
  pageCss={css}>
  <article class="article wrap precios">
      ${cuerpo}

      <p class="sello-fuente">Texto publicado desde su documento aprobado ·
        <code>sha256:${SHA.slice(0, 16)}…</code></p>
  </article>
</BaseLayout>
`;

if (VERIFICAR) {
  const actual = readFileSync(SALIDA, "utf8");
  if (actual !== pagina) {
    console.error("FALLA: la pagina publicada no coincide con el texto aprobado.\n" +
      "       Alguien edito el .astro a mano, o cambio el .md sin regenerar.");
    process.exit(1);
  }
  console.log("ok: la pagina generada coincide con el texto aprobado");
} else {
  writeFileSync(SALIDA, pagina);
  console.log(`  escrita ${SALIDA.replace(RAIZ + "/", "")} — ${bloques.length} bloques, fuente sha256:${SHA.slice(0, 12)}…`);
}
