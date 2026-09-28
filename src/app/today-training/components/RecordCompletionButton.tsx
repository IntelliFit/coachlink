'use client';
import React, { useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { executionService } from '@/app/service/executionService';
import { createCompletionRequestId, suggestPerformedOn, validatePerformedOn } from '@coachlink/core/src/completionDate';
import { toBeijingDateKey } from '@coachlink/core/src/beijingTime';

type Props = {
  instanceId: string; dayIndex: number; execution?: any; earliestDate?: string | null;
  onSaved: (execution: any) => void | Promise<void>;
};

export default function RecordCompletionButton({ instanceId, dayIndex, execution, earliestDate, onSaved }: Props) {
  const [visible, setVisible] = useState(false);
  const [date, setDate] = useState('');
  const [requestId, setRequestId] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const label = execution?.status === 'completed' ? '核对训练日期' : '补记已练过的这一天';
  const submit = async () => {
    if (saving) return;
    const invalid = validatePerformedOn(date, earliestDate);
    if (invalid) { setError(invalid); return; }
    setSaving(true); setError('');
    try {
      const saved = await executionService.recordCompletion({
        instanceId, dayIndex, performedOn: date, requestId,
        executionId: execution?.id, expectedUpdatedAt: execution?.updated_at,
      });
      setVisible(false);
      await Promise.resolve(onSaved(saved)).catch(console.error);
    } catch (e) { setError(e instanceof Error ? e.message : '保存失败，请重试'); }
    finally { setSaving(false); }
  };
  return <>
    <button type="button" className="rounded-xl border border-[#CF6D4E] bg-white px-4 py-2 text-sm text-[#CF6D4E]"
      onClick={() => { setDate(suggestPerformedOn(execution)); setRequestId(createCompletionRequestId()); setError(''); setVisible(true); }}>
      {label}
    </button>
    <Dialog header={`D${dayIndex} · ${label}`} visible={visible} onHide={() => !saving && setVisible(false)}
      style={{ width: '32rem', maxWidth: '96vw' }} modal closable={!saving}>
      <div className="flex flex-col gap-4">
        <p>请选择实际训练的那一天，不是原计划安排日，也不是今天补点按钮的日期。</p>
        <label className="flex flex-col gap-2">实际训练日期
          <input aria-label="实际训练日期" type="date" value={date} disabled={saving}
            min={earliestDate ? toBeijingDateKey(earliestDate) : undefined} max={toBeijingDateKey(new Date())}
            onChange={e => { setDate(e.target.value); setRequestId(createCompletionRequestId()); }}
            className="rounded-lg border p-2" />
        </label>
        <p className="text-sm text-surface-600">确认表示当天确实练过。已有重量、次数和视频保持不变；没有记录的组不会自动补齐。更正日期不会重复扣训练权益。</p>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button type="button" disabled={saving || !date} onClick={submit}
          className="rounded-xl bg-[#CF6D4E] px-4 py-2 text-white disabled:opacity-50">
          {saving ? '正在保存…' : `确认在 ${date || '所选日期'} 练过`}
        </button>
      </div>
    </Dialog>
  </>;
}
