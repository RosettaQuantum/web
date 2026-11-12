#!/usr/bin/env node
/**
 * Sin Turnstile válido no se escribe en D1 ni se envía nada (12-nov-2026).
 *
 * Los formularios que piden un correo —el informe de la industria en /es/q-ready y «Descargar mi
 * informe» en las dos páginas de medición— pasan por lib/captacion.mjs, y la ruta vieja
 * POST /api/medicion/envio por lib/envio-informe.mjs. El modo de fallo que este guardia caza es
 * silencioso: una verificación que se borra, se mueve después del INSERT o «deja pasar si
 * Cloudflare no responde» no rompe ninguna página; sólo abre la base a los bots.
 *
 * Se ejerce el código real de los handlers con un fetch SIMULADO para siteverify y una D1 falsa
 * que anota cada sentencia de escritura:
 *  - GRITO: sin token, con token que Cloudflare rechaza, sin secreto configurado y con siteverify
 *    caído → 403 y CERO escrituras (ni INSERT, ni CREATE, ni cola de correo).
 *  - SILENCIO: con token que Cloudflare acepta → 200, la fila se escribe y el secreto viajó a
 *    siteverify (no se aceptó sin preguntar).
 *   node scripts/check-turnstile-captacion.mjs
 */
import { registerHooks } from "node:module";
// lib/borde-envivo.mjs importa "cloudflare:sockets", que sólo existe en Workers. Aquí no se abre
// ningún socket: se sustituye por un módulo vacío ANTES de cargar los handlers.
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets en el guardia')}", shortCircuit: true } : sig(esp, ctx) });
const { manejarInformeIndustria, manejarDescarga } = await import("../lib/captacion.mjs");
const { manejarEnvio } = await import("../lib/envio-informe.mjs");
const { SITEVERIFY } = await import("../lib/turnstile.mjs");
const { sellarFoto } = await import("../public/js/qex-nucleo.mjs");

export const CONSUMIDOR = { quien: "sesion web de Rosetta", hace: "vuelve a poner la verificación de Turnstile antes de toda escritura en lib/captacion.mjs o lib/envio-informe.mjs, antes de desplegar" };

const fallas = [];
const SECRETO = "secreto-de-prueba-del-guardia";
let preguntas = [];
// siteverify simulado: acepta sólo "token-bueno" y sólo si le llega el secreto.
globalThis.fetch = async (url, init) => {
  if (String(url) !== SITEVERIFY) throw new Error(`fetch inesperado a ${url}`);
  const p = new URLSearchParams(String(init?.body ?? ""));
  preguntas.push(p.get("response"));
  if (p.get("response") === "token-caido") throw new Error("red caída");
  const ok = p.get("secret") === SECRETO && p.get("response") === "token-bueno";
  return new Response(JSON.stringify({ success: ok, "error-codes": ok ? [] : ["invalid-input-response"] }), { headers: { "content-type": "application/json" } });
};
// La caché del límite por IP (lib/borde-envivo.mjs) no existe en Node.
globalThis.caches = { default: { match: async () => undefined, put: async () => {} } };

function dbFalsa() {
  const escrituras = [];
  const prep = (sql) => {
    const st = { args: [], bind(...a) { st.args = a; return st; },
      async run() { if (/^\s*(INSERT|UPDATE|CREATE|DELETE)/i.test(sql)) escrituras.push(sql.trim().split(/\s+/).slice(0, 3).join(" ")); return { meta: { changes: 1, last_row_id: 1 } }; },
      async first() { await st.run(); return /RETURNING id/.test(sql) ? { id: typeof st.args[0] === "string" && /^[0-9a-f-]{36}$/.test(st.args[0]) ? st.args[0] : 7 } : null; } };
    return st;
  };
  return { escrituras, DB: { prepare: prep } };
}
const pedir = (ruta, cuerpo) => new Request(`http://localhost${ruta}`, { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": "203.0.113.9" }, body: JSON.stringify(cuerpo) });
const foto = await sellarFoto({ esquema: "rosetta-qex-foto/1", dominio: "ejemplo.cl", medido_utc: "2026-11-12T00:00:00Z" });

const CASOS = [
  ["informe de la industria", (t) => manejarInformeIndustria(pedir("/api/qready/informe-industria", { email: "ana@ejemplo.cl", edicion: "2026-08", proxima: true, turnstile: t }), ENV())],
  ["descargar aquí", (t) => manejarDescarga(pedir("/api/medicion/descarga", { email: "ana@ejemplo.cl", dominio: "ejemplo.cl", eleccion: "descargar", acepta: true, turnstile: t }), ENV())],
  ["recibirlo por correo", (t) => manejarDescarga(pedir("/api/medicion/descarga", { email: "ana@ejemplo.cl", dominio: "ejemplo.cl", eleccion: "correo", acepta: true, foto, turnstile: t }), ENV())],
  ["ruta vieja /api/medicion/envio", (t) => manejarEnvio(pedir("/api/medicion/envio", { email: "ana@ejemplo.cl", acepta: true, foto, turnstile: t }), ENV(), new URL("http://localhost/api/medicion/envio"))],
];
let actual = null, secreto = SECRETO;
const ENV = () => (actual = { ...dbFalsa(), TURNSTILE_SECRET: secreto, SONDA_CORREO_CLAVE: "x".repeat(40), ENVIO_INFORME_ACTIVO: "1" });

for (const [nombre, llamar] of CASOS) {
  // grito
  for (const [como, token, sec] of [["sin token", undefined, SECRETO], ["token rechazado", "token-malo", SECRETO], ["siteverify caído", "token-caido", SECRETO], ["sin secreto en el Worker", "token-bueno", ""]]) {
    secreto = sec; preguntas = [];
    const r = await llamar(token);
    if (r.status !== 403) fallas.push(`${nombre} · ${como}: respondió ${r.status}, se esperaba 403`);
    if (actual.escrituras.length) fallas.push(`${nombre} · ${como}: escribió en D1 sin Turnstile válido → ${actual.escrituras.join(" | ")}`);
  }
  // silencio
  secreto = SECRETO; preguntas = [];
  const r = await llamar("token-bueno");
  const j = await r.json().catch(() => ({}));
  if (r.status !== 200 || j.ok !== true) fallas.push(`${nombre} · token válido: respondió ${r.status} ${JSON.stringify(j)}, se esperaba 200 ok`);
  if (!actual.escrituras.some((w) => /^INSERT INTO/.test(w))) fallas.push(`${nombre} · token válido: no escribió la fila`);
  if (!preguntas.includes("token-bueno")) fallas.push(`${nombre} · token válido: aceptó sin preguntarle a siteverify`);
}

if (fallas.length) { console.error("[turnstile-captacion] FALLA:\n  " + fallas.join("\n  ")); process.exit(1); }
console.log(`[turnstile-captacion] ok: ${CASOS.length} rutas · sin token válido 0 escrituras (4 casos de grito c/u) · con token válido la fila se escribe`);
