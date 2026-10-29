#!/usr/bin/env node
/**
 * Servidor MCP del Compilador — para que un agente componga y valide un pedido sin
 * pasar por la web.
 *
 * QUE PUEDE Y QUE NO, dicho aqui para que nadie lo descubra probandolo:
 *   - puede: listar lo que se puede pedir, leer una receta entera, y VALIDAR un pedido
 *     devolviendo el `config` que correria el ejecutor, o un rechazo que nombra el campo.
 *   - NO puede: ejecutar. No existe quien lo haga (P2 del SPEC-04, decision D-1 abierta).
 *     Cada respuesta lo declara en vez de dejar suponer que algo quedo encolado.
 *
 * JSON-RPC 2.0 por stdio, sin dependencias. Comparte `lib/compilador.mjs` con la landing
 * y con el Worker: una definicion, no tres.
 *
 * Uso:  node mcp/servidor.mjs
 */
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { compilar } from "../lib/compilador.mjs";

const AQUI = dirname(fileURLToPath(import.meta.url));
const RECETAS_DIR = join(AQUI, "..", "recetas");

function recetas() {
  return readdirSync(RECETAS_DIR).filter((f) => f.endsWith(".json"))
    .map((f) => JSON.parse(readFileSync(join(RECETAS_DIR, f), "utf8")));
}
const porId = (id) => recetas().find((r) => r.id === id) || null;

const HERRAMIENTAS = [
  { name: "listar_recetas",
    description: "Que se puede pedir hoy, con su estado. Una receta solo es pedible en estado 'sellable'; si ninguna lo esta, lo dice.",
    inputSchema: { type: "object", properties: {} } },
  { name: "ver_receta",
    description: "La ficha entera de una receta: que parametros acepta, que devuelve, si puede emitir veredicto, y lo que declara que NO va a cumplir.",
    inputSchema: { type: "object", required: ["id"], properties: { id: { type: "string" } } } },
  { name: "validar_pedido",
    description: "Compila un pedido: devuelve el config que correria el ejecutor, o lo rechaza nombrando cada campo que sobra o esta fuera de rango. NO ejecuta nada.",
    inputSchema: { type: "object", required: ["receta"], properties: {
      receta: { type: "string" },
      params: { type: "object", description: "los parametros; se validan contra el params_schema de la receta" },
      exige_veredicto: { type: "boolean", description: "si true, falla cuando la receta no puede juzgar" } } } },
];

function llamar(nombre, args = {}) {
  if (nombre === "listar_recetas") {
    const rs = recetas();
    return {
      total: rs.length,
      pedibles: rs.filter((r) => r.estado === "sellable").length,
      aviso: rs.some((r) => r.estado === "sellable") ? null
        : "Ninguna receta esta en estado 'sellable' todavia: se pueden validar pedidos, no ejecutarlos.",
      items: rs.map((r) => ({ id: r.id, version: r.version, nombre: r.identidad?.name,
        clase: r.identidad?.problem_class, vertical: r.identidad?.vertical, estado: r.estado,
        emite: r.promesa?.scorable ? "VERDICT" : "PREDICTION",
        le_falta: r.estado === "sellable" ? null : r._por_que_no_es_sellable })),
    };
  }
  if (nombre === "ver_receta") {
    const r = porId(args.id);
    return r || { error: "UNKNOWN_RECIPE", requested: args.id, disponibles: recetas().map((x) => x.id) };
  }
  if (nombre === "validar_pedido") {
    const r = compilar({
      pedido: { receta: args.receta, params: args.params || {} },
      receta: porId(args.receta),
      exige_veredicto: !!args.exige_veredicto,
    });
    return { ...r, aviso_del_servidor: "Esto compila y valida. Ejecutar no existe todavia (SPEC-04 P2, decision D-1)." };
  }
  return { error: "herramienta desconocida: " + nombre };
}

// ── JSON-RPC por stdio ──────────────────────────────────────────────────────
const escribir = (o) => process.stdout.write(JSON.stringify(o) + "\n");
let resto = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (trozo) => {
  resto += trozo;
  let i;
  while ((i = resto.indexOf("\n")) >= 0) {
    const linea = resto.slice(0, i).trim(); resto = resto.slice(i + 1);
    if (!linea) continue;
    let m; try { m = JSON.parse(linea); } catch { continue; }
    if (m.method === "initialize") {
      escribir({ jsonrpc: "2.0", id: m.id, result: { protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "rosetta-compilador", version: "0.1.0" } } });
    } else if (m.method === "tools/list") {
      escribir({ jsonrpc: "2.0", id: m.id, result: { tools: HERRAMIENTAS } });
    } else if (m.method === "tools/call") {
      const out = llamar(m.params?.name, m.params?.arguments);
      escribir({ jsonrpc: "2.0", id: m.id,
        result: { content: [{ type: "text", text: JSON.stringify(out, null, 2) }] } });
    } else if (m.id !== undefined) {
      escribir({ jsonrpc: "2.0", id: m.id, error: { code: -32601, message: "method not found: " + m.method } });
    }
  }
});
