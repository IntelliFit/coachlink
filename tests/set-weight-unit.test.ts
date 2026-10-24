import { describe, expect, it } from 'vitest';
import { formatRecordedTrainingSet, getTrainingSetVolume, trainingSetMeasurementPatch } from '../packages/core/src/trainingSetMetrics';
import { fromKg, getSetDisplayWeight, toKg } from '../packages/core/src/weightUnit';
import { formatPosterSetText } from '../apps/wechat/src/training/training-execution/posterSetText';

describe('per-set weight unit', () => {
    it('converts lbs to canonical kg and back', () => {
        expect(toKg(20, 'lbs')).toBe(9.07);
        expect(toKg(20, 'kg')).toBe(20);
        expect(fromKg(9.07, 'lbs')).toBe(20);
    });

    it('stores kg in actual_weight and remembers the typed lbs value', () => {
        const { patch, error } = trainingSetMeasurementPatch({}, { actualReps: 12, weightUnit: 'lbs', weightInput: 20 });
        expect(error).toBeUndefined();
        expect(patch).toEqual({ actual_reps: 12, actual_weight: 9.07, weight_unit: 'lbs', weight_input: 20 });
    });

    it('derives lbs input when only kg is supplied with an lbs unit', () => {
        const { patch } = trainingSetMeasurementPatch({}, { actualWeight: 9.07, actualReps: 10, weightUnit: 'lbs' });
        expect(patch).toMatchObject({ actual_weight: 9.07, weight_unit: 'lbs', weight_input: 20 });
    });

    it('lets the server value win over a client kg value for lbs input', () => {
        const { patch } = trainingSetMeasurementPatch({}, { actualWeight: 1, weightUnit: 'lbs', weightInput: 40 });
        expect(patch.actual_weight).toBe(18.14);
    });

    it('clears lbs input when the weight is cleared', () => {
        const { patch } = trainingSetMeasurementPatch({}, { weightUnit: 'lbs', weightInput: null });
        expect(patch).toEqual({ actual_weight: null, weight_unit: 'lbs', weight_input: null });
    });

    it('rejects unknown units and non-numeric lbs input', () => {
        expect(trainingSetMeasurementPatch({}, { weightUnit: 'stone' as any }).error).toBeTruthy();
        expect(trainingSetMeasurementPatch({}, { weightUnit: 'lbs', weightInput: 'abc' as any }).error).toBeTruthy();
    });

    it('records kg explicitly and resets a stale lbs unit from older clients', () => {
        expect(trainingSetMeasurementPatch({}, { actualWeight: 50, weightUnit: 'kg' }).patch)
            .toEqual({ actual_weight: 50, weight_unit: 'kg', weight_input: 50 });
        expect(trainingSetMeasurementPatch({ weight_unit: 'lbs', weight_input: 20 }, { actualWeight: 12 }).patch)
            .toEqual({ actual_weight: 12, weight_unit: 'kg', weight_input: 12 });
    });

    it('keeps volume in kg regardless of the display unit', () => {
        expect(getTrainingSetVolume({ actual_weight: 9.07, weight_unit: 'lbs', weight_input: 20, actual_reps: 10 })).toBeCloseTo(90.7);
    });

    it('displays the typed value and unit, and treats historical sets as kg', () => {
        const lbs = { actual_weight: 9.07, actual_reps: 12, weight_unit: 'lbs', weight_input: 20 };
        expect(getSetDisplayWeight(lbs)).toEqual({ value: 20, unit: 'lbs' });
        expect(formatRecordedTrainingSet(lbs)).toBe('20磅 × 12次');
        expect(formatPosterSetText(lbs)).toBe('20磅×12');
        expect(getSetDisplayWeight({ actual_weight: 60 })).toEqual({ value: 60, unit: 'kg' });
        expect(formatRecordedTrainingSet({ actual_weight: 60, actual_reps: 5 })).toBe('60kg × 5次');
    });

    it('falls back to a converted value when the stored input no longer matches kg', () => {
        expect(getSetDisplayWeight({ actual_weight: 9.07, weight_unit: 'lbs', weight_input: 99 }))
            .toEqual({ value: 20, unit: 'lbs' });
    });

    it('reads planned weight strings written by the start route', () => {
        expect(getSetDisplayWeight({ planned_weight: '9.07kg', planned_weight_unit: 'lbs', planned_weight_input: 20 }, 'planned'))
            .toEqual({ value: 20, unit: 'lbs' });
        expect(getSetDisplayWeight({ planned_weight: '5RM' }, 'planned')).toBeNull();
    });
});
