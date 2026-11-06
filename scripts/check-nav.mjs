/**
 * T-nav — la barra tiene sus enlaces, el CTA visible en desktop y el menu movil.
 *
 * Se comprueba sobre el COMPONENTE (no sobre una pagina servida) porque en el commit 4
 * el nav todavia no esta montado en ninguna pagina: montarlo antes de que existan las
 * rutas dejaria el preview con 404 visibles. Cuando el commit 6 monte la home, T-home
 * lo vuelve a comprobar contra el HTML servido.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: un nav al que le falta un enlace o el CTA se ve completo hasta que alguien cuenta",
};
import { readFileSync, readdirSync } from "node:fs";
import { sinComentarios } from "../src/lib/css-sin-comentarios.js";
const src = readFileSync("src/components/NavV2.astro", "utf8");
const css = readFileSync("src/styles/componentes/nav.css", "utf8");
const fallos = [];
const ok = (m) => console.log(`  ok    ${m}`);
const mal = (m) => { console.log(`  FALLA ${m}`); fallos.push(m); };

// /blog entra el 8-sep. Estaba SOLO en el pie, y 106 posts sin puerta en la barra es
// exactamente el hueco que este guardia existe para no dejar pasar: contaba seis y los
// seis estaban, asi que callaba sobre el que faltaba. Una lista de lo que TIENE que
// haber no ve lo que nunca se puso.
/* /monitor salio de la barra el 10-sep (bloque 1 del spec maestro, B1.8): prometia un
   producto y entregaba 158 palabras. La pagina sigue viva, anunciada en llms.txt y en el
   sitemap — lo que cambio es que ya no ocupa un lugar en el menu principal. */
const en = ["/pilots","/services","/library","/ledger","/methodology","/blog"];
const es = ["/es/pilotos","/es/servicios","/es/biblioteca","/es/ledger","/es/metodologia","/es/blog"];
const faltanEn = en.filter((r) => !src.includes(`"${r}"`));
const faltanEs = es.filter((r) => !src.includes(`"${r}"`));
faltanEn.length ? mal(`faltan rutas EN: ${faltanEn}`) : ok(`${en.length} enlaces EN`);
faltanEs.length ? mal(`faltan rutas ES: ${faltanEs}`) : ok(`${es.length} enlaces ES`);
// Los textos son los aprobados: EN de la maqueta v20, ES de
// handoff/web/rosetta-home-es-textos-v20.md (2-sep). Si cambian, cambia el aprobado
// primero — este guardia esta escrito contra el texto, no contra "hay un boton".
/* Texto del anexo A del spec maestro, aprobado por Nicholas el 10-sep. */
src.includes("Request a referee") && src.includes("Pedir un árbitro") ? ok("CTA en los dos idiomas, con el texto aprobado") : mal("falta el CTA en algun idioma, o no dice el texto aprobado");
/* B1.1 · y que se VEA en desktop, que es lo que fallaba: `.nav-right .nav-cta{display:none}`
   sin media query ganaba por especificidad en todos los anchos. La regla que lo oculta
   tiene que estar dentro de un @media de maximo ancho, o el boton no existe para nadie. */
{
  const sinMedia = /(^|\})\s*\.nav-right\s+\.nav-cta\s*\{[^}]*display\s*:\s*none/.test(css);
  sinMedia ? mal("el CTA de la barra se oculta en TODOS los anchos: `.nav-right .nav-cta{display:none}` fuera de un @media")
           : ok("el CTA de la barra se oculta solo bajo el ancho del menu movil");
}
src.includes('id="burger"') && src.includes('id="mobileMenu"') && src.includes("aria-expanded") ? ok("hamburguesa con aria-expanded y menu movil") : mal("falta la hamburguesa o el menu movil");
/--[a-z0-9-]+\s*:/.test(css) ? mal("nav.css declara tokens: los sombrearia (D3)") : ok("nav.css no declara tokens");
[".burger",".mobile-menu",".nav-links",".nav-cta"].every((c) => css.includes(c)) ? ok("CSS de la barra portado") : mal("falta CSS de la barra");

/* ---------------------------------------------------------------------------
 * Ninguna hoja fija un <nav> por el ELEMENTO.
 *
 * Nace de un defecto real que Nicholas vio a ojo en la pagina publicada
 * (5-nov-2026): `nav{position:sticky;top:0;z-index:50}` era la barra del sitio, y
 * meses despues el informe mensual estreno su indice como <nav class="toc"> —el
 * elemento correcto— y heredo la regla. Quedaba clavado arriba, ENCIMA de la barra
 * (mismo z-index, y va despues en el DOM) y se comia 365 de 800 px durante todo el
 * documento. El defecto no existia cuando se escribio la regla: nace solo el dia que
 * alguien agrega un <nav> legitimo, y entonces se lee como una decision de diseno.
 *
 * La barra del sitio (NavV2) es el UNICO <nav> sin clase del repo. Por eso se fija con
 * `nav:not([class])`, y la vieja con `html nav.sitenav`. Cualquier otra forma de decir
 * "todos los nav" vuelve a armar la trampa.
 *
 * Medido sobre dist el 5-nov, para no exagerar el alcance: la unica copia desnuda que
 * llegaba a paginas construidas era la de pages/home.css, en 72 de ellas. Las de
 * pages/index.css, pages/ledger.css y pages/clases.css no las importa nadie y llegan a
 * 0 paginas; quedan igual bajo esta regla porque el dia que alguien las importe el
 * defecto vuelve, y nadie se va a acordar.
 *
 * PUNTO CIEGO DECLARADO: mira `position`. Un `nav{display:none}` o un `nav{color:…}`
 * desnudos tambien alcanzan a todos, y esta regla no los ve: se acoto a lo que produjo
 * un defecto real, porque un falso positivo aqui detiene el build de alguien mas.
 * --------------------------------------------------------------------------- */
{
  const hojas = [];
  const juntar = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = `${dir}/${e.name}`;
      if (e.isDirectory()) juntar(p);
      else if (e.name.endsWith(".css")) hojas.push(p);
    }
  };
  juntar("src/styles");

  // El ultimo compuesto del selector es el que decide a QUE elemento se aplica la regla.
  // `nav` y `html nav` alcanzan a todos; `nav:not([class])`, `nav.sitenav` y `.toc` no.
  const desnudo = (sel) => sel.split(/[>+~\s]+/).filter(Boolean).pop() === "nav";
  const fija = (decls) => /position\s*:\s*(sticky|fixed)/.test(decls);
  // Sin quitar los comentarios, este guardia acusaria a las dos hojas que explican el
  // defecto: home.css e informe-pqc.css lo citan textual en su por que. Es el caso de
  // §4 bis —un control que lee prosa aprueba (o aqui, acusa) prosa— y el filtro se
  // prueba por mutacion mas abajo. Se usa el MISMO limpiador que sirve las hojas.
  const culpables = [];
  for (const h of hojas) {
    const css = sinComentarios(readFileSync(h, "utf8"));
    for (const m of css.matchAll(/([^{}]+)\{([^}]*)\}/g)) {
      if (!fija(m[2])) continue;
      const malo = m[1].split(",").map((s) => s.trim()).filter(desnudo);
      if (malo.length) culpables.push(`${h.replace("src/styles/", "")} → ${malo.join(", ")}`);
    }
  }
  if (culpables.length)
    mal(`hojas que fijan el <nav> por elemento: ${culpables.join(" · ")} — alcanza a cualquier <nav> que nazca manana`);
  else ok(`${hojas.length} hojas: ninguna fija el <nav> por elemento`);

  // Grito y silencio. El silencio es el que vale: las hojas reales de este repo CITAN la
  // regla desnuda en sus comentarios, asi que si el filtro no estuviera, el guardia
  // acusaria justo a los dos archivos que documentan el arreglo.
  const conDefecto = "nav{position:sticky;top:0;z-index:50}";
  const soloComentario = `/* ojo: antes decia ${conDefecto} */\nnav:not([class]){position:sticky;top:0}`;
  const grita = [...conDefecto.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .some((m) => fija(m[2]) && m[1].split(",").map((s) => s.trim()).some(desnudo));
  const calla = ![...sinComentarios(soloComentario).matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .some((m) => fija(m[2]) && m[1].split(",").map((s) => s.trim()).some(desnudo));
  // Y la mutacion que prueba que el filtro de comentarios hace algo: sin el, el mismo
  // caso de silencio tiene que acusar. Si no acusa, el filtro no esta cazando nada.
  const sinFiltroAcusa = [...soloComentario.matchAll(/([^{}]+)\{([^}]*)\}/g)]
    .some((m) => fija(m[2]) && m[1].split(",").map((s) => s.trim()).some(desnudo));
  if (grita && calla && sinFiltroAcusa)
    ok("grito/silencio           `nav{sticky}` acusa; citado en un comentario no, y sin el filtro si");
  else mal(`la mutacion no sirve (grita:${grita} calla:${calla} filtro:${sinFiltroAcusa})`);
}

console.log(fallos.length ? `\nT-nav: ${fallos.length} fallo(s)` : "\nT-nav: barra completa en los dos idiomas, y nadie fija el <nav> por elemento");
process.exit(fallos.length ? 1 : 0);
