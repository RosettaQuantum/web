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
        const assetRes = await env.ASSETS.fetch(request);
        if (assetRes.status !== 404) return assetRes;      // a built/file post wins
        const d1 = await renderD1Post(env, ctx, pm[1]);    // else try D1
        if (d1) return d1;
        return assetRes;                                    // neither -> 404 page
      }
      // (2) Library index: splice D1 posts into the static list
      if (url.pathname === "/blog" || url.pathname === "/blog/")
        return injectIndex(env, request, "en");
      if (url.pathname === "/es/blog" || url.pathname === "/es/blog/")
        return injectIndex(env, request, "es");
      // (3) machine-facing feeds: append D1 posts so LLMs/readers see them
      if (url.pathname === "/llms.txt") return augmentLlms(env, request);
      if (url.pathname === "/rss.xml") return augmentRss(env, request);
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
export function renderPostHTML(shellHtml, row) {
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
    `</article>`;
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
  const html = renderPostHTML(await shellRes.text(), row);

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

  const P = PILLARS[lang];
  const word = lang === "es" ? "Pilar" : "Pillar";
  const entries = results.map(p =>
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
  const html = src.replace(/(id="liblist"[^>]*>)/, "$1" + entries);
  const spliced = html !== src;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      "Cache-Control": "public, s-maxage=60",
      "X-RQ-Splice": spliced ? `ok:${results.length}` : "FAILED:anchor-not-found",
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
  if (results.length) {
    const extra = results.map(p =>
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
  if (results.length) {
    const items = results.map(p =>
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
