import { Text, View } from '@tarojs/components'
import type { BojiSex } from '@coachlink/core/src/bojiDetector'
import { bojiStrengths } from '@coachlink/core/src/bojiDisplay'
import type { BojiMetricScores, BojiPercentile } from '@coachlink/core/src/bojiInsights'
import { ScoreRing } from './BojiCharts'

/** 结果页第一屏：环形综合分 + 超越比例 + 长板短板 */
export function ResultHero({
  total,
  percentile,
  scores,
  sex,
  packCount
}: {
  total: number | null
  percentile: BojiPercentile | null
  scores: BojiMetricScores
  sex: BojiSex
  packCount: number | null
}) {
  const strengths = bojiStrengths(scores, sex)
  const chips: string[] = []
  if (strengths) {
    chips.push(`长板 · ${strengths.best.label} ${strengths.best.score}`)
    chips.push(`短板 · ${strengths.weakest.label} ${strengths.weakest.score}`)
  }
  if (sex === 'male' && packCount !== null && packCount > 0) chips.push(`腹肌 ${packCount} 块`)

  return (
    <View className='boji-hero'>
      <View className='boji-hero__main'>
        <ScoreRing id='boji-score-ring' total={total} />
        <View className='boji-hero__rank'>
          <Text className='boji-hero__kicker'>{sex === 'female' ? '你的线条' : '你的薄肌'}</Text>
          {percentile ? (
            <>
              <Text className='boji-hero__rank-text'>超越了约</Text>
              <Text className='boji-hero__rank-value cl-num'>{percentile.value}%</Text>
              <Text className='boji-hero__rank-text'>的人</Text>
            </>
          ) : (
            <Text className='boji-hero__rank-text'>
              {total === null ? '这张照片能测的项目太少，不给综合分' : '综合分'}
            </Text>
          )}
        </View>
      </View>
      {chips.length > 0 ? (
        <View className='boji-hero__chips'>
          {chips.map((chip) => (
            <Text key={chip} className='boji-hero__chip'>{chip}</Text>
          ))}
        </View>
      ) : null}
    </View>
  )
}
