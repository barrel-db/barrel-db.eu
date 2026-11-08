// The eight use cases: shown on the home page and as /use-cases/<slug>.
// Code is real API; each use case links to a runnable example or guide.

export interface FlowNode { label: string; edge: string; record: boolean; }
export interface UseCaseDetail {
  slug: string; name: string; short: string;
  problem: string; solution: string;
  flow: FlowNode[];
  code: string; lang: string;
  example: string; uses: string;
}

export const useCaseDetails: UseCaseDetail[] = [
  {
    "slug": "database-per-agent",
    "name": "A database per agent",
    "short": "Isolated, shared by token",
    "problem": "Agents that share one database see and overwrite each other’s work, and you cannot cut one agent off without the others.",
    "solution": "Each agent gets a space: its own database and a token that says what it may read or write. Revoke the token and the agent is out.",
    "flow": [
      {
        "label": "Planner",
        "edge": "grants a token",
        "record": false
      },
      {
        "label": "Space sp_research",
        "edge": "token over MCP",
        "record": true
      },
      {
        "label": "Research agent",
        "edge": "",
        "record": false
      }
    ],
    "code": "{ok, #{id := Sp}} = barrel_spaces:create_space(\n    #{label => <<\"research\">>, owner => <<\"planner\">>}),\n{ok, Token, _} = barrel_caps:grant(Sp,\n    #{rights => [read, write], subject => <<\"researcher\">>}),\n\n%% the agent sends Token as a bearer token to /mcp\nok = barrel_caps:revoke(Token).",
    "lang": "erlang",
    "example": "Example C: two agents and a handoff",
    "uses": "barrel_spaces, barrel_server"
  },
  {
    "slug": "write-on-every-node",
    "name": "Write on every node",
    "short": "Active-active sites and devices",
    "problem": "Sites, devices and regions each need their data locally, plus a central copy, over links that come and go.",
    "solution": "Embed Barrel on each node and run a continuous replication task to the hub. Filters and channels decide what goes where.",
    "flow": [
      {
        "label": "Edge node",
        "edge": "continuous push",
        "record": true
      },
      {
        "label": "Hub barrel_server",
        "edge": "pull to others",
        "record": false
      },
      {
        "label": "Other nodes",
        "edge": "",
        "record": false
      }
    ],
    "code": "{ok, TaskId} = barrel_rep_tasks:start_task(#{\n    source    => <<\"inventory\">>,\n    target    => <<\"http://hub.example:8080/db/inventory\">>,\n    mode      => continuous,\n    direction => push,\n    filter    => #{channel => <<\"mobile\">>}}).",
    "lang": "erlang",
    "example": "Guide: synchronization",
    "uses": "barrel_docdb, barrel_server"
  },
  {
    "slug": "database-per-customer",
    "name": "A database per customer",
    "short": "One key per tenant",
    "problem": "Customer data mixed in shared tables needs a filter on every query, and deleting a customer means hunting rows.",
    "solution": "One space per customer, encrypted under its own key. Offboarding drops the space and revokes every token issued for it.",
    "flow": [
      {
        "label": "Your SaaS backend",
        "edge": "one per customer",
        "record": false
      },
      {
        "label": "Space sp_acme",
        "edge": "own key",
        "record": true
      },
      {
        "label": "Key provider",
        "edge": "",
        "record": false
      }
    ],
    "code": "{ok, #{id := Acme}} = barrel_spaces:create_space(#{\n    label      => <<\"acme\">>,\n    encryption => #{provider => tenant_keys}}),\n\n%% offboarding: the data and every grant go\nok = barrel_spaces:drop_space(Acme).",
    "lang": "erlang",
    "example": "Encryption at rest guide",
    "uses": "barrel_spaces, barrel_crypto"
  },
  {
    "slug": "agent-memory",
    "name": "Memory for agents",
    "short": "Sessions, pins, recall",
    "problem": "An agent forgets between turns unless you keep the conversation, its notes and what matters, and can find them again later.",
    "solution": "Sessions hold messages and scratch data with a sliding expiry, pinned notes stay in front, and record mode makes stored documents searchable by meaning.",
    "flow": [
      {
        "label": "Support agent",
        "edge": "each turn",
        "record": false
      },
      {
        "label": "Session in a space",
        "edge": "expires after ttl",
        "record": true
      },
      {
        "label": "Searchable documents",
        "edge": "",
        "record": false
      }
    ],
    "code": "{ok, Sid} = barrel_session:create(Space,\n    #{agent => <<\"support\">>, ttl => 3600}),\n{ok, _} = barrel_session:add_message(Space, Sid,\n    #{role => <<\"user\">>, content => <<\"I am locked out\">>}),\n{ok, _} = barrel_session:pin_context(Space, Sid,\n    #{content => <<\"enterprise plan\">>, priority => 0}),\n{ok, Recent} = barrel_session:get_messages(Space, Sid,\n    #{limit => 20}).",
    "lang": "erlang",
    "example": "Example A: persistent agent memory",
    "uses": "barrel_spaces, barrel"
  },
  {
    "slug": "private-rag",
    "name": "Private knowledge search",
    "short": "RAG on your own machines",
    "problem": "Retrieval usually means a document store, a vector database and an embedding service kept in step, with your data leaving your network.",
    "solution": "Write documents. Barrel embeds them with a local model, searches by meaning and keyword together, and can rerank the top hits. You hand the hits to your model.",
    "flow": [
      {
        "label": "Documents",
        "edge": "embedded on write",
        "record": false
      },
      {
        "label": "barrel, record mode",
        "edge": "hybrid search",
        "record": true
      },
      {
        "label": "Reranker",
        "edge": "top hits",
        "record": false
      },
      {
        "label": "Your LLM call",
        "edge": "",
        "record": false
      }
    ],
    "code": "{ok, Db} = barrel:open(kb, #{embedding => #{\n    fields   => [<<\"title\">>, <<\"body\">>],\n    embedder => {local, #{}}}}),\n{ok, Hits} = barrel:search_hybrid(Db,\n    <<\"customer cannot log in\">>, #{k => 20}),\n%% optional: barrel_rerank:rerank(Pid, Query, Texts)\n%% then pass the best hits to your model",
    "lang": "erlang",
    "example": "Example B: private RAG",
    "uses": "barrel, barrel_embed, barrel_rerank"
  },
  {
    "slug": "code-search",
    "name": "Code search for coding agents",
    "short": "Exact, regex and fuzzy",
    "problem": "A coding agent needs exact matches (an error code, a symbol, a pattern) as much as answers by meaning.",
    "solution": "A trigram index answers substring and regex queries over the fields you pick; hybrid search answers by meaning. Both are MCP tools.",
    "flow": [
      {
        "label": "Coding agent",
        "edge": "ngram_search, search",
        "record": false
      },
      {
        "label": "barrel_server",
        "edge": "MCP",
        "record": false
      },
      {
        "label": "Code chunks",
        "edge": "trigram index",
        "record": true
      }
    ],
    "code": "ok = barrel_ngram:open(<<\"src_idx\">>,\n    #{db => <<\"code\">>, fields => [<<\"text\">>]}),\nbarrel_ngram:search(<<\"src_idx\">>, <<\"ERR_CONN_TIMEOUT\">>),\nbarrel_ngram:regex(<<\"src_idx\">>, <<\"\\\\w+_timeout\">>).",
    "lang": "erlang",
    "example": "Guide: index a codebase for an agent",
    "uses": "barrel_ngram, barrel_server"
  },
  {
    "slug": "branch-per-run",
    "name": "A branch per agent run",
    "short": "Try, review, merge",
    "problem": "Letting an agent edit live data is risky, and copying a database to test on is slow.",
    "solution": "Fork in constant time, let the agent work on the copy, inspect what changed, then merge it or throw it away. Fork at a past instant to recover.",
    "flow": [
      {
        "label": "main",
        "edge": "",
        "record": false
      },
      {
        "label": "Agent run on a branch",
        "edge": "review",
        "record": true
      },
      {
        "label": "merge or delete",
        "edge": "",
        "record": false
      }
    ],
    "code": "{ok, Run} = barrel:branch(Db, run_42,\n    #{vectordb => #{db_path => \"data/run_42_vec\"}}),\n%% the agent writes to Run, you review it\n{ok, _Report} = barrel:merge(Run),\nok = barrel:delete(Run).",
    "lang": "erlang",
    "example": "Example D: experiment on a branch",
    "uses": "barrel, barrel_docdb"
  },
  {
    "slug": "offline-first",
    "name": "Offline-first apps",
    "short": "A copy in the browser",
    "problem": "A field app has to keep working without a connection and catch up later without losing edits.",
    "solution": "barrel-lite keeps a copy in the browser, reads and writes locally, and syncs both ways when the connection returns.",
    "flow": [
      {
        "label": "Web app",
        "edge": "local reads and writes",
        "record": false
      },
      {
        "label": "barrel-lite (OPFS)",
        "edge": "/db/:db/_sync",
        "record": true
      },
      {
        "label": "barrel_server",
        "edge": "",
        "record": false
      }
    ],
    "code": "const db = await Database.open(\"visits\", {\n  remote: { url: \"https://hub.example:8080\",\n            db: \"visits\", token },\n});\nawait db.put({ id: \"v-311\", site: \"Lyon 2\" });\nconst live = db.liveSync();   // sync while online",
    "lang": "ts",
    "example": "Example E: local-first app",
    "uses": "barrel-lite, barrel_server"
  }
];
