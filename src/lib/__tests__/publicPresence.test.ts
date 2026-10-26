import { describe, it, expect, vi } from 'vitest';
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
import { normalizePresenceResults, publicSourceUrl, stagePresenceClaim } from '../publicPresence';
describe('public digital presence boundaries', () => {
  it('keeps homonyms separate and deduplicates source URLs only', () => {
    const rows = normalizePresenceResults([{title:'Alex Lee',url:'https://one.com/alex'}, {title:'Alex Lee',url:'https://two.com/alex'}, {title:'Duplicate',url:'https://one.com/alex#bio'}]);
    expect(rows.map(r => r.url)).toEqual(['https://one.com/alex','https://two.com/alex']);
  });
  it('rejects private or executable source URLs', () => {
    for (const url of ['http://127.0.0.1/a','http://localhost/a','http://10.0.0.1/a','javascript:alert(1)','https://user:pass@example.com','http://[::1]/']) expect(publicSourceUrl(url)).toBeNull();
  });
  it('never stages selected links as verified', () => {
    stagePresenceClaim('Alex Lee', []);
    expect(JSON.parse(sessionStorage.getItem('pending_presence_claim') || '{}').verified).toBe(false);
  });
  it('never creates a result without a valid sourced URL', () => {
    expect(normalizePresenceResults([{title:'Invented biography'}, {title:'Wrong', url:'file:///private'}])).toEqual([]);
  });
});