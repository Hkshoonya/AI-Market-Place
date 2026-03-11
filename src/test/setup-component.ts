/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-require-imports */
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(cleanup);

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
    return createElement('a', { href, ...props }, children);
  },
}));

// Mock next/image — use React.createElement to avoid JSX in .ts file
vi.mock('next/image', () => ({
  default: (props: any) => {
    const { createElement } = require('react');
    return createElement('img', props);
  },
}));
