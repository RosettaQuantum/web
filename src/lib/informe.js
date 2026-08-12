/**
 * Markdown -> HTML del informe metodologico.
 *
 * Vive aparte del armador para que se pueda PROBAR. Los tres defectos que este modulo
 * ya tuvo llegaron al PDF entregado y sobrevivieron dos versiones, porque no habia
 * forma de ejercitarlo sin generar un documento entero y mirarlo:
 *
 *  - los asteriscos de la negrita impresos crudos, cuando un parrafo ABRIA en negrita
 *    (el "**" se confundia con una vinneta);
 *  - las vinnetas de dos lineas partidas, con la continuacion caida como parrafo
 *    suelto — el §7 entero, que es la lista de lo que el trabajo NO afirma;
 *  - un identificador cortado en dos lineas dentro de una tabla, que es lo mismo que
 *    no publicarlo: nadie puede copiarlo para verificar.
 *
 * Cada uno tiene ahora su caso en scripts/test-report-render.mjs, escrito contra el
 * defecto real y no contra un ejemplo inventado.
 */
import { esc } from "./charts.js";

// --------------------------------------------------- markdown -> html del informe

export const enlinea = s => esc(s)
  .replace(/`([^`]+)`/g, "<code>$1</code>")
  .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
  .replace(/(^|[\s(])\*([^*]+)\*/g, "$1<em>$2</em>")
  .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

/**
 * `figurasDe(seccion)` devuelve los bloques HTML que van al FINAL de esa seccion, o
 * un arreglo vacio. Se recibe como funcion en vez de importar el motor de graficos:
 * asi este modulo se prueba con datos de juguete y sin dibujar nada, que es lo que
 * hace que sus defectos se puedan atrapar antes del PDF.
 */
export function aHtml(md, figurasDe = () => []) {
  const out = [];
  const lineasMd = md.split("\n");
  let i = 0, seccion = 0;

  const cerrarSeccion = () => { out.push(...figurasDe(seccion)); };

  while (i < lineasMd.length) {
    const l = lineasMd[i];
    if (/^#{1,4} /.test(l)) {
      const nivel = l.match(/^#+/)[0].length;
      const texto = l.replace(/^#+ /, "");
      if (nivel === 2) { cerrarSeccion(); const m = texto.match(/^(\d+)\./); seccion = m ? Number(m[1]) : 0; }
      out.push(`<h${nivel}>${enlinea(texto)}</h${nivel}>`);
      i++; continue;
    }
    if (/^\|/.test(l)) {
      const filas = []; while (i < lineasMd.length && /^\|/.test(lineasMd[i])) filas.push(lineasMd[i++]);
      const celdas = f => f.replace(/^\||\|$/g, "").split("|").map(c => c.trim());
      const th = celdas(filas[0]).map(c => `<th>${enlinea(c)}</th>`).join("");
      // Una celda que es UN identificador corto no se parte nunca: un job_id cortado a
      // la mitad no se puede copiar, y copiarlo es la unica razon por la que esta ahi.
      // El limite existe porque la MISMA regla aplicada a los sha256 de la cabecera
      // (71 caracteres) reventaria la columna — ahi partir es lo correcto. Medido: con
      // la columna sin quiebre la tabla de 5 columnas mide 673 px, exactamente el ancho
      // util de la A4, y los siete identificadores quedan en una linea.
      const noPartir = c => /^`[^`]{1,28}`$/.test(c.trim());
      const tr = filas.slice(2).map(f => `<tr>${celdas(f).map(c =>
        `<td${noPartir(c) ? ' class="nb"' : ""}>${enlinea(c)}</td>`).join("")}</tr>`).join("");
      out.push(`<div class="tabla-scroll"><table><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`);
      continue;
    }
    if (/^```/.test(l)) {
      i++; const cod = []; while (i < lineasMd.length && !/^```/.test(lineasMd[i])) cod.push(lineasMd[i++]);
      i++; out.push(`<pre><code>${esc(cod.join("\n"))}</code></pre>`);
      continue;
    }
    if (/^> /.test(l)) {
      const c = []; while (i < lineasMd.length && /^>/.test(lineasMd[i])) c.push(lineasMd[i++].replace(/^> ?/, ""));
      out.push(`<blockquote>${enlinea(c.join(" "))}</blockquote>`);
      continue;
    }
    if (/^[-*] /.test(l) && !/^\*\*/.test(l)) {
      // Una vinneta que ocupa dos lineas en el .md es UNA vinneta. La primera version
      // solo tomaba la linea del guion, asi que la continuacion caia como parrafo
      // suelto debajo: en el §7 cada "no afirmamos esto" quedaba cortado en dos y la
      // lista perdia su forma. Salio en el PDF anterior y no lo vio nadie.
      const items = [];
      while (i < lineasMd.length && /^[-*] /.test(lineasMd[i])) {
        let texto = lineasMd[i++].slice(2);
        while (i < lineasMd.length && lineasMd[i].trim() && !/^([-*] |#|\||>|```|\d+\. |---)/.test(lineasMd[i])) {
          texto += " " + lineasMd[i++].trim();
        }
        items.push(texto);
      }
      out.push(`<ul>${items.map(x => `<li>${enlinea(x)}</li>`).join("")}</ul>`);
      continue;
    }
    if (/^\d+\. /.test(l)) {
      const items = []; while (i < lineasMd.length && /^\d+\. /.test(lineasMd[i])) items.push(lineasMd[i++].replace(/^\d+\. /, ""));
      out.push(`<ol>${items.map(x => `<li>${enlinea(x)}</li>`).join("")}</ol>`);
      continue;
    }
    if (/^---+$/.test(l)) { out.push("<hr>"); i++; continue; }
    if (!l.trim()) { i++; continue; }
    // OJO con el `*`: un parrafo que ABRE en negrita empieza con "**", y la primera
    // version lo confundia con una vinneta. El resultado eran los asteriscos crudos
    // impresos en el PDF, porque el cierre quedaba en la linea siguiente y el regex
    // de negrita ya no encontraba par. Se excluye "* " (lista), no "*".
    const esBloque = l2 => /^(#|\||>|```|[-*] |\d+\. |---)/.test(l2);
    const par = []; while (i < lineasMd.length && lineasMd[i].trim() && !esBloque(lineasMd[i])) par.push(lineasMd[i++]);
    if (par.length) out.push(`<p>${enlinea(par.join(" "))}</p>`);
    else { out.push(`<p>${enlinea(lineasMd[i])}</p>`); i++; }
  }
  cerrarSeccion();
  return out.join("\n");
}
