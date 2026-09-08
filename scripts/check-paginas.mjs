/**
 * T-pages — las paginas del commit 9 existen en los dos idiomas, con su par hreflang,
 * su chrome una sola vez y ningun enlace muerto.
 *
 * POR QUE HACE FALTA UN GUARDIA PARA ALGO TAN OBVIO
 * ------------------------------------------------
 * Porque las tres cosas que vigila ya fallaron en este repo, en silencio:
 *  · la home salio con DOS pies (el de la maqueta y el del layout viejo);
 *  · salio con 24 enlaces href="#", que no dan 404 ni error de consola;
 *  · y el par ES de una ruta es facil de olvidar — la pagina EN se ve perfecta sola.
 * Ninguna de las tres rompe nada visible. Por eso se cuentan.
 *
 * PUNTO CIEGO DECLARADO: comprueba que la pagina exista, este completa y no tenga
 * enlaces muertos. NO comprueba que el texto sea el correcto ni que se vea bien: el
 * texto en español de estas paginas es borrador y lo aprueba Nicholas, no un script.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no fusiona: falta media pagina en un idioma, o hay enlaces que no llevan a ninguna parte",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

// [EN, ES] — los pares del spec §1. Crece con cada commit que crea rutas.
const PARES = [
  ["/services", "/es/servicios"],
  ["/pilots", "/es/pilotos"],
  ["/methodology", "/es/metodologia"],
  ["/about", "/es/nosotros"],
  ["/errata", "/es/erratas"],
  ["/contact", "/es/contacto"],
  ["/monitor", "/es/monitor"],
  ["/verify", "/es/verificar"],
  ["/policies", "/es/politicas"],
  ["/library", "/es/biblioteca"],
  ["/library/registry", "/es/biblioteca/registro"],
];

const fallos = [];
const cuenta = (t, re) => (t.match(re) || []).length;

console.log(`preview: ${PREVIEW}\npares: ${PARES.length}\n`);

for (const [en, es] of PARES) {
  for (const [ruta, otra] of [[en, es], [es, en]]) {
    let r;
    try { r = await fetch(PREVIEW + ruta, { headers: { "x-rq-check": "1" } }); }
    catch (e) { console.log(`  FALLA ${ruta} — ${String(e).slice(0, 50)}`); fallos.push(ruta); continue; }
    if (r.status !== 200) { console.log(`  FALLA ${ruta} -> ${r.status}`); fallos.push(ruta); continue; }
    const t = await r.text();

    const problemas = [];
    if (!t.includes(`href="https://rosettaquantum.com${otra}`)) problemas.push(`sin hreflang a ${otra}`);
    if (cuenta(t, /<footer[\s>]/g) !== 1) problemas.push(`${cuenta(t, /<footer[\s>]/g)} pies`);
    if (cuenta(t, /class="wordmark"/g) !== 1) problemas.push(`${cuenta(t, /class="wordmark"/g)} barras`);
    const muertos = cuenta(t, /href="#"/g);
    if (muertos) problemas.push(`${muertos} enlaces href="#"`);
    if (cuenta(t, /class="wm-text"/g)) problemas.push("chrome viejo montado debajo");
    if (t.length < 8000) problemas.push(`solo ${t.length} bytes — la pagina llego vacia`);

    if (problemas.length) { console.log(`  FALLA ${ruta.padEnd(24)} ${problemas.join(" · ")}`); fallos.push(ruta); }
    else console.log(`  ok    ${ruta.padEnd(24)} 200 · 1 barra · 1 pie · 0 muertos · hreflang -> ${otra}`);
  }
}

// La decision page de muestra se sirve como ARCHIVO aprobado, byte a byte. Si dejara de
// estar, /services enlazaria a un 404 desde su propia linea de venta.
const m = await fetch(PREVIEW + "/services/sample-report", { headers: { "x-rq-check": "1" } });
if (m.status !== 200) { console.log(`  FALLA /services/sample-report -> ${m.status}`); fallos.push("/services/sample-report"); }
else {
  const t = await m.text();
  if (!t.includes("V-0012")) { console.log("  FALLA /services/sample-report no menciona V-0012"); fallos.push("sample-report"); }
  else console.log(`  ok    /services/sample-report  200 · ${t.length} bytes · decision page V-0012`);
}

if (fallos.length) { console.log(`\nT-pages: ${fallos.length} fallo(s).`); process.exit(1); }
console.log(`\nT-pages: los ${PARES.length} pares responden completos en los dos idiomas.`);
