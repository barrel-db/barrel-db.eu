// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';

// The ex_doc library reference is generated into public/docs/lib/ and served as
// static files. Vite's dev server does not resolve a directory to its
// index.html, so /docs/lib/vectordb/ 404s under `astro dev` even though the file
// is there. Static hosts and `astro preview` do resolve it. Close the gap so the
// same URLs work in every mode.
function devDirectoryIndex() {
  return {
    name: 'dev-directory-index',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
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
  markdown: {
    // Highlight for both themes at build time. defaultColor: false emits
    // --shiki-light and --shiki-dark custom properties instead of baking one
    // palette in, and global.css picks between them from data-theme.
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      defaultColor: false,
      wrap: false,
    },
  },
  vite: {
    plugins: [tailwindcss(), devDirectoryIndex()]
  }
});
