import { webcrypto } from 'node:crypto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { z } from 'zod';
import { corsFor, constantTimeEqual, requireServiceRole, requireUser, readJson, rateLimit, safeError, GuardError } from '../../../../supabase/functions/_shared/guard';

describe('edge guard', () => {
  beforeEach(() => { vi.stubGlobal('crypto', webcrypto); });
  it.each(['https://www.kretopia.com', 'https://kretopia.com', 'https://id-preview.lovable.app', 'https://draft.lovableproject.com'])('allows %s', origin => {
    expect(corsFor(new Request('https://edge.test', { headers: { Origin: origin } }))['Access-Control-Allow-Origin']).toBe(origin);
  });
  it.each(['http://kretopia.com', 'https://kretopia.com.evil.com', 'https://evil-lovable.app', 'https://lovable.app', 'null', 'https://draft.lovable.app:8443'])('does not reflect %s', origin => {
    const headers = corsFor(new Request('https://edge.test', { headers: { Origin: origin } }));
    expect(headers['Access-Control-Allow-Origin']).toBeUndefined(); expect(headers.Vary).toBe('Origin');
  });
  it('compares the full service credential, not a substring', async () => {
    expect(await constantTimeEqual('Bearer secret', 'Bearer secret')).toBe(true);
    expect(await constantTimeEqual('Bearer secret evil', 'Bearer secret')).toBe(false);
    vi.stubGlobal('Deno', { env: { get: () => 'secret' } });
    await expect(requireServiceRole(new Request('https://edge.test', { headers: { Authorization: 'prefix Bearer secret' } }))).rejects.toMatchObject({ status: 401 });
    vi.unstubAllGlobals();
  });
  it('rejects an anon key without a verified user', async () => {
    await expect(requireUser(new Request('https://edge.test', { headers: { Authorization: 'Bearer anon' } }), { auth: { getUser: async () => ({ data: { user: null }, error: null }) } })).rejects.toMatchObject({ status: 401 });
  });
  it('enforces 64000 bytes even without Content-Length', async () => {
    await expect(readJson(new Request('https://edge.test', { method: 'POST', body: JSON.stringify({ text: 'x'.repeat(64000) }) }), z.object({ text: z.string() }))).rejects.toMatchObject({ status: 413 });
  });
  it('returns field errors and strips unknown keys', async () => {
    const req = (value: unknown) => new Request('https://edge.test', { method: 'POST', body: JSON.stringify(value) });
    await expect(readJson(req({ age: 'bad' }), z.object({ age: z.number() }))).rejects.toMatchObject({ status: 400, payload: { fields: { age: expect.any(Array) } } });
    expect(await readJson(req({ age: 1, admin: true }), z.object({ age: z.number() }))).toEqual({ age: 1 });
  });
  it('uses the persisted limiter with 20/min and Retry-After', async () => {
    const rpc = vi.fn(async () => ({ data: [{ allowed: false }], error: null }));
    try { await rateLimit({ rpc }, 'owner', 'chat', 20); throw new Error('should deny'); }
    catch (error) { expect(error).toBeInstanceOf(GuardError); const response = safeError(error); expect(response.status).toBe(429); expect(Number(response.headers.get('Retry-After'))).toBeGreaterThan(0); }
    expect(rpc).toHaveBeenCalledWith('consume_ai_feature_call', expect.objectContaining({ _daily_cap: 20 }));
  });
  it('hides provider, SQL and stack details', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const response = safeError(new Error('SQL private provider secret'));
    expect(response.status).toBe(500); expect(await response.json()).toEqual({ error: 'Something went wrong' });
    expect(log).toHaveBeenCalled(); log.mockRestore();
  });
});