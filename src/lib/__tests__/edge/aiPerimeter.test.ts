import { webcrypto } from 'node:crypto';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { requireAiCaller } from '../../../../supabase/functions/_shared/aiPerimeter';
import { safeError } from '../../../../supabase/functions/_shared/guard';

const state = vi.hoisted(() => ({ getUser: vi.fn(), rpc: vi.fn(), createClient: vi.fn() }));
vi.mock('npm:@supabase/supabase-js@2', () => ({ createClient: state.createClient }));

const config: Record<string, string> = {
  SUPABASE_URL: 'https://deployment.test', SUPABASE_SERVICE_ROLE_KEY: 'test-service',
  SUPABASE_ANON_KEY: 'test-public', LEGACY_SUPABASE_URL: 'https://account.test',
  LEGACY_SUPABASE_ANON_KEY: 'test-account-public',
};
const request = (token = 'valid-test-token') => new Request('https://function.test', { headers: { Authorization: `Bearer ${token}` } });

describe('AI account perimeter', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.stubGlobal('crypto', webcrypto);
    vi.stubGlobal('Deno', { env: { get: (name: string) => config[name] } });
    state.getUser.mockResolvedValue({ data: { user: { id: 'owner-id' } }, error: null });
    state.rpc.mockResolvedValue({ data: [{ allowed: true }], error: null });
    state.createClient.mockReturnValue({ auth: { getUser: state.getUser }, rpc: state.rpc });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('validates the configured account backend and uses the deployment limiter at 20/min', async () => {
    await requireAiCaller(request(), 'enhance-task');
    expect(state.createClient.mock.calls.map(call => call.slice(0, 2))).toEqual([
      ['https://account.test', 'test-account-public'], ['https://deployment.test', 'test-service'],
    ]);
    expect(state.getUser).toHaveBeenCalledWith('valid-test-token');
    expect(state.rpc).toHaveBeenCalledWith('consume_ai_feature_call', expect.objectContaining({ _daily_cap: 20, _feature_key: expect.stringMatching(/^perimeter:enhance-task:/) }));
  });

  it('rejects an anonymous credential before reserving any calls', async () => {
    state.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(requireAiCaller(request('anon'), 'enhance-task')).rejects.toMatchObject({ status: 401 });
    expect(state.rpc).not.toHaveBeenCalled();
    expect(state.createClient).toHaveBeenCalledTimes(1);
  });

  it('does not try another backend when account validation fails', async () => {
    state.getUser.mockRejectedValue(new Error('account unavailable'));
    await expect(requireAiCaller(request(), 'enhance-task')).rejects.toMatchObject({ status: 401 });
    expect(state.getUser).toHaveBeenCalledTimes(1);
    expect(state.rpc).not.toHaveBeenCalled();
  });

  it('returns 429 and Retry-After when the same persisted limiter denies', async () => {
    state.rpc.mockResolvedValue({ data: [{ allowed: false }], error: null });
    let response: Response | undefined;
    try { await requireAiCaller(request(), 'enhance-task'); }
    catch (error) { response = safeError(error); }
    expect(response?.status).toBe(429);
    expect(Number(response?.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('fails closed if legacy configuration is incomplete instead of using Cloud identity', async () => {
    vi.stubGlobal('Deno', { env: { get: (name: string) => name === 'LEGACY_SUPABASE_ANON_KEY' ? undefined : config[name] } });
    await expect(requireAiCaller(request(), 'enhance-task')).rejects.toThrow('AI perimeter configuration unavailable');
    expect(state.createClient).not.toHaveBeenCalled();
  });

  it('uses deployment identity only when no separate account backend is configured', async () => {
    vi.stubGlobal('Deno', { env: { get: (name: string) => name.startsWith('LEGACY_') ? undefined : config[name] } });
    await requireAiCaller(request(), 'enhance-task');
    expect(state.createClient.mock.calls[0].slice(0, 2)).toEqual(['https://deployment.test', 'test-public']);
  });
});