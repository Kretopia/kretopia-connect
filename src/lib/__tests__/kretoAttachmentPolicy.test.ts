import { describe, expect, it } from 'vitest';
import { attachmentExpiresAt, attachmentIsLive, ATTACHMENT_MAX_BYTES, remainingAllowance } from '../../../supabase/functions/_shared/kretoAttachmentPolicy';

describe('Kreto retained attachments and reservations', () => {
  it('retains original and extracted text for 30 days', () => {
    expect(attachmentExpiresAt(Date.parse('2026-10-30T06:14:00Z'))).toBe('2026-11-29T06:14:00.000Z');
  });
  it('refuses an open exactly at expiration', () => {
    expect(attachmentIsLive('2026-11-29T06:14:00Z', Date.parse('2026-11-29T06:14:00Z'))).toBe(false);
    expect(attachmentIsLive('2026-11-29T06:14:00Z', Date.parse('2026-11-29T06:13:59Z'))).toBe(true);
  });
  it('limits each original to 10 MiB', () => {
    expect(ATTACHMENT_MAX_BYTES).toBe(10485760);
  });
  it('subtracts the enforced in-flight reservation from remaining allowance', () => {
    expect(remainingAllowance(30, 21, 4)).toBe(5);
  });
});