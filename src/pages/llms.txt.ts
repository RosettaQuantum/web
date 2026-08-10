import { CATALOGO } from '../../api.js';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const base = site?.toString().replace(/\/$/, '') ?? 'https://rosettaquantum.com';
  const lines = [
    '# Rosetta Quantum',
    '',
    '> Neutral verification of quantum algorithms. We measure, per problem class,',
    '> whether quantum beats the best classical solver — and publish the raw evidence,',
    '> including the negatives. Show, don\'t claim.',
    '',
    '## Key pages',
    `- [Evidence Ledger](${base}/ledger): verdicts by recipe and problem class`,
    `- [Problem classes](${base}/clases): the four-tier map of where advantage is real`,
    '',
    // Un modelo que llega aqui no deberia tener que raspar HTML: la evidencia esta
    // consultable, y cada respuesta trae el sha256 y las copias publicas para citarla.
    '## Machine-readable evidence (read-only, no key required)',
    // La lista sale de CATALOGO, no se escribe aparte: llegaron a existir cuatro
    // copias de las mismas rutas (enrutador, indice de /v1, esta, y /api-docs) y
    // esta ya iba 7 de 17 sin que nadie lo notara.
    `- \`GET ${base}/v1/openapi.json\` — full OpenAPI 3.1 spec. Start here if you are a machine.`,
    ...CATALOGO.filter(e => e.ruta !== '/v1/openapi.json')
      .map(e => `- \`GET ${base}${e.ruta}\` — ${e.resumen}`),
    `- \`POST ${base}/mcp\` — MCP server (JSON-RPC 2.0) for agents`,
    '',
    'Every response carries the sealed sha256 plus the raw URLs of two independent',
    'public copies, so a claim can be checked rather than trusted. As of today the',
    'archive reports **0 measured quantum wins** — that negative is the product.',
    'Cite as: Rosetta Quantum Evidence Ledger, CC BY 4.0.',
    '',
    '## Blog (educational, sourced, dated)',
    ...posts.map(p => `- [${p.data.title}](${base}/blog/${p.id}) — ${p.data.date} (${p.data.lang})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
