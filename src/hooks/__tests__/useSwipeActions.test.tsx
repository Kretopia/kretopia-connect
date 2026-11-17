import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  previous: null as null | { id: string; direction: string },
  raced: null as null | { id: string; direction: string },
  insertError: null as null | { code: string },
  inserts: vi.fn(), deletes: vi.fn(), notify: vi.fn(), toast: vi.fn(), reads: 0,
}));
vi.mock('sonner', () => ({ toast: { error: state.toast } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  from: () => {
    let operation = 'read';
    const filters: Record<string, unknown> = {};
    const chain: any = {
      select: () => chain,
      eq: (key: string, value: unknown) => { filters[key] = value; return chain; },
      delete: () => { operation = 'delete'; return chain; },
      insert: (row: unknown) => { state.inserts(row); return Promise.resolve({ error: state.insertError }); },
      maybeSingle: () => {
        if (filters.user_id !== 'me') return Promise.resolve({ data: null, error: null });
        return Promise.resolve({ data: state.reads++ === 0 ? state.previous : state.raced, error: null });
      },
      then: (resolve: (value: unknown) => unknown) => {
        if (operation === 'delete') state.deletes(filters);
        return Promise.resolve({ data: null, error: null }).then(resolve);
      },
    };
    return chain;
  },
  functions: { invoke: (...args: unknown[]) => { state.notify(...args); return Promise.resolve({}); } },
} }));
import { useSwipeActions } from '../useSwipeActions';

beforeEach(() => {
  state.previous = null; state.raced = null; state.insertError = null; state.reads = 0;
  state.inserts.mockClear(); state.deletes.mockClear(); state.notify.mockClear(); state.toast.mockClear();
});
describe('duplicate profile swipes', () => {
  it('keeps a repeated pass idempotent without a conflicting insert', async () => {
    state.previous = { id: 'existing', direction: 'left' };
    const { result } = renderHook(() => useSwipeActions('me'));
    await act(async () => { expect(await result.current.recordSwipe('creator', 'left')).toEqual({ success: true, isMatch: false }); });
    expect(state.inserts).not.toHaveBeenCalled(); expect(state.deletes).not.toHaveBeenCalled();
  });
  it('replaces only the owners confirmed pass when they now express interest', async () => {
    state.previous = { id: 'existing', direction: 'left' };
    const { result } = renderHook(() => useSwipeActions('me'));
    await act(async () => { expect((await result.current.recordSwipe('creator', 'right')).success).toBe(true); });
    expect(state.deletes).toHaveBeenCalledWith({ id: 'existing', user_id: 'me', target_id: 'creator', target_type: 'profile', direction: 'left' });
    expect(state.inserts).toHaveBeenCalledWith({ user_id: 'me', target_id: 'creator', target_type: 'profile', direction: 'right' });
    expect(state.notify).toHaveBeenCalledTimes(1);
  });
  it('does not resend interest or undo an existing right swipe', async () => {
    state.previous = { id: 'existing', direction: 'right' };
    state.raced = state.previous;
    const { result } = renderHook(() => useSwipeActions('me'));
    await act(async () => { await result.current.recordSwipe('creator', 'right'); await result.current.recordSwipe('creator', 'left'); });
    expect(state.deletes).not.toHaveBeenCalled(); expect(state.notify).not.toHaveBeenCalled();
  });
  it('confirms a concurrent same-direction swipe instead of showing the 23505 error', async () => {
    state.insertError = { code: '23505' }; state.raced = { id: 'concurrent', direction: 'right' };
    const { result } = renderHook(() => useSwipeActions('me'));
    await act(async () => { expect((await result.current.recordSwipe('creator', 'right')).success).toBe(true); });
    expect(state.toast).not.toHaveBeenCalled(); expect(state.notify).not.toHaveBeenCalled();
  });
  it('does not treat an unconfirmed conflicting write as successful', async () => {
    state.insertError = { code: '23505' };
    const { result } = renderHook(() => useSwipeActions('me'));
    await act(async () => { expect((await result.current.recordSwipe('creator', 'right')).success).toBe(false); });
    expect(state.toast).toHaveBeenCalled();
  });
});