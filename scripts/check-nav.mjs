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
import { readFileSync } from "node:fs";
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

console.log(fallos.length ? `\nT-nav: ${fallos.length} fallo(s)` : "\nT-nav: barra completa en los dos idiomas");
process.exit(fallos.length ? 1 : 0);
