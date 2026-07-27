import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import fs from 'node:fs';
import path from 'node:path';

const SITE = 'https://rosettaquantum.com';

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
      i18n: { defaultLocale: 'en', locales: { en: 'en', es: 'es' } },
      serialize(item) {
        const links = BY_URL.get(item.url);
        if (links) item.links = links;
        return item;
      },
    }),
  ],
});
