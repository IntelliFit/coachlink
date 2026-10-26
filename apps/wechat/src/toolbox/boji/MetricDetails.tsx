import { useState } from 'react'
import { Text, View } from '@tarojs/components'
import type { BojiMetricCard } from '@coachlink/core/src/bojiDetector'

const STATUS_BADGE: Record<BojiMetricCard['status'], string> = {
  ok: '',
  low_confidence: '仅供参考',
  unavailable: '测不了'
}

/** 原始数值默认折叠：大多数人只看分数，想深究的再展开 */
export function MetricDetails({ cards, notes, summary }: { cards: BojiMetricCard[]; notes: string[]; summary: string }) {
  const [open, setOpen] = useState(false)
  return (
    <View className='boji-details'>
      <View className='boji-details__toggle' hoverClass='boji-share-btn--pressed' onClick={() => setOpen((v) => !v)}>
        <View className='boji-details__titles'>
          <Text className='boji-details__title'>{open ? '收起详细数据' : '查看详细数据'}</Text>
          {summary ? <Text className='boji-details__summary'>{summary}</Text> : null}
        </View>
        <Text className={`boji-details__chevron ${open ? 'boji-details__chevron--open' : ''}`}>›</Text>
      </View>
      {open ? (
        <View className='boji-details__body'>
          {notes.length > 0 ? (
            <View className='boji-notes'>
              {notes.map((note) => (
                <Text key={note} className='boji-notes__item'>· {note}</Text>
              ))}
            </View>
          ) : null}
          {cards.map((card) => (
            <View key={card.key} className='boji-metric'>
              <View className='boji-metric__head'>
                <View className='boji-metric__titles'>
                  <Text className='boji-metric__title'>{card.title}</Text>
                  <Text className='boji-metric__explain'>{card.explain}</Text>
                </View>
                <View className='boji-metric__score-box'>
                  <Text className='boji-metric__score cl-num'>{card.score ?? '—'}</Text>
                  {STATUS_BADGE[card.status] ? (
                    <Text className={`boji-badge boji-badge--${card.status}`}>{STATUS_BADGE[card.status]}</Text>
                  ) : null}
                </View>
              </View>
              <Text className='boji-metric__headline'>{card.headline}</Text>
              {card.details.map((detail) => (
                <Text key={detail} className='boji-metric__detail'>{detail}</Text>
              ))}
              {card.reasons.map((reason) => (
                <Text key={reason} className='boji-metric__reason'>{reason}</Text>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}
