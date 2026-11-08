// Turn a site MDX page into plain Markdown for /docs/<slug>.md and llms-full.txt:
// imports go, CodeBlock and CodeTabs become fenced code, Callout becomes a quote,
// purely visual components are dropped.

const TPL = '`((?:\\\\[\\s\\S]|[^`\\\\])*)`';

function unescapeTemplate(s: string): string {
  return s.replace(/\\([`\\$])/g, '$1');
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)'|\\{'([^']*)'\\})`));
  return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
}

const fence = (code: string, lang = '') => {
  const ticks = code.includes('```') ? '````' : '```';
  return `${ticks}${lang}\n${code}\n${ticks}`;
};

export function mdxToMarkdown(src: string): string {
  let s = src.replace(/^import\s.+?from\s+['"][^'"]+['"];?\s*$/gm, '');

  s = s.replace(new RegExp(`<CodeTabs\\s+tabs=\\{\\[([\\s\\S]*?)\\]\\}\\s*/>`, 'g'), (_m, body: string) => {
    const out: string[] = [];
    const tab = new RegExp(`\\{\\s*label:\\s*'([^']*)'\\s*,(?:\\s*lang:\\s*'([^']*)'\\s*,)?\\s*code:\\s*${TPL}\\s*,?\\s*\\}`, 'g');
    for (const t of body.matchAll(tab)) out.push(`${t[1]}:\n\n${fence(unescapeTemplate(t[3]), t[2] ?? '')}`);
    return out.join('\n\n');
  });

  s = s.replace(new RegExp(`<CodeBlock([^>]*?)code=\\{${TPL}\\}([^>]*?)/>`, 'g'), (_m, a: string, code: string, b: string) => {
    const attrs = `${a} ${b}`;
    const output = /\boutput\b/.test(attrs);
    const label = attr(attrs, 'label');
    const lang = output ? '' : (attr(attrs, 'lang') ?? 'erlang');
    return `${label ? `${label}:\n\n` : ''}${fence(unescapeTemplate(code), lang)}`;
  });

  s = s.replace(/<Callout([^>]*)>([\s\S]*?)<\/Callout>/g, (_m, attrs: string, body: string) => {
    const label = attr(attrs, 'label') ?? 'Note';
    const lines = body.trim().split('\n');
    return [`> **${label}:** ${lines[0]}`, ...lines.slice(1).map((l) => `> ${l}`)].join('\n');
  });

  s = s.replace(/<(RecordFigure|TwoSiteDemo|MeshDemo)\b[^>]*\/>/g, '');
  return s.replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
