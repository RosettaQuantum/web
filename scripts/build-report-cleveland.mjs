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
import { aHtml, indice, contrastarIndice } from "../src/lib/informe.js";
import { MARCA, cabecera } from "../src/lib/marca.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..");
const STAGING = join(RAIZ, "../../evidence-staging");
const SALIDA_DIR = join(RAIZ, "../../quantum-run/submission/cleveland");
const HTML = join(SALIDA_DIR, "1_methodological_report.html");
const PDF = join(SALIDA_DIR, "1_methodological_report.pdf");
const PDF_FLAG = process.argv.includes("--pdf");
/**
 * `--marca` arma la version brandeada en un borrador APARTE.
 *
 * No sobreescribe el entregable: `1_methodological_report.pdf` ya esta verificado por
 * dos sesiones y subido, y una version con sitios reservados —sin el resumen ni el
 * equipo, que Nicholas aun no aprueba— no puede ocupar su lugar por accidente. El
 * empaquetador busca los cinco nombres exactos, asi que el borrador le es invisible.
 */
const MARCA_FLAG = process.argv.includes("--marca");
const DIR_MARCA = join(SALIDA_DIR, "borrador-marca");

/**
 * Los dos insumos, con el sha que declaro el laboratorio.
 *
 * No es ceremonia: un reporte de otra sesion es una hipotesis, y este documento
 * entero trata sobre verificar hashes. Entregarlo construido desde un archivo que
 * no verifique seria la version mas cara del mismo chiste.
 */
const INSUMOS = {
  texto: { archivo: "REPORTE-METODOLOGICO-EN.md",
           sha: "f8db4198851da35f82483a4dc1e482283fe15693a0bd7e6b80075bfda57b28d0" },
  // Revision anterior: 25d01952… Tres cifras en la prosa; ni tablas, ni listas, ni
  // titulos, asi que el contraste del indice y la ubicacion por titulo siguen calzando.
  //
  // OJO: el laboratorio anuncio este hash TRUNCADO ("f8db4198…28d0") y la primera
  // version de esta linea tenia el medio INVENTADO por mi. El ancla lo atrapo. El de
  // aca esta medido sobre el archivo, y se comprobo que empieza y termina como ellos
  // declararon — que es lo unico que un prefijo y un sufijo pueden probar.
  // Revision anterior: f304c5ef… Dos frases, ninguna estructural: el documento
  // afirmaba que la respuesta estuvo cerrada hasta el final —falso para dos de los
  // tres blancos— y declaraba su propio limite mas chico de lo que es. El sello -005
  // se re-sello en 03b80241…
  // Revision anterior: b07826d0… (sello RQ-REPORT-CLEV-METHOD-005). Gana tres secciones
  // —resumen, el hilo con julio, y Team— y su propio indice; las diez anteriores quedan
  // identicas pero RENUMERADAS. Ojo: NICHOLAS NO HA VISTO ESTE TEXTO. Se rinde para que
  // lo lea, no para subirlo — por eso solo se arma con --marca, al borrador.
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

/**
 * id del grafico -> TITULO de la seccion despues de la cual se inserta.
 *
 * Por titulo y no por numero, y no es una preferencia: el 2026-08-12 el documento gano
 * tres secciones al principio y TODO se renumero. Con el mapa por numero, las cuatro
 * figuras se habrian ido a capitulos equivocados —el grafico de p-valores al final de
 * "How the prediction was blinded", los dos de compresion dentro de "The result"— y
 * NADA habria gritado, porque las secciones 4, 5 y 6 siguen existiendo. Cada figura
 * seguiria con su titular correcto, en el capitulo que no es.
 *
 * El titulo es lo que de verdad identifica el capitulo. Si cambia, el armador aborta.
 */
const UBICACION = {
  significance:        "The result: negative",
  proximity:           "Why it failed",
  coarse_grain_order:  "Coarse-graining scalability",
  coarse_grain_topset: "Coarse-graining scalability",
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

/**
 * Los colores de las series cuando se arma la version de marca.
 *
 * El motor toma por omision los tokens del sitio (faience #4DC4B5, gold #D9B87A); la
 * linea de julio usa teal #2c8c80 y dorado #a6812f, que son mas oscuros y por eso
 * legibles sobre papel blanco. En pantalla la diferencia es sutil; impresos, el
 * faience del sitio se lava.
 */
const COLORES = MARCA_FLAG ? [MARCA.teal, MARCA.dorado, "#6f8fa8", "#a86f6f"] : [];
const pinta = series => COLORES.length
  ? series.map((s, i) => ({ ...s, color: COLORES[i % COLORES.length] }))
  : series;

function dibujar(c) {
  const comun = { numero: null, titular: c.headline, fuente: c.source, n: c.n, lang: "en" };
  if (c.type === "bar") {
    return { ...comun, subtitulo: c.y_label,
      cuerpo: barras({
        categorias: c.data.map(d => d.label),
        series: pinta([{ nombre: c.y_label, valores: c.data.map(d => d.value) }]),
        dec: 4, lang: "en", etiquetaValores: true,
        referencia: c.reference_line ? { valor: c.reference_line.value, etiqueta: c.reference_line.label } : null,
      }) };
  }
  if (c.type === "grouped_bar") {
    return { ...comun, subtitulo: c.y_label,
      cuerpo: barras({
        categorias: c.data.map(d => d.label),
        series: pinta(c.series.map((nombre, i) => ({ nombre, valores: c.data.map(d => d.values[i]) }))),
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
        series: pinta(c.data.map(s => ({ nombre: s.label, valores: s.points.map(p => p.y) }))),
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
// Antes de armar nada: cada titulo declarado tiene que existir en el documento.
// Falla cerrado — una figura sin su capitulo es peor que un build roto.
{
  const titulos = md.split("\n").filter(l => /^## /.test(l)).map(l => l.slice(3).trim());
  const perdidos = [...new Set(Object.values(UBICACION))].filter(t => !titulos.some(x => x.includes(t)));
  if (perdidos.length) {
    console.error(`ABORTA: ${perdidos.length} seccion(es) declarada(s) no existen en el documento: ${perdidos.join(" | ")}`);
    console.error(`  el documento tiene: ${titulos.join(" | ")}`);
    process.exit(1);
  }
}

let nFig = 0;
const cuerpo = aHtml(md, seccion => {
  const bloques = [];
  for (const [id, tit] of Object.entries(UBICACION)) {
    if (String(seccion).includes(tit) && figuras[id] && !figuras[id].puesta) {
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

// Sitios reservados. NO son texto: se ven como lo que son —un hueco declarado— para
// que nadie los confunda con contenido, y el armador los cuenta y los reporta.
const RESERVADOS = [
  { id: "resumen", titulo: "Executive summary", nota: "Texto en aprobacion — no publicado todavia." },
  { id: "equipo",  titulo: "Team",              nota: "Texto en aprobacion — no publicado todavia." },
];
const reservado = r => `<section class="reservado" data-reservado="${r.id}">
      <div class="res-k">${r.titulo}</div>
      <p>${r.nota}</p>
    </section>`;

// El documento trae su propio `### Contents` desde el 2026-08-12. Si esta, NO se
// inyecta otro —dos indices en la misma pagina es peor que ninguno— y en cambio se
// CONTRASTA contra los titulos reales, que es lo que de verdad puede envejecer.
const TIENE_INDICE = md.includes("### Contents");
{
  const c = contrastarIndice(md);
  if (TIENE_INDICE) {
    if (c.faltan.length || c.sobran.length) {
      console.error(`ABORTA: el indice del documento no calza con sus secciones.`);
      if (c.faltan.length) console.error(`  secciones sin entrada en el indice: ${c.faltan.join(" | ")}`);
      if (c.sobran.length) console.error(`  entradas del indice que no son secciones: ${c.sobran.join(" | ")}`);
      process.exit(1);
    }
    console.log(`  indice: el del documento calza con sus ${c.enDocumento.length} secciones`);
  }
}
const RESERVADOS_PENDIENTES = RESERVADOS.filter(r => !md.includes("## 12. Team") || r.id !== "equipo");
const bloqueInicio = (TIENE_INDICE ? "" : indice(md)) +
  (md.includes("## 1. What this is") ? "" : reservado(RESERVADOS[0]));

const CABECERA = cabecera({
  programa: "2026 Global Quantum + AI Challenge",
  fase: "Phase 2 — Results",
  desafio: "Cleveland Clinic · Allosteric Signal Propagation",
});

const CSS_MARCA = `
/* La linea de julio, medida sobre el SVG vectorial. Ver src/lib/marca.js. */
/* LA CABECERA NO VA CON position:fixed, y esto costo dos intentos medidos.
   - Con position:fixed y top:0 se dibuja donde empieza el texto y solo la primera pagina queda
     despejada, porque el padding de .hoja aplica UNA VEZ al inicio del flujo. Medido en
     el PDF: 2,2 pt de separacion en las paginas que arrancan con texto de continuacion,
     contra 19–26 pt en las que abren con titulo.
   - Con position:fixed y top:-15mm para meterla en el margen, Chrome la mando al PIE de las 13
     paginas. Tambien medido: el borde inferior del logo quedo en y=62,7 en todas.
   Lo que si reserva espacio en CADA pagina es un encabezado de TABLA repetido:
   thead{display:table-header-group} lo repite y su alto empuja el contenido. */
/* NO se declara display aqui: la clase .marca esta en el <tr>, y ponerle
   table-header-group convierte la FILA en un grupo dentro del thead — malformado, y la
   celda quedaba a 399 px de 794. El <thead> ya es header-group por omision y ya se
   repite; no habia nada que forzar. */
/* La fila NO lleva borde ni fondo: el filete es UNO y vive en la celda. Al pasar
   de position:fixed a thead deje puestas las propiedades de la regla vieja —padding,
   fondo y border-bottom— y quedaron DOS filetes dorados, uno de la fila (ancho
   completo) y otro de la celda (mas corto). Medido en el PDF: y=760,2 ancho 296 y
   y=746,7 ancho 505. Julio tiene uno solo. */
.marca-celda{width:100%;padding:0 0 7px;border-bottom:1.5px solid ${MARCA.dorado};display:flex;align-items:flex-end;justify-content:space-between;gap:20px}
.marca-logo{height:26px;width:auto}
.marca-txt{text-align:right;font-size:8.5px;line-height:1.45;color:${MARCA.gris};
  letter-spacing:.04em;text-transform:uppercase}
.marca-txt div:first-child{color:${MARCA.dorado};font-weight:600}

.indice{margin:26px 0 34px;padding:16px 18px;background:${MARCA.papel};
  border-left:2px solid ${MARCA.dorado}}
.idx-k{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:${MARCA.gris};margin-bottom:9px}
.indice ol{list-style:none;margin:0;padding:0;columns:2;column-gap:26px}
.indice li{display:flex;gap:9px;margin:0 0 5px;font-size:12px;break-inside:avoid}
.idx-n{color:${MARCA.dorado};font-weight:600;min-width:15px}
.idx-t{color:${MARCA.tinta}}
.reservado{margin:22px 0;padding:14px 16px;border:1px dashed ${MARCA.dorado};
  background:${MARCA.crema};break-inside:avoid}
.res-k{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:${MARCA.dorado};font-weight:600}
.reservado p{margin:6px 0 0;font-size:11.5px;color:${MARCA.gris};font-style:italic}
.portada-t{color:${MARCA.tinta}}
.portada-k{color:${MARCA.dorado}}
h2{border-bottom-color:${MARCA.dorado}}
a{color:${MARCA.teal}}
`;

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
${MARCA_FLAG ? CSS_MARCA : ""}
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
/* La cabecera va con position:fixed, que en impresion la repite en cada pagina PERO
   no reserva espacio: el contenido fluye por debajo y se la come. Esta regla va
   DESPUES del bloque de impresion a proposito, porque el .hoja con padding:0 de ahi
   arriba la pisaba y el titulo de la portada salia cortado por el filete.
   (Y sin comillas invertidas: esto vive dentro de una plantilla de JS.) */
body.con-marca .hoja{padding-top:0}
table.envoltura{width:100%;border-collapse:collapse;table-layout:fixed}
table.envoltura>tbody>tr>td{padding:0;border:0}
table.envoltura>thead>tr>th{padding:0 0 10px;border:0;text-transform:none;letter-spacing:normal;font-size:inherit;color:inherit;font-weight:400}
/* El margen vuelve a 17mm: con la cabecera en el FLUJO (thead) su alto ya lo reserva
   ella, y los 28mm de cuando era fija reservaban el espacio dos veces — dos paginas de
   mas en un documento de trece. */
@page{size:A4;margin:17mm 16mm}
</style></head>
<body${MARCA_FLAG ? ' class="con-marca"' : ""}><main class="hoja">${MARCA_FLAG ? '<table class="envoltura"><thead>' + CABECERA + '</thead><tbody><tr><td>' : ""}
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
${MARCA_FLAG ? bloqueInicio : ""}
${cuerpo}
${MARCA_FLAG && !md.includes("## 12. Team") ? reservado(RESERVADOS[1]) : ""}
${MARCA_FLAG ? "</td></tr></tbody></table>" : ""}
</main></body></html>
`;

const dirSalida = MARCA_FLAG ? DIR_MARCA : SALIDA_DIR;
const htmlSalida = MARCA_FLAG ? join(DIR_MARCA, "informe-brandeado.html") : HTML;
const pdfSalida  = MARCA_FLAG ? join(DIR_MARCA, "informe-brandeado.pdf")  : PDF;
mkdirSync(dirSalida, { recursive: true });
writeFileSync(htmlSalida, html);
if (MARCA_FLAG) {
  const huecos = (html.match(/data-reservado="/g) || []).length;
  // El mensaje dice lo que PASO, no lo que el armador sabe hacer: reportar "indice de
  // 13 secciones" cuando el indice lo trae el documento seria describir un trabajo que
  // no hice.
  console.log(`  marca: cabecera en cada pagina · indice ${TIENE_INDICE ? "del documento (contrastado)" : "generado aqui"}` +
    ` · ${huecos} sitios reservados — borrador, NO es el entregable`);
}
console.log(`\n  escrito ${htmlSalida.replace(join(RAIZ, "../../"), "")} — ${Object.keys(figuras).length} figuras, ${Math.round(html.length / 1024)} KB`);

if (PDF_FLAG) {
  const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
  if (!existsSync(CHROME)) { console.error("ABORTA: no encontre Chrome para exportar el PDF"); process.exit(1); }
  execFileSync(CHROME, [
    "--headless", "--disable-gpu", "--no-pdf-header-footer",
    `--print-to-pdf=${pdfSalida}`, "--virtual-time-budget=8000", `file://${htmlSalida}`,
  ], { stdio: "pipe" });
  const bytes = readFileSync(pdfSalida);
  console.log(`  escrito ${pdfSalida.replace(join(RAIZ, "../../"), "")} — ${Math.round(bytes.length / 1024)} KB, ` +
    `sha256:${createHash("sha256").update(bytes).digest("hex").slice(0, 12)}…`);
}
