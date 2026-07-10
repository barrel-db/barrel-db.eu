// Single source of truth for the docs sidebar and prev/next ordering.
// Each `slug` matches a Markdown entry id under src/content/docs/.

export interface DocItem {
  label: string;
  slug: string;
}

export interface DocSection {
  title: string;
  items: DocItem[];
}

export const docsNav: DocSection[] = [
  {
    title: "Get started",
    items: [
      { label: "Introduction", slug: "get-started/introduction" },
      { label: "Installation", slug: "get-started/installation" },
      { label: "Quickstart", slug: "get-started/quickstart" },
    ],
  },
  {
    title: "Concepts",
    items: [
      { label: "Data model", slug: "concepts/data-model" },
      { label: "Version vectors", slug: "concepts/version-vectors" },
      { label: "The agent layer", slug: "concepts/agent-layer" },
    ],
  },
  {
    title: "Guides",
    items: [
      { label: "Embedding Barrel", slug: "guides/embedding" },
      { label: "Record mode", slug: "guides/record-mode" },
      { label: "Querying with BQL", slug: "guides/query-bql" },
      { label: "Synchronization", slug: "guides/synchronization" },
      { label: "Timeline", slug: "guides/timeline" },
      { label: "Encryption", slug: "guides/encryption" },
      { label: "Audit & provenance", slug: "guides/audit-provenance" },
      { label: "Browser client", slug: "guides/barrel-lite" },
    ],
  },
  {
    title: "Server",
    items: [
      { label: "Running the server", slug: "server/rest-server" },
      { label: "Spaces & agents", slug: "server/spaces" },
      { label: "MCP endpoint", slug: "server/mcp" },
    ],
  },
  {
    title: "Reference",
    items: [
      { label: "Barrel API", slug: "reference/barrel-api" },
      { label: "BQL reference", slug: "reference/bql" },
      { label: "REST API", slug: "reference/rest-api" },
      { label: "Configuration", slug: "reference/configuration" },
      { label: "Libraries", slug: "reference/libraries" },
    ],
  },
];

// Flattened order for prev/next navigation.
export const docsOrder: DocItem[] = docsNav.flatMap((s) => s.items);

// French labels, derived from the same slug structure so the two navs never
// drift. A slug without a French label falls back to its English one.
const frSectionTitle: Record<string, string> = {
  "Get started": "Demarrer",
  "Concepts": "Concepts",
  "Guides": "Guides",
  "Server": "Serveur",
  "Reference": "Reference",
};
const frLabel: Record<string, string> = {
  "get-started/introduction": "Introduction",
  "get-started/installation": "Installation",
  "get-started/quickstart": "Demarrage rapide",
  "concepts/data-model": "Modele de donnees",
  "concepts/version-vectors": "Vecteurs de version",
  "concepts/agent-layer": "La couche agent",
  "guides/embedding": "Integrer Barrel",
  "guides/record-mode": "Mode enregistrement",
  "guides/query-bql": "Requetes avec BQL",
  "guides/synchronization": "Synchronisation",
  "guides/timeline": "Timeline",
  "guides/encryption": "Chiffrement",
  "guides/audit-provenance": "Audit et provenance",
  "guides/barrel-lite": "Client navigateur",
  "server/rest-server": "Lancer le serveur",
  "server/spaces": "Espaces et agents",
  "server/mcp": "Point de terminaison MCP",
  "reference/barrel-api": "API Barrel",
  "reference/bql": "Reference BQL",
  "reference/rest-api": "API REST (OpenAPI)",
  "reference/configuration": "Configuration",
  "reference/libraries": "Bibliotheques",
};

export const docsNavFr: DocSection[] = docsNav.map((s) => ({
  title: frSectionTitle[s.title] ?? s.title,
  items: s.items.map((i) => ({ slug: i.slug, label: frLabel[i.slug] ?? i.label })),
}));

export const docsOrderFr: DocItem[] = docsNavFr.flatMap((s) => s.items);
