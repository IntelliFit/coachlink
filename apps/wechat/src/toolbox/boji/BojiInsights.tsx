import { Button, Text, View } from '@tarojs/components'
import {
  BOJI_DUEL_LABELS,
  BOJI_DUEL_LIGHTING_TIP,
  BOJI_DUEL_METRIC_LABELS,
  bojiDuelHeadline,
  bojiLookalikeText,
  type BojiInsights,
} from '@coachlink/core/src/bojiInsights'

/** 检测结果下方：PK 结果、身材最像谁、邀请好友 PK（微信原生分享按钮） */
export function BojiInsightsView({ insights }: { insights: BojiInsights | undefined }) {
  if (!insights) return null
  const { challenge, lookalike, scoreId } = insights
  return (
    <>
      {challenge ? (
        <View className='boji-card'>
          <Text className='boji-insight__kicker'>和 {challenge.opponent.nickname} 的 PK</Text>
          <Text className='boji-insight__title'>{bojiDuelHeadline(challenge.duel)}</Text>
          <View className='boji-duel'>
            <View className='boji-duel__row boji-duel__row--head'>
              <Text className='boji-duel__name'>项目</Text>
              <Text className='boji-duel__num'>你</Text>
              <Text className='boji-duel__num'>TA</Text>
              <Text className='boji-duel__badge'> </Text>
            </View>
            {challenge.duel.lines.map((line) => (
              <View key={line.key} className='boji-duel__row'>
                <Text className='boji-duel__name'>{BOJI_DUEL_METRIC_LABELS[line.key]}</Text>
                <Text className='boji-duel__num boji-duel__num--mine cl-num'>{line.mine === null ? '—' : Math.round(line.mine)}</Text>
                <Text className='boji-duel__num cl-num'>{line.theirs === null ? '—' : Math.round(line.theirs)}</Text>
                <Text className={`boji-duel__badge boji-duel__badge--${line.outcome ?? 'none'}`}>
                  {line.outcome ? BOJI_DUEL_LABELS[line.outcome] : '不计'}
                </Text>
              </View>
            ))}
          </View>
          <Text className='boji-privacy'>{BOJI_DUEL_LIGHTING_TIP}</Text>
        </View>
      ) : null}

      {lookalike ? (
        <View className='boji-card'>
          <Text className='boji-insight__kicker'>{lookalike.groupLabel}</Text>
          <Text className='boji-insight__title'>{bojiLookalikeText(lookalike)}</Text>
          <Text className='boji-desc'>{lookalike.tagline}</Text>
        </View>
      ) : null}

      {scoreId ? (
        <View className='boji-card'>
          <Text className='boji-card__title'>叫上好友 PK 薄肌</Text>
          <Text className='boji-desc'>好友点开自己测一次，就能逐项比出输赢。对方只看到你的昵称和分数，看不到照片。</Text>
          <Button className='boji-share-btn' openType='share' hoverClass='boji-share-btn--pressed'>
            发给微信好友 PK
          </Button>
        </View>
      ) : null}
    </>
  )
}
