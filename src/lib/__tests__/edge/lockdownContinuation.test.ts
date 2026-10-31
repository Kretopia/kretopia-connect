import { webcrypto } from 'node:crypto';
import { beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const world = vi.hoisted(() => ({
  current: '', handlers: {} as Record<string, (req: Request) => Promise<Response>>,
  from: vi.fn(), rpc: vi.fn(), fetch: vi.fn(), perimeter: vi.fn(),
}));
vi.mock('https://deno.land/std@0.190.0/http/server.ts', () => ({ serve: (handler: (req: Request) => Promise<Response>) => { world.handlers[world.current] = handler; } }));
vi.mock('https://esm.sh/@supabase/supabase-js@2.57.2', () => ({ createClient: () => ({ from: world.from, rpc: world.rpc }) }));
vi.mock('https://esm.sh/@supabase/supabase-js@2', () => ({ createClient: () => ({ from: world.from, rpc: world.rpc }) }));
vi.mock('../../../../supabase/functions/_shared/publicPerimeter.ts', () => ({ publicPerimeter: world.perimeter }));

beforeAll(async () => {
  vi.stubGlobal('Deno', { serve: (handler: (req: Request) => Promise<Response>) => { world.handlers[world.current] = handler; } });
  world.current = 'book-meeting'; await import('../../../../supabase/functions/book-meeting/index.ts');
  world.current = 'public-digital-presence'; await import('../../../../supabase/functions/public-digital-presence/index.ts');
});
beforeEach(() => {
  vi.resetAllMocks();
  vi.stubGlobal('crypto', webcrypto);
  const env: Record<string, string> = { PUBLIC_PRESENCE_SEARCH_ENABLED: 'true', SUPABASE_URL: 'https://backend.test', SUPABASE_SERVICE_ROLE_KEY: 'test-service', FIRECRAWL_API_KEY: 'test-search', LOVABLE_API_KEY: 'test-model' };
  vi.stubGlobal('Deno', { env: { get: (key: string) => env[key] } });
  vi.stubGlobal('fetch', world.fetch);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  world.perimeter.mockResolvedValue(undefined);
  world.rpc.mockResolvedValue({ data: true, error: null });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const request = (body: unknown) => new Request('https://edge.test', { method: 'POST', headers: { Origin: 'https://www.kretopia.com' }, body: JSON.stringify(body) });

describe.each(['book-meeting', 'public-digital-presence'])('%s public perimeter', name => {
  it('rejects oversized bodies with 413 before privileged queries or provider calls', async () => {
    const response = await world.handlers[name](request({ extra: 'x'.repeat(64000) }));
    expect(response.status).toBe(413);
    expect(world.from).not.toHaveBeenCalled(); expect(world.fetch).not.toHaveBeenCalled();
  });
  it('does not reflect an unauthorized origin or meter a preflight', async () => {
    const response = await world.handlers[name](new Request('https://edge.test', { method: 'OPTIONS', headers: { Origin: 'https://evil.test' } }));
    expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    expect(response.headers.get('Vary')).toBe('Origin');
    expect(world.perimeter).not.toHaveBeenCalled();
  });
});
describe('public search provider boundary', () => {
  it('hides provider error bodies', async () => {
    world.fetch.mockResolvedValue(new Response('private-provider-secret', { status: 503 }));
    const response = await world.handlers['public-digital-presence'](request({ query: 'Creator' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Something went wrong' });
  });
  it('strips unknown fields before spending and provider work', async () => {
    world.fetch.mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
    const response = await world.handlers['public-digital-presence'](request({ query: 'Creator', admin: true, limit: 999, url: 'https://evil.test' }));
    expect(response.status).toBe(200);
    expect(JSON.parse(world.fetch.mock.calls[0][1].body)).toEqual({ query: 'Creator', limit: 20 });
  });
});