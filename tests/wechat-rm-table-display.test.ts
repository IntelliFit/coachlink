import { describe, expect, it } from 'vitest';
import { formatRmTableRow } from '../apps/wechat/src/streetlifting/index/calculator/result/rmTableDisplay';

describe('formatRmTableRow', () => {
  it('shows added weight and percentage as-is when positive', () => {
    expect(formatRmTableRow({ weight: 21.3, percentage: 81 })).toEqual({ weightText: '21.3 kg', percentageText: '81%', assisted: false });
  });

  it('shows a negative added weight as assistance and hides the meaningless percentage', () => {
    expect(formatRmTableRow({ weight: -3.3, percentage: -12 })).toEqual({ weightText: '助力 3.3 kg', percentageText: '—', assisted: true });
  });

  it('treats a value that rounds to zero as bodyweight only', () => {
    expect(formatRmTableRow({ weight: -0.02, percentage: 0 })).toEqual({ weightText: '0.0 kg', percentageText: '0%', assisted: false });
  });
});
