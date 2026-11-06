#!/usr/bin/env node
// Fails if anything that looks like a server-side secret ends up in files the browser can load
// (SECURITY.md "Secrets"): provider keys, Supabase secret/service-role keys, or JWTs whose role
// claim is service_role. Run after `next build`: `npm run check:bundle-secrets`.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOTS = ['.next/static', '.next/server/app'];
const TEXT = /\.(js|mjs|cjs|css|html|json|txt|map|rsc|body|meta)$/;

const PATTERNS = [
  { name: 'Groq API key', re: /gsk_[A-Za-z0-9]{20,}/g },
  { name: 'xAI API key', re: /xai-[A-Za-z0-9]{20,}/g },
  { name: 'OpenAI-style key', re: /sk-(?:proj-)?[A-Za-z0-9_-]{32,}/g },
  { name: 'Supabase secret key', re: /sb_secret_[A-Za-z0-9_-]{10,}/g },
  { name: 'Private key block', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/g },
  { name: 'Secret env name with value', re: /(?:XAI_API_KEY|GROQ_API_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY|IP_HASH_SALT)["']?\s*[:=]\s*["'][^"']{8,}["']/g },
];
const JWT = /eyJ[A-Za-z0-9_-]{8,}\.eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g;

function* walk(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) yield* walk(p);
    else if (TEXT.test(name) && st.size < 20 * 1024 * 1024) yield p;
  }
}

function jwtRole(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload?.role ?? null;
  } catch {
    return null;
  }
}

let scanned = 0;
const findings = [];
for (const root of ROOTS) {
  for (const file of walk(root)) {
    scanned += 1;
    const text = readFileSync(file, 'utf8');
    for (const { name, re } of PATTERNS) {
      re.lastIndex = 0;
      if (re.test(text)) findings.push(`${relative('.', file)}: ${name}`);
    }
    for (const m of text.matchAll(JWT)) {
      const role = jwtRole(m[0]);
      if (role === 'service_role' || role === 'supabase_admin') findings.push(`${relative('.', file)}: JWT with role ${role}`);
    }
  }
}

if (scanned === 0) {
  console.error('check-client-bundle: no build output found — run `next build` first.');
  process.exit(2);
}
if (findings.length) {
  console.error(`check-client-bundle: ${findings.length} possible secret(s) in build output:`);
  for (const f of findings) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`check-client-bundle: OK — scanned ${scanned} files, no provider keys, secret keys or service-role JWTs found.`);
