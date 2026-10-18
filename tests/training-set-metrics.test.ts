import { describe, expect, it } from 'vitest';
import {
    isTimedTrainingSet, getActualDurationSeconds, getPlannedDurationSeconds,
    getTrainingSetVolume, formatRecordedTrainingSet, trainingSetMeasurementPatch,
    inheritedTimedSetDefaults,
} from '../packages/core/src/trainingSetMetrics';
import { buildPlannedSetPreviews } from '../packages/core/src/planSetPrescriptions';

const hold = { planned_target_type: 'time', planned_target_unit: 's', planned_reps: '20秒' };

describe('bodyweight and time-based strength measurements', () => {
    it.each([hold, { planned_reps: '20秒' }, { plannedTargetType: 'time' }, { actual_duration: 20 }])('recognizes time without inspecting an action name: %j', set => {
        expect(isTimedTrainingSet(set)).toBe(true);
    });
    it('uses explicit count targets for mixed actions and does not parse RM as seconds', () => {
        expect(isTimedTrainingSet({ planned_target_type: 'reps', planned_reps: '5' }, { sets: [hold] })).toBe(false);
        expect(isTimedTrainingSet({ planned_reps: '5', planned_weight: '5RM' })).toBe(false);
    });
    it('recognizes static action attributes when no per-set target was supplied', () => {
        expect(isTimedTrainingSet({}, { attrs: ['组数', '持续时间'] })).toBe(true);
        expect(isTimedTrainingSet({}, { attrs: ['组数', '次数', '持续时间'] })).toBe(false);
    });
    it('converts minute prescriptions to seconds across normalized mobile fields', () => {
        expect(getPlannedDurationSeconds({ plannedTargetType: 'time', plannedTargetUnit: 'min', plannedReps: '2' })).toBe(120);
        expect(getPlannedDurationSeconds(hold)).toBe(20);
    });
    it('does not fabricate actual duration from a historical rep field or prescription', () => {
        const old = { ...hold, actual_weight: 50, actual_reps: 20 };
        expect(getActualDurationSeconds(old)).toBeNull();
        expect(formatRecordedTrainingSet(old)).toBe('时长未记录');
        expect(trainingSetMeasurementPatch(old, { actualWeight: 50, actualReps: 20 }).error).toBeTruthy();
    });
    it('saves actual seconds and clears meaningless kilograms, counts and estimated PR', () => {
        const { patch, error } = trainingSetMeasurementPatch(hold, { actualDuration: 23, actualWeight: 50, actualReps: 20 });
        expect(error).toBeUndefined();
        expect(patch).toEqual({ actual_duration: 23, actual_weight: null, actual_reps: null, e1rm: null, is_auto_pr: false });
        expect(formatRecordedTrainingSet({ ...hold, ...patch })).toBe('保持 23 秒');
    });
    it.each([0, -1, NaN, Infinity, null, true, '20', {}])('rejects invalid duration %s before saving', actualDuration => {
        expect(trainingSetMeasurementPatch(hold, { actualDuration: actualDuration as any }).error).toBeTruthy();
    });
    it('preserves explicit actual duration when saving only notes or video', () => {
        expect(trainingSetMeasurementPatch({ ...hold, actual_duration: 24 }, {}).patch.actual_duration).toBe(24);
    });
    it('records zero external load and still permits assisted movements', () => {
        expect(trainingSetMeasurementPatch({}, { actualWeight: 0, actualReps: 8 }).patch).toEqual({ actual_weight: 0, actual_reps: 8 });
        expect(formatRecordedTrainingSet({ actual_weight: 0, actual_reps: 8 })).toContain('自重');
        expect(formatRecordedTrainingSet({ actualWeight: -10, actualReps: 8 })).toContain('辅助 10kg');
        expect(getTrainingSetVolume({ actual_weight: -10, actual_reps: 8 })).toBe(0);
    });
    it('does not substitute planned kilograms for a missing actual weight', () => {
        expect(getTrainingSetVolume({ actual_weight: 0, actual_reps: 8, planned_weight: '80kg' })).toBe(0);
        expect(getTrainingSetVolume({ actual_weight: null, actual_reps: 8, planned_weight: '80kg' })).toBe(0);
        expect(getTrainingSetVolume({ actualWeight: 60, actualReps: 10 })).toBe(600);
    });
    it('excludes every static set including an old added set that lost its target metadata', () => {
        const sets = [{ ...hold, actual_weight: 50, actual_reps: 20 }, { ...hold, actual_weight: 50, actual_reps: 20 }, { planned_weight: '50kg', planned_reps: '20', actual_weight: 50, actual_reps: 20 }];
        const action = { sets };
        expect(sets.reduce((sum, set) => sum + getTrainingSetVolume(set, action), 0)).toBe(0);
        expect(formatRecordedTrainingSet(sets[2], action)).toBe('时长未记录');
    });
    it('inherits seconds and rest context rather than bogus old weights when adding a set', () => {
        expect(inheritedTimedSetDefaults({ ...hold, actual_weight: 50, actual_reps: 20 })).toEqual({ planned_weight: null, planned_reps: '20秒', planned_target_type: 'time', planned_target_unit: 's' });
        expect(inheritedTimedSetDefaults({ ...hold, actual_duration: 30 }).planned_reps).toBe('30秒');
    });
    it('supports legacy duration prescriptions and round counts in previews', () => {
        const sets = buildPlannedSetPreviews({ params: { 组数: 2, 持续时间: 20, 休息时间: 90 } });
        expect(sets).toHaveLength(2);
        expect(sets[0]).toMatchObject({ planned_reps: '20秒', planned_target_type: 'time', planned_target_unit: 's', planned_rest_seconds: 90 });
    });
});
