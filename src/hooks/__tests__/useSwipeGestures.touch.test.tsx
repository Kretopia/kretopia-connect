import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSwipeGestures } from '../useSwipeGestures';

describe('touch swiping', () => {
  afterEach(() => vi.useRealTimers());
  it('finishes a touch swipe released outside and cancels interrupted touch', async () => {
    vi.useFakeTimers();
    const right = vi.fn();
    const { result } = renderHook(() => useSwipeGestures({ onSwipeLeft: vi.fn(), onSwipeRight: right, swipeThreshold: 120 }));
    const start = () => act(() => result.current.handleDragStart({ touches: [{ clientX: 10, clientY: 20 }], target: document.createElement('div') } as unknown as React.TouchEvent));
    start();
    fireEvent.touchMove(window, { touches: [{ clientX: 160, clientY: 25 }] });
    fireEvent.touchEnd(window);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(right).toHaveBeenCalledTimes(1);
    expect(result.current.dragOffset.x).toBe(0);
    start();
    fireEvent.touchMove(window, { touches: [{ clientX: 160, clientY: 25 }] });
    fireEvent.touchCancel(window);
    expect(result.current.isDragging).toBe(false);
    expect(right).toHaveBeenCalledTimes(1);
  });
});