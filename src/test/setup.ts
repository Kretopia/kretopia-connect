import "@testing-library/jest-dom";

Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});

// jsdom doesn't implement IntersectionObserver -- framer-motion's
// `whileInView` (used throughout the landing chapters and several Studio
// components) reads it at mount time, so any test rendering one of those
// trees without this stub fails with a ReferenceError unrelated to what
// the test actually verifies.
class IntersectionObserverStub {
  readonly root: Element | null = null;
  readonly rootMargin: string = "";
  readonly thresholds: ReadonlyArray<number> = [];
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords(): IntersectionObserverEntry[] { return []; }
}
window.IntersectionObserver = IntersectionObserverStub;
global.IntersectionObserver = IntersectionObserverStub;

// jsdom also doesn't implement ResizeObserver -- several Studio components
// (e.g. StudioFoldersBar's overflow-detection strip) read it at mount time.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserverStub;
global.ResizeObserver = ResizeObserverStub;
