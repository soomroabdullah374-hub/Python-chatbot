import { describe, expect, it } from 'vitest';
import { encodeSse, readSse, SseParser } from '@shared/sse.ts';
import { chunkedStream, collect } from './helpers';

describe('SSE parser', () => {
  const stream = [
    'event: meta\ndata: {"turn_id":"t1"}\n\n',
    ': keep-alive comment\n\n',
    'event: delta\ndata: {"text":"Variables in café ☕"}\n\n',
    'event: delta\r\ndata: {"text":"line"}\r\n\r\n',
    'data: first\ndata: second\n\n',
    'event: done\ndata: {"status":"completed"}\n\n',
  ].join('');

  it('parses multiple events, comments, CRLF and multi-line data', () => {
    const p = new SseParser();
    const events = [...p.push(stream), ...p.end()];
    expect(events.map((e) => e.event)).toEqual(['meta', 'delta', 'delta', 'message', 'done']);
    expect(JSON.parse(events[1].data).text).toBe('Variables in café ☕');
    expect(events[3].data).toBe('first\nsecond');
  });

  it('survives byte-by-byte delivery that splits UTF-8 characters and lines', async () => {
    for (const size of [1, 2, 3, 7, 64]) {
      const events = await collect(readSse(chunkedStream(stream, size)));
      expect(events).toHaveLength(5);
      expect(JSON.parse(events[1].data).text).toBe('Variables in café ☕');
    }
  });

  it('dispatches a final event even without a trailing blank line', async () => {
    const events = await collect(readSse(chunkedStream('event: done\ndata: {"ok":true}', 4)));
    expect(events).toEqual([{ event: 'done', data: '{"ok":true}' }]);
  });

  it('ignores incomplete events at the end of a stream (no data)', () => {
    const p = new SseParser();
    expect([...p.push('event: delta\n'), ...p.end()]).toEqual([]);
  });

  it('encodes app events as single-line JSON', () => {
    const text = new TextDecoder().decode(encodeSse('delta', { text: 'a\nb' }));
    expect(text).toBe('event: delta\ndata: {"text":"a\\nb"}\n\n');
  });
});
