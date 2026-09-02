/**
 * T-css — los tokens de marca viven en la capa que gana, y nadie los sombrea.
 *
 * EL DEFECTO QUE VIGILA (mina nº3 del catastro)
 * ---------------------------------------------
 * BaseLayout importa global.css y despues inyecta el CSS de pagina INLINE:
 *     <style is:global set:html={pageCss}>
 * A igual especificidad gana el ultimo, asi que un token redefinido en
 * styles/pages/*.css hace INVISIBLE al de global.css. Antes del commit 3, las cinco
 * paginas redeclaraban la misma paleta vieja completa: global.css no llegaba nunca.
 *
 * COMO
 * ----
 * Contra el HTML servido por el preview, para cada pagina:
 *   1. los tokens de marca resuelven al valor del brand system (en la cascada);
 *   2. NINGUN bloque inline los vuelve a declarar.
 *
 * Punto ciego declarado: esto comprueba la CASCADA, no el pixel. Una pagina puede
 * tener los tokens correctos y verse mal. Eso lo ve un humano, no este guardia.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: un token de marca sombreado por el CSS de pagina se ve bien en el archivo y no llega nunca a la pantalla",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const MARCA = {
  "--paper": "#F4F5F1",
  "--ink": "#16181B",
  "--verdict": "#0F8B7E",
  "--pending": "#B8892E",
  "--alert": "#B4432F",
};

// GEOMETRIA APROBADA de la maqueta congelada v20. No es decoracion: cambia lo que el
// lector ve. Al mover los tokens de la maqueta a global.css (commit 3), --maxw:1000px
// se renombro a --maxw-brand y el CSS de pagina siguio pidiendo var(--maxw)... que SI
// existe en global.css, con el valor del diseño VIEJO: 1080px. Resultado: la home se
// sirvio 80px mas ancha que la maqueta aprobada, sin error, sin fallback, sin nada roto.
// Un token que no existe se nota; uno que existe con OTRO valor, no.
// Medido en el navegador antes del arreglo: getComputedStyle('.wrap').maxWidth = 1080px.
const GEOMETRIA = { ".wrap": { prop: "max-width", valor: "1000px" } };
// Solo las paginas YA portadas a la v20. /ledger/ y /blog/ siguen en el diseño viejo y
// miden 1080px con razon: exigirles la geometria de la maqueta seria un falso positivo,
// y un falso positivo retiene trabajo bueno — peor que dejar pasar un caso.
const RUTAS_MARCA = new Set((process.env.RUTAS_REBUILD || "/,/es/").split(",").map((r) => r.trim()));

async function texto(u) { const r = await fetch(u, { headers: { "x-rq-check": "1" } }); return { code: r.status, t: await r.text() }; }

// La hoja global: se toma del <link> de la propia pagina, no de una ruta escrita a mano.
async function cascadaDe(ruta) {
  const { code, t: html } = await texto(PREVIEW + ruta);
  if (code !== 200) return { code, global: "", inline: "" };
  const href = (html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/) || [])[1];
  const global = href ? (await texto(new URL(href, PREVIEW + ruta).href)).t : "";
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  return { code, global, inline };
}

// Un slug de D1 en vivo: uno escrito a mano deja de existir y la prueba verifica un 404.
const idx = await texto(PREVIEW + "/blog/");
const slug = (idx.t.match(/href="\/blog\/([a-z0-9-]+)\/"/) || [])[1];

const paginas = ["/", "/ledger/", slug ? `/blog/${slug}/` : null].filter(Boolean);
console.log(`preview: ${PREVIEW}\npaginas: ${paginas.join(" · ")}\n`);

const fallos = [];
for (const ruta of paginas) {
  const { code, global, inline } = await cascadaDe(ruta);
  if (code !== 200) { console.log(`  FALLA ${ruta} -> ${code}`); fallos.push(ruta); continue; }

  const problemas = [];
  for (const [tok, val] of Object.entries(MARCA)) {
    const re = new RegExp(tok.replace("--", "--") + "\\s*:\\s*([^;}]+)");
    const enGlobal = (global.match(re) || [])[1]?.trim().toUpperCase();
    if (!enGlobal) problemas.push(`${tok} no esta en la hoja global`);
    else if (enGlobal !== val.toUpperCase()) problemas.push(`${tok} = ${enGlobal}, se esperaba ${val}`);
    if (re.test(inline)) problemas.push(`${tok} REDEFINIDO en el <style> inline — sombrea a global`);
  }
  // Geometria: se resuelve el token que usa la regla y se compara con la maqueta.
  // El resolver es deliberadamente simple —ultima declaracion gana, que es como se
  // comportan estos tokens, todos a nivel :root—. Punto ciego declarado: no evalua
  // overrides dentro de media queries.
  const cascada = global + "\n" + inline;
  for (const [sel, { prop, valor }] of (RUTAS_MARCA.has(ruta) ? Object.entries(GEOMETRIA) : [])) {
    const regla = new RegExp(sel.replace(".", "\\.") + "\\s*\\{[^}]*" + prop + "\\s*:\\s*([^;}]+)");
    const m = cascada.match(regla);
    if (!m) continue; // la pagina no usa ese selector
    let v = m[1].trim();
    const usaToken = v.match(/var\(\s*(--[\w-]+)\s*\)/);
    if (usaToken) {
      let ultimo = null;
      for (const d of cascada.matchAll(new RegExp(usaToken[1] + "\\s*:\\s*([^;}]+)", "g"))) ultimo = d[1];
      v = ultimo ? ultimo.trim() : "(sin declarar)";
    }
    if (v !== valor) problemas.push(`${sel} ${prop} = ${v}${usaToken ? ` (via ${usaToken[1]})` : ""}, la maqueta v20 dice ${valor}`);
  }

  if (problemas.length) {
    console.log(`  FALLA ${ruta}`); problemas.forEach((p) => console.log(`        ${p}`)); fallos.push(ruta);
  } else {
    console.log(`  ok    ${ruta.padEnd(26)} 5/5 tokens de marca resuelven y ninguno esta sombreado`);
  }
}

if (fallos.length) { console.log(`\nT-css: ${fallos.length} pagina(s) con la cascada rota.`); process.exit(1); }
console.log(`\nT-css: los tokens de marca ganan en las ${paginas.length} paginas.`);
