import { describe, expect, it } from 'vitest';
import {
  describeLockedPlanDayViolation,
  findLockedPlanDayViolation,
  getLockedThroughDayIndex,
  isPlanDayLocked,
  mergeLockedPlanDays,
} from '../packages/core/src/planEditLock';

const set = (actionId: string, reps = 8) => ({ action_id: actionId, params: { 组数: 3, 次数: reps } });
const training = (dayIndex: number, ...actionSets: any[]) => ({ dayIndex, type: 'training', actionSets });
const rest = (dayIndex: number, ...actionSets: any[]) => ({ dayIndex, type: 'rest', actionSets });
const saved = [
  training(1, set('squat'), set('bench')),
  rest(2),
  training(3, set('pull')),
  rest(4, { action_id: 'walk', itemType: 'CARDIO' }),
  training(5, set('squat')),
  rest(6),
  training(7, set('dip')),
];

describe('getLockedThroughDayIndex', () => {
  it('locks through the furthest day that has any workout record', () => {
    expect(getLockedThroughDayIndex([
      { day_index: 1, status: 'completed' },
      { day_index: '3', status: 'abandoned' },
      { day_index: 5, status: 'timed_out' },
    ])).toBe(5);
  });

  it('counts an in-progress workout as history', () => {
    expect(getLockedThroughDayIndex([{ day_index: 3, status: 'in_progress' }])).toBe(3);
  });

  it('returns 0 when the plan has no workout records', () => {
    expect(getLockedThroughDayIndex([])).toBe(0);
    expect(getLockedThroughDayIndex([{ day_index: 0, status: 'completed' }])).toBe(0);
  });

  it('ignores unknown statuses', () => {
    expect(getLockedThroughDayIndex([{ day_index: 9, status: 'deleted' }])).toBe(0);
  });
});

describe('isPlanDayLocked', () => {
  it('locks every day up to and including the boundary', () => {
    expect(isPlanDayLocked(1, 3)).toBe(true);
    expect(isPlanDayLocked(3, 3)).toBe(true);
    expect(isPlanDayLocked(4, 3)).toBe(false);
    expect(isPlanDayLocked(1, 0)).toBe(false);
  });
});

describe('findLockedPlanDayViolation', () => {
  it('allows parameter edits on a trained day', () => {
    const next = saved.map((day) => (day.dayIndex === 1 ? training(1, set('squat', 5), set('bench', 5)) : day));
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 })).toBeNull();
  });

  it('rejects deleting a trained day because every later day is renumbered', () => {
    const next = saved.filter((day) => day.dayIndex !== 2).map((day, index) => ({ ...day, dayIndex: index + 1 }));
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 }))
      .toEqual({ dayIndex: 2, reason: 'type_changed' });
  });

  it('rejects turning a past rest day into a training day', () => {
    const next = saved.map((day) => (day.dayIndex === 2 ? training(2, set('row')) : day));
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 }))
      .toEqual({ dayIndex: 2, reason: 'type_changed' });
  });

  it('rejects swapping the exercises of a trained day', () => {
    const next = saved.map((day) => (day.dayIndex === 3 ? training(3, set('chin')) : day));
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 }))
      .toEqual({ dayIndex: 3, reason: 'actions_changed' });
  });

  it('rejects dropping the tasks of a past rest day', () => {
    const next = saved.map((day) => (day.dayIndex === 4 ? rest(4) : day));
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 4 }))
      .toEqual({ dayIndex: 4, reason: 'actions_changed' });
  });

  it('rejects removing a trained day from the end of the plan', () => {
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: saved.slice(0, 2), lockedThroughDayIndex: 3 }))
      .toEqual({ dayIndex: 3, reason: 'missing' });
  });

  it('allows any change after the locked range', () => {
    const next = [...saved.slice(0, 3), rest(4), training(5, set('deadlift')), training(6, set('press'))];
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 })).toBeNull();
  });

  it('accepts camelCase and snake_case action fields as the same exercise', () => {
    const next = saved.map((day) => (day.dayIndex === 1
      ? training(1, { actionId: 'squat', params: {} }, { actionId: 'bench', params: {} })
      : day));
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 1 })).toBeNull();
  });

  it('accepts an id kept in params as the same exercise', () => {
    const raw = [training(1, { params: { action_id: 'squat', 次数: 5 } })];
    const edited = [training(1, { action_id: 'squat', actionId: 'squat', params: { action_id: 'squat', 次数: 6 } })];
    expect(findLockedPlanDayViolation({ savedDays: raw, nextDays: edited, lockedThroughDayIndex: 1 })).toBeNull();
  });

  it('does not block when an editor resolved an id for a name-only exercise', () => {
    const raw = [training(1, { set_name: '深蹲', params: { 次数: 5 } })];
    const edited = [training(1, { action_id: 'squat', actionName: '深蹲', params: { 次数: 6 } })];
    expect(findLockedPlanDayViolation({ savedDays: raw, nextDays: edited, lockedThroughDayIndex: 1 })).toBeNull();
  });

  it('compares name-only exercises by name', () => {
    const raw = [training(1, { set_name: '深蹲' })];
    expect(findLockedPlanDayViolation({ savedDays: raw, nextDays: [training(1, { actionName: '深蹲 ' })], lockedThroughDayIndex: 1 })).toBeNull();
    expect(findLockedPlanDayViolation({ savedDays: raw, nextDays: [training(1, { actionName: '硬拉' })], lockedThroughDayIndex: 1 }))
      .toEqual({ dayIndex: 1, reason: 'actions_changed' });
  });

  it('treats reordering exercises on a trained day as a change', () => {
    const next = saved.map((day) => (day.dayIndex === 1 ? training(1, set('bench'), set('squat')) : day));
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 1 }))
      .toEqual({ dayIndex: 1, reason: 'actions_changed' });
  });

  it('does nothing when no day is locked', () => {
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: [], lockedThroughDayIndex: 0 })).toBeNull();
  });
});

describe('mergeLockedPlanDays', () => {
  it('restores structural changes on locked days and keeps parameter edits', () => {
    const next = saved.map((day) => {
      if (day.dayIndex === 1) return training(1, set('squat', 3), set('bench', 3));
      if (day.dayIndex === 2) return training(2, set('row'));
      return day;
    });
    const result = mergeLockedPlanDays({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 });
    expect(result.days[0]).toEqual(training(1, set('squat', 3), set('bench', 3)));
    expect(result.days[1]).toEqual(rest(2));
    expect(result.restoredDayIndexes).toEqual([2]);
  });

  it('applies a replacement template only after the locked range', () => {
    const template = [1, 2, 3, 4, 5].map((dayIndex) => training(dayIndex, set(`t${dayIndex}`)));
    const result = mergeLockedPlanDays({ savedDays: saved, nextDays: template, lockedThroughDayIndex: 3 });
    expect(result.days.map((day: any) => day.dayIndex)).toEqual([1, 2, 3, 4, 5]);
    expect(result.days.slice(0, 3)).toEqual(saved.slice(0, 3));
    expect(result.days.slice(3)).toEqual(template.slice(3));
    expect(result.restoredDayIndexes).toEqual([1, 2, 3]);
  });

  it('puts back a locked day that the editor deleted', () => {
    const next = saved.filter((day) => day.dayIndex !== 3);
    const result = mergeLockedPlanDays({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 });
    expect(result.days.map((day: any) => day.dayIndex)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(result.restoredDayIndexes).toEqual([3]);
    expect(findLockedPlanDayViolation({ savedDays: saved, nextDays: result.days, lockedThroughDayIndex: 3 })).toBeNull();
  });

  it('does not mutate its inputs', () => {
    const savedCopy = JSON.stringify(saved);
    const next = saved.map((day) => (day.dayIndex === 2 ? training(2, set('row')) : day));
    const nextCopy = JSON.stringify(next);
    mergeLockedPlanDays({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 3 });
    expect(JSON.stringify(saved)).toBe(savedCopy);
    expect(JSON.stringify(next)).toBe(nextCopy);
  });

  it('returns the edited days unchanged when nothing is locked', () => {
    const next = [training(1, set('x'))];
    expect(mergeLockedPlanDays({ savedDays: saved, nextDays: next, lockedThroughDayIndex: 0 }))
      .toEqual({ days: next, restoredDayIndexes: [] });
  });
});

describe('describeLockedPlanDayViolation', () => {
  it('names the day and the allowed alternative', () => {
    const message = describeLockedPlanDayViolation({ dayIndex: 3, reason: 'actions_changed' }, 5);
    expect(message).toContain('第3天');
    expect(message).toContain('第1–5天');
    expect(message).toContain('新建阶段');
  });
});
