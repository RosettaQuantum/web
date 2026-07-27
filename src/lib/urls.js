// URLs absolutas y normalizadas (Cowork, 27 jul).
// Los buscadores emparejan idiomas por hreflang, no por la ruta. Como los posts
// en español viven en /blog/<slug>-es (dentro del espacio inglés), las etiquetas
// tienen que ser absolutas y recíprocas o Google los lee como páginas sueltas.
// La barra final importa: el sitemap publica /blog/foo/ y el canonical debe
// coincidir carácter por carácter, si no son dos URLs distintas para Google.

export const SITE = 'https://rosettaquantum.com';

export function abs(path) {
  let p = String(path ?? '/');
  if (/^https?:\/\//i.test(p)) return p;
  if (!p.startsWith('/')) p = '/' + p;
  // los archivos (llms.txt, rss.xml) no llevan barra final; las páginas sí
  if (!/\.[a-z0-9]+$/i.test(p) && !p.endsWith('/')) p += '/';
  return SITE + p;
}
