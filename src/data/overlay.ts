// Lay translated text over an English data object. Strings in `tr` replace the
// English ones; arrays must keep the English length; anything not given stays English.

export type Over<T> = T extends string
  ? string
  : T extends readonly (infer U)[]
    ? Over<U>[]
    : T extends object
      ? { [K in keyof T]?: Over<T[K]> }
      : never;

export function overlay<T>(en: T, tr: Over<T> | undefined, path = '$'): T {
  if (tr === undefined || tr === null) return en;
  if (typeof en === 'string') return (typeof tr === 'string' ? tr : en) as T;
  if (Array.isArray(en)) {
    const a = tr as unknown[];
    if (!Array.isArray(a) || a.length !== en.length) {
      throw new Error(`overlay: ${path} has ${Array.isArray(a) ? a.length : 'no'} items, English has ${en.length}`);
    }
    return en.map((e, i) => overlay(e, a[i] as never, `${path}[${i}]`)) as T;
  }
  if (en && typeof en === 'object') {
    const out: Record<string, unknown> = { ...(en as Record<string, unknown>) };
    for (const [k, v] of Object.entries(tr as Record<string, unknown>)) {
      if (!(k in out)) throw new Error(`overlay: ${path}.${k} is not in the English data`);
      out[k] = overlay(out[k], v as never, `${path}.${k}`);
    }
    return out as T;
  }
  return en;
}
