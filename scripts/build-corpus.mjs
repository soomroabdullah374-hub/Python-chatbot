#!/usr/bin/env node
// Builds content/corpus.json — the approved content manifest (RAG.md) — from content/lessons/*.md.
// Each lesson is split on "## " headings into chunks (one heading + its explanation and example).
// The manifest is deterministic so the same commit always yields the same hashes.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dir = join(root, 'content', 'lessons');
const LANGS = new Set(['python', 'javascript', 'typescript', 'sql', 'html_css', 'general']);
const LICENSE = 'Original CodeBloom lesson written for this app (2026). Not copied from third-party documentation.';
const errors = [];

function parseFrontMatter(text, file) {
  const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!m) {
    errors.push(`${file}: missing front matter`);
    return { meta: {}, body: text };
  }
  const meta = {};
  for (const line of m[1].split('\n')) {
    const kv = /^([a-z_]+):\s*(.*)$/.exec(line.trim());
    if (kv) meta[kv[1]] = kv[2].trim();
  }
  return { meta, body: m[2] };
}

function chunk(body) {
  const chunks = [];
  let current = null;
  let inFence = false;
  for (const line of body.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    if (!inFence && line.startsWith('## ')) {
      if (current) chunks.push(current);
      current = { heading: line.slice(3).trim(), lines: [] };
    } else if (current) {
      current.lines.push(line);
    }
  }
  if (current) chunks.push(current);
  return chunks.map((c, index) => {
    const content = c.lines.join('\n').trim();
    const words = content.split(/\s+/).filter(Boolean).length;
    return { index, heading: c.heading, content, token_count: Math.ceil(words * 1.33) };
  });
}

const documents = [];
for (const file of readdirSync(dir).filter((f) => f.endsWith('.md')).sort()) {
  const raw = readFileSync(join(dir, file), 'utf8').replace(/\r\n/g, '\n');
  const { meta, body } = parseFrontMatter(raw, file);
  for (const key of ['slug', 'title', 'language', 'section', 'version']) {
    if (!meta[key]) errors.push(`${file}: missing ${key}`);
  }
  if (meta.slug && !/^[a-z0-9][a-z0-9-]{1,80}$/.test(meta.slug)) errors.push(`${file}: bad slug`);
  if (meta.language && !LANGS.has(meta.language)) errors.push(`${file}: bad language ${meta.language}`);
  if (meta.source_url && !meta.source_url.startsWith('https://')) errors.push(`${file}: source_url must be https`);
  const chunks = chunk(body);
  if (chunks.length === 0) errors.push(`${file}: no "## " sections`);
  for (const c of chunks) {
    if (!c.content) errors.push(`${file}: empty section "${c.heading}"`);
    if (c.content.length > 3500) errors.push(`${file}: section "${c.heading}" is too long (${c.content.length} chars)`);
  }
  const hash = createHash('sha256').update(raw).digest('hex');
  documents.push({
    document: {
      slug: meta.slug,
      title: meta.title,
      language: meta.language,
      section: meta.section,
      version: meta.version,
      source_url: meta.source_url ?? null,
      license_note: LICENSE,
      content_hash: hash,
    },
    chunks,
  });
}

const slugs = new Set();
for (const d of documents) {
  if (slugs.has(d.document.slug)) errors.push(`duplicate slug ${d.document.slug}`);
  slugs.add(d.document.slug);
}
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const manifest = { manifest_version: 1, embedding_version: 'gte-small-384-v1', documents };
writeFileSync(join(root, 'content', 'corpus.json'), JSON.stringify(manifest, null, 2) + '\n');
const chunkCount = documents.reduce((n, d) => n + d.chunks.length, 0);
console.log(`content/corpus.json: ${documents.length} documents, ${chunkCount} chunks`);
