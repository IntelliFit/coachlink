import { Image, Text, View } from '@tarojs/components'
import { BOJI_SEX_LABELS, bojiMetricOrder, type BojiMetricKey } from '@coachlink/core/src/bojiDetector'
import {
  BOJI_DUEL_LABELS,
  bojiDuelMetricLabel,
  bojiLookalikeText,
  type BojiChallengeView,
  type BojiMetricScores,
} from '@coachlink/core/src/bojiInsights'

function fmt(value: number | null | undefined): string {
  return typeof value === 'number' ? String(Math.round(value)) : '—'
}

function scoreOf(scores: BojiMetricScores, key: BojiMetricKey): number | null | undefined {
  return scores[key as keyof BojiMetricScores]
}

/** 打开 PK 分享卡时：好友看到对手的分数；发起人自己看到应战记录 */
export function ChallengeBanner({ view }: { view: BojiChallengeView }) {
  const { card, isOwner, responses } = view
  return (
    <View className='boji-pk'>
      <Text className='boji-pk__kicker'>{isOwner ? '你发起的薄肌 PK' : '有人向你发起薄肌 PK'}</Text>
      <View className='boji-pk__head'>
        {card.avatarUrl ? (
          <Image className='boji-pk__avatar' src={card.avatarUrl} mode='aspectFill' />
        ) : (
          <View className='boji-pk__avatar boji-pk__avatar--empty'>
            <Text>{card.nickname.slice(0, 1)}</Text>
          </View>
        )}
        <View className='boji-pk__who'>
          <Text className='boji-pk__name'>{card.nickname}</Text>
          <Text className='boji-pk__sub'>
            {BOJI_SEX_LABELS[card.sex]}
            {card.lookalike ? ` · ${bojiLookalikeText(card.lookalike)}` : ''}
          </Text>
        </View>
        <View className='boji-pk__total'>
          <Text className='boji-pk__sub'>综合分</Text>
          <Text className='boji-pk__total-value cl-num'>{fmt(card.total)}</Text>
        </View>
      </View>
      <View className='boji-pk__grid'>
        {bojiMetricOrder(card.sex).map((key) => (
          <View key={key} className='boji-pk__cell'>
            <Text className='boji-pk__sub'>{bojiDuelMetricLabel(key, card.sex)}</Text>
            <Text className='boji-pk__cell-value cl-num'>{fmt(scoreOf(card.scores, key))}</Text>
          </View>
        ))}
      </View>
      {isOwner ? (
        <View className='boji-pk__responses'>
          <Text className='boji-pk__name'>应战记录</Text>
          {responses.length === 0 ? (
            <Text className='boji-pk__sub'>还没有人应战，把这张卡转发给好友吧。</Text>
          ) : (
            responses.map((r, index) => (
              <View key={`${r.createdAt}-${index}`} className='boji-pk__response'>
                <Text className='boji-pk__response-name'>{r.nickname}</Text>
                <Text className='boji-pk__sub'>{fmt(r.total)} 分</Text>
                <Text className='boji-pk__response-result'>你{BOJI_DUEL_LABELS[r.overall]}</Text>
              </View>
            ))
          )}
        </View>
      ) : (
        <Text className='boji-pk__sub'>上传你的正面照，测完自动和 TA 逐项比输赢。对方看不到你的照片。</Text>
      )}
    </View>
  )
}
