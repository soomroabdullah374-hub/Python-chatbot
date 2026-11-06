'use client';
import { memo, useMemo } from 'react';
import { splitUserMessage } from '@/lib/answer';
import type { Language } from '@/lib/types';
import { CodeBlock } from '@/components/ui/CodeBlock';

/** `markLine` highlights a line of the learner's first code block (the line a Debug fix targets). */
export const UserMessage = memo(function UserMessage({ content, language, markLine }: { content: string; language: Language; markLine?: number | null }) {
  const parts = useMemo(() => splitUserMessage(content), [content]);
  const hasCode = parts.some((p) => p.type === 'code');
  const firstCode = parts.findIndex((p) => p.type === 'code');
  const marked = useMemo(() => (markLine ? [markLine] : []), [markLine]);
  return (
    <div className={`msg-user rise${hasCode ? ' has-code' : ''}`}>
      {parts.map((p, i) => {
        if (p.type === 'code') return <CodeBlock key={i} code={p.code} lang={p.lang || language} head={false} highlight={i === firstCode ? marked : undefined} />;
        if (p.type === 'error') return <p key={i} className="err-line">{p.text}</p>;
        return (
          <p key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {p.text}
          </p>
        );
      })}
    </div>
  );
});
