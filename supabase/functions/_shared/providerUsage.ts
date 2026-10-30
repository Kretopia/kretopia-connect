export function priceProviderUsage(usage: any, pricing: any) {
  const input = usage?.prompt_tokens;
  const output = usage?.completion_tokens;
  const cached = usage?.prompt_tokens_details?.cached_tokens ?? 0;
  if (![input, output, cached].every(n => Number.isSafeInteger(n) && n >= 0) || cached > input) throw new Error('Provider token receipt unavailable');
  if (pricing?.cost_currency !== 'credits') throw new Error('Workspace credit pricing unavailable');
  const rate = (tiers: any[]) => {
    const tier = tiers?.find(t => input >= (t.min ?? 0) && (t.max == null || input <= t.max));
    const value = Number(tier?.cost);
    if (!Number.isFinite(value) || value < 0) throw new Error('Pricing tier unavailable');
    return value;
  };
  const details = usage?.prompt_tokens_details;
  if (details?.audio_tokens > 0 || details?.video_tokens > 0) throw new Error('Modality receipt requires separate pricing');
  const inputRate = rate(pricing.input?.text?.tiers);
  const cacheRate = cached ? rate(pricing.input?.text?.cache_read?.tiers) : 0;
  const outputRate = rate(pricing.output?.text?.tiers);
  return { input, output, cached, credits: (input - cached) * inputRate + cached * cacheRate + output * outputRate };
}