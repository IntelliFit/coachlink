import { describe, expect, it } from 'vitest';
import { previousCompletedWeight } from '../apps/wechat/src/training/training-execution/setDefaults';

describe('previousCompletedWeight', () => {
  const sets = [
    { set_number: 1, status: 'completed', actual_weight: 5 },
    { set_number: 2, status: 'completed', actual_weight: 7.5 },
    { set_number: 3, status: 'pending', actual_weight: null },
    { set_number: 4, status: 'pending', actual_weight: null },
  ];

  it('uses the latest completed set before the target', () => {
    expect(previousCompletedWeight(sets, sets[2])).toBe(7.5);
    expect(previousCompletedWeight(sets, sets[3])).toBe(7.5);
  });

  it('keeps bodyweight (0 kg) as a real value', () => {
    const bw = [{ set_number: 1, status: 'completed', actual_weight: 0 }, { set_number: 2, status: 'pending' }];
    expect(previousCompletedWeight(bw, bw[1])).toBe(0);
  });

  it('returns null for the first set or when nothing usable was recorded', () => {
    expect(previousCompletedWeight(sets, sets[0])).toBeNull();
    const blank = [{ set_number: 1, status: 'completed', actual_weight: '' }, { set_number: 2, status: 'pending' }];
    expect(previousCompletedWeight(blank, blank[1])).toBeNull();
    expect(previousCompletedWeight(null, sets[0])).toBeNull();
  });

  it('falls back to array order when set numbers are missing', () => {
    const unnumbered = [{ status: 'completed', actual_weight: 20 }, { status: 'pending' }];
    expect(previousCompletedWeight(unnumbered, unnumbered[1])).toBe(20);
  });
});
