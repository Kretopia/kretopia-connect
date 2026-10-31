import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const functions = resolve(__dirname, '../../../../supabase/functions');
const entries = readdirSync(functions, { withFileTypes: true })
  .filter(entry => entry.isDirectory() && entry.name !== '_shared')
  .map(entry => ({ name: entry.name, file: resolve(functions, entry.name, 'index.ts') }))
  .filter(entry => existsSync(entry.file));

describe('lockdown continuation source regressions', () => {
  it('keeps the private VAPID-key-returning endpoint absent', () => {
    expect(existsSync(resolve(functions, 'generate-vapid-keys'))).toBe(false);
  });
  it('has no literal wildcard or empty allowed origin in function entrypoints', () => {
    const violations = entries.filter(entry => /['"]Access-Control-Allow-Origin['"]\s*:\s*['"](?:\*|)['"]/.test(readFileSync(entry.file, 'utf8')));
    expect(violations.map(entry => entry.name)).toEqual([]);
  });
  it('has no substring-based auth.includes credential check in entrypoints', () => {
    const violations = entries.filter(entry => /\bauth\.includes\(/.test(readFileSync(entry.file, 'utf8')));
    expect(violations.map(entry => entry.name)).toEqual([]);
  });
});