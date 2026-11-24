#!/usr/bin/env node
/**
 * Una sola letra también EN VIVO (24-nov-2026).
 *
 * EL DEFECTO REAL. El 24-nov, sobre producción, con rosettaquantum.com verificado y con inventario:
 *   get_qready_grade, el sello y /es/verificado/rosettaquantum.com → A+
 *   medir_exposicion_pqc (MCP) y /es/q-ready/medicion, el MISMO dominio, el MISMO día → A
 * y la ficha de la medición enlazaba la página pública que decía otra letra. check-qready-una-letra.mjs cubría
 * los cuatro caminos del dominio verificado (sello, cron, página, API) y no el quinto: la medición en vivo,
 * que llamaba N.explicarNota(foto) sin extras. Ahora pide las extras a extrasDeMedicion()
 * (lib/qready-wellknown.mjs → extrasNota, la regla del sello).
 *
 * Este guardia lo exige por la SALIDA, con el camino real de medirParaAgente (lo que contestan el MCP y
 * POST /v1/medicion) y las respuestas REALES de /api/ct y /api/sondas de rosettaquantum.com grabadas el
 * 24-nov (scripts/fixtures/medicion-agentes/*-rosettaquantum.com.*), sobre una D1 EN MEMORIA:
 *  · PRECONDICIÓN  sin verificar, la foto grabada es A (si no, el caso no prueba nada: regrabar el fixture).
 *  · GRITO         verificado + inventario + /.well-known válido: nota.letra, RQ.S.00 de la ficha y el
 *                  markdown dicen A+, y es la MISMA letra que guarda el cron y sirve notaParaApi.
 *  · SILENCIO      verificado sin inventario → A; no verificado → A; inventario sin llave de firma → A.
 *  · extrasDeMedicion: {} sin verificación (lo que /api/sondas manda a la página como null).
 *  · MUTACIÓN      medicion-agentes vuelve a explicarNota(r.foto) sin extras → grita.
 * QUÉ NO CUBRE. No ejerce /api/sondas ni la página en un navegador (abren sockets): la página usa la misma
 * extrasDeMedicion vía /api/sondas → extras_nota, y check-qready-nota.mjs exige la llamada de la página.
 *   node scripts/check-medicion-una-letra.mjs
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const A = await import("../lib/medicion-agentes.mjs");
const V = await import("../lib/qready-verificado.mjs");
const WK = await import("../lib/qready-wellknown.mjs");
const { d1EnMemoria } = await import("./lib/d1-memoria.mjs");
const { conMutante } = await import("./lib/mutar.mjs");

export const CONSUMIDOR = { quien: "sesión web de Rosetta", hace: "corrige lib/medicion-agentes.mjs o lib/qready-wellknown.mjs para que la medición en vivo de un dominio verificado dé la letra de su sello antes de desplegar" };

const raiz = new URL("../", import.meta.url);
const leer = (r) => readFileSync(new URL(r, raiz), "utf8");
const DOMINIO = "rosettaquantum.com";
const ESQ = [new URL("db/qready-verificado.schema.sql", raiz), new URL("db/medicion-agentes.schema.sql", raiz)];
const CT = JSON.parse(gunzipSync(readFileSync(new URL("scripts/fixtures/medicion-agentes/ct-rosettaquantum.com.json.gz", raiz))).toString("utf8"));
const SONDAS = JSON.parse(leer("scripts/fixtures/medicion-agentes/sondas-rosettaquantum.com.json"));
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
const M = { ct: async () => json(CT), sondas: async () => json(SONDAS), correo: async () => json({ ok: true, id: "c0ffee" }) };
const ASSETS = { fetch: async () => new Response("", { status: 404 }) };
const par = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
const JWK = JSON.stringify({ ...(await crypto.subtle.exportKey("jwk", par.privateKey)), kid: "rq-guardia-prueba" });

const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const silenciar = () => { const o = [console.error, console.log]; console.error = () => {}; console.log = () => {}; return () => { [console.error, console.log] = o; }; };

async function entorno({ verificado, inventario = false, conLlave = true }) {
  const db = d1EnMemoria(...ESQ);
  const token = V.generarToken();
  if (verificado) await db.prepare("INSERT INTO qready_dominios (token, dominio, sector, publico, entorno, creado_utc, verificado_en, inventario_verificado_en) VALUES (?1,?2,'fintech',1,'produccion',?3,?3,?4)")
    .bind(token, DOMINIO, "2026-11-13T00:00:00.000Z", inventario ? "2026-11-18T00:00:00.000Z" : null).run();
  return { env: { DB: db, ASSETS, ...(conLlave ? { QREADY_FIRMA_JWK: JWK } : {}) }, token };
}
// Las tres lecturas de la medición en vivo: el bloque nota, la ficha en datos y el markdown.
async function enVivo(Mod, env) {
  const restaurar = silenciar();
  try {
    const r = (await Mod.medirParaAgente(env, { dominio: DOMINIO, sector: "fintech" }, { canal: "mcp", ip: "203.0.113.7" }, null, M)).cuerpo;
    const md = r.presentacion?.markdown || "";
    return { nota: r.nota?.letra ?? null, ficha: r.presentacion?.ficha?.indicadores?.["RQ.S.00"]?.valor ?? null,
      markdown: (md.match(/\| RQ\.S\.00 \| [^|]+ \| \*\*([^*]+)\*\* \|/) || [])[1] ?? null, ficha_url: r.ficha_url ?? null };
  } finally { restaurar(); }
}
const letras = (l) => [l.nota, l.ficha, l.markdown];

// ---------------------------------------------------------------- precondición
const fuera = await enVivo(A, (await entorno({ verificado: false })).env);
if (fuera.nota !== "A")
  fallas.push(`PRECONDICIÓN: la foto grabada de ${DOMINIO} ya no es A sin verificar (dio ${fuera.nota}). Probablemente venció el certificado grabado: regrabe scripts/fixtures/medicion-agentes/*-rosettaquantum.com.*`);
igual(letras(fuera), ["A", "A", "A"], "no verificado: A en nota, ficha y markdown (desde afuera el máximo es A)");

// ---------------------------------------------------------------- grito: A+ como el sello
const conInv = await entorno({ verificado: true, inventario: true });
const vivo = await enVivo(A, conInv.env);
igual(letras(vivo), ["A+", "A+", "A+"], "verificado + inventario + /.well-known válido: la medición en vivo dice A+ en nota, ficha y markdown");
// la MISMA letra que guarda el cron (medirYGuardar con el mismo tomarFoto) y sirve notaParaApi (get_qready_grade)
{
  const restaurar = silenciar();
  let api = null;
  try {
    const fila = await conInv.env.DB.prepare("SELECT * FROM qready_dominios WHERE token = ?1").bind(conInv.token).first();
    await V.medirYGuardar(conInv.env, fila, { tomarFoto: (env, o) => A.tomarFoto(env, { ...o, m: M }) });
    api = (await V.notaParaApi(conInv.env, DOMINIO, new URL(`https://${DOMINIO}/`))).cuerpo;
  } finally { restaurar(); }
  igual([api?.nota ?? null, api?.presentacion?.ficha?.indicadores?.["RQ.S.00"]?.valor ?? null], [vivo.nota, vivo.ficha],
    "get_qready_grade (nota guardada por el cron y su ficha) = medición en vivo");
}
igual(vivo.ficha_url, `https://rosettaquantum.com/es/verificado/${DOMINIO}`, "ficha_url de un dominio público: su página /verificado");

// ---------------------------------------------------------------- silencio
igual(letras(await enVivo(A, (await entorno({ verificado: true, inventario: false })).env)), ["A", "A", "A"], "SILENCIO: verificado sin inventario → A");
igual(letras(await enVivo(A, (await entorno({ verificado: true, inventario: true, conLlave: false })).env)), ["A", "A", "A"],
  "SILENCIO: inventario marcado pero /.well-known no servible (sin llave) → A");
igual(await WK.extrasDeMedicion((await entorno({ verificado: false })).env, DOMINIO), {}, "extrasDeMedicion de un dominio no verificado: {}");
{ const restaurar = silenciar();
  try { igual(await WK.extrasDeMedicion({ DB: { prepare: () => { throw new Error("D1 caída"); } } }, DOMINIO).catch(() => "lanzó"), {}, "extrasDeMedicion con la base caída: {} (falla cerrado)"); }
  finally { restaurar(); } }
const ex = await WK.extrasDeMedicion(conInv.env, DOMINIO);
igual([ex.inventario_verificado, ex.well_known_valido], [true, true], "extrasDeMedicion de un dominio verificado con inventario: las extras del sello");

// ---------------------------------------------------------------- mutación
await conMutante(new URL("lib/medicion-agentes.mjs", raiz), "const x = N.explicarNota(r.foto, extras);", "const x = N.explicarNota(r.foto);", async (A2) => {
  const l = await enVivo(A2, (await entorno({ verificado: true, inventario: true })).env);
  igual(l.nota !== "A+", true, "MUTACIÓN: la medición en vivo sin extras vuelve a decir otra letra que el sello (el guardia lo ve)");
});

if (fallas.length) {
  console.error(`check-medicion-una-letra: ${fallas.length} FALLA(S) de ${casos} casos`);
  for (const f of fallas) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(`check-medicion-una-letra: ok (${casos} casos · ${DOMINIO} grabado: A sin verificar, A+ verificado con inventario = get_qready_grade · 3 silencios · 1 mutación grita)`);
