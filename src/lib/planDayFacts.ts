/** Progress facts are not the same as the attempt currently displayed/editable. */
export function buildPlanDayFacts(executions: any[]) {
  const facts: Record<number, any> = {};
  const rank = (e: any) => e.status === 'completed' ? 3
    : e.status === 'abandoned' && e.close_reason !== 'superseded_by_late_completion' ? 2 : 1;
  for (const e of executions || []) {
    const day = Number(e?.day_index || 0);
    if (!day) continue;
    const prev = facts[day];
    if (!prev || rank(e) > rank(prev) || (rank(e) === rank(prev) &&
      new Date(e.started_at || 0).getTime() > new Date(prev.started_at || 0).getTime())) facts[day] = e;
  }
  return facts;
}
