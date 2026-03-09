import { describe, it, expect } from 'vitest';
import { SWR_TIERS } from './config';

describe('SWR_TIERS', () => {
  it('defines FAST, MEDIUM, and SLOW tiers', () => {
    expect(SWR_TIERS).toHaveProperty('FAST');
    expect(SWR_TIERS).toHaveProperty('MEDIUM');
    expect(SWR_TIERS).toHaveProperty('SLOW');
  });

  it('each tier has refreshInterval and dedupingInterval as numbers', () => {
    for (const tier of Object.values(SWR_TIERS)) {
      expect(typeof tier.refreshInterval).toBe('number');
      expect(typeof tier.dedupingInterval).toBe('number');
    }
  });

  it('FAST.refreshInterval < MEDIUM.refreshInterval', () => {
    expect(SWR_TIERS.FAST.refreshInterval).toBeLessThan(
      SWR_TIERS.MEDIUM.refreshInterval
    );
  });

  it('SLOW.refreshInterval is 0 (no polling for static data)', () => {
    expect(SWR_TIERS.SLOW.refreshInterval).toBe(0);
  });

  it('FAST.dedupingInterval < MEDIUM.dedupingInterval < SLOW.dedupingInterval', () => {
    expect(SWR_TIERS.FAST.dedupingInterval).toBeLessThan(
      SWR_TIERS.MEDIUM.dedupingInterval
    );
    expect(SWR_TIERS.MEDIUM.dedupingInterval).toBeLessThan(
      SWR_TIERS.SLOW.dedupingInterval
    );
  });
});
