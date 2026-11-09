// The runnable examples under examples/<slug> in this repository.
// Every one is run by scripts/verify-examples.sh, which diffs its
// output against the expected.txt next to it.

export interface ExampleLink { label: string; href: string; }

export interface Example {
  slug: string;
  title: string;
  summary: string;
  /** What it runs on, shown on the index. */
  runs: string;
  /** Source files to show, in reading order (paths in the folder). */
  files: string[];
  useCase?: ExampleLink;
  docs: ExampleLink[];
}

export const REPO_TREE = 'https://github.com/barrel-db/barrel-db.eu/tree/main/examples';

export const examples: Example[] = [
  {
    slug: 'embedded-erlang',
    title: 'Embed barrel in an Erlang app',
    summary: 'Open a database inside your node, write documents, query them with BQL, close cleanly. No server.',
    runs: 'Erlang, embedded',
    files: ['src/embedded_erlang.erl', 'rebar.config', 'config/sys.config', 'run.sh'],
    docs: [
      { label: 'Quickstart: embedded', href: '/docs/start/quickstart-embedded' },
      { label: 'Embed barrel in an Erlang app', href: '/docs/guides/embedding' },
      { label: 'Query with BQL', href: '/docs/guides/query-bql' },
    ],
  },
  {
    slug: 'agent-memory',
    title: 'Agent memory across restarts',
    summary: 'A session with messages, pinned context and working data in a space; facts embedded on write and recalled by search on a second node.',
    runs: 'Erlang, embedded',
    files: ['src/agent_memory.erl', 'src/hash_embed.erl', 'rebar.config', 'config/sys.config', 'run.sh'],
    useCase: { label: 'Memory for agents', href: '/use-cases/agent-memory' },
    docs: [
      { label: 'Spaces, sessions, handoffs', href: '/docs/guides/spaces' },
      { label: 'Record mode', href: '/docs/guides/record-mode' },
      { label: 'Choose an embedding provider', href: '/docs/search/embedding-providers' },
    ],
  },
  {
    slug: 'private-rag',
    title: 'Private knowledge search',
    summary: 'Ingest support articles, search them with keyword and hybrid search, optionally rerank, and build the prompt for your LLM.',
    runs: 'Erlang, embedded',
    files: ['src/private_rag.erl', 'src/hash_embed.erl', 'priv/articles.eterm', 'rebar.config', 'run.sh'],
    useCase: { label: 'Private knowledge search', href: '/use-cases/private-rag' },
    docs: [
      { label: 'Record mode', href: '/docs/guides/record-mode' },
      { label: 'Vector, keyword and hybrid', href: '/docs/search/hybrid' },
      { label: 'Reranking', href: '/docs/search/reranking' },
      { label: 'Choose an embedding provider', href: '/docs/search/embedding-providers' },
    ],
  },
  {
    slug: 'agents-handoff',
    title: 'Share a space between agents',
    summary: 'One space, a read-only token for one agent, and a task handed to another agent, accepted and completed.',
    runs: 'Erlang, embedded',
    files: ['src/agents_handoff.erl', 'rebar.config', 'run.sh'],
    useCase: { label: 'A database per agent', href: '/use-cases/database-per-agent' },
    docs: [
      { label: 'Spaces and capabilities', href: '/docs/concepts/spaces' },
      { label: 'Spaces, sessions, handoffs', href: '/docs/guides/spaces' },
    ],
  },
  {
    slug: 'branch-experiment',
    title: 'Branch, compare, merge, recover',
    summary: 'Change a branch of a database, compare it with the parent, merge it back, then open a branch of a past state.',
    runs: 'Erlang, embedded',
    files: ['src/branch_experiment.erl', 'rebar.config', 'run.sh'],
    useCase: { label: 'A branch per agent run', href: '/use-cases/branch-per-run' },
    docs: [
      { label: 'Branch, merge, recover', href: '/docs/guides/timeline' },
      { label: 'Versions, conflicts, convergence', href: '/docs/concepts/versions' },
    ],
  },
  {
    slug: 'local-first',
    title: 'Local-first with barrel-lite',
    summary: 'Two TypeScript clients with a local copy: offline edits, sync with a barrel_server, and one conflict resolved for everyone.',
    runs: 'TypeScript, Node, a server',
    files: ['main.ts', 'package.json', 'run.sh'],
    useCase: { label: 'Offline-first apps', href: '/use-cases/offline-first' },
    docs: [
      { label: 'Quickstart: browser', href: '/docs/start/quickstart-browser' },
      { label: 'barrel-lite', href: '/docs/guides/barrel-lite' },
      { label: 'Conflicts', href: '/docs/replicate/conflicts' },
    ],
  },
  {
    slug: 'contexts-bql',
    title: 'Query two databases as contexts',
    summary: 'Register databases as contexts and run one BQL statement over them, with sources, coverage and a partial answer when one is down.',
    runs: 'Erlang, embedded',
    files: ['src/contexts_bql.erl', 'rebar.config', 'run.sh'],
    docs: [
      { label: 'Contexts and working sets', href: '/docs/concepts/contexts' },
      { label: 'Query several datasets', href: '/docs/guides/contexts' },
    ],
  },
  {
    slug: 'mcp-session',
    title: 'An MCP session with curl',
    summary: 'The raw JSON-RPC an agent sends to barrel_server: initialize, list the tools, write, read, query and search.',
    runs: 'Shell, a server',
    files: ['run.sh'],
    useCase: { label: 'A database per agent', href: '/use-cases/database-per-agent' },
    docs: [
      { label: 'MCP endpoint', href: '/docs/guides/mcp' },
      { label: 'MCP tools', href: '/docs/reference/mcp-tools' },
      { label: 'Quickstart: server', href: '/docs/start/quickstart-server' },
    ],
  },
];
