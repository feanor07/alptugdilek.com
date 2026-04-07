// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://alptugdilek.com',
  markdown: {
    shikiConfig: {
      themes: {
        light: 'github-light',
        dark: 'github-dark',
      },
    },
  },
});
