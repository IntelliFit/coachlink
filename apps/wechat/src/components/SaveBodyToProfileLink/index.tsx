import { useEffect, useState } from 'react'
import { Text } from '@tarojs/components'
import type { ProfileBodyMetricsPatch } from '@coachlink/core/src/bodyMetrics'
import './index.scss'

interface Props {
  /** What saving would change; nothing renders when null. */
  patch: ProfileBodyMetricsPatch | null
  /** The profile has no value yet, so the link offers to fill it instead of "update". */
  profileEmpty: boolean
  onSave: (patch: ProfileBodyMetricsPatch) => Promise<void>
}

/** Mini-program twin of src/components/toolbox/SaveBodyToProfileLink.tsx. */
export function SaveBodyToProfileLink({ patch, profileEmpty, onSave }: Props) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (patch && status === 'saved') setStatus('idle')
    // Only react to a new difference appearing after a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch])

  if (!patch && status !== 'saved') return null
  if (status === 'saved') {
    return <Text className='save-body-link save-body-link__done'>已更新个人资料</Text>
  }

  const save = async () => {
    if (!patch || status === 'saving') return
    setStatus('saving')
    try {
      await onSave(patch)
      setStatus('saved')
    } catch (error) {
      setMessage((error as Error)?.message || '保存失败，请稍后重试')
      setStatus('error')
    }
  }

  return (
    <Text className='save-body-link'>
      <Text
        className={`save-body-link__action${status === 'saving' ? ' save-body-link__action--busy' : ''}`}
        onClick={() => void save()}
      >
        {status === 'saving' ? '保存中…' : profileEmpty ? '保存到个人资料，下次自动填好' : '同时更新个人资料'}
      </Text>
      {status === 'error' && <Text className='save-body-link__error'>{message}</Text>}
    </Text>
  )
}
