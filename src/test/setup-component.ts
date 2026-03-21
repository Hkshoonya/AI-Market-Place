/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

if (!window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

if (!globalThis.IntersectionObserver) {
  class MockIntersectionObserver implements IntersectionObserver {
    readonly root = null;
    readonly rootMargin = '';
    readonly thresholds = [];

    constructor(private readonly callback: IntersectionObserverCallback) {}

    disconnect() {}

    observe(target: Element) {
      this.callback(
        [
          {
            boundingClientRect: target.getBoundingClientRect(),
            intersectionRatio: 1,
            intersectionRect: target.getBoundingClientRect(),
            isIntersecting: true,
            rootBounds: null,
            target,
            time: Date.now(),
          },
        ],
        this
      );
    }

    takeRecords() {
      return [];
    }

    unobserve() {}
  }

  globalThis.IntersectionObserver = MockIntersectionObserver;
}

if (!globalThis.ResizeObserver) {
  class MockResizeObserver implements ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  globalThis.ResizeObserver = MockResizeObserver;
}

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
}));

// Mock next/link — use React.createElement to avoid JSX in .ts file
vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: any) => {
    const { createElement } = require('react');
    const linkProps = { href, ...props };
    delete linkProps.prefetch;
    return createElement('a', linkProps, children);
  },
}));

// Mock next/image — use React.createElement to avoid JSX in .ts file
vi.mock('next/image', () => ({
  default: (props: any) => {
    const { createElement } = require('react');
    return createElement('img', props);
  },
}));

const originalConsoleWarn = console.warn.bind(console);

vi.spyOn(console, 'warn').mockImplementation((...args: unknown[]) => {
  const [first] = args;
  if (typeof first === 'string' && first.includes('Multiple instances of Three.js')) {
    return;
  }

  originalConsoleWarn(...args);
});
