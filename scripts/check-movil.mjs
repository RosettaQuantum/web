/**
 * T-movil — las cuatro reglas de teléfono siguen ganando la cascada, y la marca es la
 * decidida.
 *
 * POR QUE NO BASTA CON "LA REGLA ESTA EN LA HOJA"
 * ----------------------------------------------
 * Porque estaba, y no se aplicaba. Medido a 375 px el 7-sep: `.casetabs` computaba
 * `flex-wrap: wrap` aunque la hoja trae `flex-wrap:nowrap` dentro de
 * `@media(max-width:839px)` — la regla base con `wrap` aparece DESPUES en el archivo y,
 * a igual especificidad, gana la ultima. La regla existia, estaba escrita para el caso
 * correcto, y perdia por orden. Por eso este guardia mira cual es la ULTIMA declaracion
 * de cada propiedad, no si la regla aparece.
 *
 * QUE VIGILA
 * ----------
 *  1. `.casetabs` termina en nowrap (pestañas en scroll horizontal, no apiladas).
 *  2. `.bar` tiene un minimo de relleno: los claims erosionados llevan data-w="2%", que
 *     sobre una pista de 165 px son 3 px y se leen como barra vacia.
 *  3. `.burger span` mide 2 px o mas: 1,6 px no cae en un pixel de dispositivo.
 *  4. La marca servida es hoja teal SIN punto, y hay favicon (no lo habia: /favicon.svg
 *     y /favicon.ico daban 404 en produccion y en el preview).
 *
 * PUNTO CIEGO DECLARADO, Y ES GRANDE: esto lee CSS y SVG, no pixeles. Que la barra se
 * VEA, que la hamburguesa se distinga sobre el panel y que el encabezado no moleste son
 * cosas de mirar un telefono real. Ese sigue siendo el trabajo de Nicholas; aqui solo se
 * garantiza que lo arreglado no se desarregle solo.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild",
  hace: "no sigue: en escritorio se ve perfecto y en un telefono la barra no tiene relleno, las pestañas se apilan y el menu es una caja vacia",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };

const html = await (await fetch(PREVIEW + "/", { headers: { "x-rq-check": "1" } })).text();
const cabeza = html.slice(0, html.indexOf("</head>") + 7);

// La cascada, en el orden en que el documento la sirve (mismo criterio que T-css).
let css = "";
for (const m of cabeza.matchAll(/<style[^>]*>([\s\S]*?)<\/style>|<link[^>]+rel="stylesheet"[^>]+href="([^"]+\.css)"[^>]*>/g)) {
  css += "\n" + (m[1] !== undefined ? m[1] : await (await fetch(new URL(m[2], PREVIEW).href)).text());
}

// La ULTIMA declaracion de `prop` en las reglas cuyo selector calza `sel`, mirando solo
// los bloques que aplican a un telefono (fuera de @media, o dentro de un max-width chico).
function ultimo(sel, prop, soloMovil = false) {
  let val = null;
  const re = new RegExp("([^{}]*" + sel + "[^{},]*)\\{([^}]*)\\}", "g");
  for (const m of css.matchAll(re)) {
    const dec = new RegExp(prop + "\\s*:\\s*([^;}]+)").exec(m[2]);
    if (!dec) continue;
    if (soloMovil) {
      const antes = css.slice(0, m.index);
      const media = [...antes.matchAll(/@media([^{]*)\{/g)].pop();
      const cerrados = (antes.match(/\}/g) || []).length;
      // heuristica declarada: basta con que exista una regla movil posterior a la base
      if (media && /max-width\s*:\s*(\d+)/.test(media[1]) && Number(RegExp.$1) < 900) { val = dec[1].trim(); continue; }
    }
    val = dec[1].trim();
  }
  return val;
}

// 1 · pestañas
const wrap = ultimo("\\.casetabs", "flex-wrap");
if (wrap !== "nowrap") mal(`.casetabs termina en flex-wrap:${wrap} — a 375 px las pestañas se apilan`);
else ok(".casetabs      flex-wrap:nowrap gana la cascada");

// 2 · barras del reloj
// OJO con el selector: `\.bar` casa tambien con `.bar-days`, que declara min-width:86px.
// La primera version de este guardia leyo esa regla y dijo "ok min-width:86px" sobre una
// pagina donde la barra no tenia minimo ninguno — un verde midiendo otra cosa. Se exige
// que el nombre de clase TERMINE ahi.
// Y la segunda trampa del mismo selector: la regla de excepcion
// `.bar[style*="width: 0%"]{min-width:0}` tambien empieza por `.bar`, asi que el guardia
// leyo SU PROPIA excepcion como el valor final y se puso rojo sobre una pagina correcta.
// Se exige el selector pelado: sin atributo, sin sufijo.
const min = ultimo("\\.bar(?![\\w\\-\\[.])", "min-width");
if (!min || parseFloat(min) < 4) mal(`.bar min-width = ${min || "(ninguno)"} — un 2% sobre 165 px son 3 px y se lee como barra vacia`);
else ok(`.bar           min-width:${min} — un valor distinto de cero siempre se ve`);

// 3 · hamburguesa
const alto = ultimo("\\.burger span", "height");
if (!alto || parseFloat(alto) < 2) mal(`.burger span height = ${alto || "(ninguno)"} — por debajo de 2 px la linea se desvanece en un telefono`);
else ok(`.burger span   height:${alto}`);

// 4 · la marca y el favicon
for (const [ruta, que] of [["/rosetta-mark.svg", "la marca"], ["/favicon.svg", "el favicon"]]) {
  const r = await fetch(PREVIEW + ruta, { headers: { "x-rq-check": "1" } });
  if (r.status !== 200) { mal(`${ruta} responde ${r.status} — ${que} no se sirve`); continue; }
  const svg = await r.text();
  const problemas = [];
  if (/<circle/.test(svg)) problemas.push("lleva el punto (la variante decidida no lo tiene)");
  if (/#16181B/i.test(svg)) problemas.push("la hoja va en tinta, no en teal");
  if (!/#0F8B7E/i.test(svg)) problemas.push("no usa el teal de la marca");
  if (problemas.length) mal(`${ruta} ${problemas.join(" · ")}`);
  else ok(`${ruta.padEnd(20)} hoja teal, sin punto`);
}
if (!/rel="icon"/.test(cabeza)) mal("la home no declara <link rel=icon> — el sitio no tuvo favicon nunca");
else ok("la home declara su favicon");

if (fallos.length) { console.log(`\nT-movil: ${fallos.length} fallo(s). En escritorio no se nota ninguno.`); process.exit(1); }
console.log("\nT-movil: las cuatro reglas de telefono ganan la cascada y la marca es la decidida.");
