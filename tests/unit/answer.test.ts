import { describe, expect, it } from 'vitest';
import {
  excerpt,
  extractFirstFence,
  fixLine,
  flaggedLines,
  parseConcept,
  parseExercise,
  parseFence,
  parseLineNotes,
  parseList,
  parseTerms,
  prepareCitations,
  splitSections,
  splitUserMessage,
} from '@/lib/answer';

const EXPLAIN = `## Short answer
A **variable** is a name for a value [S1].

## Example
\`\`\`python title=v.py
## not a heading inside code
x = 1
\`\`\`

## What the code does
- L1!: assigns 1 to \`x\`.

## Key terms
- **Variable**: a name that points to a value.
- **Reassign**: point a name at a new value.

## Follow-ups
- What is a constant?
- Can a variable change type?`;

describe('splitSections', () => {
  it('maps the section contract to kinds and ignores "##" inside code fences', () => {
    const s = splitSections(EXPLAIN);
    expect(s.map((x) => x.kind)).toEqual(['lead', 'example', 'lines', 'terms', 'followups']);
    expect(s[1].body).toContain('## not a heading inside code');
  });

  it('treats unknown headings as generic and keeps a bare answer as the lead', () => {
    expect(splitSections('Just an answer.')[0]).toMatchObject({ kind: 'lead', heading: null });
    expect(splitSections('## Something else\ntext')[0].kind).toBe('generic');
  });
});

describe('fences', () => {
  it('parses language, title, diff and line', () => {
    expect(parseFence('python title=starter.py')).toEqual({ lang: 'python', title: 'starter.py', line: undefined, diff: false });
    expect(parseFence('diff python line=4')).toEqual({ lang: 'python', title: undefined, line: 4, diff: true });
    expect(parseFence('')).toEqual({ lang: '', title: undefined, line: undefined, diff: false });
  });

  it('extracts the first fenced block with the text around it', () => {
    const { before, fence, after } = extractFirstFence('Intro\n```js\nlet a = 1;\n```\nOutro');
    expect(before).toBe('Intro');
    expect(fence).toMatchObject({ code: 'let a = 1;', info: { lang: 'js' } });
    expect(after).toBe('Outro');
  });

  it('finds the line a Debug minimal fix targets', () => {
    expect(fixLine('## Likely problem\nOff by one.\n\n## Minimal fix\n```diff python line=3\n- a\n+ b\n```')).toBe(3);
    expect(fixLine('## Short answer\nNo fix here.')).toBeNull();
  });
});

describe('line notes, terms, lists', () => {
  it('reads "- L6!: …" bullets and flags the important line', () => {
    expect(parseLineNotes('- L1: first\n- L2-3: range\n- L6!: fails')).toEqual([
      { line: 1, label: 'L1', text: 'first', flagged: false },
      { line: 2, label: 'L2–3', text: 'range', flagged: false },
      { line: 6, label: 'L6', text: 'fails', flagged: true },
    ]);
    expect(parseLineNotes('Just prose.')).toBeNull();
    expect(flaggedLines(splitSections(EXPLAIN))).toEqual([1]);
  });

  it('reads key terms and caps lists', () => {
    const terms = splitSections(EXPLAIN).find((s) => s.kind === 'terms')!;
    expect(parseTerms(terms.body)).toEqual([
      { term: 'Variable', definition: 'a name that points to a value.' },
      { term: 'Reassign', definition: 'point a name at a new value.' },
    ]);
    expect(parseList('1. one\n2. two\n3. three\n4. four', 3)).toEqual(['one', 'two', 'three']);
  });

  it('reads the practice concept and exercise', () => {
    expect(parseConcept('**Loops**: repeating steps.')).toEqual({ name: 'Loops', definition: 'repeating steps.' });
    const ex = parseExercise('### Count vowels\nWrite a function.\n\n```python title=starter.py\ndef f():\n    pass\n```');
    expect(ex.title).toBe('Count vowels');
    expect(ex.task).toBe('Write a function.');
    expect(ex.starter?.info.title).toBe('starter.py');
  });
});

describe('citations (RAG.md: only server-validated labels render)', () => {
  it('links known labels and drops unknown ones, leaving code untouched', () => {
    const md = 'Fact [S1]. Made up [S7]. `list[S1]`\n```\ny = x[S1]\n```';
    const out = prepareCitations(md, new Set(['S1']));
    expect(out).toContain('Fact[1](#cite-1).');
    expect(out).toContain('Made up.');
    expect(out).toContain('`list[S1]`');
    expect(out).toContain('y = x[S1]');
  });
});

describe('user messages and excerpts', () => {
  it('splits prose, fenced code and a trailing error line', () => {
    const parts = splitUserMessage('Why?\n```python\nprint(x)\n```\nNameError: name \'x\' is not defined');
    expect(parts.map((p) => p.type)).toEqual(['text', 'code', 'error']);
  });

  it('excerpts the short answer as plain text', () => {
    expect(excerpt(EXPLAIN)).toBe('A variable is a name for a value.');
    expect(excerpt(`## Short answer\n${'word '.repeat(60)}`, 40).endsWith('…')).toBe(true);
  });
});
