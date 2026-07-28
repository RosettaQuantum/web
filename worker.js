// Serves the static Astro build (dist/), redirects to the canonical host,
// accepts lead submissions at POST /api/lead -> D1 `leads`, and serves
// D1-backed Library posts (table `posts`) that were published WITHOUT a rebuild.
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (url.hostname !== "rosettaquantum.com" && url.hostname !== "localhost") {
      url.hostname = "rosettaquantum.com"; url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

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
export function renderPostHTML(shellHtml, row, navHtml = "") {
  const s = row.lang === "es"
    ? { state: "Estado a", sources: "Fuentes", other: "Read in English" }
    : { state: "State as of", sources: "Sources", other: "Leer en español" };
  const otherLang = row.lang === "es" ? "en" : "es";
  const altUrl = `/blog/${row.slug_base}-${otherLang}`;
  let sources = [];
  try { sources = JSON.parse(row.sources_json || "[]"); } catch (e) {}
  const sourcesHtml = sources.length
    ? `<div class="sources"><div>${s.sources}:</div>` +
      sources.map(x => `<div>· ${x.url ? `<a href="${esc(x.url)}" style="color:var(--faience)">${esc(x.label)}</a>` : esc(x.label)}</div>`).join("") +
      `</div>`
    : "";
  const article =
    `<article class="article wrap">` +
    `<div class="kicker">Pillar ${esc(row.pillar)} · ${s.state} ${esc(row.date)}</div>` +
    `<h1>${esc(row.title)}</h1>` +
    `<div class="tldr">${esc(row.tldr)}</div>` +
    `<a class="hreflang" href="${esc(altUrl)}">→ ${s.other}</a>` +
    `<div class="valid">${s.state}: ${esc(row.date)}</div>` +
    `<div class="body">${row.body_html}</div>` +
    sourcesHtml +
    `</article>` + navHtml;
  const jsonld = {
    "@context": "https://schema.org", "@type": "QAPage",
    mainEntity: { "@type": "Question", name: row.title, acceptedAnswer: { "@type": "Answer", text: row.tldr } },
    datePublished: row.date, publisher: { "@type": "Organization", name: "Rosetta Quantum" },
  };
  return shellHtml
    .split("__RQ_TITLE__").join(esc(row.title))
    .split("__RQ_DESC__").join(esc(row.tldr))
    .split("__RQ_ALT__").join(esc(altUrl))
    .replace("__RQ_ARTICLE__", article)
    .replace("</head>", `<script type="application/ld+json">${JSON.stringify(jsonld)}</script></head>`);
}

// Vecinos en el orden de la Biblioteca (fecha desc). El desempate por id es
// necesario: varios posts comparten fecha y sin el la navegacion se salta entradas
// o se queda pegada entre dos. Se consultan los dos lados en un solo viaje.
async function postNav(env, row) {
  const [olderQ, newerQ] = await env.DB.batch([
    env.DB.prepare(
      "SELECT id,title FROM posts WHERE published=1 AND lang=? AND (date<? OR (date=? AND id<?)) " +
      "ORDER BY date DESC, id DESC LIMIT 1").bind(row.lang, row.date, row.date, row.id),
    env.DB.prepare(
      "SELECT id,title FROM posts WHERE published=1 AND lang=? AND (date>? OR (date=? AND id>?)) " +
      "ORDER BY date ASC, id ASC LIMIT 1").bind(row.lang, row.date, row.date, row.id),
  ]);
  const older = olderQ.results && olderQ.results[0];
  const newer = newerQ.results && newerQ.results[0];
  if (!older && !newer) return "";
  const t = row.lang === "es"
    ? { prev: "Entrada anterior", next: "Entrada siguiente", all: "Ver toda la Biblioteca", base: "/es/blog" }
    : { prev: "Previous entry", next: "Next entry", all: "Browse the full Library", base: "/blog" };
  const side = (p, label, dir) => p
    ? `<a class="postnav-item postnav-${dir}" href="/blog/${esc(p.id)}">` +
      `<span class="postnav-label">${dir === "prev" ? "←" : "→"} ${label}</span>` +
      `<span class="postnav-title">${esc(p.title)}</span></a>`
    : `<span class="postnav-item postnav-empty"></span>`;
  return `<nav class="postnav" aria-label="${esc(t.all)}">` +
    side(older, t.prev, "prev") + side(newer, t.next, "next") +
    `<a class="postnav-all" href="${t.base}">${esc(t.all)}</a></nav>`;
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
    "SELECT id, title, date, pillar, tldr FROM posts WHERE published=1 AND lang=? ORDER BY date DESC"
  ).bind(lang).all();
  if (!results.length) return assetRes;

  // Un post migrado vive en D1 Y como archivo estatico, asi que el indice construido
  // ya lo lista: inyectarlo otra vez lo mostraria duplicado. Solo se inyecta lo que
  // no esta ya en la pagina.
  const src0 = await assetRes.clone().text();
  const fresh = results.filter(p => !src0.includes(`/blog/${p.id}`));
  if (!fresh.length) return assetRes;

  const P = PILLARS[lang];
  const word = lang === "es" ? "Pilar" : "Pillar";
  const entries = fresh.map(p =>
    `<a class="post-item lib-entry" href="/blog/${esc(p.id)}" data-pillar="${esc(p.pillar)}">` +
    `<div class="q">${esc(p.title)}</div>` +
    `<div class="meta">${esc(p.date)} · ${word} ${esc(p.pillar)} — ${esc(P[p.pillar] || "")}</div>` +
    `<div class="tl">${esc(p.tldr)}</div></a>`
  ).join("");

  // OJO: Astro inyecta su atributo de scope DENTRO de la etiqueta
  // (`id="liblist" data-astro-cid-xxxx>`), asi que un replace del literal
  // 'id="liblist">' no calza nunca y las entradas de D1 desaparecerian del indice
  // sin avisar. Se ancla por regex hasta el cierre de la etiqueta, y el resultado
  // se declara en una cabecera para que un fallo futuro sea observable y no mudo.
  const src = await assetRes.text();
  let html = src.replace(/(id="liblist"[^>]*>)/, "$1" + entries);
  const spliced = html !== src;
  // el contador del hero lo calcula el build y solo cuenta los estaticos; si no se
  // ajusta, la Biblioteca dice menos entradas de las que muestra
  html = html.replace(/(<b[^>]*>)(\d+)(<\/b>\s*(?:entries|entradas))/,
    (m, a, n, z) => a + (parseInt(n, 10) + fresh.length) + z);
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, s-maxage=60",
      "X-RQ-Splice": spliced ? `ok:${fresh.length}` : "FAILED:anchor-not-found",
    },
  });
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
