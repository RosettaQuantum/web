#!/usr/bin/env node
/**
 * descubrir_proveedores dice el entorno real (24-nov-2026).
 * EL DEFECTO REAL. En producción la herramienta respondía `"medido_desde": "worker (preview)"`: un literal escrito
 * a mano en api.js. Ahora `medido_desde: "worker"` y `entorno` sale del host que atendió el pedido
 * (entornoDeHost): rosettaquantum.com → produccion, *.workers.dev → preview, otro → null (no se adivina).
 *  · GRITO: el literal «worker (preview)» no vuelve a api.js; producción no dice preview.
 *  · SILENCIO: el host de la vista previa dice preview.
 *   node scripts/check-entorno-proveedores.mjs
 */
import { readFileSync } from "node:fs";
const { entornoDeHost } = await import("../api.js");
export const CONSUMIDOR = { quien: "sesión web de Rosetta", hace: "no vuelve a escribir el entorno a mano en la respuesta de descubrir_proveedores" };
const fallas = [];
let casos = 0;
const igual = (a, b, q) => { casos++; if (JSON.stringify(a) !== JSON.stringify(b)) fallas.push(`${q}: esperaba ${JSON.stringify(b)}, dio ${JSON.stringify(a)}`); };
const api = readFileSync(new URL("../api.js", import.meta.url), "utf8");
igual(/worker \(preview\)/.test(api), false, "GRITO: api.js ya no escribe «worker (preview)» a mano");
igual(/medido_desde: "worker", entorno: entornoDeHost\(quien\.url\)/.test(api), true, "descubrir_proveedores declara el entorno con entornoDeHost");
igual(entornoDeHost(new URL("https://rosettaquantum.com/mcp")), "produccion", "producción dice produccion");
igual(entornoDeHost(new URL("https://www.rosettaquantum.com/mcp")), "produccion", "www también");
igual(entornoDeHost(new URL("https://00ca4135-rosetta-quantum-preview.nicholasiakl.workers.dev/mcp")), "preview", "SILENCIO: la vista previa dice preview");
igual([entornoDeHost(new URL("https://rosettaquantum.com.evil.example/")), entornoDeHost(null)], [null, null], "otro host o sin URL: null, no se adivina");
if (fallas.length) { for (const f of fallas) console.error("  ✗ " + f); console.error(`check-entorno-proveedores: ${fallas.length} FALLA(S) de ${casos} casos`); process.exit(1); }
console.log(`check-entorno-proveedores: ok (${casos} casos · producción = produccion, workers.dev = preview, sin literal a mano)`);
