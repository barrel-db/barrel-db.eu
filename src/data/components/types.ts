// Content of one /product/<slug> page. Facts come from the verified matrices
// (source, tests and real runs); text fields accept `code` and [label](href).

export interface Link { label: string; href: string; }

export interface ConfigRow { key: string; def: string; meaning: string; }
export interface ConfigTable { title: string; rows: ConfigRow[]; }

export interface ApiRow { task: string; call: string; returns: string; }
export interface ApiGroup { title: string; rows: ApiRow[]; }

export interface CodeSample {
  title: string;
  intro: string;
  label: string;
  code: string;
  lang?: string;
  /** Only output that came from a real run. */
  output?: string;
  outputLabel?: string;
}

export interface Tab { label: string; code: string; lang?: string; }

export interface FlowStep { title: string; body: string; call: string; accent?: boolean; }

export interface ComponentContent {
  slug: string;
  lead: string;
  problem: string;
  useWhen: string[];
  notWhen: string[];
  /** Barrel libraries in this app's rebar.config deps (slugs). */
  dependsOn: string[];
  /** Other runtime deps, as plain text. */
  external: string;
  /** Libraries this one can work with when present (slug and how). */
  optional?: { slug: string; text: string }[];
  standalone: { short: string; text: string };
  install: { code: string; lang: string; label: string; note?: string };
  reachedThrough: string[];
  config: ConfigTable[];
  api: ApiGroup[];
  flow?: { title: string; intro: string; steps: FlowStep[] };
  table?: { caption: string; head: string[]; rows: string[][] };
  examples: CodeSample[];
  /** Same flow in other languages: calls only, no output. */
  tabs?: { title: string; intro: string; tabs: Tab[] };
  limits: string[];
  /** Known gaps found during verification. */
  gaps?: string[];
  guides: Link[];
  apiRef?: string;
}
