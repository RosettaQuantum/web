import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://rosettaquantum.com';

// ¿La ultima edicion del informe PQC es un borrador? Se lee del DATO, con la misma
// regla que la pagina: ausente o distinto de false = borrador. Una edicion en borrador
// lleva `noindex`, y dejarla en el sitemap seria pedir que la indexen y pedir que no,
// a la vez. El dia que se publique entra sola, sin tocar este archivo.
function informeEnBorrador() {
  const dir = path.resolve('./src/data/informe-pqc');
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort(); } catch { return true; }
  if (!files.length) return true;
  try {
    const d = JSON.parse(fs.readFileSync(path.join(dir, files[files.length - 1]), 'utf8'));
    return d.borrador !== false;
  } catch { return true; }
}
const INFORME_BORRADOR = informeEnBorrador();

// Emparejado de idiomas en el sitemap (Cowork, 27 jul).
// La opción i18n de @astrojs/sitemap empareja por prefijo de ruta (/es/…), así que
// sólo cubre las 8 páginas cascarón. Los 24 posts viven en /blog/<base>-<lang>/ y
// salían sueltos: Google veía 12 pares como 24 páginas sin relación. Aquí leemos
// la colección en disco y construimos los pares reales por slugBase — declarar un
// alternate que no existe es peor que no declarar ninguno.
function postPairs() {
  const dir = path.resolve('./src/content/blog');
  const pairs = new Map();
  let files = [];
  try { files = fs.readdirSync(dir).filter((f) => f.endsWith('.md')); } catch { return pairs; }
  for (const f of files) {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    if (/^draft:\s*true\s*$/m.test(raw)) continue; // un borrador no se publica ni se declara
    const id = f.replace(/\.md$/, '');
    const m = id.match(/^(.*)-(en|es)$/);
    if (!m) continue;
    const [, base, lang] = m;
    if (!pairs.has(base)) pairs.set(base, {});
    pairs.get(base)[lang] = `${SITE}/blog/${id}/`;
  }
  // sólo los que tienen las dos caras
  for (const [base, v] of pairs) if (!v.en || !v.es) pairs.delete(base);
  return pairs;
}

const PAIRS = postPairs();
const BY_URL = new Map();
for (const v of PAIRS.values()) {
  const links = [
    { url: v.en, lang: 'en' },
    { url: v.es, lang: 'es' },
    { url: v.en, lang: 'x-default' },
  ];
  BY_URL.set(v.en, links);
  BY_URL.set(v.es, links);
}

export default defineConfig({
  site: SITE,
  output: 'static',
  i18n: {
    defaultLocale: 'en',
    locales: ['en', 'es'],
    routing: { prefixDefaultLocale: false },
  },
  integrations: [
    sitemap({
      // los cascarones rq-shell-* son plantillas internas que el Worker rellena
      // con posts de D1; no son páginas y no deben declararse (Opción C, 28 jul)
      // q-ready sale del sitemap (commit 10): los archivos NO se tocan y las rutas
      // siguen respondiendo —qready_leads y su workflow quedan intactos— pero deja de
      // anunciarse como parte de este sitio. Estaba fuera del nav desde el commit 4 y
      // seguía en el sitemap: media salida es la que no se nota.
      filter: (page) => !page.includes('/rq-shell-') && !page.includes('/q-ready')
        && !(INFORME_BORRADOR && page.includes('/informe-pqc')),
      i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es' } },
      serialize(item) {
        const links = BY_URL.get(item.url);
        if (links) item.links = links;
        return item;
      },
    }),
  ],
});
