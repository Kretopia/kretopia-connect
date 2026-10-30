import { describe, expect, it, vi } from 'vitest';
// @ts-ignore Deno module's remote type imports are resolved by Vitest, not the browser compiler.
import { gateAiCall, releaseAiCredit } from '../../../supabase/functions/_shared/aiRateLimit';

describe('Cloud reservation contract', () => {
  it('reserves against the server-selected owner and returns personal denial', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: false, reason: 'allowance', used: 30, cap: 30 }], error: null });
    const gate = await gateAiCall({ rpc } as never, 'validated-owner', 'kreto_message', 1);
    expect(rpc).toHaveBeenCalledWith('try_reserve_ai_credit', { _user_id: 'validated-owner', _feature: 'kreto_message', _units: 1, _est_credits: null });
    expect(gate.allowed).toBe(false);
    if (!("response" in gate)) throw new Error('Expected denial');
    expect(gate.response.status).toBe(429);
    expect(await gate.response.json()).toMatchObject({ code: 'AI_ALLOWANCE_EXHAUSTED', used: 30, cap: 30 });
  });
  it('returns backend envelope denial separately', async () => {
    const rpc = vi.fn().mockResolvedValue({ data: [{ allowed: false, reason: 'budget', used: 0, cap: 0 }], error: null });
    const gate = await gateAiCall({ rpc } as never, 'validated-owner', 'kreto_message', 1);
    if (!("response" in gate)) throw new Error('Expected denial');
    expect(gate.response.status).toBe(429);
    expect(await gate.response.json()).toMatchObject({ code: 'AI_BUDGET_EXHAUSTED' });
  });
  it('fails closed when reservation cannot be verified', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const gate = await gateAiCall({ rpc: vi.fn().mockResolvedValue({ data: null, error: { message: 'unavailable' } }) } as never, 'validated-owner', 'kreto_message');
    if (!("response" in gate)) throw new Error('Expected denial');
    expect(gate.response.status).toBe(500);
    vi.restoreAllMocks();
  });
  it('releases the same owner feature reservation', async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    await releaseAiCredit({ rpc } as never, 'validated-owner', 'kreto_message', 1);
    expect(rpc).toHaveBeenCalledWith('release_ai_credit', { _user_id: 'validated-owner', _feature: 'kreto_message', _units: 1, _est_credits: null });
  });
});