#!/usr/bin/env node
/**
 * Arma el reporte metodologico de Cleveland: entregable 3 del challenge.
 *
 * QUE HACE
 * --------
 * Lee el contenido EN aprobado y los datos de los graficos que sello el laboratorio,
 * los verifica contra sus sha256, y escribe un HTML autocontenido que despues se
 * exporta a PDF con Chrome. Ningun numero se teclea: los graficos salen de
 * `charts_data.json`, que a su vez sale de los archivos sellados.
 *
 * LO QUE ESTE ARCHIVO NO HACE
 * ---------------------------
 * No redacta. El texto es del laboratorio y esta aprobado por Nicholas; aca solo se
 * maqueta. Si algo del texto parece mal, se reporta, no se corrige al vuelo.
 *
 * DONDE VAN LOS GRAFICOS
 * ----------------------
 * El documento no trae marcas de posicion, asi que la ubicacion es decision de
 * render y vive abajo en UBICACION, declarada y no dispersa por el codigo. Cada
 * grafico va al final de la seccion cuyo hallazgo ilustra.
 *
 * Uso:
 *   node scripts/build-report-cleveland.mjs           # escribe el HTML
 *   node scripts/build-report-cleveland.mjs --pdf     # ademas exporta el PDF
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { barras, lineas, grafico, CSS_GRAFICOS } from "../src/lib/charts.js";
// El markdown->html vive en src/lib/informe.js para que tenga tests propios: sus
// defectos llegaron dos veces al PDF entregado por no poder ejercitarlo suelto.
import { aHtml } from "../src/lib/informe.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGING = join(RAIZ, "../../evidence-staging");
const SALIDA_DIR = join(RAIZ, "../../quantum-run/submission/cleveland");
const HTML = join(SALIDA_DIR, "1_methodological_report.html");
const PDF = join(SALIDA_DIR, "1_methodological_report.pdf");
const PDF_FLAG = process.argv.includes("--pdf");

/**
 * Los dos insumos, con el sha que declaro el laboratorio.
 *
 * No es ceremonia: un reporte de otra sesion es una hipotesis, y este documento
 * entero trata sobre verificar hashes. Entregarlo construido desde un archivo que
 * no verifique seria la version mas cara del mismo chiste.
 */
const INSUMOS = {
  texto: { archivo: "REPORTE-METODOLOGICO-EN.md",
           sha: "b07826d09cdf081476fabb3d44bc38259479b8be4691b623d3f83a0f5c27ad41" },
  // Revision anterior: ae7dd557… (sello RQ-REPORT-CLEV-METHOD-004). Tres cambios, no
  // dos: el §9 recupera los siete job_id, el §8 reescribe su primer punto, y la tabla
  // del encabezado gana la fila de RQ-EXP-N90-LOPO-003. La tercera no venia en el
  // encargo escrito y si en el aviso del laboratorio; se verifico contra el archivo
  // sellado antes de rendirla — el content_hash que declara calza.
  //
  // Antes: 006daf19…, que declaraba la bateria de hardware "en curso".
  datos: { archivo: "charts_data.json",
           sha: "0d6c0fb37f1fb19244694f9bdf19f1af340a01eace04b28bb447d025ec08f30c" },
  // Revision anterior: 7b87cc26… Cambio SOLO el punto final de los cuatro titulares,
  // que el guardia de grafico() exige para separar una afirmacion de un rotulo. Lo
  // corrigio el laboratorio en su generador, no yo aca: es texto aprobado.
  //
  // El archivo viejo estaba anclado dentro de RQ-REPORT-CLEV-METHOD-001, ya publicado,
  // asi que NO se re-sello: la correccion es un archivo nuevo (…-002) que declara a
  // quien corrige y que cambio. Lo anclado no se toca.
};

/** id del grafico -> numero de seccion despues de la cual se inserta. */
const UBICACION = {
  significance: 4,          // el resultado: los tres p lejos de 0,05
  proximity: 5,             // por que fallo: el score sigue la distancia
  coarse_grain_order: 6,    // el orden no sobrevive a la compresion
  coarse_grain_topset: 6,   // y el conjunto que decide se reemplaza
};

function leerVerificado(clave) {
  const { archivo, sha } = INSUMOS[clave];
  const ruta = join(STAGING, archivo);
  const bytes = readFileSync(ruta);
  const mio = createHash("sha256").update(bytes).digest("hex");
  if (mio !== sha) {
    console.error(`ABORTA: ${archivo} no es el que el laboratorio sello.\n` +
      `  declarado: sha256:${sha}\n  en disco:  sha256:${mio}`);
    process.exit(1);
  }
  console.log(`  ${archivo}: sha256:${mio.slice(0, 12)}… verificado`);
  return bytes.toString("utf8");
}

// ---------------------------------------------------------------- los graficos

function dibujar(c) {
  const comun = { numero: null, titular: c.headline, fuente: c.source, n: c.n, lang: "en" };
  if (c.type === "bar") {
    return { ...comun, subtitulo: c.y_label,
      cuerpo: barras({
        categorias: c.data.map(d => d.label),
        series: [{ nombre: c.y_label, valores: c.data.map(d => d.value) }],
        dec: 4, lang: "en", etiquetaValores: true,
        referencia: c.reference_line ? { valor: c.reference_line.value, etiqueta: c.reference_line.label } : null,
      }) };
  }
  if (c.type === "grouped_bar") {
    return { ...comun, subtitulo: c.y_label,
      cuerpo: barras({
        categorias: c.data.map(d => d.label),
        series: c.series.map((nombre, i) => ({ nombre, valores: c.data.map(d => d.values[i]) })),
        dec: 2, lang: "en",
      }) };
  }
  if (c.type === "line") {
    // Coarse-graining: una linea por blanco sobre los niveles de compresion. Las
    // categorias son los x de la PRIMERA serie y se comprueba que todas las demas
    // usen los mismos: dos series con distinta grilla dibujadas juntas mienten sobre
    // el eje, y aqui el eje es el tamano de bloque.
    const ejes = c.data.map(s => s.points.map(p => p.x).join(","));
    if (new Set(ejes).size !== 1)
      throw new Error(`"${c.id}": las series no comparten los mismos x (${ejes.join(" | ")})`);
    return { ...comun, subtitulo: [c.x_label, c.y_label].filter(Boolean).join(" · "),
      cuerpo: lineas({
        categorias: c.data[0].points.map(p => String(p.x)),
        series: c.data.map(s => ({ nombre: s.label, valores: s.points.map(p => p.y) })),
        dec: 2, lang: "en", alto: 300,
        referencia: c.reference_line ? { valor: c.reference_line.value, etiqueta: c.reference_line.label } : null,
      }) };
  }
  throw new Error(`tipo de grafico desconocido: ${c.type}`);
}


// ------------------------------------------------------------------------ main

console.log("Reporte metodologico de Cleveland\n");
const md = leerVerificado("texto");
const datos = JSON.parse(leerVerificado("datos"));

const figuras = {};
for (const c of datos.charts) {
  if (!UBICACION[c.id]) { console.error(`ABORTA: el grafico "${c.id}" no tiene ubicacion declarada.`); process.exit(1); }
  figuras[c.id] = { spec: dibujar(c), puesta: false };
}
let nFig = 0;
const cuerpo = aHtml(md, seccion => {
  const bloques = [];
  for (const [id, sec] of Object.entries(UBICACION)) {
    if (sec === seccion && figuras[id] && !figuras[id].puesta) {
      figuras[id].puesta = true;
      bloques.push(grafico({ ...figuras[id].spec, numero: ++nFig }));
    }
  }
  return bloques;
});

const sinPoner = Object.entries(figuras).filter(([, f]) => !f.puesta).map(([id]) => id);
if (sinPoner.length) {
  // Un grafico que no encuentra su seccion desaparece sin ruido, y el documento sale
  // con un hallazgo menos. Falla cerrado.
  console.error(`ABORTA: ${sinPoner.length} de ${datos.charts.length} graficos no encontraron su seccion: ${sinPoner.join(", ")}`);
  process.exit(1);
}

const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<title>Methodology Report — Rosetta Quantum · Cleveland Clinic Challenge</title>
<style>
:root{--papyrus:#F4EEDF;--papyrus-dim:#B5AC99;--faint:#6E675C;--stone-line:#3D372F;
      --basalt:#141210;--basalt-2:#1F1C18;--faience:#4DC4B5;--gold:#D9B87A}
*{box-sizing:border-box}
body{margin:0;background:var(--basalt);color:var(--papyrus);
     font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;
     font-size:14.5px;line-height:1.62}
.hoja{max-width:820px;margin:0 auto;padding:46px 40px 60px}
h1{font-size:27px;line-height:1.24;margin:0 0 6px;font-weight:600}
.portada{padding-bottom:26px;margin-bottom:8px;border-bottom:1px solid var(--stone-line);break-after:avoid}
.portada-k{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--faint)}
.portada-t{font-size:33px;line-height:1.15;margin:10px 0 14px;font-weight:600}
.portada-d{font-size:15px;color:var(--papyrus-dim);margin:0 0 12px;max-width:640px;line-height:1.55}
.portada-d em{color:var(--papyrus)}
.portada-n{font-size:13.5px;color:var(--faint);margin:0;max-width:640px}
/* El h1 del propio documento repite el titulo de la portada. Se oculta en vez de
   editar el texto sellado: el contenido no se toca, la presentacion es de aca. */
.hoja > h1{display:none}
h2{font-size:19px;margin:44px 0 12px;padding-bottom:8px;border-bottom:1px solid var(--stone-line);font-weight:600}
h3{font-size:15.5px;margin:26px 0 8px;font-weight:600}
p{margin:0 0 13px}
strong{color:#fff}
blockquote{margin:16px 0;padding:12px 16px;background:var(--basalt-2);
           border-left:2px solid var(--faience);color:var(--papyrus-dim);font-size:13.5px}
code{font-family:'SF Mono',Menlo,Consolas,monospace;font-size:12.2px;color:var(--gold);word-break:break-all}
pre{background:var(--basalt-2);border:1px solid var(--stone-line);padding:13px 15px;
    overflow-x:auto;border-radius:3px}
pre code{color:var(--papyrus-dim);word-break:normal}
.tabla-scroll{overflow-x:auto;margin:14px 0}
table{border-collapse:collapse;width:100%;font-size:13px}
th{text-align:left;font-size:9.5px;letter-spacing:.13em;text-transform:uppercase;
   color:var(--faint);padding:0 12px 7px 0;border-bottom:1px solid var(--stone-line);font-weight:500}
td{padding:9px 12px 9px 0;border-bottom:1px solid var(--stone-line);vertical-align:top}
td.nb code{white-space:nowrap}
ul,ol{margin:0 0 13px 20px;padding:0}
li{margin-bottom:7px}
hr{border:0;border-top:1px solid var(--stone-line);margin:26px 0}
a{color:var(--faience)}
${CSS_GRAFICOS}
/* Impresion: el PDF es el entregable, la pantalla es el borrador. Fondo claro para
   que no salga un ladrillo de tinta, y ninguna figura partida entre dos paginas. */
@media print{
  body{background:#fff;color:#14120F}
  .hoja{max-width:none;padding:0}
  h1,h2,h3,strong,.portada-t{color:#0B0A08}
  .portada-d{color:#3D372F}
  .portada-d em{color:#0B0A08}
  .portada-n,.portada-k{color:#6E675C}
  .portada{border-bottom-color:#D9D3C6}
  blockquote{background:#F5F2EA;color:#3D372F}
  pre{background:#F5F2EA;border-color:#D9D3C6}
  pre code,td,p,li{color:#22201C}
  code{color:#7A5C1E}
  th{color:#6E675C;border-bottom-color:#D9D3C6}
  td{border-bottom-color:#E8E3D8}
  .rq-fig{break-inside:avoid;page-break-inside:avoid;border-top-color:#D9D3C6}
  /* El envoltorio scrollea en pantalla; en papel no hay scroll, y un overflow oculto
     recorta la columna de la derecha sin avisar. */
  .tabla-scroll{overflow:visible}
  /* Y si una tabla no cabe entera, que al menos repita su encabezado: una pagina de
     numeros sin los rotulos de columna es una pagina de numeros sin denominador. */
  thead{display:table-header-group}
  tr{break-inside:avoid}
  .rq-fig-tit{color:#0B0A08}
  .rq-fig-sub,.rq-fig-proc,.rq-notas{color:#6E675C}
  h2{break-after:avoid;page-break-after:avoid}
  table{break-inside:avoid}
  /* --basalt tambien: el fondo de la etiqueta del umbral lo usa, y sin esto quedaba
     un rectangulo casi negro pegado sobre una pagina blanca. */
  :root{--papyrus:#22201C;--papyrus-dim:#4A453D;--faint:#6E675C;--stone-line:#D9D3C6;
        --faience:#0F7F72;--gold:#7A5C1E;--basalt-2:#F5F2EA;--basalt:#FFFFFF}
}
@page{size:A4;margin:17mm 16mm}
</style></head>
<body><main class="hoja">
<header class="portada">
  <div class="portada-k">Rosetta Quantum · deliverable 3</div>
  <h1 class="portada-t">Methodology Report</h1>
  <p class="portada-d">Submitted to the Cleveland Clinic challenge of the 2026 Global
  Quantum + AI Challenge:<br><em>“Unlocking undruggable targets: quantum simulation of
  allosteric signal propagation.”</em></p>
  <p class="portada-n">This report answers that question with a measured negative. The
  three targets scored, the null it was tested against, and the compression limit are
  below; every figure is read from the sealed files listed in the header, none typed
  by hand.</p>
</header>
${cuerpo}
</main></body></html>
`;

mkdirSync(SALIDA_DIR, { recursive: true });
writeFileSync(HTML, html);
console.log(`\n  escrito ${HTML.replace(join(RAIZ, "../../"), "")} — ${Object.keys(figuras).length} figuras, ${Math.round(html.length / 1024)} KB`);

if (PDF_FLAG) {
  const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!existsSync(CHROME)) { console.error("ABORTA: no encontre Chrome para exportar el PDF"); process.exit(1); }
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--no-pdf-header-footer",
    `--print-to-pdf=${PDF}`, "--virtual-time-budget=8000", `file://${HTML}`,
  ], { stdio: "pipe" });
  const bytes = readFileSync(PDF);
  console.log(`  escrito ${PDF.replace(join(RAIZ, "../../"), "")} — ${Math.round(bytes.length / 1024)} KB, ` +
    `sha256:${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}…`);
}
