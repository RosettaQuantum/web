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
 *   6. Un PDF que no es el entregado: vacío, con otro hash, o con un nombre inventado.
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
import { createHash } from "node:crypto";
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
// El valor de LATAM trae los venenos a la vez: cierre de script, comentario, y los patrones de
// String.replace. `$&` solo no alcanza —el escapado ya convierte `&` en \u0026, y una mutación
// que no cambia nada no prueba nada—; `$'` sí: inserta el resto del documento.
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
  const ind = db.sqlite.prepare("INSERT INTO pqc_indicators (indicator_id,date,value,source_label,source_url,created_at) VALUES (?,?,?,'s','u','c')");
  for (const [id, fecha, v] of [
    ["broken_keys_rsa2048_public", "2026-11-16", "VIEJO"], ["broken_keys_rsa2048_public", "2026-11-17", "0"],
    ["quantum_attributed_breaches_public", "2026-11-17", "0"], ["pqc_share_https_cloudflare", "2026-09-29", "≈70"],
    ["nist_rsa_ecc_clock", "2026-10-27", "deprecate 2030 / disallow 2035 - FINAL"],
    ["latam_fin_regulators_pqc_deadline", "2026-11-12", VENENO], ["ncsc_uk_clock", "2025-03-20", "NO-DEBE-SALIR"],
  ]) ind.run(id, fecha, v);
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
  si(cuerpo.startsWith("<!doctype html><html lang=\"es\">") && !/rqPromo|class="nav|<footer/.test(cuerpo),
    "el html sale tal cual, sin layout ni aviso alrededor");
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
  const fuera = (c) => {
    const malos = [];
    if (c.vars && "GUIA_PRUEBA" in c.vars) malos.push("nivel superior");
    for (const [n, e] of Object.entries(c.env || {})) if (n !== "preview" && e.vars && "GUIA_PRUEBA" in e.vars) malos.push(n);
    return malos;
  };
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
  await conMutante(GUIA, " && url && /\\.workers\\.dev$/.test(url.hostname)", "", async (M) => {
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
  const esperado = {
    broken_keys_rsa2048_public: { display: "0", date: "2026-11-17" },
    quantum_attributed_breaches_public: { display: "0", date: "2026-11-17" },
    pqc_share_https_cloudflare: { display: "≈70", date: "2026-09-29" },
    nist_rsa_ecc_clock: { display: "deprecate 2030 / disallow 2035 - FINAL", date: "2026-10-27" },
    latam_fin_regulators_pqc_deadline: { display: VENENO, date: "2026-11-12" },
  };
  const ordenar = (o) => JSON.stringify(Object.fromEntries(Object.entries(o || {}).sort()));
  si(ordenar(datos) === ordenar(esperado), "los cinco indicadores, el ÚLTIMO de cada uno, el valor tal cual (con «$&» y «$'» literales) y nada más",
    ordenar(datos).slice(0, 160));

  // La consulta falla: la página sale igual, con el marcador intacto.
  const rota = base();
  publicar(rota, "es");
  rota.sqlite.exec("DROP TABLE pqc_indicators");
  const rr = await pedir(G, rota, PROD + RUTA_ES);
  const cr = await rr.text();
  si(rr.status === 200 && cr === htmlDe("es") && /indicadores:FAILED/.test(rr.headers.get("x-rq-guia") || ""),
    `consulta caída → 200, el html byte a byte con el marcador, y «${rr.headers.get("x-rq-guia")}»`);

  await conMutante(GUIA, "window.RQ_INDICATORS=${jsonParaScript(mapa)}", "window.RQ_INDICATORS=${JSON.stringify(mapa)}", async (M) => {
    const { html: h, datos: d } = await revisar(M);
    si(h.includes("0 de 5 </script><!--x-->") && d === null,
      "grito: sin escapar «<», el valor de la base corta el <script> y el JSON no parsea — la prueba lo caza");
  });
  await conMutante(GUIA, "html.replace(MARCADOR, () => script)", "html.replace(MARCADOR, script)", async (M) => {
    const { datos: d } = await revisar(M);
    si(!d || ordenar(d) !== ordenar(esperado), "grito: reemplazar con cadena expande «$'» y mete el resto del documento en el valor — la prueba lo caza");
  });
}

// ════ 4 · el pop-up ══════════════════════════════════════════════════════════════════
console.log("\n4 · el pop-up");
const FUENTE_POPUP = leer("public/js/promo-guia.js");

/** Una página de mentira que ejecuta el archivo REAL del pop-up. */
function pagina({ ruta = "/", lang = "en", api = { mostrar: true, href: RUTA_EN }, local = {}, sesion = {}, rompe = false, modal = false, fuente = FUENTE_POPUP } = {}) {
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
    location: { pathname: ruta },
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
    out.prueba = await estado(mod, PREV, "es", PRUEBA);
    out.pruebaEnProd = (await estado(mod, PROD, "es", PRUEBA)).mostrar;
    return out;
  };
  const c = await casos(G);
  si(c.flag0pub1 === false, "flag apagado + guía publicada → no aparece");
  si(c.flag1pub0 === false, "flag encendido + guía sin publicar → no aparece");
  si(c.flag1pub1.mostrar === true && c.flag1pub1.href === RUTA_EN, "flag encendido + guía publicada → aparece y enlaza a la publicada");
  si(c.soloEnDesdeEs.href === RUTA_EN, "en una página en español, con sólo la inglesa publicada, enlaza a la publicada");
  si(c.flagTrue === false, "falla cerrado: un flag distinto de '1' es apagado");
  si(c.prueba.mostrar === true && c.prueba.href === RUTA_ES && c.pruebaEnProd === false, "modo de prueba: se enciende en el preview y no en producción");
  const sinTabla = base(); sinTabla.sqlite.exec("DROP TABLE site_flags"); publicar(sinTabla, "en");
  si((await (await pedir(G, sinTabla, PROD + "/api/promo/guia")).json()).mostrar === false, "sin la tabla de flags → no aparece");
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
/** Revisa los PDF de public/ contra los esperados. Puro: recibe la lista. */
export function revisarPdfs(archivos, esperados) {
  const fallas = [];
  for (const { ruta, bytes } of archivos) {
    if (!(ruta in esperados)) { fallas.push(`${ruta}: no es un PDF entregado (nombre fuera de PDF_ESPERADOS)`); continue; }
    if (!bytes.length) { fallas.push(`${ruta}: está vacío`); continue; }
    if (!G.esPdf(bytes)) fallas.push(`${ruta}: no empieza por %PDF-`);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== esperados[ruta]) fallas.push(`${ruta}: sha256 ${sha.slice(0, 12)}… y se esperaba ${esperados[ruta].slice(0, 12)}…`);
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
  const f = revisarPdfs(reales, G.PDF_ESPERADOS);
  if (f.length) f.forEach((x) => mal(x));
  else if (!reales.length) ok("public/guia/ y public/guide/ sin PDF todavía: la ruta da 404 hasta que lleguen");
  else ok(`${reales.length} PDF en public/, cada uno con el sha256 entregado`);

  const pdf = Buffer.from("%PDF-1.7\n%prueba\n");
  const sha = createHash("sha256").update(pdf).digest("hex");
  const esp = { "/guia/x.pdf": sha };
  si(revisarPdfs([{ ruta: "/guia/x.pdf", bytes: pdf }], esp).length === 0, "silencio: el PDF con su hash pasa");
  si(revisarPdfs([{ ruta: "/guia/x.pdf", bytes: Buffer.from("%PDF-1.7\n%otro\n") }], esp).length === 1, "grito: otro hash");
  si(revisarPdfs([{ ruta: "/guia/x.pdf", bytes: Buffer.alloc(0) }], esp).length === 1, "grito: vacío");
  si(revisarPdfs([{ ruta: "/guia/y.pdf", bytes: pdf }], esp).length === 1, "grito: un nombre inventado");

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

console.log(fallos
  ? `\nT-guia: ${fallos} problema(s). Cada uno publica o anuncia la guía antes de que Nicholas cambie published.`
  : "\nT-guia: sólo lo publicado se sirve, se declara y se anuncia; el borrador sólo en el preview; cada mutación cazada.");
process.exit(fallos ? 1 : 0);
