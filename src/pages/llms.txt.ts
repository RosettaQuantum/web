import { CATALOGO, HERRAMIENTAS } from '../../api.js';
import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';

export const GET: APIRoute = async ({ site }) => {
  const posts = (await getCollection('blog', ({ data }) => !data.draft))
    .sort((a, b) => b.data.date.localeCompare(a.data.date));
  const base = site?.toString().replace(/\/$/, '') ?? 'https://rosettaquantum.com';
  // El informe mensual. Agosto se publico el 4-nov-2026 y este archivo no lo nombraba por
  // ninguna parte —ni la ruta, ni «informe», ni «chilena», ni QEX, ni 220, en 50 KB—: estaba
  // en el sitemap y mudo en el canal que leen los modelos. Nicholas pidio agregarlo.
  // No se escribe a mano: el titulo y el subtitulo salen del JSON de la edicion, igual que
  // los lee la pagina, asi que el mes que viene entra solo. Y usa LA MISMA regla de borrador
  // que /informe-pqc (`borrador !== false` = borrador, falla cerrado): una edicion en
  // borrador lleva noindex y esta fuera del sitemap, asi que tampoco se anuncia aqui.
  const ult = Object.entries(import.meta.glob('../data/informe-pqc/*.json', { eager: true }))
    .map(([p, m]: any) => ({ slug: p.split('/').pop()!.replace(/\.json$/, ''), d: m.default ?? m }))
    .sort((a, b) => b.slug.localeCompare(a.slug))[0];
  const informe = ult && ult.d.borrador === false ? ult : null;
  const lines = [
    '# Rosetta Quantum',
    '',
    '> Neutral verification of quantum algorithms. We measure, per problem class,',
    '> whether quantum beats the best classical solver — and publish the raw evidence,',
    '> including the negatives. Show, don\'t claim.',
    '',
    '## Key pages',
    `- [Evidence Ledger](${base}/ledger): verdicts by recipe and problem class — including published self-corrections (errata) that cite the original sealed file and never overwrite it`,
    `- [Evidence Library](${base}/library): every tracked claim and the 74-algorithm catalogue, dated, sourced and linked to its seal`,
    `- [Survival Registry](${base}/library/registry): what happens to quantum advantage claims after the press release`,
    ...(informe ? [`- [${informe.d.titulo}](${base}/informe-pqc): ${informe.d.subtitulo}. In Spanish, monthly; latest edition ${informe.slug}.`] : []),
    `- [Services & pricing](${base}/services): public prices, no "contact us" to find out what it costs`,
    `- [Pilot Referee](${base}/pilots): we make your quantum pilot produce a defensible number`,
    // Bloque 7 y 8, 10-sep-2026. Las tres puertas entran ANTES de metodologia porque
    // responden la pregunta con la que llega el lector, y la metodologia responde la
    // siguiente. La descripcion de cada una es la `description` de su propia pagina.
    `- [If you invest](${base}/for/investors): does this claim survive — evidence level, survival status and every challenge on record, sealed and citable`,
    `- [If you run a pilot](${base}/for/pilots): will my pilot produce a defensible number — criterion sealed before it runs, classical champion at parity`,
    `- [If you decide for an industry](${base}/for/industry): is this real for my industry yet — sixteen claims tracked since 2009, three standing, six eroded`,
    `- [What else you could use](${base}/how-we-compare): DARPA QBI, the Quantum Advantage Tracker, Metriq and QED-C, with what each one leaves open`,
    `- [Methodology](${base}/methodology): the five layers of a verdict, the EL0-EL5 evidence scale and budget parity under juez-v1`,
    `- [Who signs](${base}/about): every verdict carries a named author, and who may never pay us`,
    `- [Errata](${base}/ledger#erratas): the corrections we published against ourselves, inside the ledger`,
    `- [Verify a seal](${base}/verify): recompute any sealed artifact's hash in your own browser`,
    // Las dos rutas que faltaban: el archivo anunciaba ocho paginas publicas y estas dos
    // no estaban. La descripcion de cada una es la `description` de su propia pagina,
    // copiada tal cual: no se redacta texto nuevo para un canal de indexacion.
    `- [RQ Advantage Monitor](${base}/monitor): one edition when it seals — what the ledger can already say about public quantum-advantage claims`,
    `- [Contact](${base}/contact): a pilot that needs a referee, a claim that needs screening, or a question about the methodology`,
    '',
    // Un modelo que llega aqui no deberia tener que raspar HTML: la evidencia esta
    // consultable, y cada respuesta trae el sha256 y las copias publicas para citarla.
    // Seccion pedida por la enmienda IA-first (§3). La frase es la del documento Norte,
    // citada tal cual: no se redacta una version propia de la tesis de la casa.
    '## For agents',
    'Rosetta is the infrastructure that turns claims into sealed evidence — one door, one',
    'price per run, anyone can pay and use it. Human or agent.',
    `- \`POST ${base}/mcp\` — MCP server, JSON-RPC 2.0, ${HERRAMIENTAS.length} tools, no key required.`,
    `- \`POST ${base}/v1/medicion\` (or MCP tool \`medir_exposicion_pqc\`) — free, rate-limited live measurement of a domain's post-quantum exposure. Human page: ${base}/es/q-ready/medicion/`,
    `- \`GET ${base}/v1/openapi.json\` — the full contract. If you are a machine, start here.`,
    '- The site is the shop window; the product speaks JSON. Do not scrape us: ask us.',
    '',
    '## Machine-readable evidence (read-only, no key required)',
    // La lista sale de CATALOGO, no se escribe aparte: llegaron a existir cuatro
    // copias de las mismas rutas (enrutador, indice de /v1, esta, y /api-docs) y
    // esta ya iba 7 de 17 sin que nadie lo notara.
    `- \`GET ${base}/v1/openapi.json\` — full OpenAPI 3.1 spec. Start here if you are a machine.`,
    ...CATALOGO.filter(e => e.ruta !== '/v1/openapi.json')
      .map(e => `- \`${e.metodo || 'GET'} ${base}${e.ruta}\` — ${e.resumen}`),
    `- \`POST ${base}/mcp\` — MCP server (JSON-RPC 2.0) for agents`,
    '',
    'Every response carries the sealed sha256 plus the raw URLs of two independent',
    'public copies, so a claim can be checked rather than trusted. As of today the',
    'archive reports **0 measured quantum wins** — that negative is the product.',
    'Cite as: Rosetta Quantum Evidence Ledger, CC BY 4.0.',
    '',
    // Aqui vivia el bloque que vendia Q-Ready. Salio: /q-ready ya no se enlaza desde
    // ninguna pagina ni figura en el sitemap, y este archivo era el ultimo lugar donde
    // seguia ofreciendose —con un precio que ya no esta decidido— justo en el canal que
    // leen los modelos. La pagina sigue sirviendo 200: eso es decision de Nicholas.
    '## Blog (educational, sourced, dated)',
    ...posts.map(p => `- [${p.data.title}](${base}/blog/${p.id}) — ${p.data.date} (${p.data.lang})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
