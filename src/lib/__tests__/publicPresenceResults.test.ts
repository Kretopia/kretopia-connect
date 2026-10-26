import { describe, expect, it } from 'vitest';
import { sourcedPublicResults, rankPublicSources } from '../../../supabase/functions/_shared/publicPresenceResults';

describe('public web evidence boundaries', () => {
  it('keeps homonyms on different public URLs separate', () => {
    expect(sourcedPublicResults([{title:'Alex',url:'https://one.com/alex'}, {title:'Alex',url:'https://two.com/alex'}])).toHaveLength(2);
  });
  it('rejects private, executable and credential-bearing URLs', () => {
    expect(sourcedPublicResults(['http://127.0.0.1/a', 'http://localhost/a', 'javascript:alert(1)', 'https://u:p@example.com/a'].map(url => ({title:'Alex',url})))).toEqual([]);
  });
  it('AI ranking cannot create sources or duplicate them', () => {
    const sources = sourcedPublicResults([{title:'One',url:'https://one.com'}, {title:'Two',url:'https://two.com'}]);
    expect(rankPublicSources(sources, [1, 1, 200, -1, 'https://invented.com']).map(r => r.title)).toEqual(['Two', 'One']);
  });
});