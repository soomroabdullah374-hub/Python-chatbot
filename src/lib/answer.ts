// Turns the tutor's Markdown (section contract in PROMPTS.md / prompts.ts) into structured parts
// for the lesson layout. Anything that doesn't follow the contract still renders as plain Markdown.

export type SectionKind =
  | 'lead'
  | 'prose'
  | 'example'
  | 'lines'
  | 'mistake'
  | 'check'
  | 'terms'
  | 'followups'
  | 'fix'
  | 'question'
  | 'exercise'
  | 'concept'
  | 'feedback'
  | 'hints'
  | 'solution'
  | 'generic';

export interface Section {
  kind: SectionKind;
  heading: string | null;
  body: string;
}

const KINDS: Record<string, SectionKind> = {
  'short answer': 'lead',
  'simple explanation': 'prose',
  explanation: 'prose',
  example: 'example',
  'what the code does': 'lines',
  'common mistake': 'mistake',
  check: 'check',
  'understanding check': 'check',
  'key terms': 'terms',
  'follow-ups': 'followups',
  'follow ups': 'followups',
  'follow-up questions': 'followups',
  'likely problem': 'lead',
  'minimal fix': 'fix',
  'why it works': 'prose',
  'test it yourself': 'prose',
  question: 'question',
  exercise: 'exercise',
  concept: 'concept',
  feedback: 'feedback',
  hints: 'hints',
  solution: 'solution',
};

function isFenceLine(line: string) {
  return /^\s{0,3}(```|~~~)/.test(line);
}

export function splitSections(md: string): Section[] {
  const out: Section[] = [];
  let heading: string | null = null;
  let buf: string[] = [];
  let inFence = false;
  const flush = () => {
    const body = buf.join('\n').trim();
    if (heading !== null || body) {
      const key = (heading ?? '').toLowerCase().replace(/[:.]+$/, '').trim();
      const kind: SectionKind = heading === null ? 'lead' : KINDS[key] ?? 'generic';
      out.push({ kind, heading, body });
    }
    buf = [];
  };
  for (const line of md.split('\n')) {
    if (isFenceLine(line)) inFence = !inFence;
    const h = !inFence ? /^##\s+(.+?)\s*#*\s*$/.exec(line) : null;
    if (h && !line.startsWith('###')) {
      flush();
      heading = h[1].replace(/\*\*/g, '').trim();
    } else {
      buf.push(line);
    }
  }
  flush();
  // A preamble before the first heading is a lead only when nothing else claims that role.
  if (out.length > 1 && out[0].heading === null && out.some((s, i) => i > 0 && s.kind === 'lead')) out[0].kind = 'prose';
  return out.filter((s) => s.body || s.kind === 'question');
}

export interface FenceInfo {
  lang: string;
  title?: string;
  line?: number;
  diff: boolean;
}

/** Info string conventions: "python", "diff python line=3", "python title=starter.py". */
export function parseFence(info: string | undefined | null): FenceInfo {
  const parts = (info ?? '').trim().split(/\s+/).filter(Boolean);
  let lang = '';
  let title: string | undefined;
  let line: number | undefined;
  let diff = false;
  for (const p of parts) {
    const kv = /^(\w+)=(.+)$/.exec(p);
    if (kv) {
      if (kv[1] === 'title') title = kv[2];
      if (kv[1] === 'line') line = Number(kv[2]) || undefined;
      continue;
    }
    if (/^L?\d+$/.test(p)) {
      line = Number(p.replace(/^L/, ''));
      continue;
    }
    const lower = p.toLowerCase();
    if (lower === 'diff') diff = true;
    else if (lower.startsWith('diff-')) {
      diff = true;
      lang ||= lower.slice(5);
    } else if (!lang) lang = lower;
  }
  return { lang, title, line, diff };
}

export interface FencedCode {
  info: FenceInfo;
  code: string;
}

/** First fenced block in a section, plus the Markdown around it. */
export function extractFirstFence(body: string): { before: string; fence: FencedCode | null; after: string } {
  const lines = body.split('\n');
  const start = lines.findIndex((l) => isFenceLine(l));
  if (start === -1) return { before: body, fence: null, after: '' };
  const marker = lines[start].trim().slice(0, 3);
  let end = lines.findIndex((l, i) => i > start && l.trim().startsWith(marker));
  if (end === -1) end = lines.length;
  return {
    before: lines.slice(0, start).join('\n').trim(),
    fence: { info: parseFence(lines[start].trim().slice(3)), code: lines.slice(start + 1, end).join('\n') },
    after: lines.slice(end + 1).join('\n').trim(),
  };
}

export interface LineNote {
  line: number | null;
  label: string;
  text: string;
  flagged: boolean;
}

/** "- L1: …" / "- L6!: …" / "- Line 2: …" bullets → line notes. Null if the section isn't in that form. */
export function parseLineNotes(body: string): LineNote[] | null {
  const items = bullets(body);
  if (!items.length) return null;
  const notes: LineNote[] = [];
  for (const item of items) {
    const m = /^\**(?:L|Line\s*)(\d+)(?:\s*[-–]\s*(\d+))?\s*(!)?\**\s*[:.)\-–—]\s*(.*)$/i.exec(item);
    if (!m) return null;
    const label = m[2] ? `L${m[1]}–${m[2]}` : `L${m[1]}`;
    notes.push({ line: Number(m[1]), label, text: m[4], flagged: Boolean(m[3]) });
  }
  return notes;
}

function bullets(body: string): string[] {
  const out: string[] = [];
  for (const line of body.split('\n')) {
    const m = /^\s*(?:[-*+]|\d+[.)])\s+(.*)$/.exec(line);
    if (m) out.push(m[1].trim());
    else if (line.trim() && out.length) out[out.length - 1] += ' ' + line.trim();
  }
  return out;
}

export function parseTerms(body: string): Array<{ term: string; definition: string }> {
  return bullets(body)
    .map((b) => {
      const m = /^\**([^*:]+?)\**\s*[:—–-]\s+(.+)$/.exec(b);
      return m ? { term: m[1].trim(), definition: m[2].trim() } : null;
    })
    .filter((x): x is { term: string; definition: string } => Boolean(x))
    .slice(0, 6);
}

export function parseList(body: string, max = 3): string[] {
  const items = bullets(body);
  return (items.length ? items : body.split('\n').filter((l) => l.trim())).map((s) => s.trim()).slice(0, max);
}

export function parseConcept(body: string): { name: string; definition: string } | null {
  const text = body.replace(/\n+/g, ' ').trim();
  const m = /^\**([^*:]+?)\**\s*[:—–-]\s+(.+)$/.exec(text);
  return m ? { name: m[1].trim(), definition: m[2].trim() } : text ? { name: text, definition: '' } : null;
}

/** "### Title" first line, task text, then the starter code block. */
export function parseExercise(body: string): { title: string | null; task: string; starter: FencedCode | null } {
  const lines = body.split('\n');
  let title: string | null = null;
  const titleIdx = lines.findIndex((l) => /^###\s+/.test(l));
  if (titleIdx !== -1) {
    title = lines[titleIdx].replace(/^###\s+/, '').replace(/\*\*/g, '').trim();
    lines.splice(titleIdx, 1);
  }
  const { before, fence, after } = extractFirstFence(lines.join('\n'));
  return { title, task: [before, after].filter(Boolean).join('\n\n'), starter: fence };
}

/** Lines flagged with "!" in "What the code does" → highlighted rows in the example. */
export function flaggedLines(sections: Section[]): number[] {
  const lines = sections.find((s) => s.kind === 'lines');
  const notes = lines ? parseLineNotes(lines.body) : null;
  return notes?.filter((n) => n.flagged && n.line).map((n) => n.line as number) ?? [];
}

const CITE = /\[S([1-9][0-9]?)\]/g;

/** [S1] → a link the renderer turns into a superscript; unknown labels are removed (RAG.md). */
export function prepareCitations(md: string, valid: ReadonlySet<string>): string {
  let inFence = false;
  return md
    .split('\n')
    .map((line) => {
      if (isFenceLine(line)) inFence = !inFence;
      if (inFence) return line;
      return line
        .split(/(`[^`]*`)/)
        .map((part) => (part.startsWith('`') ? part : part.replace(CITE, (_, n: string) => (valid.has(`S${n}`) ? `[${n}](#cite-${n})` : ''))))
        .join('');
    })
    .join('\n');
}

export type UserPart = { type: 'text'; text: string } | { type: 'code'; code: string; lang: string } | { type: 'error'; text: string };

const ERROR_LINE = /^(Traceback \(most recent call last\)|\s*File ".*", line \d+|[A-Z][A-Za-z]*(Error|Exception|Warning)\b.*|Uncaught .*|\w+Error: .*)$/;
const CODE_HINT = /[=;{}()[\]<>]|^\s{2,}\S|^(def|class|for|while|if|elif|else|return|import|from|const|let|var|function|SELECT|FROM|WHERE|print|console\.)\b/i;

/** Learner messages: fenced code stays code; an unfenced pasted snippet is detected heuristically. */
export function splitUserMessage(text: string): UserPart[] {
  if (/```/.test(text)) {
    const parts: UserPart[] = [];
    const re = /```([^\n`]*)\n([\s\S]*?)(?:```|$)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const before = text.slice(last, m.index).trim();
      if (before) parts.push(...splitErrors(before));
      parts.push({ type: 'code', lang: parseFence(m[1]).lang, code: m[2].replace(/\n$/, '') });
      last = re.lastIndex;
    }
    const rest = text.slice(last).trim();
    if (rest) parts.push(...splitErrors(rest));
    return parts;
  }
  const lines = text.split('\n');
  if (lines.length < 2) return [{ type: 'text', text }];
  const codeLike = lines.filter((l) => l.trim() && CODE_HINT.test(l) && !ERROR_LINE.test(l)).length;
  if (codeLike < 2) return splitErrors(text);
  // Leading prose lines (ending in ':' or '?', or plain sentences) stay text.
  let start = 0;
  while (start < lines.length && (!lines[start].trim() || (!CODE_HINT.test(lines[start]) && /[a-z]/i.test(lines[start])))) start += 1;
  let end = lines.length;
  while (end > start && (!lines[end - 1].trim() || ERROR_LINE.test(lines[end - 1]))) end -= 1;
  const parts: UserPart[] = [];
  const intro = lines.slice(0, start).join('\n').trim();
  if (intro) parts.push({ type: 'text', text: intro });
  parts.push({ type: 'code', lang: '', code: lines.slice(start, end).join('\n').replace(/\s+$/, '') });
  const tail = lines.slice(end).join('\n').trim();
  if (tail) parts.push({ type: 'error', text: tail });
  return parts;
}

function splitErrors(text: string): UserPart[] {
  const lines = text.split('\n');
  const idx = lines.findIndex((l) => ERROR_LINE.test(l.trim()));
  if (idx === -1) return [{ type: 'text', text }];
  const before = lines.slice(0, idx).join('\n').trim();
  const err = lines.slice(idx).join('\n').trim();
  return [...(before ? [{ type: 'text' as const, text: before }] : []), { type: 'error' as const, text: err }];
}

/** Plain-text excerpt (first sentence of the short answer) for saved cards. */
export function excerpt(md: string, max = 140): string {
  const sections = splitSections(md);
  const lead = sections.find((s) => s.kind === 'lead' || s.kind === 'feedback') ?? sections[0];
  const text = (lead?.body ?? md)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\[S\d+\]/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? text.slice(0, max - 1).replace(/\s+\S*$/, '') + '…' : text;
}
