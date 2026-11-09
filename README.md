# barrel-db.eu

The Barrel website: product pages, use cases, examples and documentation, in
one Astro site deployed as static files.

## Run it

You need Node.js 20 or later, and for a full build Erlang/OTP with `rebar3`
and CMake (the library reference is built with ex_doc from the umbrella).
Keep a checkout of [barrel](https://github.com/barrel-db/barrel) next to this
one, or point `BARREL_DIR` at it.

```bash
npm ci
npm run sync          # copy the guides from ../barrel into src/content/synced
npm run dev           # http://localhost:4321
```

Search (Cmd-K) uses the Pagefind index, which only exists after a build:

```bash
npm run build:site    # guides + astro build + search index, no ex_doc
npm run preview
```

`npm run build` does the same plus the ex_doc reference under `/docs/lib/`.

## Check it

```bash
npm run check         # astro check: types and templates
npm run check:site    # after a build: pages in both languages, versions, links, house style
npm run i18n          # every French file matches its current English source
npm run verify:examples   # run every example against ../barrel
```

CI (`.github/workflows/docs.yml`) runs all three on every pull request.

## Where content lives

| Content | Where | Notes |
|---|---|---|
| Guides, architecture notes, feature status | barrel repo `docs/` | Copied at build time by `scripts/sync-guides.mjs` into `src/content/synced/` (gitignored). Fix them upstream. |
| Pages written for the site | `src/content/docs/` | Markdown or MDX; frontmatter `title`, `description`, optional `status`. |
| Docs sidebar | `src/data/docs-nav.ts` | Organized by task. `check:site` fails if an entry has no page. |
| Libraries, versions, capabilities, use cases | `src/data/site.ts`, `src/data/use-cases.ts` | `check:site` compares versions with the umbrella. |
| Examples | `examples/<slug>/` | Runnable projects with `expected.txt`; their pages import the files, so the site shows the tested code. |
| MCP tool reference | `src/data/mcp-tools.json` | Regenerate with `scripts/update-mcp-tools.mjs` against a running server. |
| Library API reference | ex_doc output in `public/docs/lib/` | Built by `scripts/build-docs.sh`. |
| French | `src/pages/fr`, `src/content/fr`, `src/data/fr`, `examples/*/README.fr.md` | Each file names its English source and hash; `npm run i18n` checks they match. See AGENTS.md. |

Agents and tools can read every docs page as Markdown at `/docs/<page>.md`,
and the whole set through `/llms.txt` and `/llms-full.txt`.

## Style

- Design tokens and shared styles: `src/styles/site.css`. Components in
  `src/components/`, layouts in `src/layouts/`.
- Writing: second person, task first, one opening paragraph saying what the
  page is and when you need it. No em dashes. Show output only from real runs.
  Mark optional and planned features with the status marks.

## Deploy

`npm run build` writes a static site to `dist/`. Serve it from any static host
(Caddy, nginx, Cloudflare Pages). Directory URLs resolve to `index.html`;
`404.html` is the not-found page.

## License

Website content: MIT. Barrel: Apache 2.0.
