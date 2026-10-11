import { describe, expect, it } from 'vitest';
import { filterTimedStrengthRecords } from '../src/lib/filterTimedStrengthRecords';

const timedId = '500c063f-f81d-4d69-be51-1ec1b1b650f8';
const countId = '134f2c8c-4577-4586-b787-8a89f43fe427';
function database(actions: Record<string, any[]>, fail = false) {
    return { from(table: string) {
        let key: string; let values: any[];
        const query: any = { select: () => query, in: (k: string, v: any[]) => { key = k; values = v; return query; }, eq: () => query,
            then: (resolve: any) => Promise.resolve({ data: (actions[table] || []).filter(a => values.includes(a[key])), error: fail ? { message: 'offline' } : null }).then(resolve) };
        return query;
    } };
}
describe('kilogram PR read projection', () => {
    it('omits a static AUTO_STATE without changing original records or valid repetitions', async () => {
        const old = { action_id: timedId, exercise_name: '面墙倒立', notes: 'AUTO_STATE', e1rm: 85.5 };
        const count = { action_id: countId, exercise_name: '负重引体', e1rm: 50 };
        const records = [old, count];
        const db = database({ coach_actions: [{ id: timedId, attrs: ['持续时间'] }, { id: countId, attrs: ['次数'] }] });
        expect(await filterTimedStrengthRecords(db, 'student', records)).toEqual([count]);
        expect(records).toEqual([old, count]);
        expect(old.e1rm).toBe(85.5);
    });
    it('uses names for legacy history but retains ambiguous and unknown actions', async () => {
        const records = [{ exercise_name: '保持' }, { exercise_name: '混合' }, { exercise_name: '未知' }];
        const db = database({ coach_actions: [{ name: '保持', attrs: ['持续时间'] }, { name: '混合', attrs: ['持续时间'] }], student_actions: [{ name: '混合', attrs: ['次数'] }] });
        expect(await filterTimedStrengthRecords(db, 'student', records)).toEqual(records.slice(1));
    });
    it('does not read actions for empty history', async () => {
        expect(await filterTimedStrengthRecords({ from: () => { throw new Error('unexpected'); } }, 'student', [])).toEqual([]);
    });
    it('fails the projection if action metadata cannot be checked', async () => {
        await expect(filterTimedStrengthRecords(database({}, true), 'student', [{ action_id: timedId }])).rejects.toThrow('无法读取动作的计量方式');
    });
});
