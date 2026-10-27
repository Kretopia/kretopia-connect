import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const response = (title = 'Real source') => new Response(JSON.stringify({ available: true, results: [{ title, url: 'https://example.com' }] }), { headers: { 'Content-Type': 'application/json' } });

describe('fast public Web search', () => {
  it('shares identical public queries and serves repeat searches without another paid request', async () => {
    vi.resetModules();
    const fetcher = vi.fn().mockResolvedValue(response());
    vi.stubGlobal('fetch', fetcher);
    const { invokePublicWebSearch, getCachedPublicWebSearch } = await import('../publicWebSearchEndpoint');
    const [a, b] = await Promise.all([invokePublicWebSearch('Kretopia'), invokePublicWebSearch(' kretopia ')]);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(getCachedPublicWebSearch('KRETOPIA')?.results).toHaveLength(1);
    await invokePublicWebSearch('Kretopia');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('publishes real sources before the AI response finishes', async () => {
    vi.resetModules();
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const encoder = new TextEncoder();
    const body = new ReadableStream<Uint8Array>({ start(controller) { streamController = controller; } });
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(body, { headers: { 'Content-Type': 'application/x-ndjson' } })));
    const { invokePublicWebSearch } = await import('../publicWebSearchEndpoint');
    const update = vi.fn();
    let complete = false;
    const result = invokePublicWebSearch('Kretopia', undefined, update).then(data => { complete = true; return data; });
    streamController?.enqueue(encoder.encode(JSON.stringify({ available: true, results: [{ title: 'Source', url: 'https://example.com' }], phase: 'web' }) + '\n'));
    await vi.waitFor(() => expect(update).toHaveBeenCalledWith(expect.objectContaining({ phase: 'web' })));
    expect(complete).toBe(false);
    streamController?.enqueue(encoder.encode(JSON.stringify({ available: true, results: [{ title: 'Source', url: 'https://example.com' }], phase: 'complete', aiAvailable: true }) + '\n'));
    streamController?.close();
    expect((await result).aiAvailable).toBe(true);
  });

  it('isolates subscriber cancellation and does not cache unavailable responses', async () => {
    vi.resetModules();
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ available: false })));
    vi.stubGlobal('fetch', fetcher);
    const { invokePublicWebSearch, getCachedPublicWebSearch } = await import('../publicWebSearchEndpoint');
    const aborter = new AbortController();
    const first = invokePublicWebSearch('Kretopia', aborter.signal);
    const second = invokePublicWebSearch('Kretopia');
    aborter.abort();
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    expect((await second).available).toBe(false);
    expect(getCachedPublicWebSearch('Kretopia')).toBeUndefined();
    fetcher.mockResolvedValue(response());
    expect((await invokePublicWebSearch('Kretopia')).available).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('expires recent results instead of presenting stale sources indefinitely', async () => {
    vi.resetModules();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(() => Promise.resolve(response())));
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    const { invokePublicWebSearch, getCachedPublicWebSearch } = await import('../publicWebSearchEndpoint');
    await invokePublicWebSearch('Kretopia');
    now.mockReturnValue(301001);
    expect(getCachedPublicWebSearch('Kretopia')).toBeUndefined();
  });
});