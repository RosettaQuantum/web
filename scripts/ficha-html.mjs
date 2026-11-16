#!/usr/bin/env node
/**
 * Un trabajo del informe por correo armado con la MISMA función del Worker (lib/envio-informe.mjs →
 * fichaDelTrabajo → ficha.mjs: armarFicha + htmlDe, documento A4), sin cola ni base real. Para ensayar el
 * PDF del VPS (python3 informe_pdf.py --pdf trabajo.json salida.pdf) y para su prueba (test_informe_pdf.py).
 *   node scripts/ficha-html.mjs <fixture con {foto, ctx}> > trabajo.json
 * La base es de mentira y responde lo que dice el ctx del fixture: verificado, público y el correo medido.
 */
import { registerHooks } from "node:module";
import { readFileSync } from "node:fs";
registerHooks({ resolve: (esp, ctx, sig) => esp === "cloudflare:sockets"
  ? { url: "data:text/javascript,export function connect(){throw new Error('sin sockets')}", shortCircuit: true } : sig(esp, ctx) });
const { fichaDelTrabajo } = await import("../lib/envio-informe.mjs");

const ruta = process.argv[2];
if (!ruta) { console.error("uso: node scripts/ficha-html.mjs <fixture.json>"); process.exit(2); }
const { foto, ctx = {} } = JSON.parse(readFileSync(ruta, "utf8"));
const DB = { prepare: (sql) => ({ bind: () => ({ first: async () =>
  /qready_dominios/.test(sql) ? { publico: ctx.verificado ? (ctx.publico ? 1 : 0) : null }
  : /sondas_correo/.test(sql) && ctx.correo ? { estado: ctx.correo.estado, resultado: JSON.stringify(ctx.correo.resultado ?? null) } : null }) }) };
const marca = readFileSync(new URL("../public/rosetta-mark.svg", import.meta.url), "utf8");
const { ficha_html, lectura } = await fichaDelTrabajo({ DB }, { dominio: foto.dominio, foto, correo_id: ctx.correo ? "fixture" : null }, marca);
process.stdout.write(JSON.stringify({ id: "00000000-0000-0000-0000-000000000000", email: "prueba@ejemplo.cl", dominio: foto.dominio, foto,
  correo_id: null, ficha_html, lectura, baja: null }));
