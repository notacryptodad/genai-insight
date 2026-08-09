import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const notes = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/notes' }),
  schema: z.object({
    title: z.string().optional(),
    date: z.string().optional(),
    source: z.string().optional(),
    url: z.string().optional(),
    tags: z.array(z.string()).optional(),
    ogImage: z.string().optional(),
  }),
});

export const collections = { notes };
