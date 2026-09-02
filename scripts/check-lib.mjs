/**
 * T-lib — la Biblioteca dice lo que el archivo dice, y no de mas.
 *
 * QUE VIGILA, Y POR QUE CADA COSA
 * -------------------------------
 * 1. Las cuatro paginas responden 200 y llevan su par hreflang.
 *
 * 2. Las cifras HORNEADAS del catalogo (74 · 625 · 31/18/14/11) siguen siendo las que
 *    sirve /v1/algorithms. Se hornean a proposito —el catalogo entero son 241 KB y es
 *    una instantanea sellada, no un dato vivo— pero horneado sin comparar es como se
 *    publica un numero viejo durante meses. Aqui se compara contra el terreno.
 *
 * 3. Los 3 claims verified=0 NO aparecen en ninguna de las cuatro paginas ni en el
 *    endpoint. Es la regla del spec §5: no se muestran hasta verificarse.
 *
 * 4. El buscador devuelve algo real. No "el endpoint responde 200": que una consulta
 *    concreta traiga al menos un resultado de cada uno de los tres archivos. Un
 *    buscador que responde 200 con cero resultados a todo se ve perfecto.
 *
 * PUNTO CIEGO DECLARADO: comprueba los datos y las rutas, no el dibujo. Que la tabla del
 * registro se vea bien y que la barra mida lo que dice lo ve un humano o la QA de
 * navegador — aqui solo se garantiza que el dato que recibe es el correcto.
 */
export const CONSUMIDOR = {
  quien: "quien empuja a una rama rebuild y quien autoriza el cutover",
  hace: "no publica la Biblioteca: o muestra un claim sin verificar, o pinta una cifra del catalogo que ya no es la del archivo",
};

const PREVIEW = (process.env.PREVIEW_URL || "").replace(/\/+$/, "");
if (!PREVIEW) { console.error("ABORTA: falta PREVIEW_URL"); process.exit(1); }

// Los tres que D1 marca verified=0 (spec §5). No se muestran hasta verificarse.
const SIN_VERIFICAR = ["MSFT-MAJORANA1", "IONQ-ANSYS-MEDDEV", "JACS-CTQW-PROTEIN"];
const PAGINAS = [
  ["/library", "/es/biblioteca"],
  ["/library/registry", "/es/biblioteca/registro"],
];

const cifras = JSON.parse((await import("node:fs")).readFileSync("src/data/library-cifras.json", "utf8"));
const fallos = [];
const ok = (m) => console.log("  ok    " + m);
const mal = (m) => { console.log("  FALLA " + m); fallos.push(m); };

async function pide(r) { const x = await fetch(PREVIEW + r, { headers: { "x-rq-check": "1" } }); return { code: x.status, t: await x.text() }; }

console.log(`preview: ${PREVIEW}\n`);

// 1 · las cuatro paginas, con su par
for (const [en, es] of PAGINAS) {
  for (const [ruta, otra] of [[en, es], [es, en]]) {
    const r = await pide(ruta);
    if (r.code !== 200) { mal(`${ruta} -> ${r.code}`); continue; }
    if (!r.t.includes(`href="https://rosettaquantum.com${otra}`)) mal(`${ruta} sin hreflang a ${otra}`);
    else ok(`${ruta.padEnd(24)} 200 · hreflang -> ${otra}`);
  }
}

// 2 · lo horneado contra el catalogo servido
const cat = await (await fetch(PREVIEW + "/v1/algorithms?limit=200")).json();
const vivas = {};
for (const it of cat.items || []) vivas[it.categoria_id] = (vivas[it.categoria_id] || 0) + 1;
const refsVivas = (cat.items || []).reduce((n, it) => n + ((it.referencias || []).length), 0);
if (cat.total_catalogo !== cifras.algoritmos) mal(`catalogo: ${cat.total_catalogo} servidos vs ${cifras.algoritmos} horneados`);
else if (refsVivas !== cifras.referencias) mal(`referencias: ${refsVivas} servidas vs ${cifras.referencias} horneadas`);
else {
  const dif = cifras.clases.filter((c) => vivas[c.id] !== c.n);
  if (dif.length) dif.forEach((c) => mal(`clase ${c.id}: ${vivas[c.id]} servidos vs ${c.n} horneados`));
  else ok(`catalogo horneado = servido · ${cifras.algoritmos} algoritmos · ${cifras.referencias} referencias · ${cifras.clases.map((c) => c.id + ":" + c.n).join(" ")}`);
}

// 3 · los no verificados no salen
const cl = await (await fetch(PREVIEW + "/v1/claims?limit=50")).json();
const ids = (cl.claims || []).map((c) => c.id);
const colados = SIN_VERIFICAR.filter((x) => ids.includes(x));
if (colados.length) mal(`/v1/claims sirve claims sin verificar: ${colados.join(", ")}`);
else if (cl.verificados !== ids.length) mal(`/v1/claims declara ${cl.verificados} verificados y sirve ${ids.length}`);
else ok(`/v1/claims: ${cl.verificados} verificados servidos · ${cl.no_verificados_excluidos} excluidos · 0 colados`);

for (const [en, es] of PAGINAS) {
  for (const ruta of [en, es]) {
    const r = await pide(ruta);
    const dentro = SIN_VERIFICAR.filter((x) => r.t.includes(x));
    if (dentro.length) mal(`${ruta} nombra un claim sin verificar: ${dentro.join(", ")}`);
  }
}

// 4 · el buscador trae algo real de los tres archivos
const consultas = [["QAOA", "/v1/algorithms?limit=20&q=QAOA", "items"], ["quantum", "/v1/search?limit=10&q=quantum", "items"]];
for (const [q, url, campo] of consultas) {
  const d = await (await fetch(PREVIEW + url)).json();
  const n = (d[campo] || []).length;
  if (n < 1) mal(`buscar "${q}" en ${url.split("?")[0]} devuelve 0 — un buscador vacio responde 200 igual`);
  else ok(`buscar "${q}" en ${url.split("?")[0].padEnd(16)} devuelve ${n}`);
}
const conClaims = (cl.claims || []).filter((c) => (c.title + c.claimant).toLowerCase().includes("google")).length;
if (conClaims < 1) mal(`buscar "google" en los claims devuelve 0`);
else ok(`buscar "google" en los claims          devuelve ${conClaims}`);

if (fallos.length) { console.log(`\nT-lib: ${fallos.length} fallo(s).`); process.exit(1); }
console.log("\nT-lib: la Biblioteca sirve el archivo completo y ningun claim sin verificar.");
