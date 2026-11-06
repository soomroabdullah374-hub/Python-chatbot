// Tiny, dependency-free syntax tokenizer mapped to the design's five token colours
// (keyword, string, number, function, comment). Output is plain data rendered as React text
// nodes, so generated code is never injected as HTML (SECURITY.md "Rendering").

export type TokenClass = 'k' | 's' | 'n' | 'f' | 'c';
export interface Token {
  text: string;
  cls?: TokenClass;
}

const PY = new Set('False None True and as assert async await break class continue def del elif else except finally for from global if import in is lambda nonlocal not or pass raise return try while with yield match case'.split(' '));
const JS = new Set('break case catch class const continue debugger default delete do else export extends finally for function if import in instanceof let new return super switch this throw try typeof var void while with yield async await of true false null undefined static get set'.split(' '));
const TS = new Set([...JS, ...'interface type enum implements private public protected readonly as namespace declare abstract keyof infer is number string boolean any unknown never bigint symbol object'.split(' ')]);
const SQL = new Set('select from where and or not join left right inner outer full cross on group by order having limit offset as insert into values update set delete create table primary key foreign references null is in like ilike distinct count sum avg min max case when then else end desc asc union all exists between with returning default unique index alter drop add column constraint check if replace view'.split(' '));
const CSS_WORDS = new Set('important auto none inherit initial flex grid block inline absolute relative fixed sticky center'.split(' '));

type Lang = 'python' | 'js' | 'ts' | 'sql' | 'html' | 'css' | 'plain';

export function normaliseLang(lang: string | undefined | null): Lang {
  const l = (lang ?? '').toLowerCase();
  if (['py', 'python', 'python3'].includes(l)) return 'python';
  if (['js', 'javascript', 'jsx', 'node', 'mjs'].includes(l)) return 'js';
  if (['ts', 'typescript', 'tsx'].includes(l)) return 'ts';
  if (['sql', 'postgres', 'postgresql', 'sqlite', 'mysql'].includes(l)) return 'sql';
  if (['html', 'xml', 'svg', 'html_css'].includes(l)) return 'html';
  if (['css', 'scss'].includes(l)) return 'css';
  return 'plain';
}

interface Rule {
  re: RegExp;
  cls?: TokenClass | ((m: string, src: string, end: number) => TokenClass | undefined);
}

const ident = /[A-Za-z_$][\w$]*/y;
function identClass(words: Set<string>, ci = false) {
  return (m: string, src: string, end: number): TokenClass | undefined => {
    if (words.has(ci ? m.toLowerCase() : m)) return 'k';
    let i = end;
    while (src[i] === ' ') i += 1;
    return src[i] === '(' ? 'f' : undefined;
  };
}

const RULES: Record<Exclude<Lang, 'plain'>, Rule[]> = {
  python: [
    { re: /#[^\n]*/y, cls: 'c' },
    { re: /[rbfu]{0,2}("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/iy, cls: 's' },
    { re: /\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b/iy, cls: 'n' },
    { re: ident, cls: identClass(PY) },
  ],
  js: [
    { re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y, cls: 'c' },
    { re: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y, cls: 's' },
    { re: /\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b/iy, cls: 'n' },
    { re: ident, cls: identClass(JS) },
  ],
  ts: [
    { re: /\/\/[^\n]*|\/\*[\s\S]*?\*\//y, cls: 'c' },
    { re: /`(?:\\.|[^`\\])*`|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'/y, cls: 's' },
    { re: /\b\d[\d_]*(?:\.\d+)?(?:e[+-]?\d+)?\b/iy, cls: 'n' },
    { re: ident, cls: identClass(TS) },
  ],
  sql: [
    { re: /--[^\n]*|\/\*[\s\S]*?\*\//y, cls: 'c' },
    { re: /'(?:''|[^'])*'/y, cls: 's' },
    { re: /\b\d+(?:\.\d+)?\b/y, cls: 'n' },
    { re: /[A-Za-z_][\w]*/y, cls: identClass(SQL, true) },
  ],
  html: [
    { re: /<!--[\s\S]*?-->/y, cls: 'c' },
    { re: /"[^"\n]*"|'[^'\n]*'/y, cls: 's' },
    { re: /<\/?[A-Za-z][\w-]*/y, cls: 'k' },
    { re: /[A-Za-z-:]+(?==)/y, cls: 'f' },
  ],
  css: [
    { re: /\/\*[\s\S]*?\*\//y, cls: 'c' },
    { re: /"[^"\n]*"|'[^'\n]*'/y, cls: 's' },
    { re: /#[0-9a-fA-F]{3,8}\b|-?\b\d+(?:\.\d+)?(?:px|rem|em|%|fr|vh|vw|s|ms|deg)?\b/y, cls: 'n' },
    { re: /[A-Za-z-]+(?=\s*:)/y, cls: 'f' },
    { re: /[A-Za-z-]+/y, cls: (m) => (CSS_WORDS.has(m) ? 'k' : undefined) },
  ],
};

/** Tokenise source code; returns one token array per line. */
export function tokenize(code: string, lang?: string | null): Token[][] {
  const l = normaliseLang(lang);
  const rules = l === 'plain' ? [] : RULES[l];
  const tokens: Token[] = [];
  let plain = '';
  let i = 0;
  outer: while (i < code.length) {
    for (const rule of rules) {
      rule.re.lastIndex = i;
      const m = rule.re.exec(code);
      if (m && m.index === i && m[0].length > 0) {
        const cls = typeof rule.cls === 'function' ? rule.cls(m[0], code, i + m[0].length) : rule.cls;
        if (cls) {
          if (plain) tokens.push({ text: plain });
          plain = '';
          tokens.push({ text: m[0], cls });
        } else {
          plain += m[0];
        }
        i += m[0].length;
        continue outer;
      }
    }
    plain += code[i];
    i += 1;
  }
  if (plain) tokens.push({ text: plain });

  // Split tokens across lines.
  const lines: Token[][] = [[]];
  for (const t of tokens) {
    const parts = t.text.split('\n');
    parts.forEach((p, idx) => {
      if (idx > 0) lines.push([]);
      if (p) lines[lines.length - 1].push({ text: p, cls: t.cls });
    });
  }
  return lines;
}
