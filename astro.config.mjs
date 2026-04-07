// @ts-check
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://alptugdilek.com',
  markdown: {
    shikiConfig: {
      theme: 'github-light',
    },
  },
});
