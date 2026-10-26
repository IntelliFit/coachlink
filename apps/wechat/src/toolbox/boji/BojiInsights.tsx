import { Button, Image, Text, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { BojiSex } from '@coachlink/core/src/bojiDetector'
import {
  BOJI_DUEL_LABELS,
  BOJI_DUEL_LIGHTING_TIP,
  BOJI_DUEL_MIXED_TIP,
  bojiDuelMetricLabel,
  bojiDuelHeadline,
  bojiLookalikeText,
  type BojiInsights,
} from '@coachlink/core/src/bojiInsights'
import { API_BASE_URL } from '@/utils/request'

/** 微信不允许按钮直接发朋友圈，只能从右上角菜单进入，这里告诉用户怎么做 */
function showTimelineGuide() {
  Taro.showModal({
    title: '分享到朋友圈',
    content: '点右上角「···」，选择「分享到朋友圈」。朋友从朋友圈点进来就能看到你的分数，并接受 PK。',
    showCancel: false,
    confirmText: '知道了',
  })
}

/** 检测结果下方：PK 结果、身材最像谁、邀请好友 PK（微信原生分享按钮） */
export function BojiInsightsView({ insights, sex = 'male' }: { insights: BojiInsights | undefined; sex?: BojiSex }) {
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
                <Text className='boji-duel__name'>{bojiDuelMetricLabel(line.key, sex)}</Text>
                <Text className='boji-duel__num boji-duel__num--mine cl-num'>{line.mine === null ? '—' : Math.round(line.mine)}</Text>
                <Text className='boji-duel__num cl-num'>{line.theirs === null ? '—' : Math.round(line.theirs)}</Text>
                <Text className={`boji-duel__badge boji-duel__badge--${line.outcome ?? 'none'}`}>
                  {line.outcome ? BOJI_DUEL_LABELS[line.outcome] : '不计'}
                </Text>
              </View>
            ))}
          </View>
          <Text className='boji-privacy'>
            {challenge.mixedSex ? `${BOJI_DUEL_MIXED_TIP}${BOJI_DUEL_LIGHTING_TIP}` : BOJI_DUEL_LIGHTING_TIP}
          </Text>
        </View>
      ) : null}

      {lookalike ? (
        <View className='boji-card'>
          <View className='boji-insight__row'>
            <Text className='boji-insight__kicker'>{lookalike.groupLabel}</Text>
            {lookalike.similarity !== undefined ? (
              <Text className='boji-insight__similarity'>相似度 {lookalike.similarity}%</Text>
            ) : null}
          </View>
          <View className='boji-lookalike'>
            {lookalike.photoPath ? (
              <Image className='boji-lookalike__avatar' src={`${API_BASE_URL}${lookalike.photoPath}`} mode='aspectFill' />
            ) : (
              <View className='boji-lookalike__avatar boji-lookalike__avatar--initial'>
                <Text>{lookalike.name.slice(0, 1)}</Text>
              </View>
            )}
            <View className='boji-lookalike__text'>
              <Text className='boji-insight__title'>{bojiLookalikeText(lookalike)}</Text>
              <Text className='boji-desc'>{lookalike.tagline}</Text>
            </View>
          </View>
          {lookalike.traits && lookalike.traits.length > 0 ? (
            <View className='boji-traits'>
              {lookalike.traits.map((trait) => (
                <Text key={trait} className='boji-traits__item'>{trait}</Text>
              ))}
            </View>
          ) : null}
          {lookalike.runnerUp ? <Text className='boji-insight__kicker'>其次像：{lookalike.runnerUp}</Text> : null}
        </View>
      ) : null}

      {scoreId ? (
        <View className='boji-card'>
          <Text className='boji-card__title'>叫上好友 PK 薄肌</Text>
          <Text className='boji-desc'>好友点开自己测一次，就能逐项比出输赢。对方只看到你的昵称和分数，看不到照片。</Text>
          <Button className='boji-share-btn' openType='share' hoverClass='boji-share-btn--pressed'>
            发给微信好友 PK
          </Button>
          <View className='boji-share-timeline' hoverClass='boji-share-btn--pressed' onClick={showTimelineGuide}>
            <Text>分享到朋友圈</Text>
          </View>
        </View>
      ) : null}
    </>
  )
}
