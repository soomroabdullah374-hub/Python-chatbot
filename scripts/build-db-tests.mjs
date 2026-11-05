#!/usr/bin/env node
// Converts pgTAP test files (supabase/tests/*.test.sql) into a single PL/pgSQL DO block that
// runs every statement, collects the TAP output and then RAISEs it as an exception. The
// exception rolls back all fixtures, so the block can be executed against a hosted project
// through any SQL console (Supabase MCP `execute_sql`, Studio) when `supabase test db` is not
// available. Usage: node scripts/build-db-tests.mjs [file...]
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

const testsDir = join(process.cwd(), 'supabase', 'tests');
const outDir = join(testsDir, '.generated');
const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(testsDir).filter((f) => f.endsWith('.test.sql')).map((f) => join(testsDir, f));

/** Split SQL into statements on `;` outside quotes, dollar quotes and comments. */
export function splitStatements(sql) {
  const out = [];
  let buf = '';
  let i = 0;
  let dollarTag = null;
  let inSingle = false;
  while (i < sql.length) {
    const ch = sql[i];
    if (dollarTag) {
      if (sql.startsWith(dollarTag, i)) {
        buf += dollarTag;
        i += dollarTag.length;
        dollarTag = null;
        continue;
      }
      buf += ch;
      i += 1;
      continue;
    }
    if (inSingle) {
      buf += ch;
      i += 1;
      if (ch === "'") {
        if (sql[i] === "'") {
          buf += "'";
          i += 1;
        } else {
          inSingle = false;
        }
      }
      continue;
    }
    if (ch === '-' && sql[i + 1] === '-') {
      const nl = sql.indexOf('\n', i);
      i = nl === -1 ? sql.length : nl + 1;
      buf += '\n';
      continue;
    }
    if (ch === "'") {
      inSingle = true;
      buf += ch;
      i += 1;
      continue;
    }
    if (ch === '$') {
      const m = /^\$[A-Za-z_]*\$/.exec(sql.slice(i));
      if (m) {
        dollarTag = m[0];
        buf += dollarTag;
        i += dollarTag.length;
        continue;
      }
    }
    if (ch === ';') {
      if (buf.trim()) out.push(buf.trim());
      buf = '';
      i += 1;
      continue;
    }
    buf += ch;
    i += 1;
  }
  if (buf.trim()) out.push(buf.trim());
  return out;
}

const ASSERTIONS = /^select\s+(is|isnt|ok|throws_ok|lives_ok|results_eq|is_empty|isnt_empty)\s*\(/i;

for (const file of files) {
  const sql = readFileSync(file, 'utf8');
  const statements = splitStatements(sql).filter((s) => !/^(begin|rollback|commit)$/i.test(s));
  const planMatch = /select\s+plan\((\d+)\)/i.exec(sql);
  const assertions = statements.filter((s) => ASSERTIONS.test(s)).length;
  if (planMatch && Number(planMatch[1]) !== assertions) {
    console.error(`${basename(file)}: plan(${planMatch[1]}) but ${assertions} assertions found`);
    process.exitCode = 1;
  }
  const lines = [
    `-- GENERATED from ${basename(file)} by scripts/build-db-tests.mjs — do not edit.`,
    '-- Runs the pgTAP suite and raises its TAP output; the raise rolls every fixture back.',
    'create extension if not exists pgtap with schema extensions;',
    'create or replace function pg_temp.tap(_n integer, _sql text) returns text language plpgsql as $f$',
    'declare _line text;',
    'begin',
    "  if _sql ~* '^\\s*select\\M' then",
    "    execute format('select string_agg(t.x::text, chr(10)) from (%s) as t(x)', _sql) into _line;",
    "    return coalesce(_line, '');",
    '  end if;',
    '  execute _sql;',
    '  return null;',
    'exception when others then',
    "  return 'not ok - statement ' || _n || ' raised ' || sqlstate || ': ' || sqlerrm;",
    'end $f$;',
    'do $runner$',
    "declare _o text := '';",
    'begin',
  ];
  statements.forEach((stmt, idx) => {
    const tag = `$s${idx}$`;
    lines.push(`_o := _o || coalesce(pg_temp.tap(${idx + 1}, ${tag}${stmt}${tag}) || chr(10), '');`);
  });
  lines.push("raise exception using message = 'TAP-OUTPUT' || chr(10) || _o;", 'end', '$runner$;', '');
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, basename(file).replace(/\.test\.sql$/, '.run.sql'));
  writeFileSync(target, lines.join('\n'));
  console.log(`${basename(file)}: ${statements.length} statements, ${assertions} assertions -> ${target}`);
}
