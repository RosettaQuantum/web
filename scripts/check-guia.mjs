#!/usr/bin/env node
/**
 * T-guia — la guía PQC se sirve SÓLO publicada, y nada la anuncia antes (17-nov-2026).
 *
 * QUÉ PROTEGE. La guía vive en D1 (`pages`, published=0) y Nicholas decide el día en que sale.
 * Todo lo que este encargo agregó tiene un modo de fallo mudo que la publicaría ANTES:
 *
 *   1. La ruta sin `published=1` en el WHERE. Da 200, se ve perfecta, y la guía está afuera.
 *   2. El modo de prueba del preview que existe también en producción. Mismo resultado.
 *   3. El marcador `<!--RQ_INDICATORS-->` mal reemplazado: un valor de la base con `</script>`
 *      corta el <script> y pinta el resto como texto; un `$&` en un valor se expande en
 *      silencio con String.replace. Y si la consulta falla, la página tiene que salir IGUAL,
 *      con el marcador intacto.
 *   4. El pop-up que aparece dentro de la propia guía, o que aparece con el flag apagado o
 *      con la guía sin publicar.
 *   5. El sitemap o /llms.txt declarando una guía con published=0: Google y los agentes
 *      llegan a un 404, o peor, el día que alguien olvide el WHERE, a la guía.
 *   6. Un PDF que no es la guía impresa: vacío, en Carta, cortado, o con un nombre inventado.
 *
 * CÓMO. Contra una D1 en memoria con el esquema REAL (db/*.schema.sql), ejecutando el MISMO
 * código que corre en el Worker (lib/guia.mjs, lib/sitemap.mjs) y el MISMO archivo que baja el
 * navegador (public/js/promo-guia.js) en una página de mentira. Cada regla tiene su prueba de
 * SILENCIO (lo correcto pasa) y de GRITO por MUTACIÓN REAL: se copia el archivo con UN cambio
 * —el defecto— y la prueba tiene que caerse sobre la copia. Un guardia que sólo corre contra
 * el código bueno demuestra que el código anda, no que el guardia sirva.
 *
 * PUNTO CIEGO DECLARADO. No mira la guía de producción (eso lo hace el smoke test contra el
 * preview), no juzga cómo se ve el pop-up (eso lo mide check-sistema en el navegador y lo mira
 * una persona) y no sabe si el PDF entregado es el correcto: sabe si es el que tiene el hash
 * que Nicholas entregó.
 *
 * Uso:  node scripts/check-guia.mjs
 */
export const CONSUMIDOR = {
  quien: "el prebuild (bloquea el deploy) y la sesión que toque lib/guia.mjs, public/js/promo-guia.js o wrangler.jsonc",
  hace: "no despliega: cualquiera de estos defectos publica la guía —o la anuncia— antes de que Nicholas cambie published",
};

import { readFileSync, existsSync, readdirSync } from "node:fs";
import vm from "node:vm";
import { d1EnMemoria } from "./lib/d1-memoria.mjs";
import { conMutante } from "./lib/mutar.mjs";
import * as G from "../lib/guia.mjs";
import { augmentSitemap } from "../lib/sitemap.mjs";

const GUIA = new URL("../lib/guia.mjs", import.meta.url);
let fallos = 0;
const ok = (t) => console.log(`  ok    ${t}`);
const mal = (t) => { console.log(`  FALLA ${t}`); fallos++; };
const si = (cond, t, detalle = "") => (cond ? ok(t) : mal(detalle ? `${t} — ${detalle}` : t));
const leer = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");

// ── La base de mentira, con el esquema REAL ───────────────────────────────────────────
const RUTA_ES = "/guia/criptografia-post-cuantica", RUTA_EN = "/guide/post-quantum-cryptography";
const PDF_ES = "/guia/guia-criptografia-post-cuantica.pdf", PDF_EN = "/guide/post-quantum-cryptography-guide.pdf";
// Un display con los venenos a la vez: cierre de script, comentario, y los patrones de
// String.replace. `$&` solo no alcanza —el escapado ya convierte `&` en \u0026, y una mutación
// que no cambia nada no prueba nada—; `$'` sí: inserta el resto del documento. Desde que el
// display sale de `value_num` (17-nov) ningún valor de la base puede traerlos, así que el escapado
// y el reemplazo se ejercen con este mapa contra inyectarIndicadores, la función que usa la ruta.
const VENENO = "0 de 5 </script><!--x--> $& $' $1";
const htmlDe = (lang) => `<!doctype html><html lang="${lang}"><head><title>t</title>${G.MARCADOR}</head>` +
  `<body><p data-ind="broken_keys_rsa2048_public"><span class="v">0</span></p></body></html>`;

function base() {
  const db = d1EnMemoria("db/pages.schema.sql", "db/site-flags.schema.sql", "db/posts.schema.sql", "db/hits.schema.sql");
  const pqc = /CREATE TABLE pqc_indicators[^;]*;/.exec(leer("db/recuperado-de-produccion.schema.sql"));
  if (!pqc) throw new Error("db/recuperado-de-produccion.schema.sql ya no declara pqc_indicators");
  db.sqlite.exec(pqc[0]);
  const ins = db.sqlite.prepare("INSERT INTO pages (id,slug_base,lang,path,alt_path,title,description,html,pdf_path,version,published,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,0,?)");
  ins.run("es", G.SLUG_GUIA, "es", RUTA_ES, RUTA_EN, "Guía ES", "d", htmlDe("es"), PDF_ES, "1.1", "2026-11-17T20:40:00Z");
  ins.run("en", G.SLUG_GUIA, "en", RUTA_EN, RUTA_ES, "Guide EN", "d", htmlDe("en"), PDF_EN, "1.1", "2026-11-17T20:40:00Z");
  // `value` trae lo que escribe la rutina (texto libre, en inglés) y NO se usa; `value_num` manda.
  const ind = db.sqlite.prepare("INSERT INTO pqc_indicators (indicator_id,date,value,value_num,source_label,source_url,created_at) VALUES (?,?,?,?,'s','u','c')");
  for (const [id, fecha, v, n] of [
    ["broken_keys_rsa2048_public", "2026-11-16", "VIEJO", 7], ["broken_keys_rsa2048_public", "2026-11-17", "0", 0],
    ["quantum_attributed_breaches_public", "2026-11-16", "0", 0],
    ["quantum_attributed_breaches_public", "2026-11-17", "sin número", null],   // el último sin value_num → se salta
    ["pqc_share_https_cloudflare", "2026-09-29", "≈70", 70],
    ["nist_rsa_ecc_clock", "2026-10-27", "deprecate 2030 / disallow 2035 - FINAL", 2030],  // nunca se inyecta
    ["latam_fin_regulators_pqc_deadline", "2026-11-12", "0 de 5", 0], ["ncsc_uk_clock", "2025-03-20", "NO-DEBE-SALIR", 1],
  ]) ind.run(id, fecha, v, n);
  return db;
}
const publicar = (db, lang, v = 1) => db.sqlite.prepare("UPDATE pages SET published=? WHERE lang=?").run(v, lang);
const flag = (db, v) => db.sqlite.prepare("UPDATE site_flags SET v=? WHERE k='promo_guia'").run(v);

/** ASSETS de mentira: sólo lo que se le dé. */
function activos(mapa = {}) {
  return { fetch: async (r) => {
    const p = new URL(typeof r === "string" ? r : r.url).pathname;
    return p in mapa ? new Response(mapa[p], { status: 200 }) : new Response("", { status: 404 });
  } };
}
const pedir = (mod, db, u, { metodo = "GET", env = {}, assets = activos(), cabeceras = {} } = {}) => {
  const esperas = [];
  const ctx = { waitUntil: (p) => esperas.push(p) };
  return mod.manejarGuia(new Request(u, { method: metodo, headers: cabeceras }), { DB: db, ASSETS: assets, ...env }, new URL(u), ctx)
    .then(async (r) => { await Promise.all(esperas); return r; });
};
const PROD = "https://rosettaquantum.com", PREV = "https://rosetta-quantum-preview.x.workers.dev";
const PRUEBA = { GUIA_PRUEBA: "1" };

// ════ 1 · 404 si published=0 ══════════════════════════════════════════════════════════
console.log("1 · la ruta sólo sirve lo publicado");
{
  const db = base();
  /** La prueba de la regla, reutilizable contra el mutante. Devuelve los estados. */
  const estados = async (mod) => {
    const r0 = await pedir(mod, db, PROD + RUTA_ES);
    publicar(db, "es");
    const r1 = await pedir(mod, db, PROD + RUTA_ES);
    publicar(db, "es", 0);
    return [r0.status, r1.status, r1];
  };
  const [s0, s1, r1] = await estados(G);
  si(s0 === 404, `published=0 → ${s0} (se espera 404)`);
  si(s1 === 200, `published=1 → ${s1} (se espera 200)`);
  si(r1.headers.get("content-type") === "text/html; charset=utf-8", `content-type ${r1.headers.get("content-type")}`);
  si(/s-maxage=3600/.test(r1.headers.get("cache-control")) && /stale-while-revalidate/.test(r1.headers.get("cache-control")),
    `cache-control «${r1.headers.get("cache-control")}»`);
  const cuerpo = await r1.text();
  si(cuerpo.startsWith("<!doctype html><html lang=\"es\">") && !/rqPromo/.test(cuerpo),
    "el html es el de la fila (no se envuelve en un layout) y no lleva el pop-up");
  publicar(db, "es");
  const h = await pedir(G, db, PROD + RUTA_ES, { metodo: "HEAD" });
  si(h.status === 200 && (await h.text()) === "", "HEAD → 200 sin cuerpo");
  const barra = await pedir(G, db, PROD + RUTA_ES + "/");
  si(barra.status === 301 && barra.headers.get("location") === PROD + RUTA_ES, `con barra final → ${barra.status} ${barra.headers.get("location")}`);
  si(await G.manejarGuia(new Request(PROD + "/library/"), { DB: db }, new URL(PROD + "/library/"), {}) === null, "silencio: otra ruta devuelve null y sigue su camino");
  publicar(db, "es", 0);
  // GRITO: el WHERE sin `published = 1` tiene que caerse en esta misma prueba.
  await conMutante(GUIA, "WHERE path = ? AND published = 1\"", "WHERE path = ?\"", async (M) => {
    const [m0] = await estados(M);
    si(m0 === 200, `grito: sin «published = 1» en el WHERE, published=0 daría ${m0} — la prueba lo caza`);
  });
}

// ════ 2 · el modo de prueba no existe fuera del preview ══════════════════════════════
console.log("\n2 · el modo de prueba sólo existe en el preview");
{
  const conf = JSON.parse(leer("wrangler.jsonc").replace(/^\s*\/\/.*$/gm, ""));
  const fuera = (c, v = "GUIA_PRUEBA") => {
    const malos = [];
    if (c.vars && v in c.vars) malos.push("nivel superior");
    for (const [n, e] of Object.entries(c.env || {})) if (n !== "preview" && e.vars && v in e.vars) malos.push(n);
    return malos;
  };
  si(fuera(conf, "PROMO_PRUEBA").length === 0 && conf.env?.preview?.vars?.PROMO_PRUEBA === "1", "PROMO_PRUEBA (el ?promo=1) sólo en env.preview, y ahí está");
  si(fuera({ ...conf, vars: { PROMO_PRUEBA: "1" } }, "PROMO_PRUEBA").join() === "nivel superior", "grito: PROMO_PRUEBA en producción se detecta");
  si(fuera(conf).length === 0, `GUIA_PRUEBA sólo en env.preview (fuera: ${fuera(conf).join(", ") || "ninguno"})`);
  si(conf.env?.preview?.vars?.GUIA_PRUEBA === "1", "el preview tiene su modo de prueba");
  si(fuera({ ...conf, vars: { GUIA_PRUEBA: "1" } }).join() === "nivel superior", "grito: la variable en producción se detecta");
  si(fuera({ ...conf, env: { ...conf.env, staging: { vars: { GUIA_PRUEBA: "1" } } } }).join() === "staging", "grito: la variable en otro entorno se detecta");
  for (const lista of [conf.assets?.run_worker_first, conf.env?.preview?.assets?.run_worker_first]) {
    if (!lista || !lista.includes("/guia/*") || !lista.includes("/guide/*")) mal("run_worker_first no tiene /guia/* y /guide/*: los PDF se servirían sin pasar por la compuerta");
  }
  ok("/guia/* y /guide/* en run_worker_first de producción y del preview");

  const m = (env, u) => G.modoPruebaGuia(env, new URL(u));
  si([m(PRUEBA, PROD), m({}, PREV), m(PRUEBA, PREV), m({ GUIA_PRUEBA: "0" }, PREV)].join() === "false,false,true,false",
    "hacen falta las dos llaves: variable del preview Y host *.workers.dev");

  const db = base();
  const prueba = async (mod) => [
    (await pedir(mod, db, PROD + RUTA_ES, { env: PRUEBA })).status,     // variable, pero producción
    (await pedir(mod, db, PREV + RUTA_ES)).status,                      // workers.dev sin variable
  ];
  const [enProd, sinVar] = await prueba(G);
  si(enProd === 404, `la variable sola en rosettaquantum.com no abre el borrador (→ ${enProd})`);
  si(sinVar === 404, `workers.dev sin la variable no abre el borrador (→ ${sinVar})`);
  const r = await pedir(G, db, PREV + RUTA_EN, { env: PRUEBA });
  si(r.status === 200 && r.headers.get("cache-control") === "no-store" && /noindex/.test(r.headers.get("x-robots-tag") || "")
    && /^prueba:borrador/.test(r.headers.get("x-rq-guia") || ""),
    `preview + variable: el borrador sale con no-store, noindex y «${r.headers.get("x-rq-guia")}»`);
  await conMutante(GUIA, " && url && /\\.workers\\.dev$/.test(url.hostname));", ");", async (M) => {
    const [p] = await prueba(M);
    si(p === 200, `grito: sin la llave del host, la variable abriría el borrador en producción (→ ${p}) — la prueba lo caza`);
  });
}

// ════ 3 · el marcador ════════════════════════════════════════════════════════════════
console.log("\n3 · el marcador de indicadores");
{
  const db = base();
  publicar(db, "es");
  const carga = (html) => {
    const m = /<script>window\.RQ_INDICATORS=([\s\S]*?)<\/script>/.exec(html);
    return m ? m[1] : null;
  };
  const revisar = async (mod) => {
    const html = await (await pedir(mod, db, PROD + RUTA_ES)).text();
    const crudo = carga(html);
    let datos = null;
    try { datos = crudo ? JSON.parse(crudo) : null; } catch { /* queda null */ }
    return { html, crudo, datos };
  };
  const { html, crudo, datos } = await revisar(G);
  si(!html.includes(G.MARCADOR) && (html.match(/window\.RQ_INDICATORS=/g) || []).length === 1, "el marcador se reemplaza una vez y no queda");
  si(!!crudo && !crudo.includes("</") && !crudo.includes("<!--"), "el JSON no trae «</» ni «<!--»: no puede cerrar su <script>");
  // Lo que la página YA trae impreso: «0», «≈70%», «0/5». El reloj del NIST no se toca.
  const esperado = {
    broken_keys_rsa2048_public: { display: "0", date: "2026-11-17" },
    pqc_share_https_cloudflare: { display: "≈70%", date: "2026-09-29" },
    latam_fin_regulators_pqc_deadline: { display: "0/5", date: "2026-11-12" },
  };
  const ordenar = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));
  si(ordenar(datos) === ordenar(esperado),
    "display desde value_num con su formato («0», «≈70%», «0/5»), el ÚLTIMO de cada uno; sin el reloj del NIST, sin el de value_num nulo, sin ajenos",
    ordenar(datos).slice(0, 200));
  await conMutante(GUIA, "pqc_share_https_cloudflare: (n) => `≈${n}%`,", "pqc_share_https_cloudflare: (n) => String(n),", async (M) => {
    const { datos: d } = await revisar(M);
    si(d && d.pqc_share_https_cloudflare && d.pqc_share_https_cloudflare.display === "70", "grito: sin el formato, «≈70%» pasaría a «70» — la prueba lo caza");
  });
  await conMutante(GUIA, '    if (f.value_num === null || f.value_num === undefined || f.value_num === "") continue;\n', "", async (M) => {
    const { datos: d } = await revisar(M);
    si(d && d.quantum_attributed_breaches_public, "grito: sin saltar el value_num nulo, se pintaría «0» inventado — la prueba lo caza");
  });

  // La consulta falla: la página sale igual, con el marcador intacto.
  const rota = base();
  publicar(rota, "es");
  rota.sqlite.exec("DROP TABLE pqc_indicators");
  const rr = await pedir(G, rota, PROD + RUTA_ES);
  const cr = await rr.text();
  si(rr.status === 200 && cr === htmlDe("es") && /indicadores:FAILED/.test(rr.headers.get("x-rq-guia") || ""),
    `consulta caída → 200, el html byte a byte con el marcador, y «${rr.headers.get("x-rq-guia")}»`);

  // El escapado y el reemplazo, con el mapa envenenado sobre la misma función que usa la ruta.
  const envenenado = { latam_fin_regulators_pqc_deadline: { display: VENENO, date: "2026-11-12" } };
  const conVeneno = (mod) => {
    const h = mod.inyectarIndicadores(htmlDe("es"), envenenado).html;
    let d = null; try { d = JSON.parse(carga(h)); } catch { /* queda null */ }
    return { h, d };
  };
  { const { h, d } = conVeneno(G);
    si(d && d.latam_fin_regulators_pqc_deadline.display === VENENO && !carga(h).includes("</") && !carga(h).includes("<!--"),
      "silencio: un valor con «</script><!--» y «$'» queda literal y no cierra su <script>"); }
  await conMutante(GUIA, "window.RQ_INDICATORS=${jsonParaScript(mapa)}", "window.RQ_INDICATORS=${JSON.stringify(mapa)}", async (M) => {
    const { h, d } = conVeneno(M);
    si(h.includes("0 de 5 </script><!--x-->") && d === null,
      "grito: sin escapar «<», el valor corta el <script> y el JSON no parsea — la prueba lo caza");
  });
  await conMutante(GUIA, "html.replace(MARCADOR, () => script)", "html.replace(MARCADOR, script)", async (M) => {
    const { d } = conVeneno(M);
    si(!d || d.latam_fin_regulators_pqc_deadline.display !== VENENO, "grito: reemplazar con cadena expande «$'» y mete el resto del documento en el valor — la prueba lo caza");
  });
}

// ════ 4 · el pop-up ══════════════════════════════════════════════════════════════════
console.log("\n4 · el pop-up");
const FUENTE_POPUP = leer("public/js/promo-guia.js");

/** Una página de mentira que ejecuta el archivo REAL del pop-up. */
function pagina({ ruta = "/", busqueda = "", lang = "en", api = { mostrar: true, href: RUTA_EN }, local = {}, sesion = {}, rompe = false, modal = false, fuente = FUENTE_POPUP } = {}) {
  const estado = { modal, timers: [], fetches: [], balizas: [], escuchas: { scroll: [], keydown: [] } };
  const almacen = (datos) => ({
    datos,
    getItem(k) { if (rompe) throw new Error("bloqueado"); return k in datos ? datos[k] : null; },
    setItem(k, v) { if (rompe) throw new Error("bloqueado"); datos[k] = String(v); },
  });
  const nodo = (attrs = {}) => ({
    attrs, hidden: false, escuchas: {},
    getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; },
    setAttribute(k, v) { this.attrs[k] = String(v); },
    removeAttribute(k) { delete this.attrs[k]; },
    addEventListener(t, f) { (this.escuchas[t] ||= []).push(f); },
    click() { (this.escuchas.click || []).forEach((f) => f({})); },
  });
  const ir = nodo({ href: RUTA_EN }), x = nodo(), img = nodo({ "data-src": "/rosetta-mark.svg" });
  const el = nodo({ "data-lang": lang });
  el.hidden = true; el.offsetHeight = 120;
  el.querySelector = (s) => (s === "[data-promo-ir]" ? ir : s === "[data-promo-cerrar]" ? x
    : s === "img[data-src]" ? ("data-src" in img.attrs ? img : null) : null);
  const raiz = { scrollHeight: 4000, scrollTop: 0 };
  const sandbox = {
    location: { pathname: ruta, search: busqueda },
    localStorage: almacen(local), sessionStorage: almacen(sesion),
    innerHeight: 1000, scrollY: 0,
    document: {
      documentElement: raiz, body: { style: { paddingBottom: "" } },
      getElementById: (id) => (id === "rqPromo" ? el : null),
      querySelector: (s) => (s === "#leadModal.open" && estado.modal ? {} : null),
      addEventListener: (t, f) => (estado.escuchas[t] ||= []).push(f),
    },
    navigator: { sendBeacon: (u) => { estado.balizas.push(u); return true; } },
    fetch: (u) => { estado.fetches.push(String(u)); return Promise.resolve({ ok: true, json: () => Promise.resolve(api) }); },
    setTimeout: (f, ms) => { estado.timers.push({ f, ms }); return estado.timers.length; },
    clearTimeout: () => {},
    addEventListener: (t, f) => (estado.escuchas[t] ||= []).push(f),
    removeEventListener: (t, f) => { estado.escuchas[t] = (estado.escuchas[t] || []).filter((g) => g !== f); },
  };
  sandbox.window = sandbox;
  vm.runInNewContext(fuente, sandbox);
  const calma = () => new Promise((r) => setImmediate(r));
  return {
    estado, el, ir, x, img, sandbox,
    async reloj() { const t = estado.timers.splice(0); t.forEach((x) => x.f()); for (let i = 0; i < 4; i++) await calma(); },
    async scroll(frac) { sandbox.scrollY = frac * (raiz.scrollHeight - sandbox.innerHeight); (estado.escuchas.scroll || []).forEach((f) => f()); for (let i = 0; i < 4; i++) await calma(); },
    tecla(k) { (estado.escuchas.keydown || []).forEach((f) => f({ key: k })); },
  };
}

{
  // SILENCIO: en la home aparece, se mide, se cierra, y no vuelve.
  const p = pagina();
  si(p.estado.timers.some((t) => t.ms === 8000) && p.estado.fetches.length === 0, "en la home: espera 8 s y no pide nada antes");
  await p.reloj();
  si(p.estado.fetches[0] === "/api/promo/guia?lang=en" && p.el.hidden === false && p.ir.attrs.href === RUTA_EN,
    "a los 8 s pregunta al Worker y aparece con el enlace que él dio");
  si(p.img.attrs.src === "/rosetta-mark.svg", "el logo se pide recién al aparecer, y es /rosetta-mark.svg");
  si(p.estado.balizas.join() === "/_promo/guia/view" && p.sandbox.sessionStorage.datos["rq-promo-guia"] === "1", "cuenta la vista y marca la sesión");
  si(p.sandbox.document.body.style.paddingBottom === "144px", "no tapa contenido: el final de la página sube por encima del aviso");
  p.x.click();
  si(p.el.hidden === true && Number(p.sandbox.localStorage.datos["rq-promo-guia:cerrado"]) > 0 && p.estado.balizas.at(-1) === "/_promo/guia/close"
    && p.sandbox.document.body.style.paddingBottom === "", "al cerrar: se va, guarda la fecha en localStorage, cuenta el cierre y devuelve el espacio");
  const otra = pagina({ local: p.sandbox.localStorage.datos });
  await otra.reloj();
  si(otra.estado.fetches.length === 0 && otra.el.hidden, "cerrado hace un momento: no vuelve en la página siguiente");
  const vieja = pagina({ local: { "rq-promo-guia:cerrado": String(Date.now() - 31 * 864e5) } });
  await vieja.reloj();
  si(!vieja.el.hidden, "cerrado hace 31 días: vuelve");
  const ses = pagina({ sesion: { "rq-promo-guia": "1" } });
  await ses.reloj();
  si(ses.estado.fetches.length === 0, "ya visto en esta sesión: no vuelve");

  const sc = pagina({ lang: "es", api: { mostrar: true, href: RUTA_ES } });
  await sc.scroll(0.39);
  si(sc.estado.fetches.length === 0, "al 39 % de scroll todavía no");
  await sc.scroll(0.41);
  si(sc.estado.fetches[0] === "/api/promo/guia?lang=es" && !sc.el.hidden, "al 40 % de scroll aparece, con el idioma de la página");

  const esc = pagina(); await esc.reloj(); esc.tecla("Escape");
  si(esc.el.hidden, "se cierra con Esc");
  const md = pagina({ modal: true }); await md.reloj();
  si(md.el.hidden && md.estado.timers.some((t) => t.ms === 2000), "con el modal de leads abierto no aparece y vuelve a intentar");
  md.estado.modal = false; await md.reloj();
  si(!md.el.hidden, "cerrado el modal, aparece");
  const conModal = pagina(); await conModal.reloj(); conModal.estado.modal = true; conModal.tecla("Escape");
  si(!conModal.el.hidden, "el Esc que cierra el modal de leads no cierra también el aviso");
  const rompe = pagina({ rompe: true }); await rompe.reloj();
  si(!rompe.el.hidden, "con el almacenamiento bloqueado (try/catch) sigue funcionando");
  const no = pagina({ api: { mostrar: false, motivo: "flag-apagado" } }); await no.reloj();
  si(no.el.hidden && no.estado.balizas.length === 0, "si el Worker dice que no, no aparece ni cuenta nada");
  const raro = pagina({ api: { mostrar: true, href: "https://otro.example/" } }); await raro.reloj();
  si(raro.el.hidden, "un destino que no es la guía no se acepta");

  // ?promo=1: se salta la memoria de sesión y de cierre, y se lo pide al Worker (que en producción
  // lo ignora). En la guía, ni con el parámetro.
  const forz = pagina({ busqueda: "?promo=1", sesion: { "rq-promo-guia": "1" }, local: { "rq-promo-guia:cerrado": String(Date.now()) } });
  await forz.reloj();
  si(forz.estado.fetches[0] === "/api/promo/guia?lang=en&promo=1" && !forz.el.hidden, "?promo=1: aparece aunque ya se haya visto y cerrado, y pide con &promo=1");
  const sinForz = pagina({ busqueda: "?promo=0", sesion: { "rq-promo-guia": "1" } });
  await sinForz.reloj();
  si(sinForz.estado.fetches.length === 0, "silencio: ?promo=0 no fuerza nada");
  const forzGuia = pagina({ ruta: RUTA_ES, busqueda: "?promo=1" });
  await forzGuia.reloj();
  si(forzGuia.el.hidden && forzGuia.estado.fetches.length === 0, "?promo=1 dentro de la guía: tampoco aparece");

  // LA REGLA: nunca en la guía.
  const enGuia = async (fuente) => {
    const vistos = [];
    for (const ruta of [RUTA_ES, RUTA_EN, "/guia/", "/guide"]) {
      const g = pagina({ ruta, fuente });
      await g.reloj(); await g.scroll(0.9);
      vistos.push(!g.el.hidden || g.estado.fetches.length > 0);
    }
    return vistos;
  };
  si((await enGuia(FUENTE_POPUP)).every((v) => !v), "en /guia/* y /guide/* no programa nada, no pide nada y no aparece");
  const de = '/^\\/(?:guia|guide)(?:\\/|$)/.test(ruta || "")';
  if (FUENTE_POPUP.split(de).length !== 2) mal("la mutación del pop-up no entra: el texto a cambiar no aparece una vez");
  else si((await enGuia(FUENTE_POPUP.replace(de, "false"))).every((v) => v), "grito: sin la exclusión de la guía, aparecería en las cuatro rutas — la prueba lo caza");

  // Todo layout que arma un <html> monta el aviso: «en todo el sitio» se comprueba, no se supone.
  const sinAviso = readdirSync(new URL("../src/layouts/", import.meta.url)).filter((f) => f.endsWith(".astro"))
    .filter((f) => { const s = leer("src/layouts/" + f); return /<html/.test(s) && !/<PromoGuia lang=\{lang\} \/>/.test(s); });
  si(sinAviso.length === 0, `todos los layouts con <html> montan el aviso (sin él: ${sinAviso.join(", ") || "ninguno"})`);
}

{
  // El Worker: el flag Y la publicación, las dos.
  const db = base();
  const estado = async (mod, u = PROD, lang = "en", env = {}) => {
    const r = await pedir(mod, db, `${u}/api/promo/guia?lang=${lang}`, { env });
    return r.json();
  };
  const casos = async (mod) => {
    const out = {};
    flag(db, "0"); publicar(db, "en", 1); publicar(db, "es", 1); out.flag0pub1 = (await estado(mod)).mostrar;
    flag(db, "1"); publicar(db, "en", 0); publicar(db, "es", 0); out.flag1pub0 = (await estado(mod)).mostrar;
    publicar(db, "en", 1); out.flag1pub1 = await estado(mod);
    out.soloEnDesdeEs = await estado(mod, PROD, "es");
    flag(db, "true"); out.flagTrue = (await estado(mod)).mostrar;
    flag(db, "0"); publicar(db, "en", 0);
    // ?promo=1: sólo con la variable del preview, en *.workers.dev y con el parámetro.
    const promo = { PROMO_PRUEBA: "1" };
    const forzado = async (u, env) => (await (await pedir(mod, db, `${u}/api/promo/guia?lang=es&promo=1`, { env })).json());
    out.forzado = await forzado(PREV, promo);
    out.forzadoEnProd = (await forzado(PROD, promo)).mostrar;
    out.forzadoSinVar = (await forzado(PREV, {})).mostrar;
    out.previewSinParam = (await estado(mod, PREV, "es", { ...promo, ...PRUEBA })).mostrar;
    return out;
  };
  const c = await casos(G);
  si(c.flag0pub1 === false, "flag apagado + guía publicada → no aparece");
  si(c.flag1pub0 === false, "flag encendido + guía sin publicar → no aparece");
  si(c.flag1pub1.mostrar === true && c.flag1pub1.href === RUTA_EN, "flag encendido + guía publicada → aparece y enlaza a la publicada");
  si(c.soloEnDesdeEs.href === RUTA_EN, "en una página en español, con sólo la inglesa publicada, enlaza a la publicada");
  si(c.flagTrue === false, "falla cerrado: un flag distinto de '1' es apagado");
  si(c.forzado.mostrar === true && c.forzado.href === RUTA_ES, "?promo=1 en el preview: aparece con el flag apagado y la guía sin publicar, y enlaza al borrador");
  si(c.forzadoEnProd === false, "?promo=1 en producción (aun con la variable): no hace nada");
  si(c.forzadoSinVar === false, "?promo=1 en workers.dev sin la variable: no hace nada");
  si(c.previewSinParam === false, "silencio: sin ?promo=1, el preview se comporta como producción (flag Y published)");
  const sinTabla = base(); sinTabla.sqlite.exec("DROP TABLE site_flags"); publicar(sinTabla, "en");
  si((await (await pedir(G, sinTabla, PROD + "/api/promo/guia")).json()).mostrar === false, "sin la tabla de flags → no aparece");
  await conMutante(GUIA, ' && url && /\\.workers\\.dev$/.test(url.hostname)\n    && url.searchParams', "\n    && url.searchParams", async (M) => {
    const m = await casos(M);
    si(m.forzadoEnProd === true, "grito: sin la llave del host, ?promo=1 encendería el pop-up en producción — la prueba lo caza");
  });
  await conMutante(GUIA, 'String(f.v).trim() === "1"', "true", async (M) => {
    const m = await casos(M);
    si(m.flag0pub1 === true, "grito: si el flag no se mirara, aparecería con el flag apagado — la prueba lo caza");
  });

  // La medición en `hits`.
  const ev = (u, metodo = "POST") => pedir(G, db, u, { metodo, cabeceras: { "user-agent": "Mozilla/5.0", referer: "https://rosettaquantum.com/es/" } });
  const r1 = await ev(PROD + "/_promo/guia/view");
  await ev(PROD + "/_promo/guia/view");
  await ev(PROD + "/_promo/guia/click");
  const filas = db.sqlite.prepare("SELECT path, ua_class, referrer_host, n FROM hits ORDER BY path").all().map((f) => `${f.path}|${f.ua_class}|${f.referrer_host}|${f.n}`);
  si(r1.status === 204 && filas.join() === "/_promo/guia/click|browser|rosettaquantum.com|1,/_promo/guia/view|browser|rosettaquantum.com|2",
    `POST /_promo/guia/{view,click} → 204 y filas en hits: ${filas.join(" ; ")}`);
  const rp = await ev(PREV + "/_promo/guia/close");
  const n = db.sqlite.prepare("SELECT COUNT(*) AS n FROM hits WHERE path='/_promo/guia/close'").get().n;
  si(rp.status === 204 && n === 0, "en el preview responde 204 y NO escribe (comparte la base de producción)");
  si((await ev(PROD + "/_promo/guia/view", "GET")).status === 405, "GET a un evento → 405");
  si(await G.manejarGuia(new Request(PROD + "/_promo/guia/otro", { method: "POST" }), { DB: db }, new URL(PROD + "/_promo/guia/otro"), {}) === null,
    "un evento que no existe no se cuenta");
}

// ════ 5 · sitemap y llms.txt sólo con published=1 ════════════════════════════════════
console.log("\n5 · sitemap y /llms.txt");
{
  const XML = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml"><url><loc>https://rosettaquantum.com/</loc></url></urlset>';
  const db = base();
  const sitemap = async () => (await augmentSitemap({ DB: db, ASSETS: activos({ "/sitemap-0.xml": XML }) }, new Request(PROD + "/sitemap-0.xml"))).text();
  const llms = async (mod = G) => mod.lineasLlmsGuia(await mod.paginasPublicadas({ DB: db }), "# llms\n");
  let s = await sitemap();
  si(s === XML, "published=0: el sitemap sale byte a byte como el construido");
  si((await llms()).length === 0, "published=0: /llms.txt no gana ninguna línea");
  await conMutante(GUIA, " WHERE published = 1 ORDER BY slug_base, lang", " ORDER BY slug_base, lang", async (M) => {
    const u = M.urlsSitemapGuia(await M.paginasPublicadas({ DB: db }), XML);
    si(u.n === 2 && (await llms(M)).length === 1, "grito: sin el WHERE, la guía sin publicar entraría al sitemap y a /llms.txt — la prueba lo caza");
  });
  publicar(db, "es");
  s = await sitemap();
  si(s.includes(`<loc>${PROD}${RUTA_ES}</loc>`) && !s.includes(RUTA_EN) && !s.includes("hreflang"),
    "sólo la española publicada: entra ella, sin alternates (el par no existe todavía)");
  publicar(db, "en");
  s = await sitemap();
  const alt = (s.match(/hreflang="(es|en|x-default)"/g) || []).length;
  si(s.includes(`<loc>${PROD}${RUTA_ES}</loc>`) && s.includes(`<loc>${PROD}${RUTA_EN}</loc>`) && alt === 6
    && s.includes(`hreflang="x-default" href="${PROD}${RUTA_EN}"`) && s.includes("<lastmod>2026-11-17</lastmod>") && s.endsWith("</urlset>"),
    `las dos publicadas: dos <url>, 6 alternates (es, en, x-default=en) y lastmod`);
  const l = await llms();
  si(l.length === 1 && l[0] === `- [Guide EN](${PROD}${RUTA_EN}) — v1.1, 2026-11-17 (en) · [Guía ES](${PROD}${RUTA_ES}) (es)`, `una línea en /llms.txt: ${l[0]}`);
  const conLinea = G.lineasLlmsGuia(await G.paginasPublicadas({ DB: db }), l[0] + "\n");
  si(conLinea.length === 0, "silencio: si la línea ya está, no se repite");
  const w = leer("worker.js"), sm = leer("lib/sitemap.mjs");
  si(/lineasLlmsGuia\(await paginasPublicadas\(env\), text\)/.test(w) && /urlsSitemapGuia\(await paginasPublicadas\(env\), xml\)/.test(sm)
    && /const guia = await manejarGuia\(request, env, url, ctx\);/.test(w),
    "worker.js y lib/sitemap.mjs llaman a estas mismas funciones (no a una copia)");
}

// ════ 6 · los PDF ═════════════════════════════════════════════════════════════════════
console.log("\n6 · los PDF");
/**
 * Lo que se puede leer de un PDF sin dependencias: páginas (`/Type /Page`, no `/Pages`) y la
 * `/MediaBox` de cada una. Chrome (Skia) escribe un objeto por página sin comprimir esa parte,
 * que es lo que imprime scripts/build-guia-pdf.mjs.
 */
export function inspeccionarPdf(bytes) {
  const t = Buffer.from(bytes).toString("latin1");
  const paginas = (t.match(/\/Type\s*\/Page(?![a-zA-Z])/g) || []).length;
  const cajas = [...t.matchAll(/\/MediaBox\s*\[\s*([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\s*\]/g)]
    .map((m) => [Number(m[3]) - Number(m[1]), Number(m[4]) - Number(m[2])]);
  return { paginas, cajas, bytes: bytes.length };
}

/** Revisa los PDF de public/ contra las cotas. Puro: recibe la lista. */
export function revisarPdfs(archivos, rutas = G.PDF_RUTAS, c = G.PDF_COTAS) {
  const fallas = [];
  for (const { ruta, bytes } of archivos) {
    if (!rutas.includes(ruta)) { fallas.push(`${ruta}: no es un PDF de la guía (nombre fuera de PDF_RUTAS)`); continue; }
    if (!bytes.length) { fallas.push(`${ruta}: está vacío`); continue; }
    if (!G.esPdf(bytes)) { fallas.push(`${ruta}: no empieza por %PDF-`); continue; }
    const p = inspeccionarPdf(bytes);
    const mb = (p.bytes / 1048576).toFixed(2);
    if (p.bytes < c.bytesMin || p.bytes > c.bytesMax) fallas.push(`${ruta}: ${mb} MB, fuera de ${c.bytesMin / 1048576}–${c.bytesMax / 1048576} MB`);
    if (p.paginas < c.paginasMin || p.paginas > c.paginasMax) fallas.push(`${ruta}: ${p.paginas} páginas, fuera de ${c.paginasMin}–${c.paginasMax}`);
    const noA4 = p.cajas.filter(([w, h]) => Math.abs(w - c.a4[0]) > c.tolPt || Math.abs(h - c.a4[1]) > c.tolPt);
    if (!p.cajas.length || noA4.length) fallas.push(`${ruta}: ${noA4.length || "sin"} página(s) que no son A4 (${(noA4[0] || []).map((x) => x.toFixed(0)).join("×") || "sin MediaBox"} pt)`);
  }
  return fallas;
}
{
  const reales = [];
  for (const dir of ["guia", "guide"]) {
    const d = new URL(`../public/${dir}/`, import.meta.url);
    if (!existsSync(d)) continue;
    for (const f of readdirSync(d)) if (f.toLowerCase().endsWith(".pdf")) reales.push({ ruta: `/${dir}/${f}`, bytes: readFileSync(new URL(f, d)) });
  }
  const f = revisarPdfs(reales);
  if (f.length) f.forEach((x) => mal(x));
  else if (!reales.length) ok("public/guia/ y public/guide/ sin PDF todavía: la ruta da 404 hasta que lleguen");
  else for (const r of reales) { const p = inspeccionarPdf(r.bytes); ok(`${r.ruta}: %PDF-, A4, ${p.paginas} páginas, ${(p.bytes / 1048576).toFixed(2)} MB`); }
  const faltan = G.PDF_RUTAS.filter((r) => !reales.some((x) => x.ruta === r));
  if (reales.length && faltan.length) mal(`hay PDF de un idioma y no del otro: falta ${faltan.join(", ")}`);

  // Un PDF de mentira con la forma que escribe Chrome: N páginas, cada una con su MediaBox.
  const falso = (n, caja = "0 0 594.95996 841.91998", relleno = 0) => Buffer.concat([
    Buffer.from("%PDF-1.4\n" + Array.from({ length: n }, (_, k) => `${k + 3} 0 obj\n<</Type /Page\n/MediaBox [${caja}]>>\nendobj\n`).join("") + "2 0 obj\n<</Type /Pages /Count " + n + ">>\nendobj\n"),
    Buffer.alloc(relleno, 32)]);
  const MB = 1048576, R = G.PDF_RUTAS[0];
  si(revisarPdfs([{ ruta: R, bytes: falso(39, undefined, 1.3 * MB) }]).length === 0, "silencio: 39 páginas A4 y 1,3 MB pasan");
  si(revisarPdfs([{ ruta: R, bytes: falso(39, "0 0 612 792", 1.3 * MB) }]).length === 1, "grito: en Carta (612×792) en vez de A4");
  si(revisarPdfs([{ ruta: R, bytes: falso(12, undefined, 1.3 * MB) }]).length === 1, "grito: 12 páginas (una impresión cortada)");
  si(revisarPdfs([{ ruta: R, bytes: falso(39, undefined, 0.1 * MB) }]).length === 1, "grito: 0,1 MB");
  si(revisarPdfs([{ ruta: R, bytes: falso(39, undefined, 4 * MB) }]).length === 1, "grito: 4 MB");
  si(revisarPdfs([{ ruta: R, bytes: Buffer.alloc(0) }]).length === 1, "grito: vacío");
  si(revisarPdfs([{ ruta: R, bytes: Buffer.concat([Buffer.from("<!doctype html>"), Buffer.alloc(MB)]) }]).length === 1, "grito: no empieza por %PDF-");
  si(revisarPdfs([{ ruta: "/guia/y.pdf", bytes: falso(39, undefined, 1.3 * MB) }]).length === 1, "grito: un nombre inventado");
  const pdf = falso(1);

  // La ruta: compuerta de publicación + archivo de verdad.
  const db = base();
  const assets = (b) => activos({ [PDF_ES]: b });
  const st = async (b) => (await pedir(G, db, PROD + PDF_ES, { assets: assets(b) })).status;
  si(await st(pdf) === 404, "guía sin publicar: el PDF da 404 aunque el archivo exista");
  publicar(db, "es");
  si((await pedir(G, db, PROD + PDF_ES)).status === 404, "publicada y sin archivo: 404 (nunca uno inventado)");
  si(await st(new Uint8Array(0)) === 404, "archivo vacío: 404");
  si(await st(Buffer.from("<!doctype html>")) === 404, "algo que no es un PDF: 404");
  const r = await pedir(G, db, PROD + PDF_ES, { assets: assets(pdf) });
  si(r.status === 200 && r.headers.get("content-type") === "application/pdf" && Buffer.from(await r.arrayBuffer()).equals(pdf),
    "publicada y con archivo: 200, application/pdf, los mismos bytes");
}

// ════ 7 · la barra y el pie del sitio ═══════════════════════════════════════════════
// Corre en POSTBUILD a propósito: la barra sale del cascarón COMPILADO (dist/rq-shell-guia-*), que
// es lo que el Worker recorta en producción. Probarla contra una barra escrita aquí sería probar
// una copia, y la regla es justamente que no haya copias.
console.log("\n7 · la barra y el pie del sitio");
{
  const CASCARON = { es: "dist/rq-shell-guia-es/index.html", en: "dist/rq-shell-guia-en/index.html" };
  const cascarones = {};
  for (const [l, f] of Object.entries(CASCARON)) {
    const u = new URL("../" + f, import.meta.url);
    if (!existsSync(u)) mal(`${f} no existe: sin el cascarón compilado la guía sale sin la barra del sitio (¿se corrió antes del build?)`);
    else cascarones[G.rutaCascaronBarra(l)] = readFileSync(u, "utf8");
  }
  /**
   * ¿La página servida trae la barra y el pie del sitio? Se mira el OBJETO: el anfitrión con su
   * shadow root, el enlace a la home del idioma, el EN/ES al par de la guía, el pie, que todo vaya
   * dentro de <body> y que la impresión la oculte.
   */
  const tieneBarra = (html, lang, alt) => {
    const faltas = [];
    const ab = html.indexOf("<rq-sitio-arriba"), body = /<body\b[^>]*>/.exec(html), pie = html.indexOf("<rq-sitio-abajo"), fin = html.lastIndexOf("</body>");
    if (ab < 0) faltas.push("sin <rq-sitio-arriba>");
    else if (!body || ab !== body.index + body[0].length) faltas.push("la barra no va justo después de <body>");
    if (!/<rq-sitio-arriba[^>]*><template shadowrootmode="open">/.test(html)) faltas.push("la barra no va en un shadow root declarativo");
    if (!html.includes(`class="wordmark" href="${lang === "es" ? "/es/" : "/"}"`)) faltas.push("sin el enlace a la home del sitio");
    if (!html.includes(`<a href="${alt}">${lang === "es" ? "EN" : "ES"}</a>`)) faltas.push(`el ${lang === "es" ? "EN" : "ES"} no lleva a ${alt}`);
    if (html.includes(G.MARCA_ALT)) faltas.push("quedó el marcador __RQ_GUIA_ALT__");
    if (pie < 0 || pie > fin || !/<rq-sitio-abajo[^>]*><template shadowrootmode="open">[\s\S]*<footer>/.test(html)) faltas.push("sin el pie del sitio antes de </body>");
    if (!/@media print\{rq-sitio-arriba,rq-sitio-abajo\{display:none !important\}\}/.test(html)) faltas.push("la impresión no la oculta (el PDF la llevaría)");
    if (!/\(function\(document\)\{[\s\S]*getElementById\("burger"\)/.test(html)) faltas.push("el menú móvil no tiene su script");
    return faltas;
  };
  const db = base();
  publicar(db, "es"); publicar(db, "en");
  const servir = async (mod, ruta, assets = activos(cascarones)) => {
    const r = await pedir(mod, db, PROD + ruta, { assets });
    return { r, html: await r.text() };
  };
  for (const [lang, ruta, alt] of [["es", RUTA_ES, RUTA_EN], ["en", RUTA_EN, RUTA_ES]]) {
    const { r, html } = await servir(G, ruta);
    const f = tieneBarra(html, lang, alt);
    si(!f.length && /barra:ok/.test(r.headers.get("x-rq-guia") || ""), `${lang}: la página servida trae la barra y el pie del sitio, con el ${lang === "es" ? "EN" : "ES"} → ${alt}`, f.join(" · "));
    // Y el contenido de Cowork queda intacto: quitando lo inyectado vuelve la fila (con indicadores).
    const limpio = html.replace(/<style data-rq-barra[^>]*>[\s\S]*?<\/style>/, "")
      .replace(/<rq-sitio-arriba[\s\S]*?<\/rq-sitio-arriba><script>[\s\S]*?<\/script>/, "")
      .replace(/<rq-sitio-abajo[\s\S]*?<\/rq-sitio-abajo>/, "");
    si(limpio === G.inyectarIndicadores(htmlDe(lang), await G.leerIndicadores({ DB: db })).html,
      `${lang}: quitando la barra y el pie, la página es la fila de D1 byte a byte`);
  }
  // UNA SOLA FUENTE: los enlaces de la barra son los MISMOS que sirve /es/ y / (mismo componente).
  const enlaces = (h) => { const n = /<nav>[\s\S]*?<\/nav>/.exec(h); return n ? [...n[0].matchAll(/href="([^"]*)"/g)].map((m) => m[1]) : null; };
  for (const [lang, home, alt] of [["es", "dist/es/index.html", RUTA_EN], ["en", "dist/index.html", RUTA_ES]]) {
    const u = new URL("../" + home, import.meta.url);
    if (!existsSync(u)) { mal(`${home} no existe: no hay contra qué comparar la barra`); continue; }
    const delSitio = enlaces(readFileSync(u, "utf8")), deLaGuia = enlaces((await servir(G, lang === "es" ? RUTA_ES : RUTA_EN)).html);
    const otro = lang === "es" ? "EN" : "ES";
    // En la home, el EN/ES apunta a la otra home; en la guía, al par. Todo lo demás, idéntico.
    const a = (delSitio || []).filter((h) => !(lang === "es" ? h === "/" : h === "/es/")), b = (deLaGuia || []).filter((h) => h !== alt);
    si(delSitio && deLaGuia && JSON.stringify(a) === JSON.stringify(b),
      `${lang}: los enlaces de la barra son los de ${home} (salvo el ${otro}, que va al par de la guía)`, `${JSON.stringify(a)} ≠ ${JSON.stringify(b)}`);
  }
  // GRITO 1: sin el cascarón la página sale (no se cae) y la regla lo detecta.
  { const { r, html } = await servir(G, RUTA_ES, activos());
    si(r.status === 200 && tieneBarra(html, "es", RUTA_EN).length > 0 && /barra:FAILED/.test(r.headers.get("x-rq-guia") || ""),
      "grito: sin el cascarón la guía sale igual (200) pero la regla detecta que falta la barra"); }
  // GRITO 2: mutación real — la ruta deja de poner la barra.
  await conMutante(GUIA, "html.slice(0, finCuerpo) + conAlt(piezas.arriba) + ", "html.slice(0, finCuerpo) + ", async (M) => {
    const { html } = await servir(M, RUTA_ES);
    si(tieneBarra(html, "es", RUTA_EN).length > 0, "grito: si la ruta no inyecta la barra, la regla lo caza");
  });
  // GRITO 3: mutación real — el EN/ES vuelve a la home en vez de al par.
  await conMutante(GUIA, "t.split(MARCA_ALT).join(alt)", "t.split(MARCA_ALT).join(\"/\")", async (M) => {
    const { html } = await servir(M, RUTA_ES);
    si(tieneBarra(html, "es", RUTA_EN).some((x) => /EN no lleva/.test(x)), "grito: si el EN de la barra fuera a la home y no al par de la guía, la regla lo caza");
  });
}

console.log(fallos
  ? `\nT-guia: ${fallos} problema(s). Cada uno publica o anuncia la guía antes de que Nicholas cambie published.`
  : "\nT-guia: sólo lo publicado se sirve, se declara y se anuncia; el borrador sólo en el preview; cada mutación cazada.");
process.exit(fallos ? 1 : 0);
