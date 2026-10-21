/**
 * Guard against regressions to the pre-Tiramisu Arkiv SDK API and schema.
 *
 * Scans app source (lib/, app/, components/) for patterns that break on
 * SDK 0.8 / the Tiramisu testnet.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');
const DIRS = ['lib', 'app', 'components'];
// Display-only SDK code samples
const IGNORE = new Set(['app/admin/m1-exam/page.tsx']);

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = join(dir, name);
    const stat = statSync(join(ROOT, rel));
    if (stat.isDirectory()) out.push(...sourceFiles(rel));
    else if (/\.(ts|tsx)$/.test(name) && !IGNORE.has(rel)) out.push(rel);
  }
  return out;
}

const FILES = DIRS.flatMap(sourceFiles).map((rel) => ({
  rel,
  code: readFileSync(join(ROOT, rel), 'utf8'),
}));

const FORBIDDEN: Array<[string, RegExp]> = [
  ['buildQuery() (use arkivSelect/select)', /\.buildQuery\(/],
  ['updateEntity (use patchEntity / replaceArkivEntity)', /\.updateEntity\(/],
  ['expiresIn (use lifetimeFor / ExpirationTime)', /\bexpiresIn:\s/],
  ['withAttributes/withPayload (use select fields)', /\.with(Attributes|Payload)\(/],
  ['@arkiv-network/sdk/accounts (use viem/accounts)', /@arkiv-network\/sdk\/accounts/],
  ['braga chain import', /\bbraga\b.*from '@arkiv-network\/sdk\/chains'/],
  ['Braga explorer host', /explorer\.braga\.hoodi\.arkiv\.network/],
  ["eqAttr('key') (key is reserved; use getEntityByKey)", /eqAttr\(['"]key['"]/],
  ['legacy {key, value} attribute arrays', /\{\s*key:\s*['"][A-Za-z_]+['"],\s*value:/],
];

describe('Arkiv SDK 0.8 migration guard', () => {
  for (const [label, pattern] of FORBIDDEN) {
    it(`no ${label}`, () => {
      const hits = FILES.filter(({ code }) => pattern.test(code)).map(({ rel }) => rel);
      expect(hits).toEqual([]);
    });
  }

  it('attribute names in eqAttr/getAttr calls are snake_case', () => {
    const bad: string[] = [];
    const re = /\b(?:eqAttr|getAttr|readAttr)\((?:[\w.]+,\s*)?['"]([^'"]+)['"]/g;
    for (const { rel, code } of FILES) {
      for (const m of code.matchAll(re)) {
        if (!/^[a-z][a-z0-9_]*$/.test(m[1])) bad.push(`${rel}: ${m[1]}`);
      }
    }
    expect(bad).toEqual([]);
  });
});
