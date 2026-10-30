import { beforeEach, describe, expect, it, vi } from 'vitest';
const world = vi.hoisted(() => ({ rpc: vi.fn(), session: { access_token: 'test-session' } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: { getSession: async () => ({ data: { session: world.session } }) },
  rpc: world.rpc,
} }));
import { streamCopilot, loadAiCreditOverview, deleteKretoAttachment, openKretoAttachment } from '../thriveCopilot';

const fetchMock = vi.fn();
beforeEach(() => { fetchMock.mockReset(); world.rpc.mockReset().mockResolvedValue({}); vi.stubGlobal('fetch', fetchMock); });

describe('same Cloud control endpoint for UI and reservations', () => {
  it('reads overview with the same session and endpoint used for chat', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ envelope: { credits_reserved: 0.006 }, mine: [{ feature: 'kreto_message', used: 21, reserved: 4, cap: 30 }] })));
    const overview = await loadAiCreditOverview();
    expect(overview?.mine[0].reserved).toBe(4);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/kreto-resources');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mode: 'overview' });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer test-session');
    expect(world.rpc).not.toHaveBeenCalled();
  });
  it('takes the personal allowance denial path and never reads a stream', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'AI_ALLOWANCE_EXHAUSTED', used: 30, cap: 30 }), { status: 429 }));
    const onError = vi.fn(), onDelta = vi.fn();
    await streamCopilot({ messages: [{ role: 'user', content: 'brief' }], surface: 'home', conversationId: 'conv', onError, onDelta, onDone: vi.fn() });
    expect(onError).toHaveBeenCalledWith("You've used today's 30/30 for this. Resets at midnight UTC.");
    expect(onDelta).not.toHaveBeenCalled();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).mode).toBe('chat');
  });
  it('takes the backend ceiling denial path separately', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ code: 'AI_BUDGET_EXHAUSTED' }), { status: 429 }));
    const onError = vi.fn();
    await streamCopilot({ messages: [{ role: 'user', content: 'brief' }], surface: 'home', conversationId: 'conv', onError, onDelta: vi.fn(), onDone: vi.fn() });
    expect(onError).toHaveBeenCalledWith("This backend's AI ceiling is reached for today. Your draft is kept. Resets at midnight UTC.");
  });
  it('deletes a retained original through the authenticated endpoint', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ deleted: true })));
    await deleteKretoAttachment('attachment');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ mode: 'delete', id: 'attachment' });
  });
  it('never opens an expired or inaccessible reference', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'This attachment has expired.' }), { status: 410 }));
    await expect(openKretoAttachment('expired')).rejects.toThrow('This attachment has expired.');
  });
});