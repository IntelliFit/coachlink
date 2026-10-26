import { useEffect, useMemo, useState } from 'react'
import { Canvas, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import {
  BOJI_FEMALE_HEALTH_NOTE,
  BOJI_SEX_LABELS,
  BOJI_SHAPE_COLORS,
  bojiEnclosureColor,
  bojiMetricCards,
  bojiOverlayShapes,
  bojiPhotoTips,
  bojiQualityNotes,
  bojiReportSex,
  bojiTotalScore,
  isBojiSex,
  type BojiAnalysisDto,
  type BojiMetricCard,
  type BojiSex
} from '@coachlink/core/src/bojiDetector'
import { bojiPercentileText, bojiShareTitle, isBojiScoreId, type BojiChallengeView } from '@coachlink/core/src/bojiInsights'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { ClButton } from '@/components/ui'
import { useTheme } from '@/hooks/useTheme'
import { authService } from '@/services/authService'
import {
  analyzeBojiPhoto,
  choosePhoto,
  fetchBojiChallenge,
  preparePhoto,
  type PreparedPhoto
} from '@/services/bojiDetectorService'
import { buildSharePath, createSharePayload, createTimelinePayload, openCoachLinkShareMenu } from '@/utils/share'
import { BojiInsightsView } from './BojiInsights'
import { ChallengeBanner } from './ChallengeBanner'
import './index.scss'

const PAGE_PATH = '/toolbox/boji/index'
const CANVAS_ID = 'boji-canvas'
/** 画布宽度（rpx）：750 减去左右 32rpx 页边距 */
const CANVAS_WIDTH_RPX = 686
/** 从朋友圈打开的「单页模式」场景值：不能登录、不能跳页 */
const TIMELINE_SINGLE_PAGE_SCENE = 1154

function isTimelineSinglePage(): boolean {
  try {
    return Taro.getEnterOptionsSync().scene === TIMELINE_SINGLE_PAGE_SCENE
  } catch {
    return false
  }
}

type Phase = 'idle' | 'working' | 'done' | 'error'

const SEX_STORAGE_KEY = 'coachlink_boji_sex'
const SEXES: BojiSex[] = ['male', 'female']

function readStoredSex(): BojiSex {
  try {
    const value = Taro.getStorageSync(SEX_STORAGE_KEY)
    return isBojiSex(value) ? value : 'male'
  } catch {
    return 'male'
  }
}

const METHOD_TEXT: Record<BojiSex, string> = {
  male: '先找到关节和人体轮廓，再量轮廓宽度（倒三角、手臂、对称），最后在腹部找腹白线和每条横沟，逐块计算被沟围住的比例。腹肌数值依赖阴影：同一个人，光越柔和数值越低，前后对比请用同一地点和光线。',
  female: '先找到关节和人体轮廓，量出最窄腰宽和髋部最宽处（腰臀比）、肩宽（肩腰比）和左右对称；马甲线不数块，只看腹白线和腹部两侧竖线有多清楚。线条数值依赖阴影：光越柔和数值越低，前后对比请用同一地点和光线。',
}

const STATUS_BADGE: Record<BojiMetricCard['status'], string> = {
  ok: '',
  low_confidence: '仅供参考',
  unavailable: '测不了'
}

function canvasNode(): Promise<{ node: any; width: number; height: number } | null> {
  return new Promise((resolve) => {
    Taro.createSelectorQuery()
      .select(`#${CANVAS_ID}`)
      .fields({ node: true, size: true })
      .exec((res) => resolve(res?.[0]?.node ? res[0] : null))
  })
}

/** 在一张 2d 画布上画照片和测量标注；坐标按报告的 original_size 缩放。 */
async function drawResult(photo: PreparedPhoto, analysis: BojiAnalysisDto, showMarks: boolean) {
  const found = await canvasNode()
  if (!found) return
  const { node: canvas, width, height } = found
  const ctx = canvas.getContext('2d')
  const dpr = Taro.getSystemInfoSync().pixelRatio || 2
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  ctx.scale(dpr, dpr)
  const image = canvas.createImage()
  await new Promise((resolve, reject) => {
    image.onload = resolve
    image.onerror = reject
    image.src = photo.path
  })
  ctx.drawImage(image, 0, 0, width, height)
  if (!showMarks) return
  const [photoWidth, photoHeight] = analysis.report.original_size ?? [photo.width, photo.height]
  const sx = width / photoWidth
  const sy = height / photoHeight
  for (const shape of bojiOverlayShapes(analysis.report)) {
    ctx.beginPath()
    shape.points.forEach(([x, y], index) => (index === 0 ? ctx.moveTo(x * sx, y * sy) : ctx.lineTo(x * sx, y * sy)))
    if (shape.kind === 'block') {
      const color = bojiEnclosureColor(shape.enclosure ?? 0)
      ctx.closePath()
      ctx.globalAlpha = 0.3
      ctx.fillStyle = color
      ctx.fill()
      ctx.globalAlpha = 1
      ctx.strokeStyle = color
      ctx.lineWidth = 1.5
      ctx.setLineDash([])
      ctx.stroke()
      continue
    }
    ctx.strokeStyle = BOJI_SHAPE_COLORS[shape.kind]
    ctx.lineWidth = shape.kind === 'shoulder' || shape.kind === 'waist' || shape.kind === 'hip' ? 3 : 2
    ctx.lineCap = 'round'
    ctx.setLineDash(shape.kind === 'lateral' ? [6, 5] : [])
    ctx.stroke()
  }
  ctx.setLineDash([])
}

export default function BojiDetectorPage() {
  const { effectiveTheme } = useTheme()
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [analysis, setAnalysis] = useState<BojiAnalysisDto | null>(null)
  const [error, setError] = useState('')
  const [showMarks, setShowMarks] = useState(true)
  const [singlePage] = useState(isTimelineSinglePage)
  const [sex, setSex] = useState<BojiSex>(readStoredSex)
  const router = useRouter()
  const challengeId = isBojiScoreId(router.params?.challenge) ? router.params.challenge : null
  const [challenge, setChallenge] = useState<BojiChallengeView | null>(null)

  // 每次显示都重新取：登录回来后才知道自己是不是发起人
  useDidShow(() => {
    if (!challengeId) return
    fetchBojiChallenge(challengeId)
      .then(setChallenge)
      .catch(() => setChallenge(null))
  })

  const scoreId = analysis?.insights?.scoreId ?? null
  const sharePayload = useMemo(() => {
    if (analysis && scoreId) {
      return createSharePayload({
        title: bojiShareTitle(bojiTotalScore(analysis), analysis.insights?.percentile ?? null),
        path: buildSharePath(PAGE_PATH, { challenge: scoreId }),
      })
    }
    return createSharePayload({ title: '薄肌检测器：一张正面照量出腹肌和倒三角', path: buildSharePath(PAGE_PATH) })
  }, [analysis, scoreId])
  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))
  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    if (!photo || !analysis) return
    const timer = setTimeout(() => {
      drawResult(photo, analysis, showMarks).catch(() => setError('结果图绘制失败，数值仍然有效'))
    }, 50)
    return () => clearTimeout(timer)
  }, [photo, analysis, showMarks])

  const cards = useMemo(() => (analysis ? bojiMetricCards(analysis) : []), [analysis])
  const total = analysis ? bojiTotalScore(analysis) : null
  const notes = analysis ? bojiQualityNotes(analysis) : []
  const resultSex = analysis ? bojiReportSex(analysis.report) : sex

  const chooseSex = (next: BojiSex) => {
    if (phase === 'working') return
    setSex(next)
    try {
      Taro.setStorageSync(SEX_STORAGE_KEY, next)
    } catch {
      // 存不了只影响下次默认值
    }
  }

  const promptLogin = () => {
    Taro.showModal({
      title: '登录后可用',
      content: '薄肌检测需要登录。照片只用于这一次检测，不保存；只记录分数，用于排名和 PK。',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          const returnTo = challengeId ? buildSharePath(PAGE_PATH, { challenge: challengeId }) : PAGE_PATH
          Taro.navigateTo({ url: authService.buildLoginUrl(returnTo) })
        }
      }
    })
  }

  const start = async (source: 'album' | 'camera') => {
    if (!authService.getToken()) {
      promptLogin()
      return
    }
    const path = await choosePhoto(source)
    if (!path) return
    setError('')
    setAnalysis(null)
    setPhase('working')
    try {
      const prepared = await preparePhoto(path)
      setPhoto(prepared)
      // 自己打开自己的 PK 卡时不算应战
      setAnalysis(await analyzeBojiPhoto(prepared.path, challenge?.isOwner ? null : challengeId, sex))
      setPhase('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : '检测失败，请稍后再试'
      setError(message)
      setPhase('error')
      if (message.includes('登录')) promptLogin()
    }
  }

  const canvasHeightRpx = photo ? Math.round((CANVAS_WIDTH_RPX * photo.height) / photo.width) : 0

  return (
    <PageThemeRoot>
      <View className={`boji-page theme-${effectiveTheme}`}>
        <View className='boji-content'>
          {challenge ? <ChallengeBanner view={challenge} /> : null}
          <View className='boji-intro'>
            <Text className='boji-kicker'>测试版 · 照片不保存</Text>
            <Text className='boji-title'>薄肌检测器</Text>
            <Text className='boji-desc'>
              {sex === 'female'
                ? '上传一张正面照，量出马甲线、腰臀比、肩腰比和左右对称，并在照片上标出测量位置。'
                : '上传一张正面照，量出腹肌分块、倒三角、手臂围度和左右对称，并在照片上标出测量位置。'}
            </Text>
          </View>

          <View className='boji-card'>
            <View className='boji-card__row'>
              <Text className='boji-card__title'>拍摄建议</Text>
              <View className='boji-sex'>
                {SEXES.map((option) => (
                  <Text
                    key={option}
                    className={`boji-sex__option ${sex === option ? 'boji-sex__option--on' : ''}`}
                    onClick={() => chooseSex(option)}
                  >
                    {BOJI_SEX_LABELS[option]}
                  </Text>
                ))}
              </View>
            </View>
            {bojiPhotoTips(sex).map((tip) => (
              <View key={tip} className='boji-tip'>
                <View className='boji-tip__dot' />
                <Text className='boji-tip__text'>{tip}</Text>
              </View>
            ))}
            {singlePage ? (
              <Text className='boji-timeline-note'>
                从朋友圈打开时不能检测。点屏幕下方「前往小程序」，就能测自己的薄肌{challengeId ? '并接受 PK' : ''}。
              </Text>
            ) : (
              <View className='boji-actions'>
                <ClButton block loading={phase === 'working'} loadingText='正在检测…' onClick={() => start('album')}>
                  {phase === 'done' ? '换一张照片' : '从相册选择'}
                </ClButton>
                <ClButton block variant='secondary' disabled={phase === 'working'} onClick={() => start('camera')}>
                  拍一张
                </ClButton>
              </View>
            )}
            {error ? <Text className='boji-error'>{error}</Text> : null}
            <Text className='boji-privacy'>照片只用于这一次检测，不保存；只记录分数，用于排名和 PK。结果只是自测参考，不是医疗诊断。</Text>
          </View>

          {analysis && photo ? (
            <View className='boji-result'>
              <View className='boji-total'>
                <Text className='boji-total__label'>综合分</Text>
                <Text className='boji-total__value cl-num'>{total ?? '—'}</Text>
                {analysis.insights?.percentile ? (
                  <Text className='boji-total__rank'>{bojiPercentileText(analysis.insights.percentile)}</Text>
                ) : null}
                <Text className='boji-total__note'>
                  {total === null
                    ? '这张照片能测的项目太少，不给综合分。按拍摄建议换一张再试。'
                    : '测试版：分数还没有用真人评分校准，PK 图个乐；认真对比请看原始数值和自己前后的变化。'}
                </Text>
                {resultSex === 'female' ? <Text className='boji-total__note'>{BOJI_FEMALE_HEALTH_NOTE}</Text> : null}
              </View>

              <BojiInsightsView insights={analysis.insights} sex={resultSex} />

              <View className='boji-card boji-card--flush'>
                <View className='boji-card__head'>
                  <Text className='boji-card__title'>测量位置</Text>
                  <Text className='boji-toggle' onClick={() => setShowMarks((v) => !v)}>
                    {showMarks ? '隐藏标注' : '显示标注'}
                  </Text>
                </View>
                <Canvas
                  type='2d'
                  id={CANVAS_ID}
                  className='boji-canvas'
                  style={{ height: `${canvasHeightRpx}rpx` }}
                />
              </View>

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

          <View className='boji-card'>
            <Text className='boji-card__title'>它是怎么测的</Text>
            <Text className='boji-method'>{METHOD_TEXT[resultSex]}</Text>
          </View>
        </View>
      </View>
    </PageThemeRoot>
  )
}
