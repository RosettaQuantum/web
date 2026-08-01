/**
 * API de lectura del Evidence Ledger + servidor MCP.
 *
 * POR QUE EXISTE
 * --------------
 * El archivo tiene decenas de corridas selladas, ancladas y verificables, pero hasta
 * ahora solo eran legibles por una persona navegando. La tesis del proyecto dice que
 * cuando alguien le pregunte a su copilot "¿sirve quantum para optimizacion de
 * portafolios?", la respuesta deberia citar a Rosetta — y el foso no es el secreto,
 * es el rastro de citas. Nada de eso ocurre si la evidencia no se puede consultar
 * por maquina.
 *
 * REGLA DE HONESTIDAD DE ESTA API
 * -------------------------------
 * Toda respuesta que afirme algo trae con que comprobarlo: el sha256 sellado y las
 * URLs de las dos copias publicas. Un modelo que cite esto puede apuntar al archivo
 * crudo, no a nuestra palabra. Y `/v1/state` declara el titular tal como es —
 * 0 victorias cuanticas medidas — porque el producto de este archivo son los
 * negativos y una API que los escondiera traicionaria la tesis entera.
 *
 * Solo lectura. Sin claves. Sin escritura. La fase de escritura (`qlib.solve()`)
 * llega cuando haya demanda, nunca antes.
 */

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};
const SITE = "https://rosettaquantum.com";
const CACHE = "public, s-maxage=300";

function json(obj, status = 200, extra = {}) {
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": CACHE, ...CORS, ...extra },
  });
}

/** Bloque de verificacion que acompaña a todo lo que la API afirma. */
function comoComprobar(row) {
  return {
    content_hash: row.content_hash,
    github_raw: row.github_url,
    codeberg_raw: row.codeberg_url,
    como_verificar:
      "Descarga cualquiera de las dos copias, recomputa el sha256 segun " +
      `${SITE}/api-docs y compara con content_hash. Las dos copias deben ser ` +
      "byte-identicas entre si. El sello ademas esta anclado en Bitcoin (OpenTimestamps).",
  };
}

function resumenArchivo(row) {
  let payload = {};
  try { payload = JSON.parse(row.payload || "{}"); } catch (e) {}
  const q = (payload.w6 || {}).que || {};
  return {
    id: row.file_id,
    tipo: row.type,
    recipe_id: row.recipe_id,
    fecha: row.archived_at,
    es_demo: !!row.is_demo,
    clase_de_problema: q.problem_class || null,
    instancia: q.instance || null,
    resultado: q.outcome || null,
    metrica: q.metric || null,
    ...comoComprobar(row),
  };
}

async function estado(env) {
  const [tipos, recetas, ver] = await env.DB.batch([
    env.DB.prepare("SELECT type, count(*) n FROM run_archives GROUP BY type"),
    env.DB.prepare("SELECT id,name,problem_class,vertical,algorithm,status FROM recipes ORDER BY id"),
    env.DB.prepare("SELECT count(*) n FROM verdicts WHERE is_demo=0"),
  ]);
  const cuenta = Object.fromEntries((tipos.results || []).map(r => [r.type, r.n]));
  return {
    proyecto: "Rosetta Quantum — Evidence Ledger",
    tesis:
      "Medimos, por clase de problema, si un metodo cuantico le gana al mejor solver " +
      "clasico disponible, y publicamos la evidencia cruda — incluidos los negativos.",
    estado_medido: {
      corridas_selladas: cuenta.RUN || 0,
      veredictos_publicados: (ver.results || [{ n: 0 }])[0].n,
      pre_registros: cuenta.PREREG || 0,
      recetas: cuenta.RECIPE || 0,
      // El titular del archivo es un negativo. Va primero y sin adornos.
      victorias_cuanticas_medidas: 0,
      lectura:
        "Cero. En ninguna corrida sellada hasta hoy un metodo cuantico le gano al " +
        "campeon clasico. Ese resultado es el producto, no una falla del archivo.",
    },
    recetas: (recetas.results || []).map(r => ({
      id: r.id, nombre: r.name, clase: r.problem_class,
      vertical: r.vertical, algoritmo: r.algorithm, estado: r.status,
    })),
    integridad: {
      copias: ["GitHub", "Codeberg", "Cloudflare D1"],
      ancla_externa: "OpenTimestamps (Bitcoin)",
      auditoria: "diaria, automatica",
      protocolo: "https://github.com/RosettaQuantum/evidence/blob/main/PROTOCOL.md",
    },
    licencia: { datos: "CC BY 4.0", codigo: "Apache-2.0",
      atribucion: "Verdict data © Rosetta Quantum, CC BY 4.0 — " + SITE + "/ledger" },
  };
}

async function listar(env, tipo, url) {
  const recipe = url.searchParams.get("recipe");
  const limite = Math.min(parseInt(url.searchParams.get("limit") || "50", 10) || 50, 200);
  let sql = "SELECT file_id,type,recipe_id,is_demo,archived_at,content_hash,github_url,codeberg_url,payload FROM run_archives WHERE type=?";
  const args = [tipo];
  if (recipe) { sql += " AND recipe_id=?"; args.push(recipe); }
  sql += " ORDER BY archived_at DESC, file_id DESC LIMIT ?";
  args.push(limite);
  const { results = [] } = await env.DB.prepare(sql).bind(...args).all();
  return json({ total: results.length, filtro: { tipo, recipe }, items: results.map(resumenArchivo) });
}

async function porId(env, id, completo) {
  const row = await env.DB.prepare(
    "SELECT file_id,type,recipe_id,is_demo,archived_at,content_hash,github_url,codeberg_url,payload FROM run_archives WHERE file_id=?"
  ).bind(id).first();
  if (!row) return json({ error: "no existe", id }, 404);
  const base = resumenArchivo(row);
  if (!completo) return json(base);
  let payload = null;
  try { payload = JSON.parse(row.payload); } catch (e) {}
  // El archivo sellado completo: es lo que un tercero necesita para recomputar el hash.
  return json({ ...base, archivo_sellado: payload });
}

async function buscar(env, q, limite = 20) {
  const like = `%${(q || "").toLowerCase()}%`;
  const { results = [] } = await env.DB.prepare(
    "SELECT file_id,type,recipe_id,is_demo,archived_at,content_hash,github_url,codeberg_url,payload " +
    "FROM run_archives WHERE lower(payload) LIKE ? ORDER BY archived_at DESC LIMIT ?"
  ).bind(like, limite).all();
  return results.map(resumenArchivo);
}

// ---------------------------------------------------------------- MCP (JSON-RPC 2.0)

const HERRAMIENTAS = [
  {
    name: "estado_del_archivo",
    description:
      "Estado medido del Evidence Ledger de Rosetta Quantum: cuantas corridas selladas " +
      "hay, cuantos veredictos, y cuantas victorias cuanticas se han medido (hoy: cero). " +
      "Usar para responder '¿que tan real es la ventaja cuantica hoy?' con datos citables.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "buscar_evidencia",
    description:
      "Busca en las corridas selladas por texto libre: nombre de proteina, clase de " +
      "problema, algoritmo, solver. Devuelve cada coincidencia con su sha256 y las URLs " +
      "de las copias publicas para poder citarla y comprobarla.",
    inputSchema: {
      type: "object",
      properties: { consulta: { type: "string", description: "p.ej. 'portfolio', 'KRAS', 'QAOA', 'grid'" } },
      required: ["consulta"],
    },
  },
  {
    name: "ver_archivo",
    description:
      "Devuelve un archivo sellado completo por su ID (p.ej. 'V-0012', 'EXP-0012-001'), " +
      "incluido el contenido con el que se puede recomputar su hash.",
    inputSchema: {
      type: "object",
      properties: { id: { type: "string", description: "ID del run, veredicto, receta o pre-registro" } },
      required: ["id"],
    },
  },
  {
    name: "listar_por_tipo",
    description: "Lista archivos sellados de un tipo: RUN, VERDICT, PREREG o RECIPE.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["RUN", "VERDICT", "PREREG", "RECIPE"] },
        recipe: { type: "string", description: "opcional: filtrar por receta, p.ej. RQ-0012" },
      },
      required: ["tipo"],
    },
  },
];

async function ejecutarHerramienta(env, nombre, args) {
  if (nombre === "estado_del_archivo") return await estado(env);
  if (nombre === "buscar_evidencia") {
    const items = await buscar(env, args.consulta);
    return { consulta: args.consulta, encontrados: items.length, items };
  }
  if (nombre === "ver_archivo") {
    const r = await porId(env, args.id, true);
    return await r.json();
  }
  if (nombre === "listar_por_tipo") {
    const u = new URL(SITE + "/x");
    if (args.recipe) u.searchParams.set("recipe", args.recipe);
    const r = await listar(env, args.tipo, u);
    return await r.json();
  }
  throw new Error(`herramienta desconocida: ${nombre}`);
}

async function mcp(request, env) {
  if (request.method === "GET") {
    // Un GET al endpoint sirve de descubrimiento humano: que es y que ofrece.
    return json({
      servidor: "rosetta-evidence",
      transporte: "JSON-RPC 2.0 sobre HTTP POST",
      herramientas: HERRAMIENTAS.map(h => ({ nombre: h.name, descripcion: h.description })),
      nota: "Solo lectura. Toda respuesta incluye sha256 y URLs de las copias publicas.",
    });
  }
  let req;
  try { req = await request.json(); } catch (e) { return json({ error: "json invalido" }, 400); }

  const responder = (result, id) => json({ jsonrpc: "2.0", id: id ?? null, result });
  const fallar = (code, message, id) => json({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

  try {
    if (req.method === "initialize") {
      return responder({
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        serverInfo: { name: "rosetta-evidence", version: "1.0.0" },
      }, req.id);
    }
    if (req.method === "notifications/initialized") return new Response(null, { status: 204, headers: CORS });
    if (req.method === "tools/list") return responder({ tools: HERRAMIENTAS }, req.id);
    if (req.method === "tools/call") {
      const { name, arguments: args = {} } = req.params || {};
      const salida = await ejecutarHerramienta(env, name, args);
      return responder({ content: [{ type: "text", text: JSON.stringify(salida, null, 2) }] }, req.id);
    }
    return fallar(-32601, `metodo no soportado: ${req.method}`, req.id);
  } catch (e) {
    return fallar(-32000, String(e && e.message || e), req.id);
  }
}

// ---------------------------------------------------------------- enrutador

export async function manejarApi(request, env, url) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const p = url.pathname;
  if (p === "/mcp" || p === "/mcp/") return await mcp(request, env);
  // HEAD se atiende como GET y se devuelve sin cuerpo. Sin esto, `curl -I`, los
  // chequeos de salud y varios clientes HTTP reciben un 404 sobre una ruta que si
  // existe — el tipo de discrepancia que hace dudar de una API antes de usarla.
  const esHead = request.method === "HEAD";
  if (request.method !== "GET" && !esHead) return null;
  if (esHead) {
    const r = await manejarApi(new Request(request.url, { method: "GET" }), env, url);
    return r ? new Response(null, { status: r.status, headers: r.headers }) : null;
  }

  if (p === "/v1" || p === "/v1/") {
    return json({
      api: "Rosetta Quantum — Evidence Ledger, solo lectura",
      endpoints: {
        "GET /v1/state": "estado medido del archivo (empieza por aqui)",
        "GET /v1/runs": "corridas selladas · ?recipe=RQ-0012 &limit=50",
        "GET /v1/verdicts": "veredictos publicados",
        "GET /v1/prereg": "pre-registros (compromisos sellados antes de correr)",
        "GET /v1/recipes": "recetas del catalogo",
        "GET /v1/archive/{id}": "un archivo sellado completo, con su payload",
        "GET /v1/search?q=": "busqueda en texto de las corridas",
        "POST /mcp": "servidor MCP (JSON-RPC 2.0) para agentes",
      },
      licencia: "CC BY 4.0 — cita: Rosetta Quantum Evidence Ledger, " + SITE + "/ledger",
    });
  }
  if (p === "/v1/state") return json(await estado(env));
  if (p === "/v1/runs") return await listar(env, "RUN", url);
  if (p === "/v1/verdicts") return await listar(env, "VERDICT", url);
  if (p === "/v1/prereg") return await listar(env, "PREREG", url);
  if (p === "/v1/recipes") return await listar(env, "RECIPE", url);
  if (p === "/v1/search") {
    const q = url.searchParams.get("q");
    if (!q) return json({ error: "falta el parametro q" }, 400);
    const items = await buscar(env, q);
    return json({ consulta: q, encontrados: items.length, items });
  }
  const m = p.match(/^\/v1\/archive\/([^/]+)\/?$/);
  if (m) return await porId(env, decodeURIComponent(m[1]), true);

  return null;   // no es ruta de API: que siga el resto del Worker
}
