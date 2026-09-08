/**
 * T-nav — la barra tiene los seis enlaces, el CTA y el menu movil.
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

const en = ["/pilots","/services","/library","/ledger","/monitor","/methodology"];
const es = ["/es/pilotos","/es/servicios","/es/biblioteca","/es/ledger","/es/monitor","/es/metodologia"];
const faltanEn = en.filter((r) => !src.includes(`"${r}"`));
const faltanEs = es.filter((r) => !src.includes(`"${r}"`));
faltanEn.length ? mal(`faltan rutas EN: ${faltanEn}`) : ok(`6 enlaces EN`);
faltanEs.length ? mal(`faltan rutas ES: ${faltanEs}`) : ok(`6 enlaces ES`);
// Los textos son los aprobados: EN de la maqueta v20, ES de
// handoff/web/rosetta-home-es-textos-v20.md (2-sep). Si cambian, cambia el aprobado
// primero — este guardia esta escrito contra el texto, no contra "hay un boton".
src.includes("Get a verdict") && src.includes("Obtén un veredicto") ? ok("CTA en los dos idiomas, con el texto aprobado") : mal("falta el CTA en algun idioma, o no dice el texto aprobado");
src.includes('id="burger"') && src.includes('id="mobileMenu"') && src.includes("aria-expanded") ? ok("hamburguesa con aria-expanded y menu movil") : mal("falta la hamburguesa o el menu movil");
/--[a-z0-9-]+\s*:/.test(css) ? mal("nav.css declara tokens: los sombrearia (D3)") : ok("nav.css no declara tokens");
[".burger",".mobile-menu",".nav-links",".nav-cta"].every((c) => css.includes(c)) ? ok("CSS de la barra portado") : mal("falta CSS de la barra");

console.log(fallos.length ? `\nT-nav: ${fallos.length} fallo(s)` : "\nT-nav: barra completa en los dos idiomas");
process.exit(fallos.length ? 1 : 0);
