'use client';
// Safe Markdown (SECURITY.md "Rendering"): no raw HTML (react-markdown escapes it), no remote
// images, links only to https documentation hosts, citations only for validated labels.
import { memo } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { safeSourceUrl } from '@shared/citations.ts';
import { parseFence } from '@/lib/answer';
import { CARET, rehypeCaret } from './caret';
import { CodeBlock } from './CodeBlock';

function textOf(children: unknown): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(textOf).join('');
  if (children && typeof children === 'object' && 'props' in (children as Record<string, unknown>)) {
    return textOf((children as { props: { children?: unknown } }).props.children);
  }
  return '';
}

function makeComponents(highlight: number[], citeHref: (n: string) => string): Components {
  return {
    pre({ children }) {
      const child = Array.isArray(children) ? children[0] : children;
      const props = (child as { props?: { className?: string; children?: unknown; node?: { data?: { meta?: string } } } })?.props ?? {};
      const lang = /language-([\w+#-]+)/.exec(props.className ?? '')?.[1] ?? '';
      const info = parseFence(`${lang} ${props.node?.data?.meta ?? ''}`);
      const code = textOf(props.children).replaceAll(CARET, '').replace(/\n$/, '');
      return <CodeBlock code={code} lang={info.lang} title={info.title} diff={info.diff} diffLine={info.line} highlight={info.diff ? [] : highlight} copyLabel={info.diff ? 'Copy fix' : 'Copy'} />;
    },
    code({ children, className }) {
      return <code className={className ? className : 'ic'}>{children}</code>;
    },
    a({ href, children }) {
      const cite = /^#cite-(\d+)$/.exec(href ?? '');
      if (cite) {
        return (
          <sup className="cite-wrap">
            <a href={citeHref(cite[1])} className="cite" aria-label={`Source ${cite[1]}`}>
              [{cite[1]}]
            </a>
          </sup>
        );
      }
      const safe = safeSourceUrl(href);
      if (!safe) return <span>{children}</span>;
      return (
        <a href={safe} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      );
    },
    img({ alt }) {
      return alt ? <span>[{alt}]</span> : null;
    },
    h1: ({ children }) => <h3>{children}</h3>,
    h2: ({ children }) => <h3>{children}</h3>,
  };
}

export const Markdown = memo(function Markdown({
  children,
  className = '',
  highlight = [],
  citeHref = (n: string) => `#src-${n}`,
}: {
  children: string;
  className?: string;
  highlight?: number[];
  citeHref?: (n: string) => string;
}) {
  return (
    <div className={`md ${className}`}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeCaret]} components={makeComponents(highlight, citeHref)} skipHtml>
        {children}
      </ReactMarkdown>
    </div>
  );
});
