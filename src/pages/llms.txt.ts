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
    `- [Evidence Ledger](${base}/ledger): verdicts by recipe and problem class — including published self-corrections (errata) that cite the original sealed file and never overwrite it`,
    `- [Problem classes](${base}/clases): the four-tier map that sorts catalogued algorithms by how real the advantage is today`,
    // Texto lifted VERBATIM de src/aprobado/pricing.en.md (bloque "Q-Ready —
    // cryptographic exposure"): nada nuevo se escribio aca, se citan las mismas
    // frases ya aprobadas por Nicholas.
    `- [Q-Ready](${base}/q-ready): post-quantum cryptographic exposure — for organizations that need to know how exposed they are by the cryptography they run today`,
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
    // Otra vez: cada frase de este bloque esta copiada del pricing.en.md aprobado,
    // no reescrita. El nombre de los dos productos y sus precios son los que ya
    // aprobo Nicholas para /pricing.
    '## Q-Ready — post-quantum cryptographic exposure',
    'For organizations that need to know how exposed they are by the cryptography they run today.',
    '- **Cryptographic Exposure Map** — Your public surface discovered and measured: hostnames, cryptography per endpoint, providers detected. **US$0**',
    '- **Migration Starter Kit** — The map, plus the critical path —which provider sets your deadline—, where you stand against your sector, and a 30/90/365-day plan derived from your own findings. **US$4,900**',
    `- [Start here](${base}/q-ready) · [Sample report](${base}/q-ready/sample-report)`,
    '',
    '## Blog (educational, sourced, dated)',
    ...posts.map(p => `- [${p.data.title}](${base}/blog/${p.id}) — ${p.data.date} (${p.data.lang})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
