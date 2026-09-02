import { manejarApi } from "./api.js";
import { manejarQreadyLead } from "./lib/qready-lead.mjs";

// Serves the static Astro build (dist/), redirects to the canonical host,
// accepts lead submissions at POST /api/lead -> D1 `leads`, and serves
// D1-backed Library posts (table `posts`) that were published WITHOUT a rebuild.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // El preview vive en *.workers.dev. Sin esta excepcion, la canonicalizacion de
    // host rebota a produccion TODA ruta que ejecute el Worker —o sea /v1/*, /blog*,
    // /clases* y los feeds: exactamente las que el preview existe para probar— y deja
    // pasar solo las estaticas, que no lo necesitan. El preview habria verificado la
    // mitad que no falla y habria dado verde. Medido: / daba 200 y /v1/state daba 301.
    // Produccion no cambia: cualquier otro host sigue canonicalizando a rosettaquantum.com.
    const esPreview = url.hostname.endsWith(".workers.dev");
    if (url.hostname !== "rosettaquantum.com" && url.hostname !== "localhost" && !esPreview) {
      url.hostname = "rosettaquantum.com"; url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    // API de lectura del ledger + servidor MCP. Va primero porque son rutas propias
    // que no existen como archivo; si devuelve null, sigue el flujo normal del sitio.
    const api = await manejarApi(request, env, url, ctx);
    if (api) return api;

    if (url.pathname === "/api/lead" && request.method === "POST") {
      try {
        const b = await request.json();
        if (!b.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email))
          return json({ ok: false, error: "valid email required" }, 400);
        await env.DB.prepare(
          "INSERT INTO leads (name,email,role,org,problem_class,note,lang,source) VALUES (?,?,?,?,?,?,?,?)"
        ).bind(
          b.name || null, b.email, b.role || null, b.org || null,
          b.problem_class || null, b.note || null, b.lang || "en", "site-modal"
        ).run();
        return json({ ok: true });
      } catch (e) {
        return json({ ok: false, error: "server error" }, 500);
      }
    }

    // El lead del formulario Enterprise de /q-ready/checkout (tier=l3). Distinto del
    // /api/lead de arriba: campos distintos (razon social, telefono) y ademas avisa por
    // correo. El defecto que esto reemplaza: el formulario solo hacia preventDefault y
    // mostraba "Solicitud enviada" sin mandar nada a ningun lado — una promesa falsa a
    // una persona real. Ver lib/qready-lead.mjs para el porque de cada decision.
    // ── /api/monitor-lead (commit 5) — captura del Monitor ────────────────────
    // Usa el binding MAILER, que ya existe y esta desplegado: cero terceros, cero
    // secretos nuevos. Falla cerrado: sin correo valido no escribe nada.
    if (url.pathname === "/api/monitor-lead" && request.method === "POST") {
      let cuerpo = {};
      try { cuerpo = await request.json(); } catch { /* queda vacio y falla abajo */ }
      const email = String(cuerpo.email || "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
        return json({ ok: false, error: "valid email required" }, 400);
      }
      await env.DB.prepare(
        "INSERT INTO monitor_leads (email, ts, ua, origen) VALUES (?, ?, ?, ?)"
      ).bind(email, new Date().toISOString(), request.headers.get("user-agent") || "", String(cuerpo.origen || "monitor")).run();
      return new Response(null, { status: 204 });
    }

    if (url.pathname === "/api/qready-lead" && request.method === "POST") {
      let b;
      try { b = await request.json(); } catch (e) { return json({ ok: false, error: "bad json" }, 400); }
      const { status, cuerpo } = await manejarQreadyLead(b, env);
      return json(cuerpo, status);
    }

    // --- D1-backed Library: publish a post by INSERT, no rebuild needed ---
    if (request.method === "GET") {
      // (1) single post URL: /blog/<id>/  (ids end in -en / -es, both live under /blog/)
      const pm = url.pathname.match(/^\/blog\/([^\/]+)\/?$/);
      if (pm && !pm[1].startsWith("_") && !pm[1].startsWith("rq-shell")) {
        // D1 manda sobre el estático: es la copia viva y editable sin push, y es la
        // única que puede llevar prev/next. El archivo construido queda como respaldo
        // versionado en git y responde si la fila no existe o no está publicada, así
        // que un post nunca desaparece por un problema en la base.
        const d1 = await renderD1Post(env, ctx, pm[1]);
        if (d1) return d1;
        return env.ASSETS.fetch(request);
      }
      // (2) Library index: splice D1 posts into the static list
      if (url.pathname === "/blog" || url.pathname === "/blog/")
        return injectIndex(env, request, "en");
      if (url.pathname === "/es/blog" || url.pathname === "/es/blog/")
        return injectIndex(env, request, "es");
      // (2 bis) Archivador de algoritmos: la lista de /clases/ sale de D1, igual
      // que el indice de la Biblioteca. Si la base no responde, se sirve el
      // cascaron construido y la cabecera lo declara — nunca una pagina rota.
      if (url.pathname === "/clases" || url.pathname === "/clases/")
        return injectAlgorithms(env, request, "en");
      if (url.pathname === "/es/clases" || url.pathname === "/es/clases/")
        return injectAlgorithms(env, request, "es");
      // (3) machine-facing feeds: append D1 posts so LLMs/readers see them
      if (url.pathname === "/llms.txt") return augmentLlms(env, request);
      if (url.pathname === "/rss.xml") return augmentRss(env, request);
      // (4) sitemap: los posts que solo viven en D1 tambien deben declararse, con su
      // par de idioma. Sin esto, cada post publicado por INSERT queda invisible para
      // los buscadores y se pierde el emparejado hreflang del 27-jul.
      if (url.pathname === "/sitemap-0.xml") return augmentSitemap(env, request);
    }

    return env.ASSETS.fetch(request);
  }
};

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const PILLARS = {
  en: { A: "State by problem class", B: "Canonical dictionary", C: "Claim explainers", D: "Methodology & runs", E: "Maps & data", F: "Decision-maker" },
  es: { A: "Estado por clase de problema", B: "Diccionario canónico", C: "Explicadores de claims", D: "Metodología y runs", E: "Mapas y datos", F: "Decisor" },
};

// PURE: build a full post page from the built shell HTML + a D1 row.
// Mirrors src/pages/blog/[...slug].astro exactly (kicker/h1/tldr/hreflang/valid/body/sources).
export function renderPostHTML(shellHtml, row, nav = {}) {
  const s = row.lang === "es"
    ? { state: "Estado a", sources: "Fuentes", other: "Read in English" }
    : { state: "State as of", sources: "Sources", other: "Leer en español" };
  const otherLang = row.lang === "es" ? "en" : "es";
  // el enlace visible del cuerpo apunta a la contraparte aunque no exista fila:
  // si no esta publicada cae al estatico, que si existe.
  const altUrl = `/blog/${row.slug_base}-${otherLang}/`;
  let sources = [];
  try { sources = JSON.parse(row.sources_json || "[]"); } catch (e) {}
  const sourcesHtml = sources.length
    ? `<div class="sources"><div>${s.sources}:</div>` +
      sources.map(x => `<div>· ${x.url ? `<a href="${esc(x.url)}" style="color:var(--faience)">${esc(x.label)}</a>` : esc(x.label)}</div>`).join("") +
      `</div>`
    : "";
  const article =
    (nav.top || "") +
    `<article class="article wrap">` +
    `<div class="kicker">Pillar ${esc(row.pillar)} · ${s.state} ${esc(row.date)}</div>` +
    `<h1>${esc(row.title)}</h1>` +
    `<div class="tldr">${esc(row.tldr)}</div>` +
    `<a class="hreflang" href="${esc(altUrl)}">→ ${s.other}</a>` +
    `<div class="valid">${s.state}: ${esc(row.date)}</div>` +
    `<div class="body">${row.body_html}</div>` +
    sourcesHtml +
    `</article>` + (nav.bottom || "");
  const jsonld = {
    "@context": "https://schema.org", "@type": "QAPage",
    mainEntity: { "@type": "Question", name: row.title, acceptedAnswer: { "@type": "Answer", text: row.tldr } },
    datePublished: row.date, publisher: { "@type": "Organization", name: "Rosetta Quantum" },
  };
  // El cascaron se construye en /rq-shell-xx/, asi que trae ESE canonical horneado:
  // sin corregirlo, cada post servido desde D1 se declara duplicado del cascaron y
  // ademas se queda sin hreflang. Se reescribe con la URL real y, solo si la
  // traduccion existe publicada, se declaran los alternates.
  const SITE = "https://rosettaquantum.com";
  const selfUrl = `${SITE}/blog/${row.id}/`;
  let head = `<link rel="canonical" href="${selfUrl}">`;
  if (nav.altUrl) {
    const otherUrl = SITE + nav.altUrl;
    const enUrl = row.lang === "en" ? selfUrl : otherUrl;
    head += `<link rel="alternate" hreflang="${row.lang}" href="${selfUrl}">` +
            `<link rel="alternate" hreflang="${otherLang}" href="${otherUrl}">` +
            `<link rel="alternate" hreflang="x-default" href="${enUrl}">`;
  }
  return shellHtml
    .split("__RQ_TITLE__").join(esc(row.title))
    .split("__RQ_DESC__").join(esc(row.tldr))
    .split("__RQ_ALT__").join(esc(altUrl))
    .replace("__RQ_ARTICLE__", article)
    .replace(/<link rel="canonical"[^>]*>/, head)
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(jsonld)}</script></head>`);
}

// Vecinos en el orden de la Biblioteca (fecha desc). El desempate por id es
// necesario: varios posts comparten fecha y sin el la navegacion se salta entradas
// o se queda pegada entre dos. Se consultan los dos lados en un solo viaje.
async function postNav(env, row) {
  const other = row.lang === "es" ? "en" : "es";
  const [olderQ, newerQ, sibQ] = await env.DB.batch([
    env.DB.prepare(
      "SELECT id,title FROM posts WHERE published=1 AND lang=? AND (date<? OR (date=? AND id<?)) " +
      "ORDER BY date DESC, id DESC LIMIT 1").bind(row.lang, row.date, row.date, row.id),
    env.DB.prepare(
      "SELECT id,title FROM posts WHERE published=1 AND lang=? AND (date>? OR (date=? AND id>?)) " +
      "ORDER BY date ASC, id ASC LIMIT 1").bind(row.lang, row.date, row.date, row.id),
    env.DB.prepare(
      "SELECT id FROM posts WHERE published=1 AND slug_base=? AND lang=? LIMIT 1")
      .bind(row.slug_base, other),
  ]);
  const older = olderQ.results && olderQ.results[0];
  const newer = newerQ.results && newerQ.results[0];
  const sib   = sibQ.results && sibQ.results[0];
  const t = row.lang === "es"
    ? { prev: "Anterior", next: "Siguiente", prevL: "Entrada anterior", nextL: "Entrada siguiente",
        all: "Ver toda la Biblioteca", base: "/es/blog" }
    : { prev: "Previous", next: "Next", prevL: "Previous entry", nextL: "Next entry",
        all: "Browse the full Library", base: "/blog" };

  // Arriba: adelanto compacto con flechas, para que el lector vea de inmediato que
  // hay mas y hacia donde. Abajo: la version completa, para cuando ya termino de leer.
  const topSide = (p, label, dir) => p
    ? `<a class="pnt pnt-${dir}" href="/blog/${esc(p.id)}/" title="${esc(p.title)}">` +
      (dir === "prev" ? `<span class="pnt-arrow">←</span>` : "") +
      `<span class="pnt-txt"><span class="pnt-label">${label}</span>` +
      `<span class="pnt-title">${esc(p.title)}</span></span>` +
      (dir === "next" ? `<span class="pnt-arrow">→</span>` : "") + `</a>`
    : `<span class="pnt pnt-empty"></span>`;
  const top = (older || newer)
    ? `<nav class="postnav-top" aria-label="${esc(t.all)}">` +
      topSide(older, t.prev, "prev") + topSide(newer, t.next, "next") + `</nav>`
    : "";

  const side = (p, label, dir) => p
    ? `<a class="postnav-item postnav-${dir}" href="/blog/${esc(p.id)}/">` +
      `<span class="postnav-label">${dir === "prev" ? "←" : "→"} ${label}</span>` +
      `<span class="postnav-title">${esc(p.title)}</span></a>`
    : `<span class="postnav-item postnav-empty"></span>`;
  const bottom = (older || newer)
    ? `<nav class="postnav" aria-label="${esc(t.all)}">` +
      side(older, t.prevL, "prev") + side(newer, t.nextL, "next") +
      `<a class="postnav-all" href="${t.base}">${esc(t.all)}</a></nav>`
    : "";

  // hreflang solo si la traduccion existe y esta publicada: declarar un alternate
  // que responde 404 es peor que no declarar ninguno.
  const altUrl = sib ? `/blog/${row.slug_base}-${other}/` : null;
  return { top, bottom, altUrl };
}

async function renderD1Post(env, ctx, id) {
  const cache = caches.default;
  const key = new Request("https://rosettaquantum.com/__d1/" + id);
  const cached = await cache.match(key);
  if (cached) return cached;

  const row = await env.DB.prepare(
    "SELECT id, slug_base, lang, title, tldr, date, pillar, sources_json, body_html FROM posts WHERE id=? AND published=1"
  ).bind(id).first();
  if (!row) return null;

  const shellUrl = "https://rosettaquantum.com/rq-shell-" + (row.lang === "es" ? "es" : "en") + "/";
  const shellRes = await env.ASSETS.fetch(new Request(shellUrl));
  if (shellRes.status !== 200) return null;
  const html = renderPostHTML(await shellRes.text(), row, await postNav(env, row));

  const res = new Response(html, {
    headers: { "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60" },
  });
  ctx.waitUntil(cache.put(key, res.clone()));
  return res;
}

async function injectIndex(env, request, lang) {
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 200) return assetRes;
  const { results = [] } = await env.DB.prepare(
    "SELECT id, title, date, pillar, tldr FROM posts WHERE published=1 AND lang=? ORDER BY date DESC, id"
  ).bind(lang).all();
  if (!results.length) return assetRes;   // sin filas, manda lo construido

  // La lista se REEMPLAZA entera con lo que dice D1, no se le suman entradas al
  // final. Sumar dejaba viva la tarjeta construida de un post que despues se
  // actualizo en D1: la pagina mostraba la version nueva y el indice seguia
  // anunciando la fecha y el resumen viejos. D1 es la fuente de verdad del post,
  // asi que tambien tiene que serlo de su tarjeta.
  const P = PILLARS[lang];
  const word = lang === "es" ? "Pilar" : "Pillar";
  const entries = results.map(p =>
    `<a class="post-item lib-entry" href="/blog/${esc(p.id)}/" data-pillar="${esc(p.pillar)}">` +
    `<div class="q">${esc(p.title)}</div>` +
    `<div class="meta">${esc(p.date)} · ${word} ${esc(p.pillar)} — ${esc(P[p.pillar] || "")}</div>` +
    `<div class="tl">${esc(p.tldr)}</div></a>`
  ).join("");

  const src = await assetRes.text();
  const open = src.match(/<div class="post-list" id="liblist"[^>]*>/);
  const endMark = '</div><p id="libempty"';
  const end = open ? src.indexOf(endMark, src.indexOf(open[0]) + open[0].length) : -1;
  if (!open || end < 0) {
    // no se pudo anclar: se sirve lo construido antes que una pagina rota, pero
    // queda declarado en la cabecera para que el fallo no sea mudo
    return new Response(src, { status: 200, headers: {
      "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60",
      "X-RQ-Index": "FAILED:anchor-not-found" } });
  }
  let html = src.slice(0, src.indexOf(open[0]) + open[0].length) + entries + src.slice(end);
  // el contador del hero lo calcula el build sobre los archivos; ahora la lista la
  // manda D1, asi que el numero tiene que salir de la misma fuente
  html = html.replace(/(<b[^>]*>)(\d+)(<\/b>\s*(?:entries|entradas))/, `$1${results.length}$3`);
  return new Response(html, { status: 200, headers: {
    "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60",
    "X-RQ-Index": `d1:${results.length}` } });
}

// ------------------------------------------------------- archivador de algoritmos

const ARCHIVADOR_T = {
  en: { speed: "Declared speedup", declaredBy: "declared by", problem: "Problem",
        papers: "Primary papers", impl: "Public implementations", source: "Canonical entry",
        measured: "Sealed run of ours", notMeasured: "No sealed run of ours",
        all: "All", showing: "Showing", of: "of", noMatch: "Nothing matches that search.",
        seeAll: "Clear filters" },
  es: { speed: "Speedup declarado", declaredBy: "declarado por", problem: "Problema",
        papers: "Papers primarios", impl: "Implementaciones públicas", source: "Ficha canónica",
        measured: "Corrida sellada nuestra", notMeasured: "Sin corrida sellada nuestra",
        all: "Todas", showing: "Mostrando", of: "de", noMatch: "Nada calza con esa búsqueda.",
        seeAll: "Quitar filtros" },
};

/**
 * Reemplaza la lista del archivador con lo que dice D1.
 *
 * Se REEMPLAZA entera, no se le suman filas al cascaron construido: sumar deja viva
 * una tarjeta vieja de una entrada que despues cambio en la base, y la pagina
 * termina mostrando lo nuevo arriba y lo viejo abajo. Es la misma leccion que
 * costo dos deploys en el indice de la Biblioteca.
 *
 * Si D1 no responde: se sirve lo construido y `X-RQ-Archivador` lo declara. Un
 * fallo mudo aca seria una pagina que dice tener el catalogo y no lo tiene.
 */
async function injectAlgorithms(env, request, lang) {
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 200) return assetRes;

  let filas = [], cruces = [], meta = {};
  try {
    const [a, l, m] = await env.DB.batch([
      env.DB.prepare(
        "SELECT id,nombre,categoria,categoria_id,problema_es,problema_en,speedup_declarado," +
        "fuente_nombre,fuente_url,refs_json,impl_json,n_refs FROM quantum_algorithms ORDER BY orden"),
      env.DB.prepare("SELECT algorithm_id,recipe_id,nota FROM quantum_algorithm_ledger"),
      env.DB.prepare("SELECT clave,valor FROM quantum_catalog_meta"),
    ]);
    filas = a.results || [];
    cruces = l.results || [];
    meta = Object.fromEntries((m.results || []).map(r => [r.clave, r.valor]));
  } catch (e) {
    return new Response(await assetRes.text(), { status: 200, headers: {
      "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60",
      "X-RQ-Archivador": "FAILED:d1-error" } });
  }
  if (!filas.length) {
    return new Response(await assetRes.text(), { status: 200, headers: {
      "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60",
      "X-RQ-Archivador": "FAILED:sin-filas" } });
  }

  const t = ARCHIVADOR_T[lang] || ARCHIVADOR_T.en;
  const cats = [];
  for (const f of filas) if (!cats.some(c => c.id === f.categoria_id))
    cats.push({ id: f.categoria_id, nombre: f.categoria });

  const items = filas.map(f => {
    let refs = [], impl = [];
    try { refs = JSON.parse(f.refs_json || "[]"); } catch (e) {}
    try { impl = JSON.parse(f.impl_json || "[]"); } catch (e) {}
    const mias = cruces.filter(c => c.algorithm_id === f.id);
    const problema = (lang === "es" ? f.problema_es : f.problema_en) || "";

    // Solo los 6 papers mas antiguos por numero: la ficha completa, con las 625
    // citas, esta en la API. Cortar sin decirlo seria declarar de mas.
    const refsMostradas = refs.slice(0, 6);
    const refsHtml = refsMostradas.map(r =>
      `<div><span class="n">[${esc(r.n)}]</span>` +
      (r.url ? `<a href="${esc(r.url)}" class="lnk" rel="noopener">${esc(r.cita)}</a>` : esc(r.cita)) +
      `</div>`).join("") +
      (refs.length > refsMostradas.length
        ? `<div><span class="n">+</span>${refs.length - refsMostradas.length} ${lang === "es" ? "más en" : "more at"} ` +
          `<a class="lnk" href="/v1/algorithms/${esc(f.id)}">/v1/algorithms/${esc(f.id)}</a></div>`
        : "");

    const implHtml = impl.length
      ? `<div class="qblock"><h4>${esc(t.impl)}</h4><div class="qimpl">` +
        impl.map(i => `<a href="${esc(i.url)}" rel="noopener">${esc(i.nombre)}</a>`).join("") +
        `</div></div>`
      : "";

    const evid = mias.length
      ? `<span class="qev si">◆ ${esc(t.measured)}: ${mias.map(c => esc(c.recipe_id)).join(", ")}</span>`
      : `<span class="qev">${esc(t.notMeasured)}</span>`;

    // El texto de busqueda va en un atributo: filtrar en el cliente sobre el DOM
    // visible se rompe con acentos y con el marcado interno.
    //
    // Las notas de nuestras recetas entran al indice a proposito: alguien que
    // busca "portafolio" espera encontrar QAOA, y sin esto no lo encontraba
    // porque la descripcion del algoritmo habla de "problemas combinatorios".
    const buscable = `${f.nombre} ${problema} ${f.categoria} ` +
      mias.map(c => `${c.recipe_id} ${c.nota || ""}`).join(" ");

    return `<article class="qitem" data-cat="${esc(f.categoria_id)}" data-q="${esc(buscable)}">` +
      `<button class="qhead" type="button" aria-expanded="false" aria-controls="qb-${esc(f.id)}">` +
        `<div><span class="qname">${esc(f.nombre)}</span>` +
          `<span class="qcat">${esc(f.categoria)}</span></div>` +
        `<div><span class="qspeed"><span class="lbl">${esc(t.speed)}</span>${esc(f.speedup_declarado)}</span>` +
          `<span class="qcat">${esc(t.declaredBy)} ${esc(f.fuente_nombre)}</span></div>` +
        `<div><span class="qprob">${esc(problema)}</span><br>${evid}</div>` +
      `</button>` +
      `<div class="qbody" id="qb-${esc(f.id)}" hidden>` +
        (refsMostradas.length ? `<div class="qblock"><h4>${esc(t.papers)} (${refs.length})</h4><div class="qrefs">${refsHtml}</div></div>` : "") +
        implHtml +
        `<div class="qblock"><h4>${esc(t.source)}</h4><div class="qrefs">` +
          `<div><a class="lnk" href="${esc(f.fuente_url)}" rel="noopener">${esc(f.fuente_url)}</a></div>` +
          `<div><a class="lnk" href="/v1/algorithms/${esc(f.id)}">/v1/algorithms/${esc(f.id)}</a></div>` +
        `</div></div>` +
      `</div></article>`;
  }).join("");

  const src = await assetRes.text();
  const abre = src.match(/<div class="qlist" id="algolist"[^>]*>/);
  const cierra = '</div>';
  if (!abre) {
    return new Response(src, { status: 200, headers: {
      "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60",
      "X-RQ-Archivador": "FAILED:anchor-not-found" } });
  }
  const desde = src.indexOf(abre[0]) + abre[0].length;
  const hasta = src.indexOf(cierra, desde);
  if (hasta < 0) {
    return new Response(src, { status: 200, headers: {
      "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60",
      "X-RQ-Archivador": "FAILED:close-not-found" } });
  }

  const medidos = new Set(cruces.map(c => c.algorithm_id)).size;
  const citas = filas.reduce((s, f) => s + (f.n_refs || 0), 0);
  const chips = [`<button class="qchip" type="button" data-cat="" aria-pressed="true">${esc(t.all)} (${filas.length})</button>`]
    .concat(cats.map(c => {
      const n = filas.filter(f => f.categoria_id === c.id).length;
      return `<button class="qchip" type="button" data-cat="${esc(c.id)}" aria-pressed="false">${esc(c.id)} (${n})</button>`;
    })).join("");

  let html = src.slice(0, desde) + items + src.slice(hasta);
  html = html.replace('<div class="qfilters" id="qfilters" role="group"',
                      `<div class="qfilters" id="qfilters" data-ready="1" role="group"`)
             .replace(/(<div class="qfilters" id="qfilters"[^>]*>)/, `$1${chips}`);
  // Los contadores del cascaron son guiones hasta que la base contesta: asi la
  // pagina nunca muestra un numero que no salio de D1.
  const stats = { algoritmos: filas.length, categorias: cats.length, citas, medidos };
  for (const [k, v] of Object.entries(stats)) {
    html = html.replace(new RegExp(`(<span class="v" data-stat="${k}">)[^<]*(</span>)`), `$1${v}$2`);
  }
  html = html.replace(/(<p class="qcount" id="qcount">)[^<]*(<\/p>)/,
    `$1${t.showing} ${filas.length} ${t.of} ${filas.length}$2`);
  // El parrafo de respaldo solo tiene sentido si la lista quedo vacia.
  html = html.replace('<p id="algoempty" class="qempty">', '<p id="algoempty" class="qempty" hidden>');
  html = html.replace("</body>", scriptArchivador(t) + "</body>");

  return new Response(html, { status: 200, headers: {
    "Content-Type": "text/html;charset=UTF-8", "Cache-Control": "public, s-maxage=60",
    "X-RQ-Archivador": `d1:${filas.length}`,
    "X-RQ-Archivador-Sha": meta.fuente_sha256 || "sin-meta" } });
}

/** Buscador y filtros. Trabajan sobre los atributos, no sobre el texto pintado. */
function scriptArchivador(t) {
  return `<script>(function(){
  var lista=document.getElementById('algolist'); if(!lista) return;
  var items=[].slice.call(lista.querySelectorAll('.qitem'));
  var buscar=document.getElementById('qsearch');
  var filtros=document.getElementById('qfilters');
  var cuenta=document.getElementById('qcount');
  var vacio=document.getElementById('algoempty');
  var cat='', q='';
  function norm(s){return (s||'').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'');}
  function aplicar(){
    var n=0, nq=norm(q);
    items.forEach(function(el){
      var ok=(!cat||el.dataset.cat===cat)&&(!nq||norm(el.dataset.q).indexOf(nq)>=0);
      el.hidden=!ok; if(ok)n++;
    });
    cuenta.textContent=${JSON.stringify(t.showing)}+' '+n+' '+${JSON.stringify(t.of)}+' '+items.length;
    if(vacio){vacio.hidden=n>0; if(!n)vacio.textContent=${JSON.stringify(t.noMatch)};}
  }
  buscar&&buscar.addEventListener('input',function(e){q=e.target.value;aplicar();});
  filtros&&filtros.addEventListener('click',function(e){
    var b=e.target.closest('.qchip'); if(!b)return;
    cat=b.dataset.cat||'';
    [].forEach.call(filtros.querySelectorAll('.qchip'),function(x){
      x.setAttribute('aria-pressed', x===b?'true':'false');});
    aplicar();
  });
  lista.addEventListener('click',function(e){
    var h=e.target.closest('.qhead'); if(!h)return;
    var abierto=h.getAttribute('aria-expanded')==='true';
    h.setAttribute('aria-expanded', abierto?'false':'true');
    var b=document.getElementById(h.getAttribute('aria-controls'));
    if(b)b.hidden=abierto;
  });
})();</script>`;
}

async function augmentLlms(env, request) {
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 200) return assetRes;
  const { results = [] } = await env.DB.prepare(
    "SELECT id, title, date, lang FROM posts WHERE published=1 ORDER BY date DESC"
  ).all();
  let text = await assetRes.text();
  const fresh = results.filter(p => !text.includes(`/blog/${p.id}`));  // no repetir lo migrado
  if (fresh.length) {
    const extra = fresh.map(p =>
      `- [${p.title}](https://rosettaquantum.com/blog/${p.id}) — ${p.date} (${p.lang})`
    ).join("\n");
    text = text.replace(/\n*$/, "\n" + extra + "\n");
  }
  return new Response(text, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, s-maxage=60" } });
}

async function augmentRss(env, request) {
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 200) return assetRes;
  const { results = [] } = await env.DB.prepare(
    "SELECT id, title, tldr, date FROM posts WHERE published=1 ORDER BY date DESC"
  ).all();
  let xml = await assetRes.text();
  const fresh = results.filter(p => !xml.includes(`/blog/${p.id}`));   // no repetir lo migrado
  if (fresh.length) {
    const items = fresh.map(p =>
      `<item><title>${esc(p.title)}</title><description>${esc(p.tldr)}</description>` +
      `<pubDate>${new Date(p.date + "T00:00:00Z").toUTCString()}</pubDate>` +
      `<link>https://rosettaquantum.com/blog/${esc(p.id)}</link></item>`
    ).join("");
    xml = xml.replace("</channel>", items + "</channel>");
  }
  return new Response(xml, {
    headers: { "Content-Type": assetRes.headers.get("content-type") || "application/xml; charset=utf-8", "Cache-Control": "public, s-maxage=60" },
  });
}

// Declara en el sitemap los posts que solo existen en D1 (los migrados ya vienen del
// build). Reconstruye el par de idioma cuando las dos caras estan publicadas: declarar
// un alternate que no existe es peor que no declarar ninguno.
async function augmentSitemap(env, request) {
  const assetRes = await env.ASSETS.fetch(request);
  if (assetRes.status !== 200) return assetRes;
  const { results = [] } = await env.DB.prepare(
    "SELECT id, slug_base, lang, date FROM posts WHERE published=1"
  ).all();
  let xml = await assetRes.text();
  const live = new Set(results.map(p => `${p.slug_base}|${p.lang}`));
  const fresh = results.filter(p => !xml.includes(`/blog/${p.id}`));
  if (!fresh.length) return assetRes;

  const SITE = "https://rosettaquantum.com";
  const entries = fresh.map(p => {
    const other = p.lang === "es" ? "en" : "es";
    const loc = `${SITE}/blog/${p.id}/`;
    let links = "";
    if (live.has(`${p.slug_base}|${other}`)) {
      const enUrl = `${SITE}/blog/${p.slug_base}-en/`;
      const esUrl = `${SITE}/blog/${p.slug_base}-es/`;
      links =
        `<xhtml:link rel="alternate" hreflang="en" href="${enUrl}"/>` +
        `<xhtml:link rel="alternate" hreflang="es" href="${esUrl}"/>` +
        `<xhtml:link rel="alternate" hreflang="x-default" href="${enUrl}"/>`;
    }
    return `<url><loc>${loc}</loc><lastmod>${p.date}</lastmod>${links}</url>`;
  }).join("");

  xml = xml.replace("</urlset>", entries + "</urlset>");
  return new Response(xml, {
    headers: {
      "Content-Type": assetRes.headers.get("content-type") || "application/xml; charset=utf-8",
      "Cache-Control": "public, s-maxage=60",
      "X-RQ-Sitemap": `added:${fresh.length}`,
    },
  });
}
