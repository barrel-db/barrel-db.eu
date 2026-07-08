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
      { label: "Facade API", slug: "reference/facade-api" },
      { label: "BQL reference", slug: "reference/bql" },
      { label: "Configuration", slug: "reference/configuration" },
      { label: "Libraries", slug: "reference/libraries" },
    ],
  },
];

// Flattened order for prev/next navigation.
export const docsOrder: DocItem[] = docsNav.flatMap((s) => s.items);
