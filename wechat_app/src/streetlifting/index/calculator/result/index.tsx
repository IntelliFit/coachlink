/**
 * 力量计算结果页
 * 从计算器页面跳转而来，展示计算结果和分享功能
 */
import { useEffect, useState, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import {
  type ExerciseType,
  isUpperBodyExercise,
  isBenchBasedExercise,
  getScoreLevel,
  generateRMTable
} from '@/utils/streetliftingCalc'
import { useSharePoster } from '@/hooks/useSharePoster'
import { SharePosterModal } from '@/components/SharePosterModal'
import { authService } from '@/services/authService'
import { studentService } from '@/services/studentService'
import { drawStrengthPoster, type StrengthPosterData } from '../poster'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

const EXERCISE_OPTIONS: { label: string; value: ExerciseType }[] = [
  { label: '负重引体向上', value: 'weighted_pullup' },
  { label: '负重双杠臂屈伸', value: 'weighted_dips' },
  { label: '实力推（满分500）', value: 'strict_press' },
  { label: '杠铃弯举（满分500）', value: 'barbell_curl' },
  { label: '深蹲（DOTS）', value: 'squat' },
  { label: '卧推（DOTS）', value: 'bench' },
  { label: '硬拉（DOTS）', value: 'deadlift' }
]

const MODE_OPTIONS: { label: string; value: string }[] = [
  { label: '正向计算', value: 'forward' },
  { label: '反推做组重量', value: 'reverse_weight' },
  { label: '反推次数', value: 'reverse_reps' }
]

interface CalcResult {
  estimated_1rm: number
  final_score: number
  coefficient: number
  computed_added_weight?: number
  computed_reps?: number
  adjusted_used_weight?: number
}

interface ResultData {
  result: CalcResult
  exerciseType: ExerciseType
  mode: string
  gender: string
  bodyweight: string
  reps: string
  workingWeight?: number | null
}

const STORAGE_KEY = 'sl_calc_result'

export default function CalculatorResultPage() {
  const { effectiveTheme } = useTheme()
  const router = useRouter()
  const [data, setData] = useState<ResultData | null>(null)
  const [loading, setLoading] = useState(true)
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    try {
      const raw = Taro.getStorageSync(STORAGE_KEY)
      if (raw) {
        setData(JSON.parse(raw))
      }
    } catch (e) {
      console.error('[calculator-result] load data error:', e)
    } finally {
      setLoading(false)
    }
  }, [router])

  const result = data?.result
  const exerciseType = data?.exerciseType || 'weighted_pullup'
  const mode = data?.mode || 'forward'
  const gender = data?.gender || ''
  const bodyweight = data?.bodyweight || ''
  const reps = data?.reps || ''
  const workingWeight =
    typeof data?.workingWeight === 'number' && Number.isFinite(data.workingWeight)
      ? data.workingWeight
      : null

  const scoreLevel = result ? getScoreLevel(result.final_score, exerciseType) : null
  const scoreLabel = isUpperBodyExercise(exerciseType) || isBenchBasedExercise(exerciseType) ? '力量分' : 'DOTS分'
  const scoreUnit = ''
  const scoreDecimals = isUpperBodyExercise(exerciseType) ? 0 : 1
  const oneRMLabel = isUpperBodyExercise(exerciseType) ? '估算负重 1RM' : '估算 1RM'
  const bwNum = Number(bodyweight) || 0
  const rmTable = result
    ? generateRMTable(isUpperBodyExercise(exerciseType) ? bwNum : 0, result.estimated_1rm)
    : []

  const { generate: generatePoster, generating: posterGenerating, imageUrl: posterImageUrl, reset: resetPoster } =
    useSharePoster<StrengthPosterData>({
      canvasId: 'strength-calc-poster-canvas',
      width: 750,
      draw: (ctx, posterData) => drawStrengthPoster(ctx, posterData)
    })

  const buildPosterData = useCallback((): StrengthPosterData | null => {
    if (!result || !scoreLevel) return null

    const now = new Date()
    const user = Taro.getStorageSync('user') || {}
    const profile = Taro.getStorageSync('studentProfile') as Record<string, unknown> | null
    const profileUser =
      profile && typeof profile === 'object' && profile !== null && 'user' in profile
        ? (profile as { user?: Record<string, unknown> }).user
        : null
    const mergedProfile = (profileUser || profile || {}) as Record<string, unknown>

    const nickname = String(
      user?.nickname || user?.real_name || user?.name || user?.phone || 'CoachLink 用户'
    ).trim()
    const displayName = String(user?.nickname || user?.real_name || user?.name || nickname).trim()
    const avatarUrl = String(
      user?.avatar_url ||
        user?.avatarUrl ||
        user?.headimgurl ||
        user?.wechat_avatar ||
        mergedProfile?.avatar_url ||
        mergedProfile?.avatarUrl ||
        ''
    ).trim()

    const createdAtRaw = user?.created_at || user?.createdAt || user?.register_time || user?.registeredAt || ''
    const createdAt = createdAtRaw ? new Date(String(createdAtRaw)) : null
    const msPerDay = 24 * 60 * 60 * 1000
    const registeredDays =
      createdAt && !Number.isNaN(createdAt.getTime())
        ? Math.max(1, Math.floor((Date.now() - createdAt.getTime()) / msPerDay) + 1)
        : 1

    const submittedAtDisplay = `${String(now.getMonth() + 1).padStart(2, '0')}/${String(now.getDate()).padStart(
      2,
      '0'
    )} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
    const estimated1RMLabel = isUpperBodyExercise(exerciseType) ? '估算负重 1RM' : '估算 1RM'
    const posterWorkingWeight =
      workingWeight ??
      (typeof result.computed_added_weight === 'number' && Number.isFinite(result.computed_added_weight)
        ? result.computed_added_weight
        : typeof result.adjusted_used_weight === 'number' && Number.isFinite(result.adjusted_used_weight)
          ? result.adjusted_used_weight
          : undefined)

    return {
      exerciseName: EXERCISE_OPTIONS.find((option) => option.value === exerciseType)?.label || '力量训练',
      displayName,
      nickname,
      avatarUrl: avatarUrl || undefined,
      registeredDays,
      level: scoreLevel.level,
      score: result.final_score,
      scoreLabel,
      estimated1RM: result.estimated_1rm,
      estimated1RMLabel,
      coefficient: result.coefficient,
      workingWeight: posterWorkingWeight,
      bodyweight: Number(bodyweight) || 0,
      reps: Number(reps) || 0,
      gender: gender === 'Male' ? '男' : gender === 'Female' ? '女' : '',
      mode: MODE_OPTIONS.find((option) => option.value === mode)?.label || '正向计算',
      date: `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(
        2,
        '0'
      )}`,
      submittedAtDisplay
    }
  }, [bodyweight, exerciseType, gender, mode, reps, result, scoreLabel, scoreLevel, workingWeight])

  const handleOpenShare = useCallback(async () => {
    const base = buildPosterData()
    if (!base) return

    setShowShareModal(true)
    let posterData: StrengthPosterData = { ...base }

    try {
      const session = authService.getAuthSession({ normalize: true })
      const uid = session.userId
      if (uid) {
        const profileRes = await studentService.getStudentProfile(String(uid))
        const profile = profileRes?.profile as Record<string, unknown> | undefined
        const avatar = profile?.avatar_url || profile?.avatarUrl
        const nickname = profile?.nickname || profile?.real_name

        if (avatar && String(avatar).trim()) {
          posterData = { ...posterData, avatarUrl: String(avatar).trim() }
        }
        if (nickname && String(nickname).trim()) {
          const cleanName = String(nickname).trim()
          posterData = { ...posterData, displayName: cleanName, nickname: cleanName }
        }
      }
    } catch (e) {
      console.warn('[calculator-result] poster profile merge failed', e)
    }

    await new Promise<void>((resolve) => Taro.nextTick(() => resolve()))
    await new Promise<void>((resolve) => setTimeout(() => resolve(), 40))
    await generatePoster(posterData)
  }, [buildPosterData, generatePoster])

  const handleCloseShare = useCallback(() => {
    setShowShareModal(false)
    resetPoster()
  }, [resetPoster])

  const handleSharePosterImage = useCallback(() => {
    if (!posterImageUrl) return
    // @ts-ignore
    Taro.showShareImageMenu({
      path: posterImageUrl,
      fail: (err: { errMsg?: string }) => {
        console.error('showShareImageMenu fail', err)
        Taro.showToast({ title: '分享失败，请先保存图片再发送', icon: 'none' })
      }
    })
  }, [posterImageUrl])

  const handleSavePoster = useCallback(() => {
    if (!posterImageUrl) return
    Taro.saveImageToPhotosAlbum({
      filePath: posterImageUrl,
      success: () => {
        Taro.showToast({ title: '已保存到相册', icon: 'success' })
        handleCloseShare()
      },
      fail: (err: { errMsg?: string }) => {
        if (err.errMsg?.includes('auth deny') || err.errMsg?.includes('authorize')) {
          Taro.showModal({
            title: '提示',
            content: '需要您授权保存图片到相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) Taro.openSetting()
            }
          })
          return
        }
        Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    })
  }, [handleCloseShare, posterImageUrl])

  const handleBack = () => {
    Taro.navigateBack()
  }

  if (loading) {
    return (
      <View className={`calc-result-page theme-${effectiveTheme}`}>
        <View className='calc-result-loading'>
          <LoadingSpinner size={48} />
        </View>
      </View>
    )
  }

  if (!result) {
    return (
      <View className={`calc-result-page theme-${effectiveTheme}`}>
        <View className='calc-result-empty'>
          <Text>未找到计算结果</Text>
          <View className='calc-result-back-btn' onClick={handleBack}>
            <Text>返回计算器</Text>
          </View>
        </View>
      </View>
    )
  }

  return (
    <View className={`calc-result-page theme-${effectiveTheme}`}>
      <ScrollView className='calc-result-scroll' scrollY>
        <View className='calc-result-content'>
          <View className='result-actions-top'>
            <View className='result-share-row top' onClick={handleOpenShare}>
              <Text className='iconfont icon-share result-share-icon' />
              <Text className='result-share-text'>生成分享卡片</Text>
            </View>
            <View className='result-recalc-row top' onClick={handleBack}>
              <Text className='result-recalc-text'>再算一次</Text>
            </View>
          </View>

          {scoreLevel && (
            <View className='result-score-card'>
              <Text className='result-score-label'>{scoreLevel.level}</Text>
              <Text className='result-score-value'>
                {result.final_score.toFixed(scoreDecimals)}
                {scoreUnit}
              </Text>
              <Text className='result-score-sublabel'>{scoreLabel}</Text>
            </View>
          )}

          {result.adjusted_used_weight !== undefined && (
            <Text className='result-line'>实际用于计算的重量：{result.adjusted_used_weight.toFixed(1)} kg</Text>
          )}
          {result.computed_added_weight !== undefined && (
            <Text className='result-line'>反推做组重量：{result.computed_added_weight.toFixed(1)} kg</Text>
          )}
          {result.computed_reps !== undefined && (
            <Text className='result-line'>反推可完成次数：{result.computed_reps} 次</Text>
          )}

          <View className='result-metrics-grid'>
            <View className='result-metric-card'>
              <Text className='result-metric-label'>
                <Text className='iconfont icon-zhongliang metric-icon' />
                {oneRMLabel}
              </Text>
              <Text className='result-metric-value'>
                {result.estimated_1rm.toFixed(1)}
                <Text className='result-metric-unit'> kg</Text>
              </Text>
            </View>
            <View className='result-metric-card'>
              <Text className='result-metric-label'>
                <Text className='iconfont icon-strength metric-icon' />
                {scoreLabel}
              </Text>
              <Text className='result-metric-value brand'>{result.final_score.toFixed(scoreDecimals)}</Text>
            </View>
          </View>

          <View className='rm-table-wrap'>
            <Text className='rm-table-title'>RM 对照表</Text>
            <View className='rm-table'>
              <View className='rm-header'>
                <Text>次数</Text>
                <Text>重量</Text>
                <Text>百分比</Text>
              </View>
              {rmTable.map((row, idx) => (
                <View key={row.reps} className={`rm-row ${idx % 2 === 1 ? 'striped' : ''}`}>
                  <Text>{row.reps} 次</Text>
                  <Text>{row.weight.toFixed(1)} kg</Text>
                  <Text>{row.percentage}%</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      </ScrollView>

      <SharePosterModal
        visible={showShareModal}
        onClose={handleCloseShare}
        title='分享力量成绩'
        canvasId='strength-calc-poster-canvas'
        posterImageUrl={posterImageUrl}
        onShareImage={handleSharePosterImage}
        onSaveImage={handleSavePoster}
        generating={posterGenerating}
      />
    </View>
  )
}
