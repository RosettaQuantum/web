/**
 * T-fuentes — la pagina pide las tipografias que su CSS dice usar.
 *
 * EL DEFECTO QUE VIGILA (medido en el preview el 2-sep-2026)
 * ---------------------------------------------------------
 * global.css declara la marca:
 *     --serif:'Newsreader',Georgia,serif;  --sans:'IBM Plex Sans',system-ui,sans-serif;
 * y BaseLayout pedia a Google Fonts otras tres familias:
 *     Marcellus, Instrument Sans, IBM Plex Mono
 * El navegador NO avisa de esto. Cae al sustituto y la pagina se ve bien —solo que en
 * otra tipografia—. Medido en el navegador contra el preview desplegado:
 *     [...document.fonts] -> ["IBM Plex Mono","Instrument Sans","Marcellus"]
 *     ancho de un texto en 40px Newsreader === ancho en 40px serif  (o sea: no cargo)
 * La home v20 llevaba dos dias sirviendose en Georgia y system-ui, y paso P0, T-guardia,
 * T-css, T-nav, T-api y una QA de navegador completa. Ninguna miraba esto.
 *
 * POR QUE NO SE USA document.fonts.check()
 * ----------------------------------------
 * Porque MIENTE: en esa misma pagina, con Newsreader ausente,
 *     document.fonts.check('40px Newsreader') -> true
 * `check` responde "puedo pintar ese texto", no "tengo esa familia". Un guardia escrito
 * con la funcion obvia se habria dado la razon solo.
 *
 * COMO
 * ----
 * Contra el HTML servido por el preview, para cada pagina:
 *   1. se leen las familias que el documento PIDE (los <link> a fonts.googleapis.com);
 *   2. se leen los tokens --serif/--sans/--mono de la cascada (global + <style> inline);
 *   3. de cada token solo se EXIGE la familia si la pagina realmente usa var(--token)
 *      —precision sobre cobertura: las 38 paginas del diseño viejo heredan los tokens
 *      de global.css pero no los usan, y marcarlas seria un falso positivo—;
 *   4. la URL de Google Fonts se pide de verdad: si una familia esta mal escrita, Google
 *      responde 400 y aqui se cae. Un href con un typo tambien sale en el sustituto.
 *
 * PUNTO CIEGO DECLARADO: esto comprueba lo que el documento PIDE, no lo que el navegador
 * PINTA. Una familia servida pero bloqueada por red o CSP pasaria verde. Eso lo mide la
 * QA de navegador, comparando anchos —nunca con fonts.check().
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien aprueba la maqueta",
  hace: "no aprueba: la pagina que mira no esta en la tipografia de la marca, y se ve bien igual",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const UA = { "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126 Safari/537.36" };
const GENERICAS = new Set(["serif", "sans-serif", "monospace", "system-ui", "ui-serif", "ui-sans-serif", "ui-monospace", "cursive", "fantasy", "-apple-system"]);

async function texto(u, h = {}) {
  const r = await fetch(u, { headers: { "x-rq-check": "1", ...h } });
  return { code: r.status, t: await r.text() };
}

const limpia = (f) => f.trim().replace(/^['"]|['"]$/g, "");

// Familias que PIDE el documento, leidas de los <link> reales de la pagina.
function pedidas(html) {
  const hrefs = [...html.matchAll(/<link[^>]+href="(https:\/\/fonts\.googleapis\.com\/css2[^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
  const fams = new Set();
  for (const h of hrefs) for (const m of h.matchAll(/family=([^:&]+)/g)) fams.add(decodeURIComponent(m[1]).replace(/\+/g, " "));
  return { hrefs, fams };
}

// Primera familia de cada token, tomada de la cascada completa (global + inline).
function tokens(css) {
  const out = {};
  for (const tok of ["--serif", "--sans", "--mono"]) {
    // el ULTIMO valor declarado es el que gana; por eso se recorre y se queda con el final
    let val = null;
    for (const m of css.matchAll(new RegExp(tok + "\\s*:\\s*([^;}]+)", "g"))) val = m[1];
    if (!val) continue;
    const primera = limpia(val.split(",")[0]);
    if (primera && !GENERICAS.has(primera.toLowerCase())) out[tok] = primera;
  }
  return out;
}

async function cascada(ruta) {
  const { code, t: html } = await texto(PREVIEW + ruta);
  if (code !== 200) return { code };
  const href = (html.match(/<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"/) || [])[1];
  const global = href ? (await texto(new URL(href, PREVIEW + ruta).href)).t : "";
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) => m[1]).join("\n");
  return { code, html, css: global + "\n" + inline };
}

const RUTAS = (process.env.RUTAS_FUENTES || "/,/ledger/").split(",").map((r) => r.trim()).filter(Boolean);
console.log(`preview: ${PREVIEW}\npaginas: ${RUTAS.join(" · ")}\n`);

const fallos = [];
const urlsVistas = new Set();

for (const ruta of RUTAS) {
  const { code, html, css } = await cascada(ruta);
  if (code !== 200) { console.log(`  FALLA ${ruta} -> ${code}`); fallos.push(ruta); continue; }

  const { hrefs, fams } = pedidas(html);
  const toks = tokens(css);
  const problemas = [];

  // Solo se exige el token que la pagina USA de verdad.
  const exigidas = [];
  for (const [tok, fam] of Object.entries(toks)) {
    if (!css.includes(`var(${tok})`)) continue;
    exigidas.push([tok, fam]);
    if (!fams.has(fam)) problemas.push(`${tok} usa '${fam}' y el documento NO la pide — sale en el sustituto, sin error`);
  }

  // La URL tiene que existir y traer cada familia: Google responde 400 a un nombre mal escrito.
  for (const h of hrefs) {
    if (urlsVistas.has(h)) continue;
    urlsVistas.add(h);
    const r = await texto(h, UA);
    if (r.code !== 200) { problemas.push(`Google Fonts responde ${r.code} a ${h.slice(0, 80)}… — ninguna familia carga`); continue; }
    for (const f of fams) {
      if (!new RegExp(`font-family:\\s*['"]?${f.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}['"]?`, "i").test(r.t)) {
        problemas.push(`Google no devuelve la familia '${f}' (nombre mal escrito o inexistente)`);
      }
    }
  }

  const etiqueta = exigidas.length ? exigidas.map(([t, f]) => `${t}=${f}`).join(" · ") : "no usa var(--serif|--sans|--mono) — nada que exigir";
  if (problemas.length) {
    console.log(`  FALLA ${ruta.padEnd(12)} pide [${[...fams].join(", ")}]`);
    problemas.forEach((p) => console.log(`        ${p}`));
    fallos.push(ruta);
  } else {
    console.log(`  ok    ${ruta.padEnd(12)} pide [${[...fams].join(", ")}] · ${etiqueta}`);
  }
}

if (fallos.length) {
  console.log(`\nT-fuentes: ${fallos.length} pagina(s) sirviendose en una tipografia que no es la suya.`);
  process.exit(1);
}
console.log(`\nT-fuentes: las ${RUTAS.length} paginas piden las familias que su CSS usa.`);
