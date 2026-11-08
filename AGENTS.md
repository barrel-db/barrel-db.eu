# Working on barrel-db.eu

These rules apply to anyone changing the site, people and coding agents alike.

## The site is in English and French

Every page exists in both languages. English is the source; French files say which
English file they translate and the hash of the version they were made from.

When you change reader-facing English text, update the French in the same pull request:

1. Change the English file.
2. Run `npm run i18n` to list what is now out of date.
3. For each listed French file, see what changed with
   `node scripts/i18n.mjs diff <french file>`, update the translation, then record it:
   `npm run i18n:stamp <french file>`.
4. A new English page needs a new French file next to its counterpart
   (`src/pages/x.astro` -> `src/pages/fr/x.astro`, `src/content/docs/x.md` ->
   `src/content/fr/docs/x.md`, `examples/x/README.md` -> `examples/x/README.fr.md`),
   then a stamp.

CI runs `npm run i18n` and fails while any French file is missing or older than its
English source. Never stamp a file you did not update: the stamp says "this translation
matches the current English".

Guides synced from the barrel repository (`src/content/synced`) are hashed on their
upstream file. When a guide changes upstream, CI fails here until
`src/content/fr/synced/<same path>` is updated and stamped.

Components in `src/components` hold both languages side by side (strings keyed by
`lang`). If you change a visible string in a component, change both languages there.

## French style

- Address the reader as "vous". Same task-first structure as the English page.
- Typography: non-breaking space (U+00A0) before `:` `;` `?` `!` and inside « »;
  apostrophe ’. Never use the em dash "—" (CI rejects it) in either language.
- Keep code, function names, routes, tool names, options and outputs exactly as in the
  English page. Comments inside documentation snippets may be translated; files under
  `examples/` are tested and stay as they are.
- Keep English terms that French developers use (embedding, token, endpoint is
  "point d’accès"), and explain a term once where it first appears.

## Content rules

- Source code and passing tests are the authority. Never invent an API, an option, a
  route, a tool name or an output. Show output only from a real run, and say so.
- Mark optional and planned features with the status marks; state limits plainly.
- No em dash, never the word "comprehensive", no hype.
- Docs: second person, one opening paragraph saying what the page is and when you need
  it, then steps.

## Checks before a pull request

```bash
npm run check          # types and templates
npm run i18n           # translations up to date
BARREL_DIR=../barrel npm run build:site && npm run check:site
npm test               # demo logic
npm run verify:examples   # when you touch examples/
```

## Git

Stage explicit paths. Never `git add -A`: the working tree can hold files that are not
part of the site.
