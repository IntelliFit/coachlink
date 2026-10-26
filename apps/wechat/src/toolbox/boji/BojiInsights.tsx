import { Button, Image, Text, View } from '@tarojs/components'
import type { BojiSex } from '@coachlink/core/src/bojiDetector'
import {
  BOJI_DUEL_LIGHTING_TIP,
  BOJI_DUEL_MIXED_TIP,
  bojiDuelHeadline,
  type BojiChallengeOutcome,
  type BojiInsights,
} from '@coachlink/core/src/bojiInsights'
import { DuelBars } from './DuelBars'

function fmt(value: number | null): string {
  return value === null ? '—' : String(Math.round(value))
}

/** 应战完成：你 VS 对方，总分 + 胜负 + 逐项对比条 */
export function DuelView({ challenge, myTotal, sex }: { challenge: BojiChallengeOutcome; myTotal: number | null; sex: BojiSex }) {
  const { opponent, duel } = challenge
  return (
    <View className='boji-vs-wrap'>
      <View className='boji-vs'>
        <View className='boji-vs__side'>
          <View className='boji-vs__avatar boji-vs__avatar--me'>
            <Text>我</Text>
          </View>
          <Text className='boji-vs__name'>你</Text>
          <Text className='boji-vs__total boji-vs__total--me cl-num'>{fmt(myTotal)}</Text>
        </View>
        <Text className='boji-vs__mark cl-num'>VS</Text>
        <View className='boji-vs__side'>
          {opponent.avatarUrl ? (
            <Image className='boji-vs__avatar' src={opponent.avatarUrl} mode='aspectFill' />
          ) : (
            <View className='boji-vs__avatar'>
              <Text>{opponent.nickname.slice(0, 1)}</Text>
            </View>
          )}
          <Text className='boji-vs__name'>{opponent.nickname}</Text>
          <Text className='boji-vs__total cl-num'>{fmt(opponent.total)}</Text>
        </View>
      </View>
      <Text className={`boji-vs__verdict boji-vs__verdict--${duel.overall}`}>{bojiDuelHeadline(duel)}</Text>

      <View className='boji-card'>
        <Text className='boji-card__title'>逐项对比</Text>
        <DuelBars duel={duel} sex={sex} />
        <Text className='boji-soft-note'>
          {challenge.mixedSex ? `${BOJI_DUEL_MIXED_TIP}${BOJI_DUEL_LIGHTING_TIP}` : BOJI_DUEL_LIGHTING_TIP}
        </Text>
      </View>
    </View>
  )
}

/** 身材最像谁 */
export function LookalikeCard({ insights }: { insights: BojiInsights | undefined }) {
  const match = insights?.lookalike
  if (!match) return null
  return (
    <View className='boji-look'>
      <View className='boji-look__avatar'>
        <Text>{match.name.slice(0, 1)}</Text>
      </View>
      <View className='boji-look__body'>
        <Text className='boji-look__kicker'>{match.closeness === 'close' ? '你的身材最接近' : '照这个方向练，最可能成为'}</Text>
        <Text className='boji-look__name'>{match.name}</Text>
        <Text className='boji-look__tagline'>{match.tagline}</Text>
        <Text className='boji-look__group'>{match.groupLabel}</Text>
      </View>
    </View>
  )
}

/** 找好友 PK（原生分享按钮）+ 存海报发朋友圈 */
export function ShareActions({ canShare, onPoster }: { canShare: boolean; onPoster: () => void }) {
  if (!canShare) return null
  return (
    <View className='boji-share-row'>
      <Button className='boji-share-btn' openType='share' hoverClass='boji-share-btn--pressed'>
        找好友 PK
      </Button>
      <View className='boji-share-timeline' hoverClass='boji-share-btn--pressed' onClick={onPoster}>
        <Text>存海报发朋友圈</Text>
      </View>
    </View>
  )
}
