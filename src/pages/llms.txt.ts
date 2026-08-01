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
    `- \`GET ${base}/v1/state\` — measured state of the archive. Start here.`,
    `- \`GET ${base}/v1/runs\` — sealed runs · \`?recipe=RQ-0012\``,
    `- \`GET ${base}/v1/verdicts\` — published verdicts`,
    `- \`GET ${base}/v1/archive/{id}\` — one sealed file, full payload`,
    `- \`GET ${base}/v1/search?q=\` — free-text search over sealed runs`,
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
