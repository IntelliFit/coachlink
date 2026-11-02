import { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import {
  COACH_EXIT_NOTE_MAX_LENGTH,
  coachExitReasonsFor,
  type CoachExitCandidate,
  type CoachExitReason
} from '@coachlink/core/src/coachFunnel'
import { StableInput as Input } from '@/components/StableInput'
import { ClButton } from '@/components/ui'
import { trackCoachFunnel } from '../../coachFunnel'
import './index.scss'

/** 学员离开教练页后问一个「为什么没订阅」，一次点选就结束，可以跳过。 */
export default function CoachExitSheet({ candidate, onClose }: { candidate: CoachExitCandidate; onClose: () => void }) {
  const [otherOpen, setOtherOpen] = useState(false)
  const [note, setNote] = useState('')

  const submit = (reason: CoachExitReason, text?: string) => {
    trackCoachFunnel('exit_reason', {
      coachId: candidate.coachId,
      reason,
      note: text,
      properties: { trigger: candidate.trigger }
    })
    Taro.showToast({ title: '谢谢你的反馈', icon: 'none' })
    onClose()
  }

  const skip = () => {
    trackCoachFunnel('exit_skip', { coachId: candidate.coachId, properties: { trigger: candidate.trigger } })
    onClose()
  }

  return (
    <View className='coach-exit' catchMove>
      <View className='coach-exit__mask' onClick={skip} />
      <View className='coach-exit__panel'>
        <Text className='coach-exit__title'>这次没有订阅{candidate.coachName ? ` ${candidate.coachName}` : '这位教练'}，主要是因为？</Text>
        <Text className='coach-exit__hint'>选一项就好，帮我们和教练做得更好</Text>

        <View className='coach-exit__options'>
          {coachExitReasonsFor(candidate.canBuy).map((reason) => (
            <View
              key={reason.value}
              className={`coach-exit__option ${otherOpen && reason.value === 'other' ? 'coach-exit__option--on' : ''}`}
              onClick={() => (reason.value === 'other' ? setOtherOpen(true) : submit(reason.value))}
            >
              <Text>{reason.label}</Text>
            </View>
          ))}
        </View>

        {otherOpen && (
          <View className='coach-exit__other'>
            <Input
              className='coach-exit__input'
              value={note}
              maxlength={COACH_EXIT_NOTE_MAX_LENGTH}
              placeholder='想说点什么（选填，请勿填写手机号等隐私）'
              onInput={(e) => setNote(e.detail.value)}
            />
            <ClButton block size='md' onClick={() => submit('other', note.trim() || undefined)}>提交</ClButton>
          </View>
        )}

        <View className='coach-exit__skip' onClick={skip}>
          <Text>跳过</Text>
        </View>
      </View>
    </View>
  )
}
