import { describe, expect, it } from 'vitest';
import { fitPosterChipText, formatPosterSetText } from '../apps/wechat/src/training/training-execution/posterSetText';

// Rough canvas stand-in: every character is 0.6 em wide.
const measure = (value: string, fontSize: number) => value.length * fontSize * 0.6;
const CHIP_TEXT_WIDTH = 86;

describe('formatPosterSetText', () => {
  it('keeps both weight and reps in a compact form', () => {
    expect(formatPosterSetText({ actual_weight: 20, actual_reps: 8 })).toBe('20kg×8');
    expect(formatPosterSetText({ actual_weight: 12.5, actual_reps: 6 })).toBe('12.5kg×6');
    expect(formatPosterSetText({ actual_weight: 7.499999999, actual_reps: 7 })).toBe('7.5kg×7');
  });

  it('labels bodyweight, assisted and missing values', () => {
    expect(formatPosterSetText({ actual_weight: 0, actual_reps: 10 })).toBe('自重×10');
    expect(formatPosterSetText({ actual_weight: -10, actual_reps: 8 })).toBe('辅助10kg×8');
    expect(formatPosterSetText({ actual_weight: null, actual_reps: 8 })).toBe('—×8');
    expect(formatPosterSetText({ actual_weight: 20, actual_reps: null })).toBe('20kg×-');
  });

  it('shows timed sets as seconds', () => {
    expect(formatPosterSetText({ planned_target_type: 'time', actual_duration: 30 })).toBe('30秒');
    expect(formatPosterSetText({ planned_target_type: 'time' })).toBe('未记录');
  });
});

describe('fitPosterChipText', () => {
  it('keeps the default size when the text fits', () => {
    expect(fitPosterChipText('20kg×8', CHIP_TEXT_WIDTH, measure)).toEqual({ text: '20kg×8', fontSize: 18 });
  });

  it('shrinks the font before truncating', () => {
    expect(fitPosterChipText('12.5kg×10', CHIP_TEXT_WIDTH, measure)).toEqual({ text: '12.5kg×10', fontSize: 15 });
  });

  it('truncates only when the smallest size still overflows', () => {
    const fitted = fitPosterChipText('辅助12.5kg×12', CHIP_TEXT_WIDTH, measure);
    expect(fitted.fontSize).toBe(14);
    expect(fitted.text.endsWith('…')).toBe(true);
    expect(measure(fitted.text, 14)).toBeLessThanOrEqual(CHIP_TEXT_WIDTH);
  });

  it('fits the compact text that the old full format used to cut off', () => {
    const compact = formatPosterSetText({ actual_weight: 12.5, actual_reps: 6 });
    expect(fitPosterChipText(compact, CHIP_TEXT_WIDTH, measure).text).toBe('12.5kg×6');
  });
});
