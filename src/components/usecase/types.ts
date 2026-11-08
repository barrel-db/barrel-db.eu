// Shapes shared by the use case pages.
import type { Status } from '../../data/site';

export interface ArchBox { name: string; note: string; rec?: boolean; }
export interface ArchColumn { who: string; boxes: ArchBox[]; }

export interface Tab { label: string; code: string; lang?: string; }

export interface Step {
  title: string;
  body: string;
  status?: Status;
  /** One block: code, its language and the label above it. */
  code?: string;
  lang?: string;
  label?: string;
  /** Or the same step in several languages. */
  tabs?: Tab[];
  out?: string;
  outLabel?: string;
}

export interface GoLink { label: string; href: string; }

/** Escape text, then turn `code` spans into <code>. */
export function fmt(s: string): string {
  const esc = s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return esc.replace(/`([^`]+)`/g, '<code>$1</code>');
}
