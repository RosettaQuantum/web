#!/usr/bin/env node
/**
 * El pedido de exclusión y el casillero de la capa 2 (27-nov-2026, regla de las dos capas).
 *
 * POR QUÉ EXISTE. Los errores caros de esta pieza son mudos:
 *  · un correo de otro dominio que pasa: cualquiera excluye a un tercero (y deja de medirse lo que sí se debe);
 *  · un pedido sin confirmar que ya excluye, o una revocación que no devuelve a la medición;
 *  · el correo de la persona guardado en claro en la base;
 *  · el alta de la verificación que se cae porque las columnas autorizacion_* no existen todavía;
 *  · un texto aprobado que se reescribe en el código.
 *
 * Con el código que corre: lib/exclusion.mjs y lib/qready-verificado.mjs contra el esquema REAL
 * (db/qready-verificado.schema.sql + db/capas.schema.sql) en SQLite (d1-memoria), la lectura con excluido()
 * y capaDe() de lib/capas.mjs (la única definición), y el handler HTTP con un siteverify simulado.
 * Gritos, silencios y MUTACIONES reales (lib/exclusion.mjs con un cambio): sin el control del dominio del
 * correo, o guardando el correo en claro, el guardia grita.
 *   node scripts/check-exclusion.mjs
 */
import { registerHooks } from "node:module";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
// El límite por IP usa caches.default (el borde); en Node, una caché en memoria con la misma forma.
const memoria = new Map();
globalThis.caches = { default: { match: async (k) => (memoria.has(k.url) ? new Response(memoria.get(k.url)) : undefined),
  put: async (k, r) => { memoria.set(k.url, await r.text()); } } };
import { readFileSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");
const { conMutante } = await import("./lib/mutar.mjs");
const TA = await import("./lib/textos-aprobados.mjs");
const X = await import("../lib/exclusion.mjs");
const C = await import("../lib/capas.mjs");
const V = await import("../lib/qready-verificado.mjs");
const { TXT } = await import("../public/js/qready-textos.mjs");
const { SITEVERIFY } = await import("../lib/turnstile.mjs");

export const CONSUMIDOR = { quien: "el build (prebuild): bloquea el despliegue", hace: "si grita, un tercero podría excluir un dominio ajeno, una exclusión no se cumpliría o no se podría deshacer, el correo quedaría en claro, el alta caería sin el esquema de capas o un texto aprobado cambió: se corrige lib/exclusion.mjs, lib/qready-verificado.mjs o public/js/qready-textos.mjs antes de subir" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
let casos = 0; const fallas = [];
const igual = (a, b, q) => { casos++; const ok = JSON.stringify(a) === JSON.stringify(b); console.log(`  ${ok ? "✓" : "✗"} ${q}${ok ? "" : ` — esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`}`); if (!ok) fallas.push(q); };
const silenciar = async (f) => { const e = console.error; console.error = () => {}; try { return await f(); } finally { console.error = e; } };

const ESQ = [new URL("db/qready-verificado.schema.sql", raiz), new URL("db/capas.schema.sql", raiz)];
const COLS = ["autorizacion_version TEXT", "autorizacion_utc TEXT", "autorizacion_retirada_utc TEXT"];
const base = ({ columnas = true } = {}) => { const db = d1EnMemoria(...ESQ); if (columnas) for (const c of COLS) db.sqlite.exec(`ALTER TABLE qready_dominios ADD COLUMN ${c}`); return db; };
const sha = (s) => createHash("sha256").update(s).digest("hex");
const filas = (db) => db.sqlite.prepare("SELECT * FROM qready_exclusiones").all();
// El correo en claro en CUALQUIER tabla de la base, no sólo en la columna esperada.
const correoEnClaro = (db, correo) => db.sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all()
  .some(({ name }) => db.sqlite.prepare(`SELECT * FROM "${name}"`).all().some((f) => Object.values(f).some((v) => String(v).toLowerCase().includes(correo))));

// ---------------------------------------------------------------- 1 · el correo es del dominio
console.log("exclusión · lib/exclusion.mjs");
for (const [c, d, esp, q] of [
  ["ti@banco.example", "banco.example", true, "silencio: correo del mismo dominio"],
  ["ti@mail.banco.example", "banco.example", true, "silencio: correo de un subdominio"],
  ["ti@otro.example", "banco.example", false, "grito: correo de otro dominio"],
  ["ti@otrobanco.example", "banco.example", false, "grito: un dominio que sólo TERMINA igual («otrobanco») no es subdominio"],
  ["ti@banco.example.evil.example", "banco.example", false, "grito: el dominio en medio del host no cuenta"],
  ["ti@banco.example", "mail.banco.example", false, "grito: el correo del padre no excluye a un subdominio ajeno a su host"],
  ["no-es-correo", "banco.example", false, "grito: sin @ no es correo"],
]) igual(X.correoDelDominio(c, d), esp, q);

async function prueba(M, pre = "") {
  const out = {};
  let db = base();
  const ajeno = await M.pedirExclusion(db, { dominio: "banco.example", correo: "ti@otro.example" });
  out.ajeno = ajeno.ok === false && ajeno.error === "correo" && filas(db).length === 0;
  const p = await M.pedirExclusion(db, { dominio: "https://www.Banco.example/x", correo: "TI@Banco.example" });
  out.pedido = p.ok === true && p.dominio === "banco.example" && /^[0-9a-f]{64}$/.test(p.token);
  out.sin_confirmar = await C.excluido(db, "banco.example");
  out.en_claro = correoEnClaro(db, "ti@banco.example");
  out.huella = filas(db)[0]?.correo_sha256 === sha("ti@banco.example");
  out.confirma = (await M.confirmarExclusion(db, p.token)).estado;
  out.confirmado = await C.excluido(db, "banco.example");
  out.sub_confirmado = await C.excluido(db, "app.banco.example");
  out.reconfirma = (await M.confirmarExclusion(db, p.token)).estado;
  out.revoca = (await M.revocarExclusion(db, p.token)).estado;
  out.revocado = await C.excluido(db, "banco.example");
  out.confirma_revocado = (await M.confirmarExclusion(db, p.token)).estado;
  out.revocado_tras_reconfirmar = await C.excluido(db, "banco.example");
  return out;
}
const R = await prueba(X);
igual(R.ajeno, true, "grito: un correo de otro dominio se rechaza y no escribe nada");
igual(R.pedido, true, "silencio: un correo del dominio crea el pedido (dominio normalizado, token de 64 hex)");
igual(R.sin_confirmar, false, "grito: un pedido sin confirmar NO excluye");
igual(R.en_claro, false, "grito: el correo no queda en claro en ninguna tabla");
igual(R.huella, true, "silencio: se guarda el sha256 del correo en minúsculas");
igual([R.confirma, R.confirmado], ["confirmado", true], "silencio: al confirmar, excluido() da true");
igual(R.sub_confirmado, true, "silencio: la exclusión cubre los subdominios");
igual(R.reconfirma, "ya", "silencio: abrir el enlace dos veces no cambia nada");
igual([R.revoca, R.revocado], ["revocado", false], "grito: revocar devuelve excluido() a false");
igual([R.confirma_revocado, R.revocado_tras_reconfirmar], ["invalido", false], "grito: un enlace revocado no vuelve a confirmar");

{ // revocar deshace el dominio entero, aunque haya dos pedidos confirmados
  const db = base();
  const a = await X.pedirExclusion(db, { dominio: "banco.example", correo: "a@banco.example" });
  const b = await X.pedirExclusion(db, { dominio: "banco.example", correo: "b@banco.example" });
  await X.confirmarExclusion(db, a.token); await X.confirmarExclusion(db, b.token);
  await X.revocarExclusion(db, a.token);
  igual(await C.excluido(db, "banco.example"), false, "grito: con dos pedidos confirmados, deshacer uno deshace la exclusión del dominio");
  const ahora = new Date().toISOString(), viejo = new Date(Date.now() - (X.VIGENCIA_PEDIDO_HORAS + 1) * 3600e3).toISOString();
  const v = await X.pedirExclusion(db, { dominio: "viejo.example", correo: "ti@viejo.example" }, viejo);
  igual((await X.confirmarExclusion(db, v.token, ahora)).estado, "invalido", `grito: un pedido de hace más de ${X.VIGENCIA_PEDIDO_HORAS} h ya no se confirma`);
  igual((await X.confirmarExclusion(db, "z".repeat(64))).estado, "invalido", "grito: un token con otra forma es inválido");
  igual((await X.revocarExclusion(db, v.token)).estado, "invalido", "grito: no se revoca lo que nunca se confirmó");
}

// ---------------------------------------------------------------- 2 · el handler HTTP
console.log("exclusión · POST /api/exclusion, confirmar y revocar");
const fetchOrig = globalThis.fetch;
globalThis.fetch = async (u, init) => {
  if (String(u) === SITEVERIFY) { const tk = new URLSearchParams(String(init.body)).get("response"); return new Response(JSON.stringify({ success: tk === "ts-bueno" })); }
  throw new Error(`fetch inesperado a ${u}`);
};
const ENV = (db) => ({ DB: db, TURNSTILE_SECRET: "x".repeat(20) });
let ip = 0;
const post = (cuerpo) => new Request("https://rosettaquantum.com/api/exclusion", { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `203.0.113.${++ip}` }, body: JSON.stringify(cuerpo) });
const llamar = async (db, req, deps) => { const r = await silenciar(() => X.manejarExclusion(req, ENV(db), new URL(req.url), deps)); return { status: r.status, texto: await r.text() }; };
{
  const enviados = [];
  const enviar = async (env, m) => { enviados.push(m); };
  let db = base();
  const sin = await llamar(db, post({ dominio: "banco.example", correo: "ti@banco.example", turnstile: "ts-bueno" }), { enviar: null });
  igual([sin.status, filas(db).length], [503, 0], "grito: sin medio para enviar el correo, 503 y nada escrito");
  const malTs = await llamar(db, post({ dominio: "banco.example", correo: "ti@banco.example", turnstile: "ts-malo" }), { enviar });
  igual([malTs.status, filas(db).length, enviados.length], [403, 0, 0], "grito: con Turnstile rechazado, 403, nada escrito ni enviado");
  const ajeno = await llamar(db, post({ dominio: "banco.example", correo: "ti@otro.example", turnstile: "ts-bueno" }), { enviar });
  igual([ajeno.status, JSON.parse(ajeno.texto).error, filas(db).length, enviados.length], [400, "correo", 0, 0], "grito: correo de otro dominio por HTTP → 400, nada escrito ni enviado");
  const uno = await llamar(db, post({ dominio: "banco.example", correo: "ti@banco.example", turnstile: "ts-bueno", lang: "en" }), { enviar });
  igual([uno.status, uno.texto, enviados.length, enviados[0]?.para], [200, '{"ok":true}', 1, "ti@banco.example"], "silencio: el pedido válido responde {ok:true} y manda UN correo al correo pedido");
  const enlace = (enviados[0]?.texto.match(/https:\/\/\S+/) || [""])[0];
  igual(/\/api\/exclusion\/confirmar\?t=[0-9a-f]{64}&l=en$/.test(enlace), true, "silencio: el correo lleva el enlace de confirmación en el idioma del pedido");
  igual(await C.excluido(db, "banco.example"), false, "grito: hasta abrir el enlace, el dominio NO está excluido");
  const conf = await llamar(db, new Request(enlace), {});
  igual([conf.status, /lang="en"/.test(conf.texto), await C.excluido(db, "banco.example")], [200, true, true], "silencio: abrir el enlace confirma (página en el idioma del pedido) y excluye");
  // la respuesta no delata que el dominio ya estaba excluido
  const dos = await llamar(db, post({ dominio: "banco.example", correo: "otra@banco.example", turnstile: "ts-bueno", lang: "en" }), { enviar });
  igual([dos.status, dos.texto], [uno.status, uno.texto], "grito: con el dominio ya excluido la respuesta es idéntica (no lo revela)");
  igual(correoEnClaro(db, "ti@banco.example") || correoEnClaro(db, "otra@banco.example"), false, "grito: por HTTP tampoco queda el correo en claro");
  const t = new URL(enlace).searchParams.get("t");
  const revGet = await llamar(db, new Request(`https://rosettaquantum.com/api/exclusion/revocar?t=${t}&l=en`), {});
  igual([revGet.status, /<form method="post"/.test(revGet.texto), await C.excluido(db, "banco.example")], [200, true, true],
    "grito: abrir el enlace de revocar (GET, como un antivirus) NO deshace la exclusión: sólo muestra el botón");
  const revPost = await llamar(db, new Request(`https://rosettaquantum.com/api/exclusion/revocar?t=${t}&l=en`, { method: "POST" }), {});
  igual([revPost.status, await C.excluido(db, "banco.example")], [200, false], "grito: el botón (POST) revoca y excluido() vuelve a false");
  db = base({ columnas: false }); db.sqlite.exec("DROP TABLE qready_exclusiones");
  const sinTabla = await llamar(db, post({ dominio: "banco.example", correo: "ti@banco.example", turnstile: "ts-bueno" }), { enviar });
  igual(sinTabla.status, 503, "grito: sin la tabla (esquema sin aplicar) el pedido no se acepta: 503, no un 200 que promete un correo");
  igual(/\{ enviar: null \}/.test(leer("worker.js")) && /startsWith\("\/api\/exclusion"\)\) return manejarExclusion\(/.test(leer("worker.js")), true,
    "worker.js enchufa /api/exclusion (sin medio de correo todavía: enviar = null → 503)");
}
globalThis.fetch = fetchOrig;

// ---------------------------------------------------------------- 3 · el casillero de la capa 2
console.log("capa 2 · el casillero en la verificación");
{
  const R2 = {};
  let db = base();
  const si = await V.alta(db, { dominio: "banco.example", sector: "banca", autoriza: true });
  const fila = (tk) => db.sqlite.prepare("SELECT autorizacion_version, autorizacion_utc FROM qready_dominios WHERE token = ?").get(tk);
  igual([si.ok, si.autorizacion, fila(si.token).autorizacion_version, !!fila(si.token).autorizacion_utc], [true, C.VERSION_AUTORIZACION, C.VERSION_AUTORIZACION, true],
    "silencio: con el casillero marcado se guardan la versión de los términos y la hora");
  db.sqlite.prepare("UPDATE qready_dominios SET verificado_en = ? WHERE token = ?").run("2026-11-27T00:00:00Z", si.token);
  igual(await C.capaDe(db, "banco.example"), 2, "silencio: verificado y con autorización → capa 2");
  for (const [v, q] of [[false, "sin marcar"], ["true", "el texto «true»"], [1, "un 1"], [undefined, "sin el campo"]]) {
    const r = await V.alta(db, { dominio: "otro.example", sector: "banca", autoriza: v });
    igual([r.ok, fila(r.token).autorizacion_version], [true, null], `grito: ${q} no autoriza (sólo true)`);
  }
  db = base({ columnas: false });
  const r = await silenciar(() => V.alta(db, { dominio: "banco.example", sector: "banca", autoriza: true }));
  igual([r.ok, r.autorizacion], [true, null], "grito: sin las columnas autorizacion_* (esquema sin aplicar) el alta NO falla: se guarda sin autorización");
  db.sqlite.prepare("UPDATE qready_dominios SET verificado_en = ? WHERE token = ?").run("2026-11-27T00:00:00Z", r.token);
  igual(await silenciar(() => C.capaDe(db, "banco.example")), 1, "grito: ese pedido queda en capa 1");
  // iniciarParaApi (MCP) e iniciarPedido (la página) pasan autoriza
  db = base();
  const PREV = new URL("https://rosetta-quantum-preview.example.workers.dev/");
  const api = await V.iniciarParaApi({ DB: db }, { dominio: "mcp.example", sector: "banca", autoriza: true }, PREV, "198.51.100.9", { sectoresValidos: ["banca"] });
  igual([api.http, api.cuerpo.autorizacion, fila(api.cuerpo.token).autorizacion_version], [200, C.VERSION_AUTORIZACION, C.VERSION_AUTORIZACION], "silencio: iniciarParaApi guarda la autorización");
  const sinAut = await V.iniciarParaApi({ DB: db }, { dominio: "mcp2.example", sector: "banca" }, PREV, "198.51.100.10", { sectoresValidos: ["banca"] });
  igual(fila(sinAut.cuerpo.token).autorizacion_version, null, "grito: iniciarParaApi sin autoriza → capa 1");
  const qv = leer("lib/qready-verificado.mjs");
  igual(/autoriza: c\.autoriza === true \}/.test(qv), true, "la ruta del alta pasa c.autoriza === true a iniciarPedido");
  igual(/autoriza: !!\(\$\("qv-autoriza"\) && \$\("qv-autoriza"\)\.checked\)/.test(leer("public/js/qready-alta.mjs")), true, "qready-alta.mjs envía autoriza desde el casillero qv-autoriza");
  for (const [p, pre] of [["src/pages/es/q-ready/verificar.astro", "/es"], ["src/pages/q-ready/verificar.astro", ""]]) {
    const s = leer(p); const iPub = s.indexOf('id="qv-publico"'), iAut = s.indexOf('id="qv-autoriza"');
    igual(iPub > 0 && iAut > iPub && s.includes(`href="${pre}/q-ready/autorizacion/"`), true, `${p}: el casillero va bajo qv-publico y enlaza a ${pre}/q-ready/autorizacion/`);
  }
}

// ---------------------------------------------------------------- 4 · el texto es el aprobado
console.log("textos · lo aprobado, letra por letra");
{
  const md = TA.leerBytes("TEXTOS-dos-capas-2026-11-27.md").toString("utf8");
  const s5 = TA.leerBytes("TEXTO-autorizacion-2026-11-27.md").toString("utf8");
  // La página: la cita de la sección 3, párrafo por párrafo, armada desde lo que sirve el código.
  const sec3 = md.slice(md.indexOf("## 3 ·"), md.indexOf("## 4 ·"));
  const cita = sec3.split("\n").filter((l) => l.startsWith(">")).map((l) => l.replace(/^> ?/, "")).join("\n").trim();
  const armarCita = (Q) => {
    const p = [`**${Q.titulo}**`, Q.lede];
    for (const b of Q.bloques) {
      p.push([`**${b.titulo}** ${b.texto}`, ...(b.lista || []).map((i) => `- ${i}`)].join("\n"));
      if (b.id === "excluir") p.push(`[ ${Q.form.dominio} ] [ ${Q.form.correo} ] [ ${Q.form.ir} ]`);
    }
    return p.join("\n\n");
  };
  igual(armarCita(TXT.es.quien) === cita, true, "«Quién mide y cómo» (es) es la sección 3 aprobada, byte a byte");
  igual(armarCita(TXT.es.quien).replace("Contacto:", "Contacto;") === cita, false, "MUTACIÓN: un signo distinto en el texto armado → grita");
  igual(armarCita(TXT.en.quien) !== cita && TXT.en.quien.bloques.length === TXT.es.quien.bloques.length, true, "en: misma estructura que el español, traducida");
  // Los términos y el casillero: la sección 5 de la regla.
  const armarS5 = (T, A) => {
    const ps = A.puntos.map((p, i) => [`${i + 1}. **${p.titulo}**${p.texto ? " " + p.texto : ""}`, ...(p.lista || []).map((x) => `   - ${x}`)].join("\n"));
    return `> ☐ ${T.alta_autoriza}\n\n**${A.titulo}** · ${A.version}\n\n${ps.join("\n")}`;
  };
  const s5cuerpo = s5.slice(s5.indexOf("> ☐")).trim();
  igual(armarS5(TXT.es, TXT.es.autorizacion) === s5cuerpo, true, "el casillero y los términos (es) son la sección 5 aprobada, byte a byte");
  const en4 = (/^> ☐ (.+)$/m.exec(md.slice(md.indexOf("## 4 ·"), md.indexOf("## 5 ·"))) || [])[1];
  igual(TXT.en.alta_autoriza, en4, "el casillero en inglés es el aprobado (sección 4)");
  for (const l of ["es", "en"]) igual(TXT[l].alta_autoriza.split(TXT[l].alta_autoriza_enlace).length, 2, `${l}: el tramo enlazado del casillero aparece una vez`);
  // El User-Agent que la página dice es el que mandan las conexiones (lib/capas.mjs).
  for (const l of ["es", "en"]) igual(TXT[l].quien.bloques.find((b) => b.id === "reconocer").texto.includes("`" + C.USER_AGENT + "`"), true, `${l}: «Cómo reconocernos» dice el USER_AGENT de lib/capas.mjs`);
  igual(new URL(C.PAGINA_QUIEN_MIDE).pathname, "/es/q-ready/quien-mide/", "PAGINA_QUIEN_MIDE apunta a la página que existe");
  for (const p of ["src/pages/es/q-ready/quien-mide.astro", "src/pages/q-ready/quien-mide.astro", "src/pages/es/q-ready/autorizacion.astro", "src/pages/q-ready/autorizacion.astro"]) {
    const s = existsSync(new URL(p, raiz)) ? leer(p) : "";
    igual(/noindex=\{true\}/.test(s) && /qready-verificado\.css\?raw/.test(s) && /MarcaLayout/.test(s), true, `${p}: existe, con MarcaLayout, el CSS de verificar y noindex`);
  }
}

// ---------------------------------------------------------------- 5 · mutaciones del código
console.log("mutaciones · lib/exclusion.mjs");
const URLX = new URL("lib/exclusion.mjs", raiz);
await conMutante(URLX, '  if (!correoDelDominio(c, d)) return { ok: false, http: 400, error: "correo" };\n', "",
  async (M) => igual((await prueba(M)).ajeno, false, "MUTACIÓN: sin el control del dominio del correo, el correo ajeno pasa (el guardia lo ve)"));
await conMutante(URLX, ".bind(token, d, await sha256Hex(c), ahora)", ".bind(token, d, c, ahora)",
  async (M) => igual((await prueba(M)).en_claro, true, "MUTACIÓN: guardando el correo en claro, el guardia lo ve"));
await conMutante(URLX, '"SELECT dominio FROM qready_exclusiones WHERE token = ?1 AND confirmado_utc IS NOT NULL AND revocado_utc IS NULL").bind(token).first();\n  if (!f) return { estado: "invalido" };\n  await db.prepare("UPDATE qready_exclusiones SET revocado_utc = ?2 WHERE dominio = ?1',
  '"SELECT dominio FROM qready_exclusiones WHERE token = ?1 AND confirmado_utc IS NOT NULL AND revocado_utc IS NULL").bind(token).first();\n  if (!f) return { estado: "invalido" };\n  await db.prepare("UPDATE qready_exclusiones SET revocado_utc = ?2 WHERE dominio = ?1 AND 0',
  async (M) => igual((await prueba(M)).revocado, true, "MUTACIÓN: una revocación que no escribe deja el dominio excluido (el guardia lo ve)"));

if (fallas.length) { console.error(`\ncheck-exclusion: ${fallas.length} falla(s) de ${casos} casos`); process.exit(1); }
console.log(`\ncheck-exclusion: verde (${casos} casos · esquema real en SQLite · 3 mutaciones de código y 1 de texto gritan)`);
