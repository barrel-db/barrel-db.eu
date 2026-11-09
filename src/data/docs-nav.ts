// The docs sidebar, organized by what the reader wants to do.
// `slug` is the URL under /docs/. Pages come from src/content/docs (written for the
// site) or src/content/synced (copied from the barrel repository); scripts/check-nav.mjs
// fails the build when a slug has no page.

export interface NavItem { label: string; slug: string; }
export interface NavSection { title: string; items: NavItem[]; }

export const docsNav: NavSection[] = [
  { title: 'Get started', items: [
    { label: 'Overview for developers', slug: 'start/what-is-barrel' },
    { label: 'Install', slug: 'start/install' },
    { label: 'Quickstart: embedded', slug: 'start/quickstart-embedded' },
    { label: 'Quickstart: server', slug: 'start/quickstart-server' },
    { label: 'Quickstart: browser', slug: 'start/quickstart-browser' },
    { label: 'Choose a deployment', slug: 'start/choose-deployment' },
  ] },
  { title: 'Concepts', items: [
    { label: 'The record', slug: 'concepts/record' },
    { label: 'Versions, conflicts, convergence', slug: 'concepts/versions' },
    { label: 'Spaces and capabilities', slug: 'concepts/spaces' },
    { label: 'Contexts and working sets', slug: 'concepts/contexts' },
    { label: 'Glossary', slug: 'concepts/glossary' },
  ] },
  { title: 'Store and query', items: [
    { label: 'Embed barrel in an Erlang app', slug: 'guides/embedding' },
    { label: 'Record mode', slug: 'guides/record-mode' },
    { label: 'Query with BQL', slug: 'guides/query-bql' },
    { label: 'Attachments', slug: 'store/attachments' },
  ] },
  { title: 'Search', items: [
    { label: 'Vector, keyword and hybrid', slug: 'search/hybrid' },
    { label: 'Substring and regex', slug: 'search/substring-regex' },
    { label: 'Reranking', slug: 'search/reranking' },
    { label: 'Choose an embedding provider', slug: 'search/embedding-providers' },
  ] },
  { title: 'Replicate', items: [
    { label: 'Synchronization', slug: 'guides/synchronization' },
    { label: 'Conflicts', slug: 'replicate/conflicts' },
    { label: 'Upgrade from 2.0', slug: 'replicate/upgrade-from-2-0' },
  ] },
  { title: 'Agents', items: [
    { label: 'Spaces, sessions, handoffs', slug: 'guides/spaces' },
    { label: 'MCP endpoint', slug: 'guides/mcp' },
    { label: 'Audit and provenance', slug: 'guides/audit-provenance' },
    { label: 'Index a codebase', slug: 'guides/code-indexing' },
  ] },
  { title: 'Timeline', items: [
    { label: 'Branch, merge, recover', slug: 'guides/timeline' },
  ] },
  { title: 'Contexts', items: [
    { label: 'Query several datasets', slug: 'guides/contexts' },
  ] },
  { title: 'Browser', items: [
    { label: 'barrel-lite', slug: 'guides/barrel-lite' },
  ] },
  { title: 'Security', items: [
    { label: 'Encryption at rest', slug: 'guides/encryption' },
    { label: 'Authentication', slug: 'security/authentication' },
  ] },
  { title: 'Operate', items: [
    { label: 'Run the server', slug: 'guides/rest-server' },
    { label: 'Embed the server in an app', slug: 'guides/embedding-barrel-server' },
    { label: 'Monitoring', slug: 'operate/monitoring' },
    { label: 'Troubleshooting', slug: 'operate/troubleshooting' },
    { label: 'Backups and recovery', slug: 'operate/backups' },
  ] },
  { title: 'Reference', items: [
    { label: 'Barrel API', slug: 'reference/barrel-api' },
    { label: 'BQL', slug: 'reference/bql' },
    { label: 'REST API', slug: 'reference/rest-api' },
    { label: 'MCP tools', slug: 'reference/mcp-tools' },
    { label: 'Configuration', slug: 'reference/configuration' },
    { label: 'Error codes', slug: 'reference/errors' },
    { label: 'Libraries', slug: 'reference/libraries' },
  ] },
  { title: 'Architecture', items: [
    { label: 'Overview', slug: 'architecture/overview' },
    { label: 'Feature status', slug: 'features' },
    { label: 'Replication proofs', slug: 'architecture/replication-proofs' },
    { label: 'Contexts design', slug: 'architecture/contexts' },
    { label: 'Vision', slug: 'architecture/vision' },
  ] },
  { title: 'Contribute', items: [
    { label: 'Build and test', slug: 'contribute/build-and-test' },
    { label: 'End-to-end tests', slug: 'contribute/end-to-end-tests' },
    { label: 'Write a provider', slug: 'contribute/write-a-provider' },
    { label: 'Distribute the apps', slug: 'guides/distributing-apps' },
  ] },
];

export const docsOrder: NavItem[] = docsNav.flatMap((s) => s.items);

export function sectionOf(slug: string): NavSection | undefined {
  return docsNav.find((s) => s.items.some((i) => i.slug === slug));
}
