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
import { clasificar, decidir, CAMPOS } from "./check-posts-sobrescritura.mjs";

const DRY = process.argv.includes("--dry");
// `worker.js` declara que D1 es "la copia viva y editable sin push". Este script escribia
// encima con INSERT OR REPLACE sobre TODOS los posts, sin comparar: correrlo despues de
// editar un post en D1 borraba la edicion viva sin conflicto y sin aviso. El --dry existia
// pero era opt-in, y un candado que hay que acordarse de poner no es un candado.
// Ahora se compara antes de escribir y los divergentes NO se tocan sin pedirlo aqui.
const SOBRESCRIBIR = process.argv.includes("--sobrescribir");
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


// ── Antes de escribir: mirar que hay. ────────────────────────────────────────────────────
const enD1 = (await d1(`SELECT id,${CAMPOS.join(",")} FROM posts`, [])).results ?? [];
const c = clasificar({ generado: rows, enD1 });

// Denominador siempre: cuantos vio, cuantos de cada clase. Un total sin denominador no es
// un resultado.
console.log(`\nen D1 hoy: ${enD1.length} | generados: ${c.vistos} -> nuevos ${c.nuevos.length} · iguales ${c.iguales.length} · DIVERGENTES ${c.divergentes.length}`);

for (const d of c.divergentes) console.log(`  ! ${d.id.padEnd(42)} difiere en: ${d.campos.join(", ")}`);

const plan = decidir({ clasificacion: c, sobrescribir: SOBRESCRIBIR });

// --dry sale DESPUES de clasificar, no antes: lo que uno quiere saber de una corrida en
// seco es justamente si hay algo que se pisaria, no solo que se generaria.
if (DRY) {
  console.log(`\n--dry: no se escribió nada. Sin --dry se escribirian ${plan.escribir.length} post(s)` +
              (plan.bloqueado ? ` y se DETENDRIA por ${c.divergentes.length} divergente(s).` : "."));
  process.exit(0);
}

if (plan.bloqueado) {
  console.error(`\n[posts] ${plan.motivo}`);
  console.error("[posts] No se puede saber desde aca quien tiene razon: puede que alguien");
  console.error("[posts] editara el post en D1 (el camino que worker.js recomienda) o que");
  console.error("[posts] editara el markdown para publicarlo. Adivinar borra trabajo ajeno.");
  console.error("[posts] Mira el diff y decide: si el markdown manda, corre con --sobrescribir.");
  if (c.nuevos.length) console.error(`[posts] (los ${c.nuevos.length} post(s) NUEVOS tampoco se escribieron: corre de nuevo cuando resuelvas esto)`);
  process.exit(1);
}

const SQL = "INSERT OR REPLACE INTO posts (id,slug_base,lang,title,tldr,date,pillar,sources_json,body_html,published,created_at) VALUES (?,?,?,?,?,?,?,?,?,1,?)";
const aEscribir = SOBRESCRIBIR ? rows : c.nuevos;
if (SOBRESCRIBIR && c.divergentes.length) {
  console.log(`\n--sobrescribir: se van a PISAR ${c.divergentes.length} version(es) viva(s) en D1.`);
}
let n = 0;
for (const r of aEscribir) {
  await d1(SQL, [r.id, r.slug_base, r.lang, r.title, r.tldr, r.date, r.pillar,
                 r.sources_json, r.body_html, new Date().toISOString().slice(0, 10)]);
  if (++n % 6 === 0 || n === aEscribir.length) console.log(`  ${n}/${aEscribir.length}`);
}
console.log(`escritos ${n} post(s) a D1 (de ${c.vistos} generados; ${c.iguales.length} ya estaban iguales)`);
