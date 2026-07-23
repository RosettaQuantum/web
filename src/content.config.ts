import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    tldr: z.string(),
    date: z.string(),
    pillar: z.enum(['A','B','C','D','E','F']),
    lang: z.enum(['en','es']).default('en'),
    slugBase: z.string(),
    sources: z.array(z.object({ label: z.string(), url: z.string().optional() })).default([]),
    draft: z.boolean().default(false),
  }),
});
export const collections = { blog };
