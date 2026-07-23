import rss from '@astrojs/rss';
import { getCollection } from 'astro:content';

export async function GET(context) {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  return rss({
    title: 'Rosetta Quantum — Blog',
    description: "What is real in quantum, by problem class, with sources.",
    site: context.site,
    items: posts.map(p => ({
      title: p.data.title,
      description: p.data.tldr,
      pubDate: new Date(p.data.date),
      link: `/blog/${p.id}`,
    })),
  });
}
