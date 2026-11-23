/**
 * T-nav — la barra tiene sus enlaces, el CTA visible en desktop y el menu movil.
 *
 * Se comprueba sobre el COMPONENTE (no sobre una pagina servida) porque en el commit 4
 * el nav todavia no esta montado en ninguna pagina: montarlo antes de que existan las
 * rutas dejaria el preview con 404 visibles. Cuando el commit 6 monte la home, T-home
 * lo vuelve a comprobar contra el HTML servido.
 *
 * `--medir` (postbuild, 23-nov-2026): abre las home construidas en dist/ con Chrome, el viewport
 * EMULADO (un --window-size no baja de ~500 px y mide otra cosa), y comprueba que la barra no se
 * encime a 840, 980, corte-1, corte y 1280 px, en español y en inglés. Nace de un defecto que estuvo
 * meses en producción sin que nada lo dijera: a 840 px la marca pisaba «Pilotos» 45 px y EN/ES caía
 * en tres líneas. Ver medirBarra() más abajo.
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

if (process.argv.includes("--medir")) {
  await medirBarra();
  console.log(fallos.length ? `\nT-nav --medir: ${fallos.length} fallo(s)` : "\nT-nav --medir: la barra no se encima en ningún ancho medido, en los dos idiomas");
  process.exit(fallos.length ? 1 : 0);
}

// /blog entra el 8-sep. Estaba SOLO en el pie, y 106 posts sin puerta en la barra es
// exactamente el hueco que este guardia existe para no dejar pasar: contaba seis y los
// seis estaban, asi que callaba sobre el que faltaba. Una lista de lo que TIENE que
// haber no ve lo que nunca se puso.
/* /monitor salio de la barra el 10-sep (bloque 1 del spec maestro, B1.8): prometia un
   producto y entregaba 158 palabras. La pagina sigue viva, anunciada en llms.txt y en el
   sitemap — lo que cambio es que ya no ocupa un lugar en el menu principal. */
/* /q-ready entra el 23-nov (pedido de Nicholas): «Seguridad» / «Security» lleva a la portada de
   seguridad, que reúne el informe PQC mensual y la guía. Hasta ese día sólo tenía puerta desde el pie. */
/* VARIANTE B (23-nov): «Seguridad» reemplaza a «Notes» en la barra. /blog sigue en el pie, y eso
   también se exige aquí: sacarlo de la barra no puede dejar los posts sin puerta. */
/* «Seguridad» (/es/q-ready, /q-ready) NO está en estas listas porque su ruta y su etiqueta no se
   escriben en NavV2: salen del texto aprobado (src/data/publicaciones/textos-aprobados/). Se
   comprueba más abajo, contra el documento. */
const en = ["/pilots","/services","/library","/ledger","/methodology"];
const es = ["/es/pilotos","/es/servicios","/es/biblioteca","/es/ledger","/es/metodologia"];
{
  const pie = readFileSync("src/components/PieV2.astro", "utf8");
  pie.includes('["/es/blog", "Notes"]') && pie.includes('["/blog", "Notes"]')
    ? ok("Notes sigue en el pie en los dos idiomas (salió de la barra por Seguridad)")
    : mal("Notes salió de la barra y tampoco está en el pie: los posts quedan sin puerta");
}
const faltanEn = en.filter((r) => !src.includes(`"${r}"`));
const faltanEs = es.filter((r) => !src.includes(`"${r}"`));
faltanEn.length ? mal(`faltan rutas EN: ${faltanEn}`) : ok(`${en.length} enlaces EN`);
faltanEs.length ? mal(`faltan rutas ES: ${faltanEs}`) : ok(`${es.length} enlaces ES`);
// La etiqueta, no sólo la ruta: el pie ya enlaza /es/q-ready con «Si llevas la seguridad», así que
// una ruta presente en el archivo no prueba que el botón diga lo que se pidió. Desde el 23-nov la
// etiqueta es la APROBADA y NavV2 la lee del documento: se exige que la lea (las dos ramas del
// arreglo) y que el documento diga lo aprobado.
{
  const { textosGaleria, ARCHIVO, DIR } = await import("../src/lib/textos-galeria.mjs");
  const M = textosGaleria(readFileSync(DIR + ARCHIVO, "utf8")).menu;
  const leeAprobado = src.includes(`import aprobado from "../data/publicaciones/textos-aprobados/${ARCHIVO}?raw"`)
    && (src.match(/\[SEG\.ruta, SEG\.texto\]/g) || []).length === 2;
  leeAprobado ? ok("NavV2 toma «Seguridad» del texto aprobado, en las dos ramas del menú")
              : mal("NavV2 no toma el botón de seguridad del texto aprobado (import + [SEG.ruta, SEG.texto] en es y en)");
  // 23-nov: «Security» NO va a /q-ready (la página vieja, identidad retirada) sino a la portada nueva.
  M.es.texto === "Seguridad" && M.es.ruta === "/es/q-ready" && M.en.texto === "Security" && M.en.ruta === "/es/q-ready"
    ? ok("el menú dice «Seguridad» → /es/q-ready y «Security» → /es/q-ready (nunca a la /q-ready vieja)")
    : mal(`el texto aprobado del menú no es el esperado: ${JSON.stringify(M)}`);
}
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

/* ---------------------------------------------------------------------------
 * --medir · la barra, medida en la página construida.
 *
 * QUÉ MIDE, en /es/ y / de dist (las dos montan NavV2), a 840, 980, corte-1, corte y 1280 px:
 *  · el ancho es el pedido (innerWidth real): si no, el instrumento mide otra cosa y FALLA;
 *  · bajo el corte, los items están ocultos y la hamburguesa a la vista;
 *  · desde el corte, los items a la vista y la marca a 8 px o más del primer enlace («encime»);
 *  · en todo ancho, EN/ES en una sola línea.
 * El corte se LEE de nav.css y de home.css (las dos hojas que pintan la barra) y tienen que decir lo
 * mismo.
 *
 * GRITO: en la página real a 840 px se inyecta el corte viejo (items a la vista desde 840) y la
 * medida TIENE que dar encime; si no lo da, el instrumento no sirve y falla. SILENCIO: la página real.
 *
 * TRES ESTADOS. Las fuentes de marca vienen de Google Fonts. Sin ellas el navegador dibuja con
 * Georgia y system-ui, que miden otra cosa: entonces se dice NO MEDIDO y no se falla (un falso
 * positivo detendría el build de otro por la red), pero tampoco se dice «ok».
 *
 * PUNTO CIEGO DECLARADO: mide los anchos listados, no todos; entre medio manda el margen del corte.
 * --------------------------------------------------------------------------- */
async function medirBarra() {
  const { existsSync, statSync } = await import("node:fs");
  const { createServer } = await import("node:http");
  const { join, extname, normalize } = await import("node:path");
  const { abrirChrome } = await import("./lib/chrome.mjs");

  const hojas = ["src/styles/componentes/nav.css", "src/styles/pages/home.css"];
  const cortes = hojas.map((h) => {
    const m = [...sinComentarios(readFileSync(h, "utf8")).matchAll(/@media\(min-width:(\d+)px\)\{nav:not\(\[class\]\) \.nav-links\{display:flex\}\}/g)];
    return m.length === 1 ? Number(m[0][1]) : null;
  });
  if (cortes.some((c) => c === null) || cortes[0] !== cortes[1]) {
    mal(`el corte de la hamburguesa no está una vez y igual en las dos hojas (${hojas.join(", ")}): ${cortes}`);
    return;
  }
  const CORTE = cortes[0];
  ok(`corte de la hamburguesa: ${CORTE}px, igual en nav.css y home.css`);
  if (!existsSync("dist/es/index.html") || !existsSync("dist/index.html")) { mal("no hay dist/: --medir corre después de construir"); return; }

  const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript", ".mjs": "text/javascript",
    ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".woff2": "font/woff2", ".json": "application/json" };
  const srv = createServer((req, res) => {
    let p = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname)).replace(/^(\.\.[/\\])+/, "");
    let f = join("dist", p);
    if (existsSync(f) && statSync(f).isDirectory()) f = join(f, "index.html");
    if (!existsSync(f)) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { "content-type": TIPOS[extname(f)] || "application/octet-stream" });
    res.end(readFileSync(f));
  });
  await new Promise((r) => srv.listen(0, "127.0.0.1", r));
  const BASE = `http://127.0.0.1:${srv.address().port}`;

  // Corre DENTRO de la página. Sin parámetros: evaluar() la serializa con toString().
  const medir = async () => {
    await document.fonts.ready;
    const fuentes = document.fonts.check('16px "IBM Plex Sans"') && document.fonts.check('18px "Newsreader"');
    const nav = document.querySelector("nav:not([class])");
    if (!nav) return { sinBarra: true };
    const links = [...nav.querySelectorAll(".nav-links a")];
    const visibles = getComputedStyle(nav.querySelector(".nav-links")).display !== "none" && links.some((a) => a.getBoundingClientRect().width > 0);
    const burger = nav.querySelector(".burger");
    const lang = nav.querySelector(".nav-right .lang");
    const wm = nav.querySelector(".wm").getBoundingClientRect();
    return {
      ancho: innerWidth, fuentes, visibles,
      burger: getComputedStyle(burger).display !== "none",
      encime: visibles ? Math.round((wm.right - links[0].getBoundingClientRect().left) * 10) / 10 : null,
      lineasIdioma: Math.round(lang.getBoundingClientRect().height / parseFloat(getComputedStyle(lang).lineHeight)),
      desborda: document.documentElement.scrollWidth > innerWidth,
    };
  };
  const conCorteViejo = async () => {
    const st = document.createElement("style");
    st.textContent = "@media(min-width:840px){html body nav:not([class]) .nav-links{display:flex!important} html body nav:not([class]) .burger{display:none!important}}";
    document.head.appendChild(st);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const nav = document.querySelector("nav:not([class])");
    const a = nav.querySelector(".nav-links a").getBoundingClientRect();
    const wm = nav.querySelector(".wm").getBoundingClientRect();
    const lang = nav.querySelector(".nav-right .lang");
    return { encime: Math.round((wm.right - a.left) * 10) / 10,
      lineasIdioma: Math.round(lang.getBoundingClientRect().height / parseFloat(getComputedStyle(lang).lineHeight)) };
  };

  const MARGEN = 8;
  const anchos = [...new Set([840, 980, CORTE - 1, CORTE, 1280])].sort((a, b) => a - b);
  let sinFuentes = 0;
  try {
    for (const ancho of anchos) {
      const c = await abrirChrome({ ancho, alto: 900 });
      try {
        for (const ruta of ["/es/", "/"]) {
          const m = await c.evaluar(BASE + ruta, medir, 1500);
          const d = `${ruta} @${ancho}`;
          if (m.sinBarra) { mal(`${d}: no encontré la barra (nav:not([class]))`); continue; }
          if (m.ancho !== ancho) { mal(`${d}: el navegador midió a ${m.ancho}px — el instrumento no mide lo que dice`); continue; }
          if (!m.fuentes) { sinFuentes++; console.log(`  NO MEDIDO ${d}: no cargaron las fuentes de marca (Google Fonts); con las de reemplazo el ancho es otro`); continue; }
          const debeVer = ancho >= CORTE;
          if (m.visibles !== debeVer) mal(`${d}: los items ${m.visibles ? "se ven" : "no se ven"} y el corte es ${CORTE}px`);
          else if (!debeVer && !m.burger) mal(`${d}: sin items y sin hamburguesa — no hay cómo navegar`);
          else if (debeVer && m.encime > -MARGEN) mal(`${d}: la marca queda a ${-m.encime}px del primer enlace (encime ${m.encime}px; se pide ≥ ${MARGEN}px de aire)`);
          else if (m.lineasIdioma !== 1) mal(`${d}: EN/ES cae en ${m.lineasIdioma} líneas`);
          else if (m.desborda) mal(`${d}: la página se desborda a lo ancho`);
          else ok(`${d.padEnd(14)} ${debeVer ? `items a la vista, marca a ${-m.encime}px del primer enlace` : "hamburguesa, items en el menú móvil"} · EN/ES en 1 línea`);
        }
        if (ancho === 840) {
          const g = await c.evaluar(BASE + "/es/", conCorteViejo, 1500);
          g.encime > -MARGEN || g.lineasIdioma !== 1
            ? ok(`grito/silencio           con el corte viejo (840px) la misma medida da encime ${g.encime}px y EN/ES en ${g.lineasIdioma} líneas; la página real pasa`)
            : mal(`la mutación no sirve: con el corte viejo a 840px la medida no ve encime (${g.encime}px, ${g.lineasIdioma} líneas)`);
        }
      } finally { await c.cerrar(); }
    }
  } finally { srv.close(); }
  if (sinFuentes) console.log(`  NO MEDIDO en ${sinFuentes} de ${anchos.length * 2} casos: sin las fuentes de marca no se puede afirmar nada del ancho`);
}
