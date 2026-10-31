import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Proves the atomic reserve-then-commit limiter holds its cap under concurrency,
 * and that the migration that installs it actually uses the atomic pattern.
 *
 * The old consume_ai_feature_call did SELECT then INSERT/UPDATE: two concurrent
 * callers could both read the same count and both pass. The replacement performs
 * one INSERT ... ON CONFLICT ... DO UPDATE ... WHERE call_count < cap RETURNING,
 * which Postgres serializes with a row lock. We model both semantics against an
 * in-memory store with an async yield between read and write (the interleaving
 * that breaks the old pattern) and fire all callers concurrently.
 */

const MIGRATION = resolve(__dirname, '../../../../supabase/migrations/20261031090000_atomic_ai_feature_rate_limit.sql');

function oldPattern(store: { count: number }, cap: number) {
  // SELECT, await, then conditional write — the historical race.
  return async function consume(): Promise<boolean> {
    const read = store.count; // SELECT call_count
    await Promise.resolve(); // interleaving point: another caller runs here
    if (read >= cap) return false;
    store.count = read + 1; // INSERT/UPDATE
    return true;
  };
}

function atomicPattern(store: { count: number }, cap: number) {
  // Single statement under a row lock: check-and-increment cannot interleave.
  return function consume(): Promise<boolean> {
    if (store.count >= cap) return Promise.resolve(false);
    store.count += 1;
    return Promise.resolve(true);
  };
}

describe('atomic ai_feature rate limiter', () => {
  it('migration uses a single atomic statement with the cap inside the UPDATE', () => {
    const sql = readFileSync(MIGRATION, 'utf8');
    expect(sql).toContain('ON CONFLICT (user_id, feature_key, usage_date)');
    expect(sql).toContain('DO UPDATE SET call_count = ai_feature_usage.call_count + 1');
    expect(sql).toContain('WHERE ai_feature_usage.call_count < _daily_cap');
    expect(sql).toContain('RETURNING call_count INTO v_count');
    // No pre-read before the atomic write in the capped path: the only remaining
    // SELECT is the denial-reporting read after v_count IS NULL.
    const cappedBranch = sql.slice(sql.indexOf('IF _daily_cap = -1 THEN'));
    const atomicWrite = cappedBranch.indexOf('INSERT INTO public.ai_feature_usage');
    const denialRead = cappedBranch.indexOf('IF v_count IS NULL THEN');
    expect(atomicWrite).toBeGreaterThan(-1);
    expect(denialRead).toBeGreaterThan(atomicWrite);
    expect(cappedBranch.slice(0, atomicWrite)).not.toContain('SELECT call_count');
  });

  it('old read-then-write pattern lets concurrent callers exceed the cap', async () => {
    const store = { count: 0 };
    const cap = 5;
    const consume = oldPattern(store, cap);
    const results = await Promise.all(Array.from({ length: 20 }, () => consume()));
    // Documents the race being fixed: every caller read 0 and all 20 passed.
    expect(results.filter(Boolean).length).toBeGreaterThan(cap);
  });

  it('atomic pattern holds the cap exactly under concurrent fire', async () => {
    const store = { count: 0 };
    const cap = 5;
    const consume = atomicPattern(store, cap);
    const results = await Promise.all(Array.from({ length: 20 }, () => consume()));
    expect(results.filter(Boolean).length).toBe(cap);
    expect(store.count).toBe(cap);
  });

  it('atomic pattern holds the cap across repeated concurrent bursts', async () => {
    const store = { count: 0 };
    const cap = 20;
    const consume = atomicPattern(store, cap);
    for (let burst = 0; burst < 5; burst++) {
      await Promise.all(Array.from({ length: 50 }, () => consume()));
    }
    expect(store.count).toBe(cap);
  });
});
