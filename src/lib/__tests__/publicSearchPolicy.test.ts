import { describe, it, expect, vi } from 'vitest';
import { authorizePublicSearch } from '../../../supabase/functions/_shared/publicSearchPolicy';
describe('prepared public search protection', () => {
  it('fails closed when atomic quota refuses consumption', async () => {
    await expect(authorizePublicSearch({query:'Alex'}, 'anonymous-client', {consume:async () => false})).rejects.toThrow('Search limit reached');
  });
  it('requires atomic quotas and limits provider results without scraping URLs', async () => {
    const consume = vi.fn(async () => true);
    expect(await authorizePublicSearch({query:'https://example.com/profile'}, 'anonymous-client', {consume})).toEqual({query:'https://example.com/profile',limit:20,scrape:false});
    expect(consume).toHaveBeenCalledWith('anonymous-client',10,60);
  });
  it('rejects unbounded input before consuming quota', async () => {
    const consume = vi.fn(async () => true);
    await expect(authorizePublicSearch({query:'x'.repeat(201)},'anonymous-client',{consume})).rejects.toThrow('Invalid query');
    expect(consume).not.toHaveBeenCalled();
  });
});