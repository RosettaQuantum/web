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
    '## Blog (educational, sourced, dated)',
    ...posts.map(p => `- [${p.data.title}](${base}/blog/${p.id}) — ${p.data.date} (${p.data.lang})`),
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
};
