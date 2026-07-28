/**
 * Migra los posts estáticos de la Biblioteca a la tabla `posts` de D1.
 *
 * Por qué extrae en vez de re-renderizar: el cuerpo se toma del HTML YA CONSTRUIDO
 * (dist/blog/<id>/index.html), no del markdown. Re-renderizar con otro pipeline
 * (marked) produciría HTML parecido pero no idéntico — se perderían el resaltado de
 * Shiki, la tipografía inteligente y cualquier plugin de remark/rehype. Extrayendo,
 * el post migrado queda byte a byte igual a lo que ya está en vivo.
 *
 * Los .md NO se borran: siguen en git como historial y respaldo, y alimentan el
 * emparejado hreflang del sitemap. D1 pasa a ser la copia viva y editable.
 *
 * Uso:  node scripts/migrate-posts-to-d1.mjs [--dry]
 * Requiere: npm run build previo (necesita dist/) y el token OAuth de wrangler.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const DRY = process.argv.includes("--dry");
const ACCOUNT = "6398d10da6c1f1e8b38b5e7c15d2410f";
const DB_UUID = "f0919403-5bd0-4842-a1d3-0954fdd47633";

function token() {
  const cfg = fs.readFileSync(
    path.join(os.homedir(), "Library/Preferences/.wrangler/config/default.toml"), "utf8");
  const m = cfg.match(/oauth_token\s*=\s*"([^"]+)"/);
  if (!m) throw new Error("sin token OAuth de wrangler: corre `npx wrangler login`");
  return m[1];
}

/** Frontmatter mínimo: los campos que usa la Biblioteca. No es un parser YAML general. */
function frontmatter(raw) {
  const m = raw.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return null;
  const fm = {}; const block = m[1];
  const scalar = (k) => {
    const r = block.match(new RegExp(`^${k}:\\s*(.+)$`, "m"));
    if (!r) return undefined;
    return r[1].trim().replace(/^['"]|['"]$/g, "");
  };
  for (const k of ["title", "tldr", "date", "pillar", "lang", "slugBase", "draft"]) fm[k] = scalar(k);
  // sources: lista de objetos { label, url? }
  const sm = block.match(/^sources:\n([\s\S]*?)(?=^\w|$)/m);
  fm.sources = [];
  if (sm) {
    for (const item of sm[1].split(/^\s*-\s+/m).slice(1)) {
      const label = (item.match(/label:\s*(.+)/) || [])[1];
      const url = (item.match(/url:\s*(.+)/) || [])[1];
      if (label) fm.sources.push({
        label: label.trim().replace(/^['"]|['"]$/g, ""),
        ...(url ? { url: url.trim().replace(/^['"]|['"]$/g, "") } : {}),
      });
    }
  }
  return fm;
}

/** Cuerpo renderizado tal cual salió del build. */
function builtBody(id) {
  const file = path.join("dist", "blog", id, "index.html");
  if (!fs.existsSync(file)) return null;
  const html = fs.readFileSync(file, "utf8");
  const open = html.indexOf('<div class="body"');
  if (open < 0) return null;
  const start = html.indexOf(">", open) + 1;
  // el cuerpo termina donde empiezan las fuentes o se cierra el artículo
  let end = html.indexOf('<div class="sources"', start);
  if (end < 0) end = html.indexOf("</article>", start);
  if (end < 0) return null;
  const chunk = html.slice(start, end);
  const close = chunk.lastIndexOf("</div>");   // el </div> propio del .body
  return close < 0 ? null : chunk.slice(0, close).trim();
}

async function d1(sql, params) {
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/d1/database/${DB_UUID}/query`,
    { method: "POST",
      headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }) });
  const j = await res.json();
  if (!j.success) throw new Error(JSON.stringify(j.errors).slice(0, 300));
  return j.result[0];
}

const dir = "src/content/blog";
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
const rows = []; const skipped = [];

for (const f of files) {
  const id = f.replace(/\.md$/, "");
  const raw = fs.readFileSync(path.join(dir, f), "utf8");
  const fm = frontmatter(raw);
  if (!fm) { skipped.push([id, "sin frontmatter"]); continue; }
  if (fm.draft === "true") { skipped.push([id, "borrador"]); continue; }
  const body = builtBody(id);
  if (!body) { skipped.push([id, "sin cuerpo en dist/ — ¿corriste npm run build?"]); continue; }
  const m = id.match(/^(.*)-(en|es)$/);
  rows.push({
    id,
    slug_base: fm.slugBase || (m ? m[1] : id),
    lang: fm.lang || (m ? m[2] : "en"),
    title: fm.title, tldr: fm.tldr, date: fm.date, pillar: fm.pillar,
    sources_json: JSON.stringify(fm.sources || []),
    body_html: body,
  });
}

console.log(`posts encontrados: ${files.length} | a migrar: ${rows.length} | omitidos: ${skipped.length}`);
for (const [id, why] of skipped) console.log(`  omitido ${id}: ${why}`);
for (const r of rows) console.log(`  ${r.id.padEnd(42)} ${r.lang} ${r.date} P${r.pillar} ${r.body_html.length}B`);

if (DRY) { console.log("\n--dry: no se escribió nada"); process.exit(0); }

const SQL = "INSERT OR REPLACE INTO posts (id,slug_base,lang,title,tldr,date,pillar,sources_json,body_html,published,created_at) VALUES (?,?,?,?,?,?,?,?,?,1,?)";
let n = 0;
for (const r of rows) {
  await d1(SQL, [r.id, r.slug_base, r.lang, r.title, r.tldr, r.date, r.pillar,
                 r.sources_json, r.body_html, new Date().toISOString().slice(0, 10)]);
  if (++n % 6 === 0 || n === rows.length) console.log(`  ${n}/${rows.length}`);
}
console.log(`migrados ${n} post(s) a D1`);
