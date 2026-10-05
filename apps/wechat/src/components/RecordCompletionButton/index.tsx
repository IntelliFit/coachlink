import { useEffect, useState } from 'react'
import { View, Text, Picker, Button } from '@tarojs/components'
import { Popup } from '@nutui/nutui-react-taro'
import { executionService } from '@/services/executionService'
import { createCompletionRequestId, suggestPerformedOn, validatePerformedOn } from '@coachlink/core/src/completionDate'
import { toBeijingDateKey } from '@coachlink/core/src/beijingTime'
import './index.scss'

type Props = {
  instanceId: string; dayIndex: number; execution?: any; earliestDate?: string | null
  onSaved: (execution: any) => void | Promise<void>
  open?: boolean; hideTrigger?: boolean; onClose?: () => void
}
export default function RecordCompletionButton({ instanceId, dayIndex, execution, earliestDate, onSaved, open, hideTrigger, onClose }: Props) {
  const [visible, setVisible] = useState(false)
  const [date, setDate] = useState('')
  const [requestId, setRequestId] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const label = execution?.status === 'completed' ? '核对训练日期' : '补记已练过的这一天'
  const close = () => { setVisible(false); onClose?.() }
  useEffect(() => {
    if (!open) return
    setDate(suggestPerformedOn(execution))
    setRequestId(createCompletionRequestId())
    setError('')
  }, [open, execution])
  const submit = async () => {
    if (saving) return
    const invalid = validatePerformedOn(date, earliestDate)
    if (invalid) { setError(invalid); return }
    setSaving(true); setError('')
    try {
      const saved = await executionService.recordCompletion({ instanceId, dayIndex, performedOn: date,
        requestId, executionId: execution?.id, expectedUpdatedAt: execution?.updated_at })
      close()
      await Promise.resolve(onSaved(saved)).catch(console.error)
    } catch (e: any) { setError(e?.message || '补记失败，请重试') }
    finally { setSaving(false) }
  }
  return <>
    {!hideTrigger && <Button className='record-completion-trigger' onClick={() => {
      setDate(suggestPerformedOn(execution)); setRequestId(createCompletionRequestId()); setError(''); setVisible(true)
    }}>{label}</Button>}
    <Popup visible={visible || !!open} position='bottom' round onClose={() => !saving && close()}>
      <View className='record-completion-sheet'>
        <Text className='record-completion-title'>D{dayIndex} · {label}</Text>
        <Text>请选择实际训练的那一天，不是原计划安排日，也不是补点按钮的今天。</Text>
        <Picker mode='date' value={date || toBeijingDateKey(new Date())}
          start={earliestDate ? toBeijingDateKey(earliestDate) : undefined} end={toBeijingDateKey(new Date())}
          disabled={saving} onChange={e => { setDate(e.detail.value); setRequestId(createCompletionRequestId()) }}>
          <View className='record-completion-date'>实际训练日期：{date || '请选择'}</View>
        </Picker>
        <Text>确认表示当天确实练过。已有重量、次数和视频保持不变；没有记录的组不会补齐，更正日期不重复扣权益。</Text>
        {!!error && <Text className='record-completion-error'>{error}</Text>}
        <Button className='record-completion-confirm' disabled={saving || !date} onClick={submit}>
          {saving ? '保存中…' : `确认在 ${date || '所选日期'} 练过`}
        </Button>
        <Button className='record-completion-trigger' disabled={saving} onClick={close}>取消</Button>
      </View>
    </Popup>
  </>
}
