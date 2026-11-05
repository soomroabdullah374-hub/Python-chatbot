// Server-Sent Events: encoder for the app protocol (API.md) and a tolerant parser used for
// upstream provider streams and by the browser client. Handles UTF-8 split across chunks,
// several events per chunk, CRLF line endings, comments and multi-line data fields.

export interface SseEvent {
  event: string;
  data: string;
  id?: string;
}

const encoder = new TextEncoder();

export function encodeSse(event: string, data: unknown): Uint8Array {
  const json = JSON.stringify(data);
  return encoder.encode(`event: ${event}\ndata: ${json}\n\n`);
}

/** Incremental parser. Feed decoded text with push(); collect complete events. */
export class SseParser {
  private buffer = '';
  private dataLines: string[] = [];
  private eventName = '';
  private lastId: string | undefined;

  push(text: string): SseEvent[] {
    this.buffer += text;
    const out: SseEvent[] = [];
    let idx: number;
    // Process complete lines only; keep the trailing partial line in the buffer.
    while ((idx = this.findLineEnd()) !== -1) {
      const line = this.buffer.slice(0, idx);
      const skip = this.buffer[idx] === '\r' && this.buffer[idx + 1] === '\n' ? 2 : 1;
      this.buffer = this.buffer.slice(idx + skip);
      const ev = this.processLine(line);
      if (ev) out.push(ev);
    }
    return out;
  }

  /** Flush at end of stream: a final event without a trailing blank line is still dispatched. */
  end(): SseEvent[] {
    const out: SseEvent[] = [];
    if (this.buffer.length) {
      const ev = this.processLine(this.buffer);
      this.buffer = '';
      if (ev) out.push(ev);
    }
    const last = this.dispatch();
    if (last) out.push(last);
    return out;
  }

  private findLineEnd(): number {
    const n = this.buffer.indexOf('\n');
    const r = this.buffer.indexOf('\r');
    if (r === -1) return n;
    if (n === -1) {
      // A lone CR at the very end might be the first half of CRLF; wait for more data.
      return r === this.buffer.length - 1 ? -1 : r;
    }
    return Math.min(n, r);
  }

  private processLine(line: string): SseEvent | null {
    if (line === '') return this.dispatch();
    if (line.startsWith(':')) return null;
    const colon = line.indexOf(':');
    const field = colon === -1 ? line : line.slice(0, colon);
    let value = colon === -1 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'data') this.dataLines.push(value);
    else if (field === 'event') this.eventName = value;
    else if (field === 'id') this.lastId = value;
    return null;
  }

  private dispatch(): SseEvent | null {
    if (this.dataLines.length === 0) {
      this.eventName = '';
      return null;
    }
    const ev: SseEvent = { event: this.eventName || 'message', data: this.dataLines.join('\n') };
    if (this.lastId !== undefined) ev.id = this.lastId;
    this.dataLines = [];
    this.eventName = '';
    return ev;
  }
}

/** Iterate SSE events from a byte stream. */
export async function* readSse(
  body: ReadableStream<Uint8Array>,
  signal?: AbortSignal,
): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder('utf-8');
  const parser = new SseParser();
  try {
    while (true) {
      if (signal?.aborted) throw signal.reason ?? new DOMException('Aborted', 'AbortError');
      const { value, done } = await reader.read();
      if (done) break;
      for (const ev of parser.push(decoder.decode(value, { stream: true }))) yield ev;
    }
    for (const ev of parser.push(decoder.decode())) yield ev;
    for (const ev of parser.end()) yield ev;
  } finally {
    try {
      await reader.cancel();
    } catch {
      // stream already closed
    }
    reader.releaseLock();
  }
}
