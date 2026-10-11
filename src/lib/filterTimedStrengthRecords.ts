import { isTimedTrainingSet } from '@coachlink/core/src/trainingSetMetrics';

/** Read projection only: retain raw history, omit time-based actions from kilogram PR lists. */
export async function filterTimedStrengthRecords<T extends { action_id?: string | null; exercise_name?: string | null }>(
    db: any, userId: string, records: T[],
): Promise<T[]> {
    if (!records.length) return records;
    const validId = (id?: string | null) => !!id && /^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(id);
    const ids = [...new Set(records.map(r => r.action_id).filter(validId))];
    const names = [...new Set(records.filter(r => !validId(r.action_id)).map(r => r.exercise_name).filter(Boolean))];
    const actions: any[] = [];
    for (const table of ['coach_actions', 'student_actions']) {
        for (const [column, values] of [['id', ids], ['name', names]] as const) {
            if (!values.length) continue;
            let query = db.from(table).select('id, name, attrs').in(column, values);
            if (table === 'student_actions') query = query.eq('user_id', userId);
            const { data, error } = await query;
            if (error) throw new Error('无法读取动作的计量方式');
            actions.push(...(data || []));
        }
    }
    return records.filter(record => {
        const matches = actions.filter(action => validId(record.action_id)
            ? action.id === record.action_id : action.name === record.exercise_name);
        // Ambiguous legacy names and unavailable action metadata remain unchanged.
        return !matches.length || !matches.every(action => isTimedTrainingSet({}, action));
    });
}
