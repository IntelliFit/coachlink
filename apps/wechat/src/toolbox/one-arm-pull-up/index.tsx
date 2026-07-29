import { useEffect, useMemo, useState } from 'react'
import { Text, View } from '@tarojs/components'
import {
  useShareAppMessage,
  useShareTimeline
} from '@tarojs/taro'
import { StableInput } from '@/components/StableInput'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { useTheme } from '@/hooks/useTheme'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import './index.scss'

type ReadinessLevel = {
  name: string
  summary: string
  focus: string
  className: string
  unilateralExercise: string
}

const READINESS_LEVELS: ReadinessLevel[] = [
  {
    name: '基础力量期',
    summary: '先把双手引体的动作质量和基础拉力做扎实。',
    focus: '稳定完成 8–12 次严格自重引体',
    className: 'foundation',
    unilateralExercise: '偏重引体或弓箭手引体 4 × 4/侧'
  },
  {
    name: '负重积累期',
    summary: '你已经有不错基础，下一步是稳定提高最大拉力。',
    focus: '让负重 1RM 逐步接近 0.5 倍体重',
    className: 'strength',
    unilateralExercise: '弓箭手引体 4 × 3/侧'
  },
  {
    name: '单侧过渡期',
    summary: '力量底子已经形成，可以增加单侧动作的比重。',
    focus: '同步提高负重力量与单侧控制',
    className: 'bridge',
    unilateralExercise: '弹力带辅助单手引体 5 × 3/侧'
  },
  {
    name: '专项冲刺期',
    summary: '你离理论门槛已经很近，重点转向单手专项技术。',
    focus: '补齐起拉、顶端和抗旋转控制',
    className: 'specific',
    unilateralExercise: '低辅助单手引体 + 5 秒离心 5 × 2/侧'
  },
  {
    name: '理论门槛已达到',
    summary: '你的负重力量已达到经验门槛，可以安排高质量单手尝试。',
    focus: '把双手最大力量转化为单手动作能力',
    className: 'ready',
    unilateralExercise: '标准单手引体尝试 4–6 次/侧，次间充分休息'
  }
]

function getReadinessLevel(additionalRatio: number): ReadinessLevel {
  if (additionalRatio >= 0.8) return READINESS_LEVELS[4]
  if (additionalRatio >= 0.68) return READINESS_LEVELS[3]
  if (additionalRatio >= 0.48) return READINESS_LEVELS[2]
  if (additionalRatio >= 0.25) return READINESS_LEVELS[1]
  return READINESS_LEVELS[0]
}

function formatKg(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, '')} kg`
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <View className='metric-card'>
      <Text className='metric-label'>{label}</Text>
      <Text className='metric-value'>{value}</Text>
    </View>
  )
}

function TrainingItem({ index, name, dose }: { index: number; name: string; dose: string }) {
  return (
    <View className='training-item'>
      <View className='training-index'>
        <Text>{index}</Text>
      </View>
      <View className='training-copy'>
        <Text className='training-name'>{name}</Text>
        <Text className='training-dose'>{dose}</Text>
      </View>
    </View>
  )
}

export default function OneArmPullUpPage() {
  const { effectiveTheme } = useTheme()
  const [bodyWeightInput, setBodyWeightInput] = useState('70')
  const [additionalWeightInput, setAdditionalWeightInput] = useState('40')

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '算一算，你离单手引体还有多远',
        path: buildSharePath('/toolbox/one-arm-pull-up/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  const result = useMemo(() => {
    const bodyWeight = Number(bodyWeightInput)
    const additionalWeight = Number(additionalWeightInput)

    if (
      !Number.isFinite(bodyWeight) ||
      bodyWeight <= 0 ||
      !Number.isFinite(additionalWeight) ||
      additionalWeight < 0
    ) {
      return null
    }

    const targetAdditionalWeight = bodyWeight * 0.8
    const additionalRatio = additionalWeight / bodyWeight
    const progress = (additionalWeight / targetAdditionalWeight) * 100
    const equivalentBodyWeight = (bodyWeight + additionalWeight) / 1.8

    return {
      targetAdditionalWeight,
      additionalRatio,
      systemRatio: (bodyWeight + additionalWeight) / bodyWeight,
      progress,
      progressWidth: Math.min(100, Math.max(0, progress)),
      gap: Math.max(0, targetAdditionalWeight - additionalWeight),
      equivalentBodyWeight,
      equivalentDelta: equivalentBodyWeight - bodyWeight,
      level: getReadinessLevel(additionalRatio)
    }
  }, [additionalWeightInput, bodyWeightInput])

  return (
    <PageThemeRoot>
      <View className={`oap-page theme-${effectiveTheme}`}>
        <View className='oap-content'>
          <View className='intro-card'>
            <Text className='intro-kicker'>负重引体 → 单手引体</Text>
            <Text className='intro-title'>算一算，你离单手引体还有多远</Text>
            <Text className='intro-desc'>
              输入严格负重引体 1RM，查看你距离“外加 0.8 倍体重”经验门槛还有多少。
            </Text>
            <View className='intro-stats'>
              <View className='intro-stat'>
                <Text className='intro-stat-value'>2 个</Text>
                <Text className='intro-stat-label'>必填数据</Text>
              </View>
              <View className='intro-stat'>
                <Text className='intro-stat-value'>1 分钟</Text>
                <Text className='intro-stat-label'>完成测算</Text>
              </View>
              <View className='intro-stat'>
                <Text className='intro-stat-value'>2 天</Text>
                <Text className='intro-stat-label'>每周训练</Text>
              </View>
            </View>
          </View>

          <View className='input-card'>
            <Text className='card-kicker'>输入你的成绩</Text>
            <Text className='card-title'>使用同一动作标准，结果才有可比性</Text>

            <View className='field-block'>
              <Text className='field-label'>当前体重</Text>
              <View className='input-shell'>
                <StableInput
                  className='number-input'
                  type='digit'
                  value={bodyWeightInput}
                  onInput={(event) => setBodyWeightInput(event.detail.value)}
                  placeholder='例如 70'
                />
                <Text className='input-unit'>kg</Text>
              </View>
              <Text className='field-hint'>使用最近一次稳定体重。</Text>
            </View>

            <View className='field-block'>
              <Text className='field-label'>负重引体 1RM 外加重量</Text>
              <View className='input-shell'>
                <StableInput
                  className='number-input'
                  type='digit'
                  value={additionalWeightInput}
                  onInput={(event) => setAdditionalWeightInput(event.detail.value)}
                  placeholder='例如 40'
                />
                <Text className='input-unit'>kg</Text>
              </View>
              <Text className='field-hint'>不含体重；直臂起始、下巴明确过杠。</Text>
            </View>

            {!result && <Text className='input-error'>请输入大于 0 的体重，以及不小于 0 的外加重量。</Text>}
          </View>

          {result && (
            <>
              <View className={`result-card result-card--${result.level.className}`}>
                <View className='result-heading'>
                  <View className='result-heading-copy'>
                    <Text className='card-kicker'>当前阶段</Text>
                    <Text className='result-title'>{result.level.name}</Text>
                    <Text className='result-summary'>{result.level.summary}</Text>
                  </View>
                  <Text className='result-badge'>
                    {result.progress >= 100 ? '已过门槛' : `${Math.round(result.progress)}%`}
                  </Text>
                </View>

                <View className='progress-heading'>
                  <View>
                    <Text className='progress-value'>{Math.round(result.progress)}</Text>
                    <Text className='progress-unit'>%</Text>
                  </View>
                  <View className='target-copy'>
                    <Text className='target-label'>目标外加重量</Text>
                    <Text className='target-value'>{formatKg(result.targetAdditionalWeight)}</Text>
                  </View>
                </View>
                <View className='progress-track'>
                  <View className='progress-fill' style={{ width: `${result.progressWidth}%` }} />
                </View>
                <View className='progress-ends'>
                  <Text>自重基础</Text>
                  <Text>0.8 × 体重经验门槛</Text>
                </View>

                <View className='metric-grid'>
                  <MetricCard label='还差外加重量' value={result.gap > 0 ? formatKg(result.gap) : '0 kg'} />
                  <MetricCard label='外加 / 体重' value={`${result.additionalRatio.toFixed(2)}×`} />
                  <MetricCard label='系统重量指数' value={`${result.systemRatio.toFixed(2)}×`} />
                  <MetricCard label='单引等效体重' value={formatKg(result.equivalentBodyWeight)} />
                </View>

                <View className='focus-card'>
                  <Text className='focus-label'>本阶段最重要的事</Text>
                  <Text className='focus-value'>{result.level.focus}</Text>
                </View>

                <View className='result-note'>
                  <Text>
                    {result.progress >= 100
                      ? '力量门槛不等于动作必然成功。接下来重点练握杠、肩胛起拉、抗旋转和单侧顶端控制。'
                      : `按经验模型，你还需要把严格负重 1RM 提高约 ${formatKg(result.gap)}。完成下方 8 周训练后再复测。`}
                  </Text>
                </View>
              </View>

              <View className='plan-section'>
                <Text className='section-kicker'>8 周简易计划</Text>
                <Text className='section-title'>每周练 2 次，至少间隔 48 小时</Text>
                <Text className='section-desc'>每组保留 1–2 次余力。第 4 周总组数减 30%，第 8 周末复测。</Text>

                <View className='session-card'>
                  <View className='session-heading'>
                    <View className='session-icon session-icon--dark'>
                      <Text>A</Text>
                    </View>
                    <View>
                      <Text className='session-kicker'>训练 A</Text>
                      <Text className='session-title'>最大力量日</Text>
                    </View>
                  </View>
                  <View className='training-list'>
                    <TrainingItem index={1} name='严格负重引体' dose='5 × 3，最后一组仍保留 1 次余力' />
                    <TrainingItem index={2} name='顶端停顿引体' dose='4 × 3，顶端停 2 秒' />
                    <TrainingItem index={3} name='单臂悬垂' dose='3 × 15–30 秒/侧，可用另一手轻扶' />
                  </View>
                </View>

                <View className='session-card'>
                  <View className='session-heading'>
                    <View className='session-icon session-icon--brand'>
                      <Text>B</Text>
                    </View>
                    <View>
                      <Text className='session-kicker'>训练 B</Text>
                      <Text className='session-title'>单侧转化日</Text>
                    </View>
                  </View>
                  <View className='training-list'>
                    <TrainingItem
                      index={1}
                      name={result.level.unilateralExercise}
                      dose='左右都从较弱侧开始，质量优先'
                    />
                    <TrainingItem index={2} name='爆发胸触杠引体' dose='5 × 2，充分休息，不做到力竭' />
                    <TrainingItem
                      index={3}
                      name='单臂肩胛下沉'
                      dose='3 × 6/侧，保持肘伸直，可用另一手或弹力带辅助'
                    />
                  </View>
                </View>
              </View>

              <View className='method-card'>
                <Text className='section-kicker'>怎么算的？</Text>
                <View className='formula-row'>
                  <Text className='formula-label'>经验门槛</Text>
                  <Text className='formula-value'>目标 AW = 0.8 × BW</Text>
                </View>
                <View className='formula-row'>
                  <Text className='formula-label'>单引等效体重</Text>
                  <Text className='formula-value'>(BW + AW) ÷ 1.8</Text>
                </View>
                <View className='formula-row'>
                  <Text className='formula-label'>等效差值 x</Text>
                  <Text className='formula-value'>(AW − 0.8BW) ÷ 1.8</Text>
                </View>
                <Text className='method-equivalent'>
                  你的等效差值为 {result.equivalentDelta >= 0 ? '+' : ''}
                  {formatKg(result.equivalentDelta)}
                </Text>
                <Text className='method-note'>
                  BW 是体重，AW 是严格负重引体 1RM 的外加重量。0.8 是经验假设，不是医学或生物力学定律；臂长、握力、肩胛稳定、抗旋转和动作标准都会影响真实表现。
                </Text>
              </View>
            </>
          )}
        </View>
      </View>
    </PageThemeRoot>
  )
}
