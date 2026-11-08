// Tiny inline markup for component content: `code` and [label](href).
// Input is escaped first, so content files cannot inject HTML.
import { localize, type Lang } from '../../i18n';

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function inline(s: string, lang: Lang = 'en'): string {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_m, label, href) => `<a href="${localize(href, lang)}">${label}</a>`);
}
