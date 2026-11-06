'use client';
import { memo, useMemo } from 'react';
import { splitUserMessage } from '@/lib/answer';
import type { Language } from '@/lib/types';
import { CodeBlock } from '@/components/ui/CodeBlock';

export const UserMessage = memo(function UserMessage({ content, language }: { content: string; language: Language }) {
  const parts = useMemo(() => splitUserMessage(content), [content]);
  const hasCode = parts.some((p) => p.type === 'code');
  return (
    <div className={`msg-user rise${hasCode ? ' has-code' : ''}`}>
      {parts.map((p, i) => {
        if (p.type === 'code') return <CodeBlock key={i} code={p.code} lang={p.lang || language} head={false} />;
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
