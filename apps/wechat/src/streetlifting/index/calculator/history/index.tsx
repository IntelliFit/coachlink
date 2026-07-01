import { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, ScrollView, Picker } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useTheme } from '@/hooks/useTheme'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { authService } from '@/services/authService'
import {
  streetliftingIndexService,
  type StreetliftingCalcHistoryRes,
  type StreetliftingCalcRecord,
  type StreetliftingCalcSummary
} from '@/services/streetliftingIndexService'
import {
  readStreetliftingCalcHistoryCache,
  persistStreetliftingCalcHistoryCache
} from '@/utils/streetliftingCalcHistoryCache'
import type { ExerciseType } from '@/utils/streetliftingCalc'
import './index.scss'

const EXERCISE_OPTIONS: { label: string; value: ExerciseType }[] = [
  { label: '负重引体向上', value: 'weighted_pullup' },
  { label: '负重双杠臂屈伸', value: 'weighted_dips' },
  { label: '实力推（满分500）', value: 'strict_press' },
  { label: '杠铃弯举（满分500）', value: 'barbell_curl' },
  { label: '深蹲（DOTS）', value: 'squat' },
  { label: '卧推（DOTS）', value: 'bench' },
  { label: '硬拉（DOTS）', value: 'deadlift' }
]

function isExerciseType(value: unknown): value is ExerciseType {
  return typeof value === 'string' && EXERCISE_OPTIONS.some((option) => option.value === value)
}

function getScoreDecimals(exerciseType: ExerciseType) {
  return exerciseType === 'weighted_pullup' || exerciseType === 'weighted_dips' ? 0 : 1
}

function formatScore(record: StreetliftingCalcRecord | null, exerciseType: ExerciseType) {
  if (!record) return '--'
  return record.finalScore.toFixed(getScoreDecimals(exerciseType))
}

function formatDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${date.getMonth() + 1}.${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

export default function StreetliftingCalculatorHistoryPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const initialExerciseType = router.params?.exerciseType
  const authSession = authService.getAuthSession({ normalize: true })
  const isAuthenticated = authSession.isAuthenticated
  const [exerciseType, setExerciseType] = useState<ExerciseType>(
    isExerciseType(initialExerciseType) ? initialExerciseType : 'weighted_pullup'
  )
  const [payload, setPayload] = useState<StreetliftingCalcHistoryRes | null>(null)
  const [loading, setLoading] = useState(true)

  const summary = payload?.summary || null
  const records = payload?.records || []
  const scoreDecimals = getScoreDecimals(exerciseType)

  useEffect(() => {
    const cached = readStreetliftingCalcHistoryCache(exerciseType)
    if (cached) {
      setPayload(cached)
      setLoading(false)
    }

    let cancelled = false
    const run = async () => {
      if (!cached) setLoading(true)
      try {
        const res = await streetliftingIndexService.getCalculatorHistory({
          exerciseType,
          page: 1,
          limit: 20
        })
        if (!cancelled) {
          setPayload(res)
          persistStreetliftingCalcHistoryCache(res, exerciseType)
        }
      } catch (e) {
        console.error('[calculator-history] load error:', e)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [exerciseType])

  const exerciseLabel = useMemo(
    () => EXERCISE_OPTIONS.find((option) => option.value === exerciseType)?.label || '力量计算器',
    [exerciseType]
  )

  const openLogin = useCallback(() => {
    Taro.navigateTo({
      url: authService.buildLoginUrl(`/streetlifting/index/calculator/history?exerciseType=${exerciseType}`)
    })
  }, [exerciseType])

  const rankingText = useMemo(() => {
    if (!summary?.ranking) return '暂无排名'
    if (!summary.ranking.eligible) return summary.ranking.notice || '当前模式暂不参与趣味排名'
    if (!summary.ranking.rank) return '暂无排名'
    return `第 ${summary.ranking.rank} 名 · 超过 ${summary.ranking.percentile ?? 0}% 用户`
  }, [summary])

  if (!isAuthenticated) {
    return (
      <View className={`calc-history-page theme-${effectiveTheme}`}>
        <View className='calc-history-empty calc-history-empty--auth'>
          <Text className='calc-history-empty-title'>登录后查看历史记录</Text>
          <Text className='calc-history-empty-desc'>
            力量计算历史、历史最佳和趣味排名都属于个人数据，需要登录后才能查看。
          </Text>
          <View className='calc-history-login-btn' onClick={openLogin}>
            <Text className='calc-history-login-btn-text'>前往登录</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={`calc-history-page theme-${effectiveTheme}`}>
      {loading && !payload ? (
        <View className='calc-history-loading'>
          <LoadingSpinner size={48} />
        </View>
      ) : (
        <ScrollView className='calc-history-scroll' scrollY>
          <View className='calc-history-content'>
            <View className='calc-history-filter-card'>
              <Text className='calc-history-filter-label'>查看动作</Text>
              <Picker
                mode='selector'
                range={EXERCISE_OPTIONS}
                rangeKey='label'
                value={Math.max(0, EXERCISE_OPTIONS.findIndex((option) => option.value === exerciseType))}
                onChange={(e) => {
                  const index = Number(e.detail.value)
                  if (index >= 0) setExerciseType(EXERCISE_OPTIONS[index].value)
                }}
              >
                <View className='calc-history-picker'>{exerciseLabel}</View>
              </Picker>
            </View>

            <View className='calc-history-summary-grid'>
              <View className='calc-history-summary-card'>
                <Text className='calc-history-summary-label'>历史最佳</Text>
                <Text className='calc-history-summary-value'>{formatScore(summary?.personalBestRecord || null, exerciseType)}</Text>
                <Text className='calc-history-summary-desc'>
                  {summary?.personalBestRecord
                    ? `${summary.personalBestRecord.estimated1RMKg.toFixed(1)} kg 估算 1RM`
                    : '还没有历史最佳'}
                </Text>
              </View>

              <View className='calc-history-summary-card'>
                <Text className='calc-history-summary-label'>最近一次</Text>
                <Text className='calc-history-summary-value'>{formatScore(summary?.latestRecord || null, exerciseType)}</Text>
                <Text className='calc-history-summary-desc'>
                  {summary?.latestRecord ? formatDate(summary.latestRecord.createdAt) : '暂无记录'}
                </Text>
              </View>
            </View>

            <View className='calc-history-ranking-card'>
              <Text className='calc-history-ranking-title'>趣味排名</Text>
              <Text className='calc-history-ranking-bucket'>{summary?.ranking.bucketTitle || `${exerciseLabel}趣味榜`}</Text>
              <Text className='calc-history-ranking-value'>{rankingText}</Text>
              <Text className='calc-history-ranking-desc'>
                {summary?.ranking.eligible
                  ? `同动作趣味榜共 ${summary.ranking.totalParticipants} 人`
                  : '仅正向计算会进入趣味排名'}
              </Text>
            </View>

            <Text className='calc-history-section-title'>最近 20 次</Text>
            {records.length === 0 ? (
              <View className='calc-history-empty'>
                <Text>这个动作还没有历史记录</Text>
              </View>
            ) : (
              <View className='calc-history-list'>
                {records.map((record) => (
                  <View key={record.id} className='calc-history-record-card'>
                    <View className='calc-history-record-top'>
                      <Text className='calc-history-record-score'>
                        {record.finalScore.toFixed(scoreDecimals)}
                      </Text>
                      <Text className='calc-history-record-level'>{record.resultLevel || '已计算'}</Text>
                    </View>
                    <Text className='calc-history-record-meta'>
                      估算 1RM {record.estimated1RMKg.toFixed(1)} kg
                    </Text>
                    <Text className='calc-history-record-meta'>
                      {record.reps ? `${record.reps} 次` : '未记录次数'}
                      {record.adjustedUsedWeightKg !== null && record.adjustedUsedWeightKg !== undefined
                        ? ` · 计算重量 ${record.adjustedUsedWeightKg.toFixed(1)} kg`
                        : ''}
                    </Text>
                    <Text className='calc-history-record-date'>{formatDate(record.createdAt)}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </View>
  )
}
