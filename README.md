# barrel-db.eu

Marketing website for Barrel DB open source databases.

## Overview

- **Website and documentation**: https://barrel-db.eu (Astro + Tailwind CSS)

The Barrel guides live at `/docs`, written as Astro content collections. The
per-library API reference lives at `/docs/lib/<name>/`, generated with
`rebar3 ex_doc` from the umbrella. One site, one deploy.

## Website Setup

### Prerequisites

- Node.js 18+
- npm

### Development

```bash
# Install dependencies
npm install

# Start dev server (http://localhost:4321)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Structure

```
src/
├── layouts/
│   ├── Layout.astro      # English layout
│   └── LayoutFr.astro    # French layout
├── pages/
│   ├── index.astro       # Homepage
│   ├── pricing.astro     # Open source page
│   ├── contact.astro     # Contact page
│   ├── opensource.astro  # OSS projects page
│   └── fr/               # French translations
│       ├── index.astro
│       ├── pricing.astro
│       ├── contact.astro
│       └── opensource.astro
├── styles/
│   └── global.css        # Tailwind + custom styles
└── products/
    ├── vectordb.astro    # Barrel Vector page
    └── docdb.astro       # Barrel Docs page
```

### Deployment

Build and deploy the `dist/` folder to any static hosting (Caddy, nginx, Cloudflare Pages, etc.).

```bash
npm run build
# Deploy ./dist/
```

## Library reference

The per-library reference is ex_doc output for each app of the
[barrel umbrella](https://github.com/barrel-db/barrel): the guides each app
ships, plus an API reference generated from its modules, so it cannot drift from
the source.

| Path | Umbrella app |
|------|--------------|
| `/docs/lib/barrel/` | `apps/barrel` |
| `/docs/lib/docdb/` | `apps/barrel_docdb` |
| `/docs/lib/vectordb/` | `apps/barrel_vectordb` |
| `/docs/lib/embed/` | `apps/barrel_embed` |
| `/docs/lib/server/` | `apps/barrel_server` |
| `/docs/lib/spaces/` | `apps/barrel_spaces` |
| `/docs/lib/rerank/` | `apps/barrel_rerank` |
| `/docs/lib/crypto/` | `apps/barrel_crypto` |

`barrel_faiss` is not built here: it links against a system FAISS build. Its
reference ships on [HexDocs](https://hexdocs.pm/barrel_faiss).

### Prerequisites

Erlang/OTP with `rebar3` on your `PATH`, plus CMake (`barrel_vectordb` builds a
NIF). Point `BARREL_DIR` at your umbrella checkout; it defaults to `../barrel`.

### Building

`npm run build` generates the reference before building the site, so you rarely
need to run it directly:

```bash
BARREL_DIR=../barrel npm run build
```

To regenerate only the reference, into `public/docs/lib/`:

```bash
BARREL_DIR=../barrel npm run build:docs
```

The output is gitignored. `astro dev` serves `public/` but does not resolve a
directory to its `index.html`, so `/docs/lib/barrel/` 404s under `npm run dev`
while `/docs/lib/barrel/readme.html` works. Use `npm run preview` to exercise
the real URLs.

## Related Repositories

| Repository | Description |
|------------|-------------|
| [barrel](https://github.com/barrel-db/barrel) | The Barrel umbrella: every library, one repository |

## Branches

| Branch | Description |
|--------|-------------|
| `main` | Production - pure OSS site |
| `with-platform-links` | Includes Barrel Platform CTAs and links (for when barrel-platform.eu is ready) |

## License

Website content: MIT
Barrel DB projects: Apache 2.0
