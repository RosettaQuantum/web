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
 * URLs de las dos copias públicas. Un modelo que cite esto puede apuntar al archivo
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
import { legiblesDe } from "./lib/legible.mjs";

const SITE = "https://rosettaquantum.com";
const CACHE = "public, s-maxage=300";

// Los errores NO se cachean. Un 404 servido con s-maxage=300 se queda pegado en el
// edge cinco minutos, asi que una ruta que empieza a existir sigue respondiendo 404
// en algunos colos despues de desplegarla. Paso de verdad: tras publicar los alias
// por sigla, /v1/algorithms/grover devolvio 404 una vez y 200 las tres siguientes.
// Cachear la respuesta correcta es util; cachear la equivocada solo alarga el error.
function json(obj, status = 200, extra = {}) {
  const cache = status >= 400 ? "no-store" : CACHE;
  return new Response(JSON.stringify(obj, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": cache, ...CORS, ...extra },
  });
}

/** Bloque de verificacion que acompaña a todo lo que la API afirma. */
function comoComprobar(row) {
  return {
    content_hash: row.content_hash,
    github_raw: row.github_url,
    codeberg_raw: row.codeberg_url,
    // ESTA LINEA VIAJA EN CADA RESPUESTA. Es la instruccion que mas gente lee, y
    // durante meses fue FALSA en dos puntos a la vez:
    //
    //  1. "recomputa el sha256" hace pensar que el content_hash es el sha256 DEL
    //     ARCHIVO. No lo es: es el sha256 de un payload canonico —el documento sin
    //     meta.content_hash, sin meta.schema y sin storage, con serializacion fija—.
    //     Sobre RQ-EXP-EON-K20-002: declara 4ffdfeb4… y el sha256 del archivo es
    //     a6ff6a5f…. Quien siguiera la instruccion al pie de la letra concluia que
    //     mentimos.
    //  2. Mandaba a /api-docs, que documentaba UNA convencion de cuatro. Sobre las
    //     corridas v3 daba MISMATCH.
    //
    // Ahora nombra la herramienta que hace las cuatro y de donde bajar los bytes que
    // de verdad reproducen el hash.
    como_verificar:
      `Baja el archivo tal como se selló —de ${SITE}/v1/archive/<id>/raw o de cualquiera ` +
      "de las dos copias públicas— y verifícalo con " +
      "https://github.com/RosettaQuantum/evidence/blob/main/tools/verificar.py, que prueba " +
      "las cuatro convenciones del archivo y dice con cuál calzó. OJO: content_hash NO es " +
      "el sha256 del archivo, sino el de su forma canónica; la receta de cada convención " +
      `está en ${SITE}/api-docs. Las dos copias públicas deben ser byte-idénticas entre si, ` +
      "y el sello está anclado en Bitcoin (OpenTimestamps).",
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
    // La prosa del sello va en ASCII y NO se toca: una tilde cambia el sha256, y
    // v1-legada ademas escapa los no-ASCII. Pero esa misma prosa se muestra al lado de
    // «API publica» en la consola, y el texto que lee una persona lleva tildes.
    //
    // Asi que va DERIVADA, en un campo aparte. Escribirla a mano seria garantizar que un
    // dia diga algo distinto del sello y que el que quede mal sea el que ve el comprador.
    // `legible` solo puede AGREGAR tildes; lib/legible.mjs lo prueba sobre los textos
    // reales del archivo. Objeto vacio = no hacia falta; ausente = este endpoint no lo
    // emite todavia. No son lo mismo.
    legible: legiblesDe(
      { clase_de_problema: q.problem_class, instancia: q.instance, resultado: q.outcome, metrica: q.metric },
      ["clase_de_problema", "instancia", "resultado", "métrica"]),
    ...comoComprobar(row),
  };
}

async function estado(env) {
  const [tipos, recetas, ver, gana] = await env.DB.batch([
    env.DB.prepare("SELECT type, count(*) n FROM run_archives GROUP BY type"),
    env.DB.prepare("SELECT id,name,problem_class,vertical,algorithm,status FROM recipes ORDER BY id"),
    env.DB.prepare("SELECT count(*) n FROM verdicts WHERE is_demo=0"),
    // El titular del archivo es un negativo, y ese numero es el que la web cita
    // en la pagina de precios. Estaba escrito a mano aca — o sea que "sacarlo de
    // /v1/state" habria sido citar otro literal un piso mas arriba, que es el
    // mismo defecto del "450+". Ahora sale de la base: victoria = un veredicto
    // publicado cuyo resultado es 'win' (el vocabulario es win|negative|not yet).
    env.DB.prepare("SELECT count(*) n FROM verdicts WHERE is_demo=0 AND outcome='win'"),
  ]);
  const victorias = (gana.results || [{ n: 0 }])[0].n;
  const cuenta = Object.fromEntries((tipos.results || []).map(r => [r.type, r.n]));
  return {
    proyecto: "Rosetta Quantum — Evidence Ledger",
    tesis:
      "Medimos, por clase de problema, si un método cuántico le gana al mejor solver " +
      "clásico disponible, y publicamos la evidencia cruda — incluidos los negativos.",
    estado_medido: {
      corridas_selladas: cuenta.RUN || 0,
      veredictos_publicados: (ver.results || [{ n: 0 }])[0].n,
      pre_registros: cuenta.PREREG || 0,
      recetas: cuenta.RECIPE || 0,
      victorias_cuanticas_medidas: victorias,
      // La lectura acompana al numero y tiene que seguirlo: un texto que dice
      // "Cero" junto a un contador que ya no dice cero es peor que no tener texto.
      // LA FRASE TIENE QUE AFIRMAR LO QUE EL NUMERO SOSTIENE.
      //
      // Decia "en ninguna CORRIDA SELLADA hasta hoy un metodo cuantico le gano", y eso
      // es falso: hay cuatro corridas selladas cuyo propio campo `resultado` dice
      // "quantum win", las cuatro con es_demo=false. El numero nunca mintio —cuenta
      // VEREDICTOS publicados con outcome win, y hay uno solo, que dice "not yet"—; la
      // que mentia era la prosa, que hablaba de otro conjunto.
      //
      // Es la familia de defectos mas cara del proyecto: los campos medidos correctos y
      // el texto de al lado afirmando de mas. Y aqui vive en la vitrina, al lado de
      // identificadores que cualquiera puede abrir y contar.
      //
      // Se corrige la frase. NO se toca el numero y NO se re-sella ningun archivo.
      // Esta frase NO sale de ningun sello: es un literal de este archivo, y por eso va
      // derecho con tildes en vez de llevar un campo «legible» al lado. El campo derivado
      // existe para la prosa SELLADA, donde el ASCII es una restriccion real del hash;
      // duplicar aqui un texto que podemos escribir bien seria maquinaria para un
      // problema que no existe.
      lectura: victorias === 0
        ? "Cero. Ningún veredicto publicado hasta hoy declara que un método cuántico le " +
          "ganó al campeón clásico. Ese resultado es el producto, no una falla del archivo."
        : `${victorias} de ${(ver.results || [{ n: 0 }])[0].n} veredictos publicados ` +
          "miden una victoria cuántica. Cada uno está sellado y se puede recomputar.",
    },
    recetas: (recetas.results || []).map(r => ({
      id: r.id, nombre: r.name, clase: r.problem_class,
      vertical: r.vertical, algoritmo: r.algorithm, estado: r.status,
    })),
    integridad: {
      copias: ["GitHub", "Codeberg", "Cloudflare D1"],
      ancla_externa: "OpenTimestamps (Bitcoin)",
      auditoria: "diaria, automática",
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

/**
 * El archivo sellado TAL CUAL: los bytes que se sellaron, sin volver a serializar.
 *
 * POR QUE EXISTE, y por que no basta con /v1/archive/{id}
 * ------------------------------------------------------
 * Ese endpoint hace `JSON.parse` del payload y lo vuelve a serializar en la respuesta.
 * El viaje ida y vuelta es inocente salvo en un punto: un float de valor entero se
 * guarda `6.0` y sale `6`. Los hashes de v1 y v2 se calculan sobre el texto que produce
 * `json.dumps` de Python, asi que ese solo caracter cambia el hash.
 *
 * Medido sobre 20 corridas: por el espejo verifican 20 de 20; por la API, 17 de 20. El
 * sello nunca estuvo mal — lo que se perdia era poder recomputarlo desde nuestra propia
 * API, que es justo lo que la pagina promete. v3 es inmune porque JCS normaliza los
 * numeros, que es para lo que se creo.
 *
 * Aca se devuelve `row.payload` sin tocar. Es la unica forma de que la promesa
 * «bajalo y recomputalo» valga tambien por nuestro lado y no solo por el del espejo.
 */
async function porIdCrudo(env, id) {
  const row = await env.DB.prepare(
    "SELECT payload, content_hash FROM run_archives WHERE file_id=?"
  ).bind(id).first();
  if (!row) return json({ error: "no existe", id }, 404);
  return new Response(row.payload, {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": CACHE,
      "access-control-allow-origin": "*",
      // El hash declarado viaja en cabecera para poder comparar sin parsear el cuerpo.
      "x-rq-content-hash": row.content_hash || "",
      "x-rq-nota": "bytes tal como se sellaron; no re-serializado",
    },
  });
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

// ------------------------------------------------- archivador de algoritmos y fuentes

/**
 * El catalogo (tablas `quantum_algorithms` / `quantum_sources`) es una cosa DISTINTA
 * del ledger, y la API las mantiene separadas a proposito:
 *
 *   - `speedup_declarado` es lo que declara la fuente canonica. Es una cita, no una
 *     medicion nuestra. Por eso viaja siempre pegado a `declarado_por` y `fuente_url`.
 *   - `evidencia_rosetta` es lo unico que afirmamos nosotros, y sale de cruzar contra
 *     las recetas selladas. Para casi todo el catalogo dice "sin medicion sellada", y
 *     ese es el dato honesto: catalogar no es implementar, y declarar no es medir.
 *
 * Una respuesta que mezclara las dos cosas convertiria un catalogo bibliografico en
 * una promesa de producto, que es exactamente lo que el proyecto no vende.
 */

/**
 * Alias por sigla. Un agente pregunta por "qaoa", no por
 * "quantum-approximate-optimization", y hoy eso daba 404.
 *
 * Solo entran los que son 1:1 y no admiten discusion. Shor NO esta: su algoritmo
 * cubre factorizacion Y logaritmo discreto, que en el catalogo son dos entradas
 * distintas — devolver una sola seria elegir por el que pregunta y perder la otra.
 * Para esos casos esta /v1/search y el buscador del archivador.
 *
 * La respuesta declara siempre por que alias llego, para que nadie crea que el id
 * canonico es la sigla.
 */
const ALIAS_ALGORITMO = {
  qaoa: "quantum-approximate-optimization",
  grover: "searching",
  hhl: "linear-systems",
  dqi: "optimization-by-decoded-quantum-interferometry",
};

const AVISO_CATALOGO =
  "speedup_declarado es lo que declara la fuente citada, NO una medición de Rosetta. " +
  "Lo que Rosetta midió va en evidencia_rosetta, y para la mayoría del catálogo esta vacío.";

function filaAlgoritmo(row, recetas) {
  let refs = [], impl = [], remisiones = [];
  try { refs = JSON.parse(row.refs_json || "[]"); } catch (e) {}
  try { impl = JSON.parse(row.impl_json || "[]"); } catch (e) {}
  try { remisiones = JSON.parse(row.remisiones_json || "[]"); } catch (e) {}
  const mias = (recetas || []).filter(r => r.algorithm_id === row.id);
  return {
    id: row.id,
    nombre: row.nombre,
    categoria: row.categoria,
    categoria_id: row.categoria_id,
    problema: row.problema_es,
    speedup_declarado: row.speedup_declarado,
    declarado_por: row.fuente_nombre,
    fuente_url: row.fuente_url,
    implementaciones: impl,
    referencias: refs,
    n_referencias: row.n_refs,
    // Remisiones a otras entradas del mismo catalogo, tal como las hace la fuente.
    remisiones: remisiones.map(a => ({ ancla: a, url: row.fuente_url.split("#")[0] + "#" + a })),
    evidencia_rosetta: mias.length
      ? {
          medido: true,
          recetas: mias.map(r => ({ recipe_id: r.recipe_id, nota: r.nota, estado: r.status })),
          donde: SITE + "/v1/runs?recipe=" + mias[0].recipe_id,
        }
      : {
          medido: false,
          lectura: "Rosetta no tiene ninguna corrida sellada sobre este algoritmo. " +
            "Que esté catalogado no significa que lo hayamos medido ni que lo ofrezcamos.",
        },
  };
}

async function metaCatalogo(env) {
  const { results = [] } = await env.DB.prepare("SELECT clave,valor FROM quantum_catalog_meta").all();
  return Object.fromEntries(results.map(r => [r.clave, r.valor]));
}

async function cruceLedger(env) {
  const { results = [] } = await env.DB.prepare(
    "SELECT l.algorithm_id, l.recipe_id, l.nota, r.status FROM quantum_algorithm_ledger l " +
    "LEFT JOIN recipes r ON r.id = l.recipe_id"
  ).all();
  return results;
}

async function algoritmos(env, url) {
  const categoria = url.searchParams.get("categoria");
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  const limite = Math.min(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 200);

  let sql = "SELECT * FROM quantum_algorithms";
  const cond = [], args = [];
  if (categoria) { cond.push("categoria_id=?"); args.push(categoria); }
  if (q) { cond.push("(lower(nombre) LIKE ? OR lower(problema_es) LIKE ?)"); args.push(`%${q}%`, `%${q}%`); }
  if (cond.length) sql += " WHERE " + cond.join(" AND ");
  sql += " ORDER BY orden LIMIT ?";
  args.push(limite);

  const [{ results = [] }, recetas, meta, totalRow] = await Promise.all([
    env.DB.prepare(sql).bind(...args).all(),
    cruceLedger(env),
    metaCatalogo(env),
    env.DB.prepare("SELECT count(*) n FROM quantum_algorithms").first(),
  ]);

  // El denominador viaja siempre: "12 items" sin decir de cuantos no es un resultado.
  return json({
    // `total` = cuantos van en esta respuesta, que es lo que ya significa en
    // /v1/runs y companeros: un solo parser sirve para todas las listas.
    // `total_catalogo` es el denominador, y es el que no se puede perder.
    total: results.length,
    devueltos: results.length,
    total_catalogo: totalRow ? totalRow.n : null,
    filtro: { categoria: categoria || null, q: q || null, limit: limite },
    aviso: AVISO_CATALOGO,
    procedencia: {
      fuente: meta.fuente_nombre,
      fuente_url: meta.fuente_url,
      instantanea_sha256: meta.fuente_sha256,
      generado_at: meta.generado_at,
      como_reconstruir: meta.como_reconstruir,
    },
    items: results.map(r => filaAlgoritmo(r, recetas)),
  });
}

async function algoritmoPorId(env, id) {
  const pedido = id;
  const alias = ALIAS_ALGORITMO[String(id).toLowerCase()];
  if (alias) id = alias;
  const row = await env.DB.prepare("SELECT * FROM quantum_algorithms WHERE id=?").bind(id).first();
  if (!row) {
    // Un 404 que no ayuda obliga a adivinar. Se ofrece la busqueda y los alias que si existen.
    return json({
      error: "no existe", id: pedido,
      prueba: {
        busqueda: SITE + "/v1/search?q=" + encodeURIComponent(pedido),
        catalogo: SITE + "/v1/algorithms?q=" + encodeURIComponent(pedido),
        alias_disponibles: Object.keys(ALIAS_ALGORITMO),
      },
    }, 404);
  }
  const [recetas, meta] = await Promise.all([cruceLedger(env), metaCatalogo(env)]);
  return json({
    aviso: AVISO_CATALOGO,
    ...(alias ? { resuelto_por_alias: { pediste: pedido, id_canonico: id } } : {}),
    procedencia: {
      fuente: meta.fuente_nombre, fuente_url: meta.fuente_url,
      instantanea_sha256: meta.fuente_sha256, generado_at: meta.generado_at,
    },
    ...filaAlgoritmo(row, recetas),
  });
}

async function categorias(env) {
  const { results = [] } = await env.DB.prepare(
    "SELECT categoria_id, categoria, count(*) n FROM quantum_algorithms GROUP BY categoria_id, categoria ORDER BY min(orden)"
  ).all();
  return results.map(r => ({ id: r.categoria_id, nombre: r.categoria, algoritmos: r.n }));
}

async function fuentes(env, url) {
  const tipo = url.searchParams.get("tipo");
  let sql = "SELECT * FROM quantum_sources";
  const args = [];
  if (tipo) { sql += " WHERE tipo=?"; args.push(tipo); }
  sql += " ORDER BY tipo, orden";
  const [{ results = [] }, totalRow, tipos] = await Promise.all([
    env.DB.prepare(sql).bind(...args).all(),
    env.DB.prepare("SELECT count(*) n FROM quantum_sources").first(),
    env.DB.prepare("SELECT tipo, count(*) n FROM quantum_sources GROUP BY tipo ORDER BY tipo").all(),
  ]);
  return json({
    total: results.length,
    devueltos: results.length,
    total_catalogo: totalRow ? totalRow.n : null,
    filtro: { tipo: tipo || null },
    tipos: Object.fromEntries((tipos.results || []).map(r => [r.tipo, r.n])),
    nota_enlaces:
      "http_status es el código REAL que devolvió la URL cuando se generó el catálogo, " +
      "no una suposición. Un 403 con nota_enlace es un sitio que bloquea clientes " +
      "automatizados y que se abrió a mano en un navegador.",
    items: results.map(r => ({
      id: r.id, tipo: r.tipo, nombre: r.nombre, url: r.url,
      que_es: r.que_es, por_que_importa: r.por_que_importa, pais: r.pais,
      enlace: { http_status: r.http_status, verificado_at: r.verificado_at, nota: r.nota_enlace },
    })),
  });
}

// ------------------------------------------------------------ corridas de challenge

/**
 * Los datos de una viz de challenge, servidos por API.
 *
 * La pagina los pide de aca en vez de traerlos horneados: el HTML queda en ~12 KB,
 * los 100 KB de datos se cachean aparte, y un agente puede leerlos sin parsear una
 * pagina. Es la regla del doc de producto: si existe en la consola y no en la API,
 * el build esta mal.
 *
 * TODA respuesta declara `validado: false`. Son predicciones de una caminata
 * cuantica, no hallazgos confirmados en laboratorio, y esa distincion no puede
 * depender de que alguien la escriba en la pagina.
 */
const AVISO_CHALLENGE =
  "Los sitios son PREDICHOS por caminata cuántica y no están validados " +
  "experimentalmente. El sitio conocido, cuando existe, se lee del fármaco " +
  "co-cristalizado y nunca entra al calculo.";

async function challenges(env, url) {
  const { results = [] } = await env.DB.prepare(
    "SELECT r.*, (SELECT count(*) FROM challenge_proteins p WHERE p.run_id=r.id) n_proteinas " +
    "FROM challenge_runs r WHERE r.publicado=1 ORDER BY r.fecha DESC"
  ).all();
  return json({
    total: results.length,
    aviso: AVISO_CHALLENGE,
    items: results.map(r => ({
      id: r.id, challenge: r.challenge, fecha: r.fecha,
      titulo: { es: r.titulo_es, en: r.titulo_en },
      recipe_id: r.recipe_id, pre_registro: r.prereg,
      proteinas: r.n_proteinas,
      validado_experimentalmente: !!r.validado,
      datos: SITE + "/v1/challenges/" + r.id,
    })),
  });
}

async function challengePorId(env, id, clave) {
  const run = await env.DB.prepare(
    "SELECT * FROM challenge_runs WHERE id=? AND publicado=1").bind(id).first();
  if (!run) return json({ error: "no existe", id }, 404);

  let sql = "SELECT * FROM challenge_proteins WHERE run_id=?";
  const args = [id];
  if (clave) { sql += " AND clave=?"; args.push(clave); }
  sql += " ORDER BY orden";
  const { results = [] } = await env.DB.prepare(sql).bind(...args).all();
  if (clave && !results.length) return json({ error: "esa proteína no está en la corrida", id, clave }, 404);

  const proteinas = {};
  for (const p of results) {
    let datos = null, stats = null;
    try { datos = JSON.parse(p.datos_json); } catch (e) {}
    try { stats = JSON.parse(p.stats_json); } catch (e) {}
    proteinas[p.clave] = {
      // Las dos caras del rotulo. La cara EN mostraba "Miosina cardiaca" porque
      // habia una sola: un rotulo en el idioma equivocado no rompe nada y por eso
      // nadie lo ve.
      label: p.label, label_en: p.label_en, pdb: p.pdb, n_residuos: p.n_residuos,
      // El denominador va pegado al dato: "Top-5" era el encabezado y KRAS G12C
      // trae 2. Publicar el numero real quita la posibilidad de redondearlo.
      sitios_predichos: p.n_sitios,
      sitios_conocidos: p.sitios_conocidos,
      hay_con_que_comparar: p.sitios_conocidos > 0,
      sha256: p.sha256,
      datos, estadistica: stats,
    };
  }
  return json({
    id: run.id, challenge: run.challenge, fecha: run.fecha,
    titulo: { es: run.titulo_es, en: run.titulo_en },
    recipe_id: run.recipe_id, pre_registro: run.prereg,
    validado_experimentalmente: !!run.validado,
    aviso: AVISO_CHALLENGE,
    como_verificar:
      "Cada proteína trae su sha256, calculado sobre datos + estadística tal como " +
      "salieron del entregable sellado. Recomputálo y comparalo.",
    total_proteinas: results.length,
    proteinas,
  });
}

// ---------------------------------------------------------------- MCP (JSON-RPC 2.0)

// Exportado a proposito: /api-docs decia "nine tools" en un parrafo y "four tools"
// —con cuatro nombres— tres parrafos mas abajo, mientras el servidor servia 9. Una
// lista escrita a mano en la documentacion envejece sin avisar. La pagina la lee de
// aca y un chequeo la compara contra tools/list en vivo.
export const HERRAMIENTAS = [
  {
    name: "estado_del_archivo",
    description:
      "Estado medido del Evidence Ledger de Rosetta Quantum: cuántas corridas selladas " +
      "hay, cuántos veredictos, y cuántas victorias cuánticas se han medido (hoy: cero). " +
      "Usar para responder '¿qué tan real es la ventaja cuántica hoy?' con datos citables.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "buscar_evidencia",
    description:
      "Busca en las corridas selladas por texto libre: nombre de proteína, clase de " +
      "problema, algoritmo, solver. Devuelve cada coincidencia con su sha256 y las URLs " +
      "de las copias públicas para poder citarla y comprobarla.",
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
    description: "Lista archivos sellados de un tipo: RUN, VERDICT, PREREG, PREDICTION, MANIFEST o RECIPE.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["RUN", "VERDICT", "PREREG", "PREDICTION", "MANIFEST", "RECIPE"] },
        recipe: { type: "string", description: "opcional: filtrar por receta, p.ej. RQ-0012" },
      },
      required: ["tipo"],
    },
  },
  {
    name: "buscar_algoritmo_cuántico",
    description:
      "Busca en el archivador de algoritmos cuánticos (catálogo canónico del Quantum " +
      "Algorithm Zoo, 60 entradas en 4 categorías) por nombre o por el problema que " +
      "atacan. Cada resultado trae el speedup DECLARADO por la fuente con su cita, los " +
      "papers primarios, las implementaciones públicas — y si Rosetta lo midió o no. " +
      "Usar para responder '¿existe un algoritmo cuántico para X y hay evidencia?'.",
    inputSchema: {
      type: "object",
      properties: {
        consulta: { type: "string", description: "p.ej. 'factorizacion', 'optimizacion', 'ecuaciones diferenciales'" },
        categoria: { type: "string", description: "opcional: algebraic, oracular, BQP u ONML" },
      },
    },
  },
  {
    name: "uso_de_la_api",
    description:
      "Cuántas veces se llamó a esta API, por superficie y por ruta, con la ventana " +
      "de fechas que cubre. Es público a propósito: si dice cero, dice cero. Declara " +
      "también lo que NO se guarda — ninguna IP, ningún identificador — y los límites " +
      "de la medición.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "ver_estructura",
    description:
      "Devuelve la red de contactos de una estructura publicada por el motor (4OBE, " +
      "1OPL, 5TBY, 1NKP): cuántos residuos, aristas, residuos distales y de fuente, " +
      "más el sha256 y la URL del PDB original en RCSB para recomputarla. La red se " +
      "deriva SOLO de topología: ninguna estructura con fármaco se abrió para construirla.",
    inputSchema: {
      type: "object",
      properties: { pdb: { type: "string", description: "código PDB, p.ej. 4OBE" } },
      required: ["pdb"],
    },
  },
  {
    name: "ver_propagación",
    description:
      "Devuelve los sitios PREDICHOS por caminata cuántica para un blanco de una " +
      "corrida, con el métrico usado, su pre-registro, y la matriz de conectividad " +
      "por referencia con firma para poder comprobarla. Declara siempre que NO están " +
      "validados experimentalmente, y el número de sitios es el real: si son menos de " +
      "cinco, se declaran menos.",
    inputSchema: {
      type: "object",
      properties: {
        run_id: { type: "string", description: "p.ej. cleveland-2026-08-ciego" },
        target: { type: "string", description: "opcional: KRAS_4OBE, ABL1_1OPL, MYOSIN_5TBY, MYC_1NKP" },
      },
      required: ["run_id"],
    },
  },
  {
    name: "listar_fuentes_cuánticas",
    description:
      "Lista las fuentes del campo cuántico catalogadas: fabricantes de QPU, librerías, " +
      "revistas y conferencias, blogs, catálogos y organismos de norma. Cada una con que " +
      "es, por qué importa y el código HTTP real que devolvió su URL al catalogarla.",
    inputSchema: {
      type: "object",
      properties: {
        tipo: { type: "string", enum: ["qpu", "libreria", "venue", "blog", "catalogo", "estandar"] },
      },
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
  if (nombre === "buscar_algoritmo_cuántico") {
    const u = new URL(SITE + "/x");
    if (args.consulta) u.searchParams.set("q", args.consulta);
    if (args.categoria) u.searchParams.set("categoria", args.categoria);
    const r = await algoritmos(env, u);
    return await r.json();
  }
  if (nombre === "uso_de_la_api") { const r = await usoPublico(env); return await r.json(); }
  if (nombre === "ver_estructura") {
    const r = await estructuras(env, args.pdb);
    return await r.json();
  }
  if (nombre === "ver_propagación") {
    const r = await propagaciones(env, args.run_id, args.target || null);
    return await r.json();
  }
  if (nombre === "listar_fuentes_cuánticas") {
    const u = new URL(SITE + "/x");
    if (args.tipo) u.searchParams.set("tipo", args.tipo);
    const r = await fuentes(env, u);
    return await r.json();
  }
  throw new Error(`herramienta desconocida: ${nombre}`);
}

async function mcp(request, env, info = {}) {
  if (request.method === "GET") {
    // Un GET al endpoint sirve de descubrimiento humano: que es y que ofrece.
    return json({
      servidor: "rosetta-evidence",
      transporte: "JSON-RPC 2.0 sobre HTTP POST",
      herramientas: HERRAMIENTAS.map(h => ({ nombre: h.name, descripcion: h.description })),
      nota: "Solo lectura. Toda respuesta incluye sha256 y URLs de las copias públicas.",
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
    if (req.method === "tools/list") { info.tool = "tools/list"; return responder({ tools: HERRAMIENTAS }, req.id); }
    if (req.method === "tools/call") {
      const { name, arguments: args = {} } = req.params || {};
      info.tool = name;   // para el contador de uso; no se guarda nada mas del que llama
      const salida = await ejecutarHerramienta(env, name, args);
      return responder({ content: [{ type: "text", text: JSON.stringify(salida, null, 2) }] }, req.id);
    }
    return fallar(-32601, `método no soportado: ${req.method}`, req.id);
  } catch (e) {
    return fallar(-32000, String(e && e.message || e), req.id);
  }
}

// ----------------------------------------------------------- lado de lectura del motor

/**
 * El motor (Python, en `quantum-run`) calcula y publica contratos; esto los sirve.
 * Aca no se calcula nada.
 *
 * LA MATRIZ NO VIAJA EN LA RESPUESTA. La de miosina son 954x954 float32 = 3.120 KB.
 * Se sirve por referencia con `contenido_sha256` y `bytes`, y ese hash es del
 * CONTENIDO —bytes de cada arreglo en orden de clave—, no del archivo .npz: un .npz
 * es un zip y su compresion cambia con la version de numpy. Yo baje la matriz de
 * KRAS por la URL declarada y recompute la firma: calza. La promesa esta ejercida,
 * no solo escrita.
 */
const AVISO_MOTOR =
  "Sitios PREDICHOS por caminata cuántica, sin validación experimental. " +
  "n_sitios_predichos es el número REAL: si son menos de cinco, se declaran menos.";

function filaEstructura(row, completo) {
  const j = (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } };
  const base = {
    pdb_id: row.pdb_id, target: row.target, chain: row.chain,
    n_residuos: row.n_residuos, n_aristas: row.n_aristas,
    n_distales: row.n_distales, n_fuente: row.n_fuente,
    red: j(row.red_json, {}),
    procedencia: j(row.procedencia_json, {}),
    aviso: row.aviso,
    contrato_sha256: row.contrato_sha256,
  };
  if (!completo) return base;
  return { ...base, fuente: j(row.fuente_json, {}), distal: j(row.distal_json, {}) };
}

async function estructuras(env, pdb) {
  if (!pdb) {
    const { results = [] } = await env.DB.prepare(
      "SELECT * FROM structures ORDER BY orden").all();
    return json({
      total: results.length,
      nota: "Redes de contactos derivadas SOLO de topología. Ninguna estructura con " +
            "fármaco se abrió para construirlas.",
      items: results.map(r => filaEstructura(r, false)),
    });
  }
  const row = await env.DB.prepare("SELECT * FROM structures WHERE pdb_id=?")
    .bind(String(pdb).toUpperCase()).first();
  if (!row) {
    const { results = [] } = await env.DB.prepare("SELECT pdb_id FROM structures ORDER BY orden").all();
    return json({ error: "no existe", pdb, disponibles: results.map(r => r.pdb_id) }, 404);
  }
  return json(filaEstructura(row, true));
}

async function propagaciones(env, runId, target) {
  const j = (t, d) => { try { return JSON.parse(t); } catch (e) { return d; } };
  if (!target) {
    const { results = [] } = await env.DB.prepare(
      "SELECT run_id,target,pdb_id,n_sitios_predichos,matriz_json FROM propagations WHERE run_id=? ORDER BY orden"
    ).bind(runId).all();
    if (!results.length) {
      const { results: hay = [] } = await env.DB.prepare(
        "SELECT DISTINCT run_id FROM propagations").all();
      return json({ error: "no existe esa corrida", run_id: runId, disponibles: hay.map(r => r.run_id) }, 404);
    }
    return json({
      run_id: runId, total: results.length,
      validado_experimentalmente: false,
      aviso: AVISO_MOTOR,
      items: results.map(r => ({
        target: r.target, pdb_id: r.pdb_id,
        n_sitios_predichos: r.n_sitios_predichos,
        matriz: j(r.matriz_json, {}),
        datos: SITE + "/v1/propagate/" + runId + "/" + r.target,
      })),
    });
  }
  const row = await env.DB.prepare("SELECT * FROM propagations WHERE run_id=? AND target=?")
    .bind(runId, target).first();
  if (!row) {
    const { results = [] } = await env.DB.prepare(
      "SELECT target FROM propagations WHERE run_id=? ORDER BY orden").bind(runId).all();
    return json({ error: "no existe", run_id: runId, target, disponibles: results.map(r => r.target) }, 404);
  }
  return json({
    run_id: row.run_id, target: row.target, pdb_id: row.pdb_id, chain: row.chain,
    // Va primero y sin adornos, igual que el titular del ledger.
    validado_experimentalmente: !!row.validado,
    metrico: j(row.metrico_json, {}),
    matriz_conectividad: j(row.matriz_json, {}),
    n_sitios_predichos: row.n_sitios_predichos,
    sitios_predichos: j(row.sitios_json, []),
    aviso: row.aviso || AVISO_MOTOR,
    estructura: SITE + "/v1/structures/" + row.pdb_id,
    contrato_sha256: row.contrato_sha256,
  });
}

// ------------------------------------------------------- catalogo de rutas y OpenAPI

/**
 * EL catalogo de la API. Una sola definicion.
 *
 * POR QUE EXISTE
 * --------------
 * Habia 17 rutas vivas y ninguna especificacion legible por maquina: un agente
 * tenia que adivinar la forma de cada respuesta. Y el indice de `/v1` era una
 * lista escrita a mano al lado del enrutador — o sea, dos listas, que es como se
 * pierde una ruta sin que nadie lo note.
 *
 * De aqui salen: el indice de `/v1`, el documento OpenAPI y el chequeo. El
 * chequeo ademas lee el CODIGO del enrutador y compara: si aparece una ruta
 * `/v1/...` que no esta en este catalogo, grita. No alcanza con prometer que se
 * mantendran sincronizados.
 *
 * `esquema` es honesto a proposito: no todas las respuestas lo tienen todavia, y
 * el documento declara cuantas de cuantas — un total sin denominador no es un
 * resultado.
 */
export const CATALOGO = [
  { ruta: "/v1", resumen: "Indice de la API", grupo: "meta" },
  { ruta: "/v1/openapi.json", resumen: "Esta especificacion, en OpenAPI 3.1", grupo: "meta" },
  { ruta: "/v1/usage", resumen: "Cuántas veces se llamó a esta API · público, y declara lo que NO se guarda",
    grupo: "meta", esquema: { $ref: "#/components/schemas/Uso" } },
  { ruta: "/v1/state", resumen: "Estado medido del Evidence Ledger", grupo: "ledger",
    esquema: {
      type: "object",
      properties: {
        proyecto: { type: "string" }, tesis: { type: "string" },
        estado_medido: { type: "object", properties: {
          corridas_selladas: { type: "integer" },
          veredictos_publicados: { type: "integer" },
          victorias_cuanticas_medidas: { type: "integer",
            description: "Cuántas veces un método cuántico le ganó al campeón clásico en una corrida sellada. Hoy: 0. Es el titular del archivo, no una falla." },
          lectura: { type: "string" },
        } },
        recetas: { type: "array", items: { type: "object" } },
        integridad: { type: "object" },
      },
    } },
  { ruta: "/v1/runs", resumen: "Corridas selladas", grupo: "ledger",
    params: [["recipe", "filtra por receta, p.ej. RQ-0012"], ["limit", "maximo 200, por defecto 50"]] },
  { ruta: "/v1/verdicts", resumen: "Veredictos publicados", grupo: "ledger", params: [["limit", "maximo 200"]] },
  { ruta: "/v1/prereg", resumen: "Pre-registros: compromisos sellados antes de correr", grupo: "ledger" },
  { ruta: "/v1/predictions", resumen: "Predicciones forward, comprometidas antes de conocer el resultado", grupo: "ledger" },
  { ruta: "/v1/manifests", resumen: "Manifiestos: cómo leer el archivo", grupo: "ledger" },
  { ruta: "/v1/recipes", resumen: "Recetas del catálogo", grupo: "ledger" },
  { ruta: "/v1/archive/{id}", resumen: "Un archivo sellado completo, con su payload", grupo: "ledger",
    // El ejemplo apunta a un archivo que EXISTE. El primero que puse (EXP-0012-001)
    // no existia, y el chequeo lo atrapo: documentar un ejemplo que responde 404 es
    // la misma falla que la API que apuntaba a /api-docs cuando /api-docs no estaba.
    ejemplo: { id: "PR-CLEV-001" } },
  { ruta: "/v1/archive/{id}/raw", grupo: "ledger",
    resumen: "El archivo sellado TAL CUAL se selló, sin re-serializar: es el que sirve para recomputar el hash",
    ejemplo: { id: "PR-CLEV-001" } },
  { ruta: "/v1/search", resumen: "Búsqueda en texto de las corridas", grupo: "ledger",
    params: [["q", "obligatorio"]], ejemploQuery: "q=portfolio" },
  { ruta: "/v1/algorithms", resumen: "Archivador de algoritmos cuánticos", grupo: "archivador",
    params: [["categoria", "algebraic | oracular | BQP | ONML"], ["q", "busca en nombre y problema"], ["limit", "maximo 200"]],
    esquema: {
      type: "object",
      properties: {
        total: { type: "integer", description: "cuantos van en esta respuesta" },
        total_catalogo: { type: "integer", description: "el denominador: cuantos hay en total" },
        aviso: { type: "string", description: "el speedup lo declara la fuente, no lo mide Rosetta" },
        procedencia: { type: "object", properties: {
          fuente: { type: "string" }, fuente_url: { type: "string" },
          instantanea_sha256: { type: "string", description: "sha256 de la instantánea de la fuente de la que salió el catalogo" },
        } },
        items: { type: "array", items: { $ref: "#/components/schemas/Algoritmo" } },
      },
    } },
  { ruta: "/v1/algorithms/{id}", resumen: "Ficha de un algoritmo · acepta alias por sigla", grupo: "archivador",
    ejemplo: { id: "qaoa" }, esquema: { $ref: "#/components/schemas/Algoritmo" } },
  { ruta: "/v1/categories", resumen: "Categorías del archivador, con cuantos algoritmos tiene cada una", grupo: "archivador" },
  { ruta: "/v1/sources", resumen: "Fuentes del campo: QPUs, librerías, venues, blogs, normas", grupo: "archivador",
    params: [["tipo", "qpu | libreria | venue | blog | catalogo | estandar"]] },
  { ruta: "/v1/challenges", resumen: "Corridas de challenge publicadas", grupo: "challenges" },
  { ruta: "/v1/challenges/{id}", resumen: "Datos de una corrida completa", grupo: "challenges",
    ejemplo: { id: "cleveland-2026-07" }, esquema: { $ref: "#/components/schemas/Corrida" } },
  // Esta ruta la atendia el enrutador y NO estaba declarada: la encontro el chequeo
  // comparando el codigo contra el catalogo, que es justo para lo que existe.
  { ruta: "/v1/challenges/{id}/{proteina}", resumen: "Una sola proteína de una corrida", grupo: "challenges",
    ejemplo: { id: "cleveland-2026-07", proteina: "KRAS_G12C" },
    esquema: { $ref: "#/components/schemas/Corrida" } },
  { ruta: "/v1/structures", resumen: "Redes de contactos publicadas por el motor", grupo: "motor" },
  { ruta: "/v1/structures/{pdb}", resumen: "La red de contactos de una estructura, con el sha256 y la URL del PDB de origen",
    grupo: "motor", ejemplo: { pdb: "4OBE" }, esquema: { $ref: "#/components/schemas/Estructura" } },
  { ruta: "/v1/propagate/{run_id}", resumen: "Los blancos de una corrida de propagación", grupo: "motor",
    ejemplo: { run_id: "cleveland-2026-08-ciego" } },
  { ruta: "/v1/propagate/{run_id}/{target}", resumen: "Top-N predicho de un blanco, con la matriz por referencia firmada",
    grupo: "motor", ejemplo: { run_id: "cleveland-2026-08-ciego", target: "KRAS_4OBE" },
    esquema: { $ref: "#/components/schemas/Propagación" } },
];

const ESQUEMAS = {
  Algoritmo: {
    type: "object",
    properties: {
      id: { type: "string" }, nombre: { type: "string" },
      categoria: { type: "string" }, categoria_id: { type: "string" },
      problema: { type: "string", nullable: true },
      speedup_declarado: { type: "string",
        description: "Literal de la fuente citada. NO es una medición de Rosetta." },
      declarado_por: { type: "string" }, fuente_url: { type: "string" },
      referencias: { type: "array", items: { type: "object", properties: {
        n: { type: "integer" }, cita: { type: "string" }, url: { type: "string", nullable: true } } } },
      evidencia_rosetta: { type: "object", description:
        "Lo único que afirma Rosetta. `medido:false` en la mayoría del catálogo, y ese es el dato.",
        properties: { medido: { type: "boolean" }, recetas: { type: "array", items: { type: "object" } },
                      lectura: { type: "string" } } },
    },
  },
  Uso: {
    type: "object",
    properties: {
      midiendo_desde: { type: "string", nullable: true },
      ventana: { type: "object", description: "El denominador del total: sin la ventana, un total no dice nada." },
      total: { type: "integer" },
      por_superficie: { type: "object", additionalProperties: { type: "integer" } },
      por_ruta: { type: "array", items: { type: "object" } },
      lo_que_no_guardamos: { type: "string", description:
        "Ninguna IP, ningún user-agent, ningún identificador. La ruta se guarda en su FORMA." },
      limites_de_esta_medicion: { type: "array", items: { type: "string" } },
    },
  },
  Estructura: {
    type: "object",
    properties: {
      pdb_id: { type: "string" }, target: { type: "string" }, chain: { type: "string" },
      n_residuos: { type: "integer" }, n_aristas: { type: "integer" },
      n_distales: { type: "integer" }, n_fuente: { type: "integer" },
      red: { type: "object", description: "tipo de contacto, corte en angstrom, peso" },
      procedencia: { type: "object", properties: {
        estructura_sha256: { type: "string" },
        estructura_url: { type: "string", description: "el PDB original en RCSB, para recomputar" },
        ciego: { type: "boolean" },
      } },
      aviso: { type: "string", description:
        "Derivada solo de topología. Ninguna estructura con fármaco se abrió para construirla." },
    },
  },
  Propagacion: {
    type: "object",
    properties: {
      run_id: { type: "string" }, target: { type: "string" }, pdb_id: { type: "string" },
      validado_experimentalmente: { type: "boolean", description:
        "Siempre false. Son predicciones de una caminata cuántica, no hallazgos de laboratorio." },
      metrico: { type: "object", properties: {
        nombre: { type: "string" }, definicion: { type: "string" },
        parametros_libres: { type: "integer" },
        pre_registrado_en: { type: "string", description: "commit anterior al de las predicciones" },
      } },
      matriz_conectividad: { type: "object", description:
        "La matriz NO viaja en la respuesta: hasta 954x954 float32. Se sirve por referencia.",
        properties: {
          forma: { type: "array", items: { type: "integer" } },
          dtype: { type: "string" }, url: { type: "string" }, bytes: { type: "integer" },
          contenido_sha256: { type: "string", description:
            "sha256 del CONTENIDO —bytes de cada arreglo en orden de clave—, NO del archivo .npz: " +
            "un .npz es un zip y su compresión cambia con la versión de numpy." },
          como_verificar: { type: "string" },
        } },
      n_sitios_predichos: { type: "integer", description:
        "El número REAL. Si son menos de cinco, se declaran menos en vez de rellenar." },
      sitios_predichos: { type: "array", items: { type: "object" } },
    },
  },
  Corrida: {
    type: "object",
    properties: {
      id: { type: "string" }, challenge: { type: "string" }, fecha: { type: "string" },
      recipe_id: { type: "string", nullable: true },
      pre_registro: { type: "string", nullable: true },
      validado_experimentalmente: { type: "boolean",
        description: "Siempre false por ahora: son predicciones, no hallazgos confirmados en laboratorio." },
      total_proteinas: { type: "integer" },
      proteinas: { type: "object", additionalProperties: { type: "object", properties: {
        label: { type: "string" }, label_en: { type: "string" },
        n_residuos: { type: "integer" },
        sitios_predichos: { type: "integer", description: "El número REAL, no un top-N fijo." },
        sitios_conocidos: { type: "integer" },
        hay_con_que_comparar: { type: "boolean", description: "false = no hay verdad de referencia publicada." },
        sha256: { type: "string" },
      } } },
    },
  },
};

function openapiDoc() {
  const paths = {};
  for (const e of CATALOGO) {
    const parametros = [];
    for (const m of e.ruta.matchAll(/\{(\w+)\}/g)) {
      parametros.push({ name: m[1], in: "path", required: true, schema: { type: "string" },
        example: e.ejemplo ? e.ejemplo[m[1]] : undefined });
    }
    for (const [nombre, desc] of e.params || []) {
      parametros.push({ name: nombre, in: "query", required: false, description: desc, schema: { type: "string" } });
    }
    paths[e.ruta] = {
      get: {
        summary: e.resumen,
        tags: [e.grupo],
        parameters: parametros.length ? parametros : undefined,
        responses: {
          200: { description: "ok", content: { "application/json": {
            schema: e.esquema || { type: "object", description:
              "Esquema todavía no declarado. La respuesta viva es el contrato: " + SITE + e.ruta } } } },
          404: { description: "no existe. No se cachea, y trae por donde seguir." },
        },
      },
    };
  }
  const conEsquema = CATALOGO.filter(e => e.esquema).length;
  return {
    openapi: "3.1.0",
    info: {
      title: "Rosetta Quantum — Evidence Ledger y archivador",
      version: "1.0.0",
      description:
        "Solo lectura, sin claves. Dos cosas distintas conviven aca y no hay que mezclarlas: " +
        "el LEDGER publica lo que Rosetta midió (incluidos los negativos), y el ARCHIVADOR cataloga " +
        "el campo citando fuentes externas. Un speedup declarado en el catalogo no es un resultado " +
        "nuestro.\n\n" +
        `Cobertura de esquemas: ${conEsquema} de ${CATALOGO.length} endpoints tienen esquema de ` +
        "respuesta declarado; el resto documenta su forma con la respuesta viva. Se declara el " +
        "denominador en vez de fingir cobertura completa.",
      license: { name: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
    },
    servers: [{ url: SITE }],
    tags: [
      { name: "meta", description: "La API describiendose a si misma" },
      { name: "ledger", description: "Lo que Rosetta midió y sello" },
      { name: "archivador", description: "El campo catalogado, con la cita pegada a cada dato" },
      { name: "challenges", description: "Corridas de challenge, con sus predicciones y sellos" },
      { name: "motor", description: "Lo que publica el motor: redes de contactos y propagaciones" },
    ],
    paths,
    components: { schemas: ESQUEMAS },
    "x-mcp": { endpoint: SITE + "/mcp", transporte: "JSON-RPC 2.0 sobre HTTP POST" },
  };
}

// ------------------------------------------------------------------ uso, medido y publico

/**
 * Cabecera con la que nuestros propios chequeos se marcan para NO contarse.
 *
 * Las 135 pruebas en vivo golpean produccion en cada deploy. Contarlas envenenaria
 * el primer numero que publiquemos con nuestro propio eco: diriamos "135 llamadas
 * esta semana" y serian todas nuestras. Que sea una cabecera publica y conocida es
 * un limite real de la medicion —cualquiera puede mandarla y no ser contado— y se
 * declara en la respuesta en vez de esconderse.
 */
const CABECERA_CHEQUEO = "x-rq-check";

/**
 * La FORMA de una ruta, no la ruta con su parametro. `/v1/algorithms/qaoa` cuenta
 * como `/v1/algorithms/{id}`.
 *
 * Sale del mismo CATALOGO que la especificacion, asi que un endpoint nuevo se mide
 * solo. Y tiene un efecto de privacidad que importa mas que la prolijidad: guardar
 * la forma hace que desde esta tabla no se pueda reconstruir QUE consulto alguien.
 */
export function formaDeRuta(p) {
  const limpia = p.replace(/\/$/, "") || "/v1";
  for (const e of CATALOGO) {
    if (!e.ruta.includes("{")) { if (e.ruta === limpia) return e.ruta; continue; }
    const re = new RegExp("^" + e.ruta.replace(/\{[^}]+\}/g, "[^/]+") + "$");
    if (re.test(limpia)) return e.ruta;
  }
  return "(otra)";
}

/**
 * Suma uno. NUNCA en la ruta critica: se llama desde `ctx.waitUntil()` y se traga
 * cualquier error. Una metrica que puede tumbar una lectura es peor que no tener
 * metrica — y eso tiene su caso positivo en los tests, forzando el fallo de la
 * escritura y comprobando que la respuesta sigue saliendo.
 */
export async function contarUso(db, { superficie, ruta, tool = "" }) {
  try {
    const fecha = new Date().toISOString().slice(0, 10);
    await db.prepare(
      "INSERT INTO api_usage (fecha,superficie,ruta,tool,n) VALUES (?,?,?,?,1) " +
      "ON CONFLICT(fecha,superficie,ruta,tool) DO UPDATE SET n = n + 1"
    ).bind(fecha, superficie, ruta, tool).run();
    return true;
  } catch (e) {
    return false;   // falla abierta, siempre
  }
}

async function usoPublico(env) {
  const [tot, porRuta, rango, meta] = await env.DB.batch([
    env.DB.prepare("SELECT superficie, sum(n) n FROM api_usage GROUP BY superficie"),
    env.DB.prepare("SELECT superficie, ruta, tool, sum(n) n FROM api_usage GROUP BY superficie, ruta, tool ORDER BY n DESC"),
    env.DB.prepare("SELECT min(fecha) desde, max(fecha) hasta, count(DISTINCT fecha) dias FROM api_usage"),
    env.DB.prepare("SELECT clave, valor FROM usage_meta"),
  ]);
  const m = Object.fromEntries((meta.results || []).map(r => [r.clave, r.valor]));
  const porSuperficie = Object.fromEntries((tot.results || []).map(r => [r.superficie, r.n]));
  const total = Object.values(porSuperficie).reduce((a, b) => a + b, 0);
  const r0 = (rango.results || [{}])[0];

  // Un contador vivo cacheado 5 minutos miente durante 5 minutos. Se sirve fresco.
  return json({
    que_es: "Cuántas veces se llamó a esta API. Publicado por la misma razón que el " +
            "contador de victorias cuánticas: un número propio que solo se muestra " +
            "cuando favorece no es una medición.",
    // El denominador va pegado al total: "12 llamadas" sin su ventana no dice nada.
    midiendo_desde: m.desde || null,
    ventana: { primer_dia: r0.desde || null, ultimo_dia: r0.hasta || null, dias_con_uso: r0.dias || 0 },
    total,
    por_superficie: porSuperficie,
    por_ruta: (porRuta.results || []).map(r => ({
      superficie: r.superficie, ruta: r.ruta, tool: r.tool || undefined, llamadas: r.n,
    })),
    lo_que_no_guardamos:
      "Ninguna IP, ningún user-agent, ninguna cabecera de quien llama, ningún " +
      "identificador. Solo (fecha, superficie, forma de la ruta) y un contador. La " +
      "ruta se guarda en su FORMA — /v1/algorithms/{id}, nunca /v1/algorithms/qaoa — " +
      "asi que desde estos datos no se puede reconstruir que consulto nadie.",
    limites_de_esta_medicion: [
      "Las páginas del sitio NO se miden: no pasan por el Worker, y contar solo " +
      "algunas seria declarar mas alcance del que hay.",
      "Nuestros propios chequeos automáticos se marcan con una cabecera y no se " +
      "cuentan; como la cabecera es publica, cualquiera puede mandarla y no ser contado.",
      "Es un agregado por dia: no hay registro de peticiones individuales.",
    ],
  }, 200, { "Cache-Control": "no-store" });
}

// ---------------------------------------------------------------- enrutador

/**
 * Envuelve el enrutado y suma uno al contador de uso.
 *
 * El conteo va en `ctx.waitUntil()` — FUERA de la ruta critica. Si la escritura
 * falla, la respuesta sale igual: una metrica que puede tumbar una lectura es peor
 * que no tener metrica. Hay un test que fuerza el fallo y comprueba justo eso.
 */
export async function manejarApi(request, env, url, ctx) {
  const info = {};
  const res = await enrutar(request, env, url, info);
  if (!res) return res;                       // no era ruta de API: no se cuenta

  // Nuestros propios chequeos no se cuentan: serian el eco de nuestro trafico.
  const esChequeo = request.headers.get(CABECERA_CHEQUEO) === "1";
  const p = url.pathname;
  const esMcp = p === "/mcp" || p === "/mcp/";
  const esApi = p === "/v1" || p.startsWith("/v1/");
  if (!esChequeo && (esMcp || esApi) && ctx && ctx.waitUntil && env.DB) {
    ctx.waitUntil(contarUso(env.DB, {
      superficie: esMcp ? "mcp" : "api",
      ruta: esMcp ? "/mcp" : formaDeRuta(p),
      tool: esMcp ? (info.tool || "") : "",
    }));
  }
  return res;
}

async function enrutar(request, env, url, info = {}) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });

  const p = url.pathname;
  if (p === "/mcp" || p === "/mcp/") return await mcp(request, env, info);
  // HEAD se atiende como GET y se devuelve sin cuerpo. Sin esto, `curl -I`, los
  // chequeos de salud y varios clientes HTTP reciben un 404 sobre una ruta que si
  // existe — el tipo de discrepancia que hace dudar de una API antes de usarla.
  const esHead = request.method === "HEAD";
  if (request.method !== "GET" && !esHead) return null;
  if (esHead) {
    const r = await enrutar(new Request(request.url, { method: "GET" }), env, url, info);
    return r ? new Response(null, { status: r.status, headers: r.headers }) : null;
  }

  if (p === "/v1" || p === "/v1/") {
    // El indice sale del MISMO catalogo del que sale la especificacion. Antes era
    // una lista escrita a mano al lado del enrutador: dos listas, que es como se
    // pierde una ruta sin que nadie lo note.
    return json({
      api: "Rosetta Quantum — Evidence Ledger y archivador, solo lectura",
      especificacion: SITE + "/v1/openapi.json",
      mcp: SITE + "/mcp",
      endpoints: Object.fromEntries(CATALOGO.map(e => [
        "GET " + e.ruta,
        e.resumen + ((e.params || []).length ? " · " + e.params.map(([n]) => "?" + n + "=").join(" ") : ""),
      ])),
      nota_catalogo:
        "El archivador (/v1/algorithms, /v1/sources) CATALOGA el campo citando fuentes " +
        "externas; el ledger (/v1/runs, /v1/verdicts) publica lo que medimos nosotros. " +
        "Un speedup declarado en el catalogo no es un resultado de Rosetta.",
      licencia: "CC BY 4.0 — cita: Rosetta Quantum Evidence Ledger, " + SITE + "/ledger",
    });
  }
  if (p === "/v1/openapi.json") return json(openapiDoc());
  if (p === "/v1/usage" || p === "/v1/usage/") return await usoPublico(env);
  if (p === "/v1/state") return json(await estado(env));
  if (p === "/v1/runs") return await listar(env, "RUN", url);
  if (p === "/v1/verdicts") return await listar(env, "VERDICT", url);
  if (p === "/v1/prereg") return await listar(env, "PREREG", url);
  // Un tipo nuevo que solo responde por /v1/archive/{id} queda publicado e invisible:
  // nadie lo encuentra sin saber ya su ID, que es lo contrario de un archivo consultable.
  if (p === "/v1/predictions") return await listar(env, "PREDICTION", url);
  if (p === "/v1/manifests") return await listar(env, "MANIFEST", url);
  if (p === "/v1/recipes") return await listar(env, "RECIPE", url);
  if (p === "/v1/search") {
    const q = url.searchParams.get("q");
    if (!q) return json({ error: "falta el parametro q" }, 400);
    const items = await buscar(env, q);
    return json({ consulta: q, encontrados: items.length, items });
  }
  // Archivador de algoritmos y fuentes. Va con la misma regla que el resto: el
  // listado antes que la ficha, para que nada quede publicado e invisible.
  if (p === "/v1/algorithms" || p === "/v1/algorithms/") return await algoritmos(env, url);
  if (p === "/v1/sources" || p === "/v1/sources/") return await fuentes(env, url);
  if (p === "/v1/categories" || p === "/v1/categories/") {
    const cats = await categorias(env);
    const meta = await metaCatalogo(env);
    return json({
      total: cats.reduce((s, c) => s + c.algoritmos, 0),
      categorias: cats,
      procedencia: { fuente: meta.fuente_nombre, fuente_url: meta.fuente_url,
        instantanea_sha256: meta.fuente_sha256, generado_at: meta.generado_at },
    });
  }
  const ma = p.match(/^\/v1\/algorithms\/([^/]+)\/?$/);
  if (ma) return await algoritmoPorId(env, decodeURIComponent(ma[1]));

  // Corridas de challenge. La pagina de la viz lee de aca, y un agente tambien.
  if (p === "/v1/challenges" || p === "/v1/challenges/") return await challenges(env, url);
  if (p === "/v1/structures" || p === "/v1/structures/") return await estructuras(env, null);
  const me = p.match(/^\/v1\/structures\/([^/]+)\/?$/);
  if (me) return await estructuras(env, decodeURIComponent(me[1]));
  const mp = p.match(/^\/v1\/propagate\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (mp) return await propagaciones(env, decodeURIComponent(mp[1]),
                                     mp[2] ? decodeURIComponent(mp[2]) : null);
  const mc = p.match(/^\/v1\/challenges\/([^/]+)(?:\/([^/]+))?\/?$/);
  if (mc) return await challengePorId(env, decodeURIComponent(mc[1]),
                                      mc[2] ? decodeURIComponent(mc[2]) : null);

  // Va ANTES del generico: `([^/]+)` no acepta la barra, pero el orden deja explicito
  // que /raw es una ruta propia y no un id que casualmente termina en "raw".
  const mr = p.match(/^\/v1\/archive\/([^/]+)\/raw\/?$/);
  if (mr) return await porIdCrudo(env, decodeURIComponent(mr[1]));

  const m = p.match(/^\/v1\/archive\/([^/]+)\/?$/);
  if (m) return await porId(env, decodeURIComponent(m[1]), true);

  return null;   // no es ruta de API: que siga el resto del Worker
}
