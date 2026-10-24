import { Image, Text, View } from '@tarojs/components'
import {
  BOJI_DUEL_LABELS,
  BOJI_DUEL_METRIC_LABELS,
  BOJI_DUEL_ORDER,
  bojiLookalikeText,
  type BojiChallengeView,
} from '@coachlink/core/src/bojiInsights'

function fmt(value: number | null): string {
  return value === null ? '—' : String(Math.round(value))
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
          {card.lookalike ? <Text className='boji-pk__sub'>{bojiLookalikeText(card.lookalike)}</Text> : null}
        </View>
        <View className='boji-pk__total'>
          <Text className='boji-pk__sub'>综合分</Text>
          <Text className='boji-pk__total-value cl-num'>{fmt(card.total)}</Text>
        </View>
      </View>
      <View className='boji-pk__grid'>
        {BOJI_DUEL_ORDER.map((key) => (
          <View key={key} className='boji-pk__cell'>
            <Text className='boji-pk__sub'>{BOJI_DUEL_METRIC_LABELS[key]}</Text>
            <Text className='boji-pk__cell-value cl-num'>{fmt(card.scores[key])}</Text>
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
