// Single source for navigation, capabilities, components and use cases.
// Versions come from each app's .app.src in the barrel umbrella; scripts/check-data.mjs
// compares them against BARREL_DIR so a release cannot leave them stale.

export type Status = 'today' | 'optional' | 'planned';

export interface Capability {
  slug: string;
  name: string;
  body: string;
}

export interface Component {
  slug: string;        // URL under /product/
  name: string;        // app name as published
  group: string;
  version: string;
  status: Status;
  body: string;
  app: string;         // path in the umbrella
}

export interface UseCase {
  slug: string;
  name: string;
  short: string;
}

export const GITHUB = 'https://github.com/barrel-db/barrel';
export const SITE_REPO = 'https://github.com/barrel-db/barrel-db.eu';

export const capabilities: Capability[] = [
  { slug: 'replication', name: 'Replication', body: 'Active-active: every copy takes writes and converges' },
  { slug: 'search', name: 'Search', body: 'Vector, keyword, hybrid and regex, in one query language' },
  { slug: 'timeline', name: 'Timeline', body: 'Branch a database, merge it back, recover a past state' },
  { slug: 'agents', name: 'Agent layer', body: 'Spaces, capability tokens, sessions, handoffs, MCP' },
  { slug: 'security', name: 'Security', body: 'Encryption at rest, tokens, signed requests, mTLS' },
  { slug: 'deployments', name: 'Deployments', body: 'Embedded, server or browser, and how to choose' },
];

export const components: Component[] = [
  { slug: 'barrel', name: 'barrel', group: 'The database', version: '1.13.0', status: 'today', body: 'Records: document, files and vector under one id', app: 'apps/barrel' },
  { slug: 'docdb', name: 'barrel_docdb', group: 'Data', version: '2.4.0', status: 'today', body: 'Documents, versions, queries, replication', app: 'apps/barrel_docdb' },
  { slug: 'vectordb', name: 'barrel_vectordb', group: 'Data', version: '2.5.3', status: 'today', body: 'Vector index, BM25, hybrid search', app: 'apps/barrel_vectordb' },
  { slug: 'ngram', name: 'barrel_ngram', group: 'Data', version: '0.11.4', status: 'today', body: 'Substring and regex search', app: 'apps/barrel_ngram' },
  { slug: 'embed', name: 'barrel_embed', group: 'Models', version: '2.6.1', status: 'today', body: 'Embedding providers, local or cloud', app: 'apps/barrel_embed' },
  { slug: 'rerank', name: 'barrel_rerank', group: 'Models', version: '1.0.3', status: 'optional', body: 'Rerank search results', app: 'apps/barrel_rerank' },
  { slug: 'spaces', name: 'barrel_spaces', group: 'Agents', version: '1.3.1', status: 'today', body: 'Spaces, tokens, sessions, handoffs', app: 'apps/barrel_spaces' },
  { slug: 'server', name: 'barrel_server', group: 'Access', version: '1.14.1', status: 'today', body: 'REST and MCP over HTTP', app: 'apps/barrel_server' },
  { slug: 'lite', name: 'barrel-lite', group: 'Access', version: '0.1.0', status: 'today', body: 'A copy in the browser, synced', app: 'clients/barrel-lite' },
  { slug: 'crypto', name: 'barrel_crypto', group: 'Storage and security', version: '1.0.0', status: 'today', body: 'Encryption keys and ciphers', app: 'apps/barrel_crypto' },
  { slug: 'att-s3', name: 'barrel_att_s3', group: 'Storage and security', version: '0.2.1', status: 'optional', body: 'Attachments in S3-compatible storage', app: 'apps/barrel_att_s3' },
  { slug: 'faiss', name: 'barrel_faiss', group: 'Storage and security', version: '1.0.1', status: 'optional', body: 'FAISS index backend', app: 'apps/barrel_faiss' },
];

export const componentGroups = ['The database', 'Data', 'Models', 'Agents', 'Access', 'Storage and security'];

export const useCases: UseCase[] = [
  { slug: 'database-per-agent', name: 'A database per agent', short: 'Isolated, shared by token' },
  { slug: 'write-on-every-node', name: 'Write on every node', short: 'Active-active sites and devices' },
  { slug: 'database-per-customer', name: 'A database per customer', short: 'One key per tenant' },
  { slug: 'agent-memory', name: 'Memory for agents', short: 'Sessions, pins, recall' },
  { slug: 'private-rag', name: 'Private knowledge search', short: 'RAG on your own machines' },
  { slug: 'code-search', name: 'Code search for coding agents', short: 'Exact, regex and fuzzy' },
  { slug: 'branch-per-run', name: 'A branch per agent run', short: 'Try, review, merge' },
  { slug: 'offline-first', name: 'Offline-first apps', short: 'A copy in the browser' },
];

export const mainNav = [
  { label: 'What is Barrel?', href: '/what-is-barrel' },
  { label: 'Use cases', href: '/use-cases' },
  { label: 'Replication', href: '/product/replication' },
  { label: 'Docs', href: '/docs' },
  { label: 'Examples', href: '/examples' },
];

export const statusLabel: Record<Status, string> = {
  today: 'Works today',
  optional: 'Optional, needs setup',
  planned: 'Planned',
};
