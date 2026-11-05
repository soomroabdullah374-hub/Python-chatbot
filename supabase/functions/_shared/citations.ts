// Citation labels (RAG.md "Attribution"): the model may cite only server-assigned labels.

const LABEL_RE = /\[S([1-9][0-9]?)\]/g;

export function citedLabels(text: string): Set<string> {
  const out = new Set<string>();
  for (const m of text.matchAll(LABEL_RE)) out.add(`S${m[1]}`);
  return out;
}

/** Keep only supplied references that the answer actually cites; unknown labels are ignored. */
export function selectCitedSources<T extends { label: string }>(text: string, supplied: T[]): T[] {
  const cited = citedLabels(text);
  return supplied.filter((s) => cited.has(s.label));
}

/** Remove citation markers that do not map to a validated source (used before rendering). */
export function stripUnknownCitations(text: string, valid: ReadonlySet<string>): string {
  return text.replace(LABEL_RE, (whole, n: string) => (valid.has(`S${n}`) ? whole : ''));
}

const APPROVED_HOSTS = new Set([
  'docs.python.org',
  'developer.mozilla.org',
  'www.typescriptlang.org',
  'www.postgresql.org',
  'www.sqlite.org',
  'sqlite.org',
  'html.spec.whatwg.org',
  'www.w3.org',
  'tc39.es',
  'nodejs.org',
]);

/** Only https links to approved documentation hosts survive (no javascript:, data:, http:). */
export function safeSourceUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    if (u.protocol !== 'https:') return null;
    if (!APPROVED_HOSTS.has(u.hostname)) return null;
    return u.toString();
  } catch {
    return null;
  }
}
