import { describe, expect, it } from 'vitest';
import { shouldTriggerSerial } from './utils';
import type { SerialReferenceConfig } from '@/lib/types';

const baseConfig: SerialReferenceConfig = {
  enabled: true,
  mode: 'hybrid',
  firstResponder: 'auto',
};

describe('shouldTriggerSerial', () => {
  it('returns false when serial mode is disabled', () => {
    expect(
      shouldTriggerSerial({ ...baseConfig, enabled: false }, { primary: 'A', secondary: 'B' })
    ).toBe(false);
  });

  it('returns true in always-serial mode', () => {
    expect(
      shouldTriggerSerial({ ...baseConfig, mode: 'always-serial' }, { primary: 'A', secondary: 'A' })
    ).toBe(true);
  });

  it('returns false in hybrid mode when one side is missing', () => {
    expect(shouldTriggerSerial(baseConfig, { primary: 'A' })).toBe(false);
    expect(shouldTriggerSerial(baseConfig, { secondary: 'B' })).toBe(false);
  });

  it('returns false in hybrid mode when normalized content matches', () => {
    expect(
      shouldTriggerSerial(baseConfig, {
        primary: 'Answer with same meaning',
        secondary: '  answer   with same meaning  ',
      })
    ).toBe(false);
  });

  it('returns true in hybrid mode when normalized content differs', () => {
    expect(
      shouldTriggerSerial(baseConfig, {
        primary: 'The answer is yes',
        secondary: 'The answer is no',
      })
    ).toBe(true);
  });
});
