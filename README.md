# barrel-db.eu

Marketing website for Barrel DB open source databases.

## Overview

- **Website**: https://barrel-db.eu (Astro + Tailwind CSS)
- **Documentation**: https://docs.barrel-db.eu (MkDocs Material)

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

## Documentation Setup

Documentation is hosted at `docs.barrel-db.eu` with three MkDocs sites:

| Path | Project | Source |
|------|---------|--------|
| `/vectordb/` | barrel_vectordb | `../barrel_vectordb/docs/` |
| `/docdb/` | barrel_docdb | `../barrel_docdb/docs/` |
| `/embed/` | barrel_embed | `../barrel_embed/docs/` |

### Prerequisites

```bash
pip install mkdocs-material
```

### Building Documentation

Each project has its own `mkdocs.yml`:

```bash
# Build barrel_vectordb docs
cd ../barrel_vectordb
mkdocs build --site-dir ../barrel-db.eu/docs-dist/vectordb

# Build barrel_docdb docs
cd ../barrel_docdb
mkdocs build --site-dir ../barrel-db.eu/docs-dist/docdb

# Build barrel_embed docs
cd ../barrel_embed
mkdocs build --site-dir ../barrel-db.eu/docs-dist/embed
```

Or use the build script:

```bash
./scripts/build-docs.sh
```

### Docs Deployment

Deploy `docs-dist/` to docs.barrel-db.eu. Example nginx config:

```nginx
server {
    server_name docs.barrel-db.eu;
    root /var/www/docs.barrel-db.eu;

    location /vectordb/ {
        try_files $uri $uri/ /vectordb/index.html;
    }

    location /docdb/ {
        try_files $uri $uri/ /docdb/index.html;
    }

    location /embed/ {
        try_files $uri $uri/ /embed/index.html;
    }

    location = / {
        return 302 /vectordb/;
    }
}
```

## Related Repositories

| Repository | Description |
|------------|-------------|
| [barrel_vectordb](https://github.com/barrel-db/barrel_vectordb) | Vector database |
| [barrel_docdb](https://github.com/barrel-db/barrel_docdb) | Document database |
| [barrel_embed](https://github.com/barrel-db/barrel_embed) | Embedding library |

## Branches

| Branch | Description |
|--------|-------------|
| `main` | Production - pure OSS site |
| `with-platform-links` | Includes Barrel Platform CTAs and links (for when barrel-platform.eu is ready) |

## License

Website content: MIT
Barrel DB projects: Apache 2.0
