import { priceProviderUsage } from './providerUsage.ts';

// Existing feature gate reserves before this call. This observer never invents
// usage from text length and never converts absent receipts into zero cost.
export async function measuredModelFetch(admin: any, userId: string, feature: string, input: string, init: RequestInit, baseFetch: typeof fetch = fetch): Promise<Response> {
  const body = JSON.parse(String(init.body ?? '{}'));
  const gateway = input.startsWith('https://ai.gateway.lovable.dev/');
  const model = typeof body.model === 'string' ? body.model : 'legacy-unreported';
  let pricing: any = null;
  if (gateway) {
    const { data } = await admin.from('ai_model_pricing').select('pricing,fetched_at').eq('model', model).maybeSingle();
    pricing = data?.pricing;
    if (!pricing || Date.now() - Date.parse(data.fetched_at) > 86400000) {
      const key = Deno.env.get('LOVABLE_API_KEY');
      if (!key) throw new Error('Gateway pricing unavailable');
      const response = await fetch('https://ai.gateway.lovable.dev/v1/models', { headers: { Authorization: `Bearer ${key}` } });
      const catalog = await response.json();
      if (!response.ok || String(catalog.workspace_models).startsWith('public_only')) throw new Error('Workspace pricing unavailable');
      pricing = catalog.data?.find((m: any) => m.id === model)?.pricing;
      if (!pricing) throw new Error('Model pricing unavailable');
      const { error } = await admin.from('ai_model_pricing').upsert({ model, pricing, fetched_at: new Date().toISOString() });
      if (error) throw new Error('Could not store pricing');
    }
  }
  const id = crypto.randomUUID();
  const { error: insertError } = await admin.from('ai_model_calls').insert({ id, user_id: userId, feature, model, pricing_snapshot: pricing });
  if (insertError) throw new Error('Could not create usage receipt');
  if (gateway && body.stream) body.stream_options = { ...body.stream_options, include_usage: true };
  let upstream: Response;
  try { upstream = await baseFetch(input, { ...init, body: JSON.stringify(body) }); }
  catch (error) { await admin.from('ai_model_calls').update({ status: 'usage_missing' }).eq('id', id); throw error; }
  const requestId = upstream.headers.get('X-Lovable-AIG-Run-ID');
  await admin.from('ai_model_calls').update({ gateway_request_id: requestId }).eq('id', id);
  if (!upstream.ok) { await admin.from('ai_model_calls').update({ status: 'usage_missing' }).eq('id', id); return upstream; }
  const record = async (receipt: any, receiptModel?: string) => {
    try {
      if (!pricing && receiptModel) {
        const { data } = await admin.from('ai_model_pricing').select('pricing').eq('model', receiptModel).maybeSingle();
        pricing = data?.pricing;
        await admin.from('ai_model_calls').update({ model: receiptModel }).eq('id', id);
      }
      const priced = priceProviderUsage(receipt, pricing);
      const { error } = await admin.rpc('record_ai_model_usage', { _call_id: id, _usage: receipt, _input: priced.input, _output: priced.output, _cached: priced.cached, _credits: priced.credits, _pricing: pricing });
      if (error) throw new Error('Usage settlement failed');
    } catch {
      await admin.from('ai_model_calls').update({ status: 'usage_missing', usage: receipt ?? null }).eq('id', id);
    }
  };
  if (!upstream.headers.get('Content-Type')?.includes('text/event-stream')) {
    const result = await upstream.clone().json().catch(() => null);
    await record(result?.usage, result?.model);
    return upstream;
  }
  let buffer = '', usage: any = null, receiptModel: string | undefined;
  const decoder = new TextDecoder();
  const reader = upstream.body?.getReader();
  if (!reader) { await record(null); return upstream; }
  const observe = (chunk: Uint8Array) => {
    buffer += decoder.decode(chunk, { stream: true });
    let index: number;
    while ((index = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, index).trim(); buffer = buffer.slice(index + 1);
      if (!line.startsWith('data: ') || line === 'data: [DONE]') continue;
      try { const event = JSON.parse(line.slice(6)); if (event.usage) usage = event.usage; if (event.model) receiptModel = event.model; } catch { /* non-JSON SSE event */ }
    }
  };
  const stream = new ReadableStream({
    async pull(controller) {
      try { const result = await reader.read(); if (result.done) { await record(usage, receiptModel); controller.close(); } else { observe(result.value); controller.enqueue(result.value); } }
      catch (error) { await record(usage, receiptModel); controller.error(error); }
    },
    async cancel() { await reader.cancel(); await record(usage, receiptModel); },
  });
  return new Response(stream, { status: upstream.status, headers: upstream.headers });
}