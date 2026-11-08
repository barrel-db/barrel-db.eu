// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';

// The ex_doc library reference is generated into public/docs/lib/ and served as
// static files. Vite's dev server does not resolve a directory to its
// index.html, so /docs/lib/vectordb/ 404s under `astro dev` even though the file
// is there. Static hosts and `astro preview` do resolve it. Close the gap so the
// same URLs work in every mode.
/** @returns {any} */
function devDirectoryIndex() {
  return {
    name: 'dev-directory-index',
    apply: 'serve',
    /** @param {any} server */
    configureServer(server) {
      server.middlewares.use((/** @type {any} */ req, /** @type {any} */ _res, /** @type {any} */ next) => {
        if (req.url) {
          const [path, query] = req.url.split('?');
          if (path.startsWith('/docs/lib/') && path.endsWith('/')) {
            req.url = `${path}index.html${query ? `?${query}` : ''}`;
          }
        }
        next();
      });
    },
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://barrel-db.eu',
  // Tailwind is only used by the legacy French pages under src/legacy; the new site
  // uses plain CSS from src/styles/site.css.
  integrations: [mdx(), sitemap({ filter: (p) => !p.includes('/fr/') })],
  markdown: {
    // Keep text as written: smart dashes turn "--" in prose and flags into em dashes.
    smartypants: false,
    // Highlight for both themes at build time. defaultColor: false emits
    // --shiki-light and --shiki-dark custom properties instead of baking one
    // palette in, and site.css picks between them from data-theme.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
  vite: {
    plugins: /** @type {any} */ ([tailwindcss(), devDirectoryIndex()])
  }
});
