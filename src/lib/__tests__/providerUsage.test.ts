import { describe, expect, it } from 'vitest';
import { priceProviderUsage } from '../../../supabase/functions/_shared/providerUsage';
const pricing = { cost_currency: 'credits', input: { text: { tiers: [{ min: 0, cost: '0.000002' }], cache_read: { tiers: [{ min: 0, cost: '0.0000002' }] } } }, output: { text: { tiers: [{ min: 0, cost: '0.000012' }] } } };
describe('provider usage only', () => {
  it('matches the real gateway probe receipt from 30 October 2026', () => {
    expect(priceProviderUsage({ prompt_tokens: 26, completion_tokens: 30, prompt_tokens_details: { cached_tokens: 0 } }, pricing).credits).toBeCloseTo(0.000412, 12);
  });
  it('prices input and output separately without the former fixed 0.006', () => {
    expect(priceProviderUsage({ prompt_tokens: 3052, completion_tokens: 73 }, pricing).credits).toBeCloseTo(0.006980, 12);
  });
  it('subtracts cached input and applies its own rate', () => {
    expect(priceProviderUsage({ prompt_tokens: 1000, completion_tokens: 100, prompt_tokens_details: { cached_tokens: 500 } }, pricing).credits).toBeCloseTo(0.0023, 12);
  });
  it('never infers missing usage or records it as zero', () => {
    expect(() => priceProviderUsage(undefined, pricing)).toThrow('Provider token receipt unavailable');
  });
  it('refuses missing pricing instead of inventing a blended rate', () => {
    expect(() => priceProviderUsage({ prompt_tokens: 10, completion_tokens: 2 }, null)).toThrow('Workspace credit pricing unavailable');
  });
});