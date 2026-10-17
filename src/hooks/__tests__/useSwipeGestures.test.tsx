import { act, fireEvent, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSwipeGestures } from '../useSwipeGestures';

describe('swipe gesture completion', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function setup() {
    const left = vi.fn();
    const right = vi.fn();
    const hook = renderHook(() => useSwipeGestures({ onSwipeLeft: left, onSwipeRight: right, swipeThreshold: 120 }));
    const target = document.createElement('div');
    const start = () => act(() => hook.result.current.handleDragStart({ clientX: 0, clientY: 0, button: 0, target } as unknown as React.MouseEvent));
    return { ...hook, left, right, start };
  }

  it('finishes outside the card once, then allows the next swipe from center', async () => {
    const { result, start, left, right } = setup();
    start();
    fireEvent.mouseMove(window, { clientX: 180, clientY: 8 });
    expect(result.current.dragOffset.x).toBe(180);
    fireEvent.mouseUp(window);
    fireEvent.mouseUp(window);
    expect(right).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(right).toHaveBeenCalledTimes(1);
    expect(result.current.dragOffset.x).toBe(0);
    expect(result.current.isAnimating).toBe(false);
    start();
    fireEvent.mouseMove(window, { clientX: -180, clientY: 0 });
    fireEvent.mouseUp(window);
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(left).toHaveBeenCalledTimes(1);
  });

  it('tracks small gestures immediately and restores canceled gestures', () => {
    const { result, start, right, left } = setup();
    start();
    fireEvent.mouseMove(window, { clientX: 20, clientY: 0 });
    expect(result.current.dragOffset.x).toBe(20);
    fireEvent.mouseUp(window);
    expect(result.current.dragOffset.x).toBe(0);
    expect(result.current.isDragging).toBe(false);
    expect(right).not.toHaveBeenCalled();
    expect(left).not.toHaveBeenCalled();
  });

  it('does not complete a pending action after unmount', async () => {
    const { start, right, unmount } = setup();
    start();
    fireEvent.mouseMove(window, { clientX: 180, clientY: 0 });
    fireEvent.mouseUp(window);
    unmount();
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    expect(right).not.toHaveBeenCalled();
  });
});