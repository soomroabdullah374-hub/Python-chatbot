#!/usr/bin/env node
// Local stand-in for the Supabase endpoints CodeBloom's browser code calls, so Playwright can run
// the learner journeys (TESTING.md "E2E journeys") without a live project or a paid model call.
// It reproduces the response shapes the app depends on — anonymous auth sessions, PostgREST
// arrays/counts/errors, RPCs and the app-owned SSE protocol of POST /functions/v1/chat — and it
// scopes every row to the caller the way RLS does. Real authorization is tested by pgTAP.
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_SUPABASE_PORT ?? 54399);

const users = new Map(); // id -> { id, created_at, profile }
const tokens = new Map(); // access token -> user id
const refreshTokens = new Map(); // refresh token -> user id
const conversations = new Map(); // id -> row (+ user_id)
const messages = new Map(); // id -> row (+ user_id, seq, sources)
const turns = new Map(); // id -> { id, user_id, conversation_id, status, cancel, key }
const feedback = new Map(); // message id -> rating
const bookmarks = new Map(); // message id -> { user_id, created_at }
let seq = 0;
let lastTs = 0;

function now() {
  lastTs = Math.max(Date.now(), lastTs + 1);
  return new Date(lastTs).toISOString();
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

// ---------------------------------------------------------------- auth
function userJson(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: '',
    phone: '',
    app_metadata: {},
    user_metadata: {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.created_at,
    is_anonymous: true,
  };
}

function issueSession(u) {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const access = [
    b64url({ alg: 'HS256', typ: 'JWT' }),
    b64url({ sub: u.id, role: 'authenticated', aud: 'authenticated', is_anonymous: true, exp, iat: exp - 3600, session_id: randomUUID() }),
    randomBytes(24).toString('base64url'),
  ].join('.');
  const refresh = randomBytes(18).toString('base64url');
  tokens.set(access, u.id);
  refreshTokens.set(refresh, u.id);
  return { access_token: access, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: refresh, user: userJson(u) };
}

function createUser() {
  const u = {
    id: randomUUID(),
    created_at: now(),
    profile: {
      preferred_language: 'python',
      explanation_language: 'en',
      experience_level: 'new',
      explanation_depth: 'concise',
      enter_to_send: true,
      reduce_motion: false,
      onboarded_at: null,
    },
  };
  users.set(u.id, u);
  return u;
}

/** The caller's user id from the bearer token (null when absent/unknown/deleted). */
function caller(req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
  if (!m) return null;
  const id = tokens.get(m[1]);
  return id && users.has(id) ? id : null;
}
const knownToken = (req) => tokens.has(/^Bearer (.+)$/.exec(req.headers.authorization ?? '')?.[1] ?? '');

// ---------------------------------------------------------------- helpers
function cors(req) {
  const origin = req.headers.origin;
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': req.headers['access-control-request-headers'] ?? 'authorization, apikey, content-type, x-client-info, prefer',
        'Access-Control-Expose-Headers': 'content-range, retry-after, x-request-id, x-supabase-api-version',
        Vary: 'Origin',
      }
    : {};
}

function send(req, res, status, body, headers = {}) {
  const h = { ...cors(req), ...headers };
  if (body === undefined) {
    res.writeHead(status, h);
    res.end();
    return;
  }
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...h });
  res.end(JSON.stringify(body));
}

const pgError = (code, message, status) => ({ status, body: { code, message, details: null, hint: null } });

async function readJson(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function eqParam(params, col) {
  const v = params.get(col);
  return v && v.startsWith('eq.') ? v.slice(3) : null;
}

function ilikeMatcher(pattern) {
  // PostgREST ilike: % = any run, _ = one char, backslash escapes.
  let re = '';
  for (let i = 0; i < pattern.length; i += 1) {
    const ch = pattern[i];
    if (ch === '\\' && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    else if (ch === '%' || ch === '*') re += '.*';
    else if (ch === '_') re += '.';
    else re += ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  return new RegExp(`^${re}$`, 'is');
}

const convRow = (c) => ({ id: c.id, title: c.title, mode: c.mode, language: c.language, created_at: c.created_at, updated_at: c.updated_at });

function messageRow(m) {
  const b = bookmarks.get(m.id);
  const r = feedback.get(m.id);
  return {
    id: m.id,
    role: m.role,
    content: m.content,
    status: m.status,
    mode: m.mode,
    language: m.language,
    created_at: m.created_at,
    generation_request_id: m.generation_request_id,
    message_sources: m.sources.map((s) => ({ citation_label: s.label, document_title: s.title, source_url: s.url, section: s.section })),
    feedback: r ? [{ rating: r }] : [],
    bookmarks: b ? [{ message_id: m.id }] : [],
  };
}

function addMessage(fields) {
  const m = { id: randomUUID(), created_at: now(), seq: ++seq, sources: [], ...fields };
  messages.set(m.id, m);
  return m;
}

function deleteConversationRows(id) {
  for (const m of [...messages.values()]) {
    if (m.conversation_id !== id) continue;
    bookmarks.delete(m.id);
    feedback.delete(m.id);
    messages.delete(m.id);
  }
  for (const t of [...turns.values()]) if (t.conversation_id === id) t.cancel = true;
  conversations.delete(id);
}

// ---------------------------------------------------------------- tutor answers (section contract)
const SOURCES = {
  python: [
    { label: 'S1', title: 'Variables and assignment', url: null, section: 'Variables' },
    { label: 'S2', title: 'Reading a NameError', url: null, section: 'Errors' },
  ],
  javascript: [
    { label: 'S1', title: 'let and const', url: null, section: 'Variables' },
    { label: 'S2', title: 'Reading a TypeError', url: null, section: 'Errors' },
  ],
  sql: [{ label: 'S1', title: 'Filtering and sorting rows', url: null, section: 'Queries' }],
};

function explainAnswer(language) {
  if (language === 'javascript') {
    return {
      sources: SOURCES.javascript,
      text: `## Short answer
Use \`const\` by default. Switch to \`let\` only when you need to give the same name a new value later [S1].

## Simple explanation
A **variable** is a name for a value. \`const\` makes the name fixed, so you can't **reassign** it; \`let\` allows a new value later [S1].

## Example
\`\`\`javascript title=scores.js
const name = "Sara";
let score = 0;
score = score + 10;
name = "Ali"; // TypeError: Assignment to constant variable.
\`\`\`

## What the code does
- L1: creates a fixed name \`name\`.
- L2: creates \`score\`, which can change.
- L3: gives \`score\` a new value, 10.
- L4!: tries to reassign a \`const\`, so JavaScript throws a TypeError [S2].

## Common mistake
\`const\` doesn't freeze the value inside it — an array declared with \`const\` can still get new items.

## Check
Would \`const list = []; list.push(1);\` throw an error?

## Key terms
- **Variable**: a name that refers to a value.
- **Reassign**: point an existing name at a new value.

## Follow-ups
- Why does const allow changing an array?
- When should I use var?`,
    };
  }
  if (language === 'sql') {
    return {
      sources: SOURCES.sql,
      text: `## Short answer
The query lists students who scored 50 or more, highest score first [S1].

## Example
\`\`\`sql
SELECT name, score
FROM students
WHERE score >= 50
ORDER BY score DESC;
\`\`\`

## What the code does
- L1: picks the two columns to show.
- L2: reads rows from the \`students\` table.
- L3!: keeps only rows where \`score\` is at least 50.
- L4: sorts the remaining rows from highest to lowest.

## Check
What would change if you removed \`DESC\`?

## Key terms
- **Clause**: one part of a query, such as \`WHERE\`.`,
    };
  }
  return {
    sources: SOURCES.python,
    text: `## Short answer
A **variable** is a name that points to a value, so you can use the value again later [S1].

## Simple explanation
When you write \`score = 10\`, Python stores the value \`10\` and lets you call it \`score\`. You can **reassign** the name later to point at a different value [S1].

## Example
\`\`\`python title=variables.py
score = 10
score = score + 5
print(score)  # 15
\`\`\`

## What the code does
- L1: creates the name \`score\` and points it at \`10\`.
- L2!: reads the old value, adds 5 and points \`score\` at the result.
- L3: prints the current value, \`15\`.

## Common mistake
Using a name before assigning it raises a \`NameError\` — assign first, then use it [S2].

## Check
What would \`print(score)\` show if line 2 were \`score = score * 2\`?

## Key terms
- **Variable**: a name that points to a value.
- **Reassign**: point an existing name at a new value.

## Follow-ups
- What is the difference between a variable and a constant?
- Can a variable change its type?`,
  };
}

const DEBUG_ANSWER = `## Likely problem
Line 4 reads \`scores[i + 1]\`. On the last pass of the loop that index is past the end of the list, so Python raises an \`IndexError\`. This comes from reading the code — it wasn't run.

## Minimal fix
\`\`\`diff python line=4
- total += scores[i + 1]
+ total += scores[i]
\`\`\`

## Why it works
\`range(len(scores))\` already gives every valid index, from \`0\` to \`len(scores) - 1\`.

## Test it yourself
Run \`average([2, 4, 6])\` — you should see \`4.0\`.

## Key terms
- **Index**: a position in a list, starting at 0.`;

const EXERCISE_ANSWER = `## Exercise
### Count the vowels
Write a function \`count_vowels(word)\` that returns how many vowels are in \`word\`. For example, \`count_vowels("banana")\` should return \`3\`.

\`\`\`python title=starter.py
def count_vowels(word):
    count = 0
    # your code here
    return count
\`\`\`

## Concept
**Loops**: repeating the same steps once for each item in a sequence.`;

const FEEDBACK_ANSWER = `## Feedback
Good start — your loop visits every letter (line 3). The one issue: line 4 compares the letter to the whole string with \`==\`, so it is never true.

## Hints
1. Think about whether one letter can ever equal \`"aeiou"\`.
2. Python has an operator that checks whether a letter appears inside a string.
3. Replace the comparison on line 4 with \`letter in "aeiou"\`.

## Solution
\`\`\`python
def count_vowels(word):
    count = 0
    for letter in word:
        if letter in "aeiou":
            count += 1
    return count
\`\`\`

## Check
What does \`count_vowels("sky")\` return, and why?`;

function answerFor(mode, language, message) {
  if (mode === 'debug') return { text: DEBUG_ANSWER, sources: [] };
  if (mode === 'practice') return { text: /```|def |My answer/i.test(message) ? FEEDBACK_ANSWER : EXERCISE_ANSWER, sources: [] };
  return explainAnswer(language);
}

function titleFrom(message) {
  const first = message.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  const t = first || 'Code question';
  return t.length > 60 ? `${t.slice(0, 59).replace(/\s+\S*$/, '')}…` : t;
}

// ---------------------------------------------------------------- chat function (SSE)
async function chat(req, res, uid) {
  const body = await readJson(req);
  const reject = (status, code, message, extra = {}) =>
    send(req, res, status, { error: { code, message, retryable: status === 429 || status >= 500, ...extra } });
  if (!body || typeof body.message !== 'string' || !body.message.trim() || !['explain', 'debug', 'practice'].includes(body.mode)) {
    return reject(400, 'INVALID_REQUEST', "Something about that request wasn't quite right.");
  }
  if (body.message.length > 12000) return reject(413, 'MESSAGE_TOO_LONG', 'That message is too long.');

  let conv;
  if (body.conversation_id) {
    conv = conversations.get(body.conversation_id);
    if (!conv || conv.user_id !== uid) return reject(404, 'CONVERSATION_NOT_FOUND', "We couldn't find that conversation.");
    if ([...turns.values()].some((t) => t.conversation_id === conv.id && t.status === 'streaming')) {
      return reject(409, 'TURN_IN_PROGRESS', 'CodeBloom is still writing the previous answer.');
    }
  } else {
    const ts = now();
    conv = { id: randomUUID(), user_id: uid, title: titleFrom(body.message), mode: body.mode, language: body.programming_language, created_at: ts, updated_at: ts };
    conversations.set(conv.id, conv);
  }
  conv.mode = body.mode;
  conv.language = body.programming_language;
  conv.updated_at = now();

  const turn = { id: randomUUID(), user_id: uid, conversation_id: conv.id, status: 'streaming', cancel: false };
  turns.set(turn.id, turn);
  const common = { user_id: uid, conversation_id: conv.id, generation_request_id: turn.id, mode: body.mode, language: body.programming_language };
  const userMsg = addMessage({ ...common, role: 'user', content: body.message, status: 'completed' });
  const asst = addMessage({ ...common, role: 'assistant', content: '', status: 'streaming' });

  let open = true;
  res.on('close', () => {
    open = false;
  });
  res.writeHead(200, { ...cors(req), 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', 'X-Request-Id': randomUUID() });
  const emit = (event, data) => {
    if (open) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  emit('meta', {
    request_id: randomUUID(),
    turn_id: turn.id,
    conversation_id: conv.id,
    assistant_message_id: asst.id,
    user_message_id: userMsg.id,
    conversation_title: conv.title,
  });
  emit('status', { stage: 'retrieving' });
  await sleep(250);
  const { text, sources } = answerFor(body.mode, body.programming_language, body.message);
  emit('status', { stage: 'streaming', sources_found: sources.length });

  const slow = /\[slow\]/i.test(body.message);
  const pieces = text.match(/[\s\S]{1,18}/g) ?? [];
  for (const piece of pieces) {
    if (turn.cancel || !messages.has(asst.id)) break;
    asst.content += piece;
    emit('delta', { text: piece });
    await sleep(slow ? 110 : 12);
  }

  if (turn.cancel || !messages.has(asst.id)) {
    turn.status = 'interrupted';
    if (messages.has(asst.id)) asst.status = 'interrupted';
    emit('error', { code: 'GENERATION_INTERRUPTED', message: 'The answer was stopped.', retryable: true, turn_id: turn.id, status: 'interrupted' });
    if (open) res.end();
    return;
  }
  emit('status', { stage: 'saving' });
  await sleep(60);
  asst.status = 'completed';
  asst.sources = sources;
  turn.status = 'completed';
  conv.updated_at = now();
  emit('sources', { items: sources });
  emit('done', { turn_id: turn.id, status: 'completed', usage: { input_tokens: 420, output_tokens: Math.ceil(text.length / 4) } });
  if (open) res.end();
}

// ---------------------------------------------------------------- RPCs
function rpc(name, args, uid) {
  const own = (id) => {
    const c = conversations.get(id);
    return c && c.user_id === uid ? c : null;
  };
  const ownMessage = (id) => {
    const m = messages.get(id);
    return m && m.user_id === uid ? m : null;
  };
  switch (name) {
    case 'complete_onboarding': {
      const p = users.get(uid).profile;
      p.onboarded_at ??= now();
      return { status: 204 };
    }
    case 'touch_activity':
      return { status: 204 };
    case 'rename_conversation': {
      const c = own(args.p_conversation_id);
      if (!c) return pgError('PT404', 'CONVERSATION_NOT_FOUND', 404);
      const title = String(args.p_title ?? '').trim();
      if (!title || title.length > 120) return pgError('PT400', 'INVALID_REQUEST', 400);
      c.title = title;
      c.updated_at = now();
      return { status: 200, body: { id: c.id, title: c.title } };
    }
    case 'delete_conversation': {
      if (!own(args.p_conversation_id)) return pgError('PT404', 'CONVERSATION_NOT_FOUND', 404);
      deleteConversationRows(args.p_conversation_id);
      return { status: 204 };
    }
    case 'delete_all_conversations': {
      if (args.p_confirm !== 'DELETE_ALL_CONVERSATIONS') return pgError('PT400', 'INVALID_REQUEST', 400);
      for (const c of [...conversations.values()]) if (c.user_id === uid) deleteConversationRows(c.id);
      return { status: 204 };
    }
    case 'set_feedback': {
      const m = ownMessage(args.p_message_id);
      if (!m || m.role !== 'assistant') return pgError('PT404', 'MESSAGE_NOT_FOUND', 404);
      if (args.p_rating) feedback.set(m.id, args.p_rating);
      else feedback.delete(m.id);
      return { status: 204 };
    }
    case 'add_bookmark': {
      const m = ownMessage(args.p_message_id);
      if (!m || m.role !== 'assistant' || m.status !== 'completed') return pgError('PT404', 'MESSAGE_NOT_FOUND', 404);
      if (!bookmarks.has(m.id)) bookmarks.set(m.id, { user_id: uid, created_at: now() });
      return { status: 204 };
    }
    case 'remove_bookmark': {
      const b = bookmarks.get(args.p_message_id);
      if (b && b.user_id === uid) bookmarks.delete(args.p_message_id);
      return { status: 204 };
    }
    case 'cancel_turn': {
      const t = turns.get(args.p_turn_id);
      if (!t || t.user_id !== uid) return pgError('PT404', 'TURN_NOT_FOUND', 404);
      if (t.status === 'streaming') t.cancel = true;
      return { status: 204 };
    }
    default:
      return pgError('PGRST202', `Could not find the function public.${name}`, 404);
  }
}

// ---------------------------------------------------------------- REST reads
function restGet(table, params, uid) {
  switch (table) {
    case 'profiles':
      return [{ id: uid, ...users.get(uid).profile }];
    case 'conversations': {
      let rows = [...conversations.values()].filter((c) => c.user_id === uid);
      const id = eqParam(params, 'id');
      if (id) rows = rows.filter((c) => c.id === id);
      const title = params.get('title');
      if (title?.startsWith('ilike.')) {
        const re = ilikeMatcher(title.slice(6));
        rows = rows.filter((c) => re.test(c.title));
      }
      rows.sort((a, b) => b.updated_at.localeCompare(a.updated_at));
      const limit = Number(params.get('limit') ?? rows.length);
      return rows.slice(0, limit).map(convRow);
    }
    case 'messages': {
      const conversationId = eqParam(params, 'conversation_id');
      return [...messages.values()]
        .filter((m) => m.user_id === uid && (!conversationId || m.conversation_id === conversationId))
        .sort((a, b) => a.seq - b.seq)
        .map(messageRow);
    }
    case 'saved_explanations': {
      const rows = [];
      for (const [messageId, b] of bookmarks) {
        if (b.user_id !== uid) continue;
        const m = messages.get(messageId);
        const c = m && conversations.get(m.conversation_id);
        if (!m || !c) continue;
        const question = [...messages.values()].find((x) => x.generation_request_id === m.generation_request_id && x.role === 'user');
        rows.push({
          message_id: m.id,
          saved_at: b.created_at,
          conversation_id: c.id,
          mode: m.mode,
          language: m.language,
          content: m.content,
          conversation_title: c.title,
          question: question?.content ?? null,
        });
      }
      return rows.sort((a, b) => b.saved_at.localeCompare(a.saved_at));
    }
    case 'bookmarks':
      return [...bookmarks.entries()].filter(([, b]) => b.user_id === uid).map(([message_id]) => ({ message_id }));
    default:
      return null;
  }
}

// ---------------------------------------------------------------- server
const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);
  const path = url.pathname;
  try {
    if (req.method === 'OPTIONS') return send(req, res, 204);
    if (path === '/health') return send(req, res, 200, { ok: true, users: users.size });

    // --- auth
    if (path === '/auth/v1/signup' && req.method === 'POST') {
      await readJson(req);
      return send(req, res, 200, issueSession(createUser()));
    }
    if (path === '/auth/v1/token' && req.method === 'POST') {
      const body = await readJson(req);
      const uid = refreshTokens.get(body?.refresh_token ?? '');
      if (!uid || !users.has(uid)) return send(req, res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      refreshTokens.delete(body.refresh_token);
      return send(req, res, 200, issueSession(users.get(uid)));
    }
    if (path === '/auth/v1/user' && req.method === 'GET') {
      const uid = caller(req);
      if (!uid) return send(req, res, 403, { code: 403, error_code: 'user_not_found', msg: 'User from sub claim in JWT does not exist' });
      return send(req, res, 200, userJson(users.get(uid)));
    }
    if (path === '/auth/v1/logout') return send(req, res, 204);
    if (path === '/auth/v1/.well-known/jwks.json') return send(req, res, 200, { keys: [] });
    if (path === '/auth/v1/settings') return send(req, res, 200, { external: { anonymous_users: true, email: false }, disable_signup: false });

    // --- functions
    if (path.startsWith('/functions/v1/')) {
      const name = path.slice('/functions/v1/'.length);
      const uid = caller(req);
      if (!uid) return send(req, res, 401, { error: { code: 'SESSION_REQUIRED', message: "We couldn't restore your private session.", retryable: true } });
      if (name === 'chat' && req.method === 'POST') return chat(req, res, uid);
      if (name === 'data-delete' && req.method === 'POST') {
        const body = await readJson(req);
        if (body?.confirm !== 'DELETE_ALL_MY_DATA') return send(req, res, 400, { error: { code: 'INVALID_REQUEST', message: 'Confirmation missing.', retryable: false } });
        for (const c of [...conversations.values()]) if (c.user_id === uid) deleteConversationRows(c.id);
        for (const t of [...turns.values()]) if (t.user_id === uid) turns.delete(t.id);
        users.delete(uid);
        return send(req, res, 200, { status: 'completed' });
      }
      return send(req, res, 404, { error: { code: 'INVALID_REQUEST', message: 'Unknown function', retryable: false } });
    }

    // --- PostgREST
    if (path.startsWith('/rest/v1/')) {
      const uid = caller(req);
      if (!uid) {
        // A validly issued token whose user was deleted sees no rows (like RLS); anything else is rejected.
        if (knownToken(req) && req.method === 'GET') return send(req, res, 200, []);
        return send(req, res, 401, { code: 'PGRST301', message: 'JWT expired', details: null, hint: null });
      }
      const rest = path.slice('/rest/v1/'.length);
      if (rest.startsWith('rpc/') && req.method === 'POST') {
        const args = (await readJson(req)) ?? {};
        const out = rpc(rest.slice(4), args, uid);
        return send(req, res, out.status, out.body);
      }
      if (req.method === 'PATCH' && rest === 'profiles') {
        const body = (await readJson(req)) ?? {};
        if (eqParam(url.searchParams, 'id') !== uid) return send(req, res, 204);
        const allowed = ['preferred_language', 'explanation_language', 'experience_level', 'explanation_depth', 'enter_to_send', 'reduce_motion'];
        const p = users.get(uid).profile;
        for (const k of allowed) if (k in body) p[k] = body[k];
        return send(req, res, 204);
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const rows = restGet(rest, url.searchParams, uid);
        if (rows === null) return send(req, res, 404, { code: '42P01', message: `relation "public.${rest}" does not exist`, details: null, hint: null });
        const range = { 'Content-Range': rows.length ? `0-${rows.length - 1}/${rows.length}` : `*/0` };
        if (req.method === 'HEAD') return send(req, res, 200, undefined, range);
        return send(req, res, 200, rows, range);
      }
      return send(req, res, 405, { code: 'PGRST105', message: 'Method not allowed', details: null, hint: null });
    }
    return send(req, res, 404, { message: 'not found' });
  } catch (err) {
    console.error('[fake-supabase]', err);
    if (!res.headersSent) send(req, res, 500, { message: 'fake backend error' });
    else res.end();
  }
});

server.listen(PORT, () => console.log(`[fake-supabase] listening on http://localhost:${PORT}`));
