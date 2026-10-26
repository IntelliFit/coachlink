import { Text, View } from '@tarojs/components'

export type PowerAnalysisCheckStatus = 'good' | 'info' | 'warn' | 'issue' | 'unavailable'

export interface PowerAnalysisCheck {
  code: string
  titleZh: string
  status: PowerAnalysisCheckStatus
  detailZh: string
  repIndexes: number[]
  timesS: number[]
  value: number | null
  unit: string
}

export interface PowerAnalysisAssessment {
  version: string
  view: 'front' | 'side' | 'oblique' | 'unknown'
  viewLabelZh: string
  recommendedViewZh: string
  counts: Record<PowerAnalysisCheckStatus, number>
  checks: PowerAnalysisCheck[]
}

export interface PowerAnalysisMeasurement {
  target: 'body_anchor' | 'barbell_plate' | 'barbell_body_proxy'
  anchorLabelZh: string
  scaleSource: string
  confidence: 'high' | 'medium' | 'low'
  plateDiameterCm?: number
  trackingCoverage?: number
  warningsZh: string[]
}

const STATUS_LABEL: Record<PowerAnalysisCheckStatus, string> = {
  issue: '问题',
  warn: '注意',
  info: '信息',
  good: '良好',
  unavailable: '无法评估'
}

function describeMeasurement(measurement?: PowerAnalysisMeasurement) {
  if (!measurement) return ''
  if (measurement.target === 'barbell_plate') {
    const coverage = typeof measurement.trackingCoverage === 'number'
      ? `，追踪覆盖 ${Math.round(measurement.trackingCoverage * 100)}%`
      : ''
    return `测量对象：杠铃片中心（按直径 ${measurement.plateDiameterCm ?? 45} cm 换算${coverage}）`
  }
  const scaleText = SCALE_SOURCE_ZH[measurement.scaleSource] || '按身高换算'
  if (measurement.target === 'barbell_body_proxy') {
    return `测量对象：${measurement.anchorLabelZh || '身体'}位置估算（没有识别到杠铃片，${scaleText}，误差较大）`
  }
  return `测量对象：${measurement.anchorLabelZh || '身体'}位置（${scaleText}）`
}

const SCALE_SOURCE_ZH: Record<string, string> = {
  plate_diameter: '按杠铃片直径换算',
  body_height: '按身高换算',
  torso_segment: '按躯干长度估算',
  limb_segments: '按躯干和腿的长度换算',
  frame_fallback: '人物没有完整入镜，按画面高度粗略估算'
}

interface AssessmentSectionProps {
  assessment?: PowerAnalysisAssessment
  measurement?: PowerAnalysisMeasurement
  canSeek: boolean
  onSeek: (timeS: number) => void
}

export default function AssessmentSection({ assessment, measurement, canSeek, onSeek }: AssessmentSectionProps) {
  if (!assessment) return null
  const measurementText = describeMeasurement(measurement)

  return (
    <View className='assessment-card'>
      <View className='assessment-header'>
        <Text className='section-title'>动作评估</Text>
        <Text className='assessment-view'>机位：{assessment.viewLabelZh}（推荐{assessment.recommendedViewZh}）</Text>
      </View>
      <View className='assessment-counts'>
        {(['issue', 'warn', 'info', 'good', 'unavailable'] as PowerAnalysisCheckStatus[])
          .filter((status) => status !== 'info' || (assessment.counts?.info ?? 0) > 0)
          .map((status) => (
          <View key={status} className={`assessment-chip status-${status}`}>
            <Text>{STATUS_LABEL[status]} {assessment.counts?.[status] ?? 0}</Text>
          </View>
        ))}
      </View>
      {measurementText && <Text className='assessment-measurement'>{measurementText}</Text>}
      {(measurement?.warningsZh || []).map((warning) => (
        <Text key={warning} className='assessment-warning'>{warning}</Text>
      ))}
      {assessment.checks.length === 0 ? (
        <Text className='assessment-empty'>没有识别到完整动作，暂时无法评估姿态。</Text>
      ) : (
        <View className='assessment-list'>
          {assessment.checks.map((check, checkIndex) => (
            <View key={`${check.code}-${checkIndex}`} className='assessment-item'>
              <View className={`assessment-chip status-${check.status}`}>
                <Text>{STATUS_LABEL[check.status]}</Text>
              </View>
              <View className='assessment-body'>
                <Text className='assessment-title'>{check.titleZh}</Text>
                <Text className='assessment-detail'>{check.detailZh}</Text>
                {check.timesS.length > 0 && (
                  <View className='assessment-times'>
                    {check.timesS.map((time, index) => (
                      <View
                        key={`${check.code}-${time}-${index}`}
                        className={`assessment-time ${canSeek ? 'seekable' : ''}`}
                        onClick={() => canSeek && onSeek(time)}
                      >
                        <Text>第 {check.repIndexes[index] ?? index + 1} 次 · {time.toFixed(1)}s</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>
      )}
      <Text className='assessment-footnote'>
        评估基于视频关键点自动估算，阈值为通用训练参考，不是比赛判罚或医学诊断。{canSeek ? '点时间可跳到上方视频对应位置。' : ''}
      </Text>
    </View>
  )
}
