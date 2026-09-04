import { docsSchema } from '@astrojs/starlight/schema';
import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';

export const collections = {
  docs: defineCollection({
    loader: glob({
      base: './src/content/docs',
      pattern: ['**/[^_]*.{md,mdx}', '!index.mdx'],
    }),
    schema: docsSchema(),
  }),
};
