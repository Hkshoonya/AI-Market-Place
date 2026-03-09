import { createElement } from 'react';
import { render } from '@testing-library/react';
import { SWRConfig } from 'swr';

/**
 * Renders a component wrapped in SWRConfig with a fresh cache.
 * Prevents cross-test cache pollution (official SWR testing pattern).
 * @see https://swr.vercel.app/docs/advanced/cache
 */
export function renderWithSWR(ui: React.ReactElement) {
  return render(
    createElement(
      SWRConfig,
      { value: { provider: () => new Map(), dedupingInterval: 0 } },
      ui
    )
  );
}
