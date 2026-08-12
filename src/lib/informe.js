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
/**
 * Indice, GENERADO desde los `##` del documento.
 *
 * No se escribe a mano por la razon de siempre: una lista que vive en dos lugares ya
 * divergio. Si manana el laboratorio agrega, quita o renumera una seccion, el indice
 * cambia solo — y si no cambiara, seria peor que no tenerlo, porque un indice
 * equivocado se lee como un mapa y manda al lector a una pagina que no existe.
 */
export function indice(md) {
  const secciones = md.split("\n")
    .filter(l => /^## /.test(l))
    .map(l => l.slice(3).trim());
  if (!secciones.length) return "";
  const li = secciones.map(t => {
    const m = t.match(/^(\d+)\.\s*(.*)$/);
    return m
      ? `<li><span class="idx-n">${m[1]}</span><span class="idx-t">${enlinea(m[2])}</span></li>`
      : `<li><span class="idx-n"></span><span class="idx-t">${enlinea(t)}</span></li>`;
  }).join("");
  return `<nav class="indice"><div class="idx-k">Contents</div><ol>${li}</ol></nav>`;
}

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
        const parrafos = [lineasMd[i++].slice(2)];
        // continuacion en la MISMA linea logica: se pega al parrafo en curso
        while (i < lineasMd.length && lineasMd[i].trim() && !/^([-*] |#|\||>|```|\d+\. |---)/.test(lineasMd[i])) {
          parrafos[parrafos.length - 1] += " " + lineasMd[i++].trim();
        }
        // Y la continuacion SANGRADA despues de una linea en blanco: en markdown eso
        // es otro parrafo de la MISMA vinneta. Sin esto, el primer punto del §8 —una
        // vinneta de cuatro parrafos— soltaba tres al cuerpo del documento: el texto
        // llegaba entero y la estructura no, que es el mismo defecto del §7 en una
        // forma que una revision "esta todo el texto?" no puede ver.
        //
        // Se exige la SANGRIA, no se adivina: un parrafo sin sangria despues de una
        // lista es prosa de la seccion, y absorberlo seria inventar una estructura que
        // el autor no escribio.
        let j = i;
        while (j < lineasMd.length && !lineasMd[j].trim()) j++;
        while (j < lineasMd.length && /^(\s{2,}|\t)\S/.test(lineasMd[j])) {
          // El corte NO es solo la linea en blanco: en el §8 real la vinneta siguiente
          // viene pegada al ultimo parrafo sangrado, sin blanco en medio. La primera
          // version paraba solo en el blanco y se trago las otras dos vinnetas — el
          // §8 salio con UNA en vez de tres. Mi test no lo vio porque lo escribi con
          // un ejemplo inventado que si tenia la linea en blanco.
          const cont = [];
          while (j < lineasMd.length && lineasMd[j].trim() &&
                 !/^([-*] |#|\||>|```|\d+\. |---)/.test(lineasMd[j])) cont.push(lineasMd[j++].trim());
          parrafos.push(cont.join(" "));
          i = j;
          while (j < lineasMd.length && !lineasMd[j].trim()) j++;
        }
        items.push(parrafos);
        // Tras absorber los parrafos sangrados, `i` quedaba en la linea en blanco y el
        // bucle de items terminaba: la vinneta siguiente abria una lista NUEVA y el §8
        // salia como dos listas separadas por sus propios parrafos. Si lo unico que
        // separa a la siguiente vinneta son lineas en blanco, es la MISMA lista.
        let k = i;
        while (k < lineasMd.length && !lineasMd[k].trim()) k++;
        if (k < lineasMd.length && /^[-*] /.test(lineasMd[k])) i = k;
      }
      out.push(`<ul>${items.map(ps => `<li>${ps.length === 1
        ? enlinea(ps[0])
        : ps.map(x => `<p>${enlinea(x)}</p>`).join("")}</li>`).join("")}</ul>`);
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
