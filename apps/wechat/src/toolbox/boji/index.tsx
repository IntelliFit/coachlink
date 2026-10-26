import { useEffect, useMemo, useState } from 'react'
import { Canvas, Text, View } from '@tarojs/components'
import Taro, { useDidShow, useRouter, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import {
  BOJI_FEMALE_HEALTH_NOTE,
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
  type BojiSex
} from '@coachlink/core/src/bojiDetector'
import { bojiScoreIdFromScene, bojiStrengths, bojiTrainingTip } from '@coachlink/core/src/bojiDisplay'
import { bojiScoreSnapshot, bojiShareTitle, isBojiScoreId, type BojiChallengeView } from '@coachlink/core/src/bojiInsights'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { SharePosterModal } from '@/components/SharePosterModal'
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
import { RadarChart, type ChartColors } from './BojiCharts'
import { DuelView, LookalikeCard, ShareActions } from './BojiInsights'
import { BOJI_POSTER_HEIGHT, type BojiShareImageData } from './bojiPoster'
import { ChallengeBanner } from './ChallengeBanner'
import { MetricDetails } from './MetricDetails'
import { ResultHero } from './ResultHero'
import { StartHero } from './StartHero'
import { BOJI_CARD_CANVAS_ID, BOJI_POSTER_CANVAS_ID, useBojiShareImages } from './useBojiShareImages'
import './index.scss'
import './redesign-pages.scss'

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

function readStoredSex(): BojiSex {
  try {
    const value = Taro.getStorageSync(SEX_STORAGE_KEY)
    return isBojiSex(value) ? value : 'male'
  } catch {
    return 'male'
  }
}

function readNickname(): string {
  try {
    const user = Taro.getStorageSync('user') || {}
    return String(user?.nickname || user?.real_name || user?.name || '我').trim() || '我'
  } catch {
    return '我'
  }
}

const METHOD_TEXT: Record<BojiSex, string> = {
  male: '先找到关节和人体轮廓，再量轮廓宽度（倒三角、手臂、对称），最后在腹部找腹白线和每条横沟，逐块计算被沟围住的比例。腹肌数值依赖阴影：同一个人，光越柔和数值越低，前后对比请用同一地点和光线。',
  female: '先找到关节和人体轮廓，量出最窄腰宽和髋部最宽处（腰臀比）、肩宽（肩腰比）和左右对称；马甲线不数块，只看腹白线和腹部两侧竖线有多清楚。线条数值依赖阴影：光越柔和数值越低，前后对比请用同一地点和光线。',
}

const RADAR_COLORS: Record<'light' | 'dark', ChartColors> = {
  light: { accent: '#CF6D4E', accentStrong: '#B4553A', track: '#E7E1D7', grid: '#E7E1D7', label: '#1E1C1A' },
  dark: { accent: '#CF6D4E', accentStrong: '#E08A6D', track: '#3A3631', grid: 'rgba(255,255,255,0.14)', label: '#F5F2ED' },
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

function detailSummary(snapshot: ReturnType<typeof bojiScoreSnapshot>): string {
  const parts: string[] = []
  if (snapshot.sex === 'female' && snapshot.waistHipRatio !== null) parts.push(`腰臀比 ${snapshot.waistHipRatio.toFixed(2)}`)
  if (snapshot.shoulderWaistRatio !== null) parts.push(`肩腰比 ${snapshot.shoulderWaistRatio.toFixed(2)}`)
  if (snapshot.sex === 'male' && snapshot.upperArmRatio !== null) parts.push(`上臂宽/长 ${snapshot.upperArmRatio.toFixed(2)}`)
  if (snapshot.silhouetteIou !== null) parts.push(`轮廓重合 ${Math.round(snapshot.silhouetteIou * 100)}%`)
  return parts.join(' · ')
}

export default function BojiDetectorPage() {
  const { effectiveTheme } = useTheme()
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [analysis, setAnalysis] = useState<BojiAnalysisDto | null>(null)
  const [error, setError] = useState('')
  const [showMarks, setShowMarks] = useState(true)
  const [showTips, setShowTips] = useState(false)
  const [singlePage] = useState(isTimelineSinglePage)
  const [sex, setSex] = useState<BojiSex>(readStoredSex)
  const router = useRouter()
  // 分享链接带 challenge；扫海报小程序码进来带 scene（成绩 id 去掉连字符）
  const challengeId = isBojiScoreId(router.params?.challenge)
    ? router.params.challenge
    : bojiScoreIdFromScene(router.params?.scene)
  const [challenge, setChallenge] = useState<BojiChallengeView | null>(null)

  // 每次显示都重新取：登录回来后才知道自己是不是发起人
  useDidShow(() => {
    if (!challengeId) return
    fetchBojiChallenge(challengeId)
      .then(setChallenge)
      .catch(() => setChallenge(null))
  })

  const total = analysis ? bojiTotalScore(analysis) : null
  const resultSex = analysis ? bojiReportSex(analysis.report) : sex
  const snapshot = useMemo(() => (analysis ? bojiScoreSnapshot(analysis.report) : null), [analysis])
  const scoreId = analysis?.insights?.scoreId ?? null

  const shareData = useMemo<BojiShareImageData | null>(() => {
    if (!analysis || !snapshot) return null
    const look = analysis.insights?.lookalike ?? null
    return {
      sex: snapshot.sex,
      total: bojiTotalScore(analysis),
      percentile: analysis.insights?.percentile?.value ?? null,
      lookalikeName: look?.name ?? null,
      lookalikeGroup: look?.groupLabel ?? null,
      scores: snapshot.scores,
      nickname: readNickname()
    }
  }, [analysis, snapshot])
  const shareImages = useBojiShareImages(shareData, scoreId)

  const sharePayload = useMemo(() => {
    if (analysis && scoreId) {
      return createSharePayload({
        title: bojiShareTitle(bojiTotalScore(analysis), analysis.insights?.percentile ?? null),
        path: buildSharePath(PAGE_PATH, { challenge: scoreId }),
        imageUrl: shareImages.cardImageUrl ?? undefined
      })
    }
    return createSharePayload({ title: '薄肌检测器：一张正面照测出你的薄肌等级', path: buildSharePath(PAGE_PATH) })
  }, [analysis, scoreId, shareImages.cardImageUrl])
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
  const notes = analysis ? bojiQualityNotes(analysis) : []

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
      Taro.pageScrollTo({ scrollTop: 0, duration: 0 })
    } catch (err) {
      const message = err instanceof Error ? err.message : '检测失败，请稍后再试'
      setError(message)
      setPhase('error')
      if (message.includes('登录')) promptLogin()
    }
  }

  const canvasHeightRpx = photo ? Math.round((CANVAS_WIDTH_RPX * photo.height) / photo.width) : 0
  const strengths = snapshot ? bojiStrengths(snapshot.scores, snapshot.sex) : null

  const actions = singlePage ? (
    <Text className='boji-timeline-note'>
      从朋友圈打开时不能检测。点屏幕下方「前往小程序」，就能测自己的薄肌{challengeId ? '并接受 PK' : ''}。
    </Text>
  ) : (
    <View className='boji-actions'>
      <ClButton block loading={phase === 'working'} loadingText='正在检测，通常几秒…' onClick={() => start('album')}>
        {analysis ? '换一张照片再测' : '从相册选一张，测测我的薄肌'}
      </ClButton>
      <View className='boji-actions__row'>
        <ClButton block variant='secondary' disabled={phase === 'working'} onClick={() => start('camera')}>
          现在拍一张
        </ClButton>
        <ClButton block variant='secondary' onClick={() => setShowTips((v) => !v)}>
          {showTips ? '收起拍摄建议' : '怎么拍更准'}
        </ClButton>
      </View>
    </View>
  )

  return (
    <PageThemeRoot>
      <View className={`boji-page theme-${effectiveTheme}`}>
        <View className='boji-content'>
          {challenge && !analysis ? <ChallengeBanner view={challenge} /> : null}

          {analysis && snapshot ? (
            <View className='boji-result'>
              {analysis.insights?.challenge ? (
                <DuelView challenge={analysis.insights.challenge} myTotal={total} sex={resultSex} />
              ) : null}

              <ResultHero
                total={total}
                percentile={analysis.insights?.percentile ?? null}
                scores={snapshot.scores}
                sex={resultSex}
                packCount={snapshot.absPackCount}
              />
              <LookalikeCard insights={analysis.insights} />
              <ShareActions canShare={!!scoreId && !singlePage} onPoster={shareImages.openPoster} />

              <View className='boji-card'>
                <Text className='boji-card__title'>{resultSex === 'female' ? '四项线条' : '四项得分'}</Text>
                <RadarChart id='boji-radar' scores={snapshot.scores} sex={resultSex} colors={RADAR_COLORS[effectiveTheme === 'dark' ? 'dark' : 'light']} />
                {strengths ? <Text className='boji-desc'>{bojiTrainingTip(strengths, resultSex)}</Text> : null}
              </View>

              <View className='boji-card boji-card--flush'>
                <View className='boji-card__head'>
                  <Text className='boji-card__title'>测量位置</Text>
                  <Text className='boji-toggle' onClick={() => setShowMarks((v) => !v)}>
                    {showMarks ? '隐藏标注' : '显示标注'}
                  </Text>
                </View>
                <Canvas type='2d' id={CANVAS_ID} className='boji-canvas' style={{ height: `${canvasHeightRpx}rpx` }} />
              </View>

              <MetricDetails cards={cards} notes={notes} summary={detailSummary(snapshot)} />
            </View>
          ) : (
            <StartHero sex={sex} onSexChange={chooseSex} disabled={phase === 'working'} />
          )}

          {actions}
          {error ? <Text className='boji-error'>{error}</Text> : null}

          {showTips ? (
            <View className='boji-card'>
              <Text className='boji-card__title'>怎么拍更准</Text>
              {bojiPhotoTips(analysis ? resultSex : sex).map((tip) => (
                <View key={tip} className='boji-tip'>
                  <View className='boji-tip__dot' />
                  <Text className='boji-tip__text'>{tip}</Text>
                </View>
              ))}
              <Text className='boji-card__title'>它是怎么测的</Text>
              <Text className='boji-method'>{METHOD_TEXT[analysis ? resultSex : sex]}</Text>
            </View>
          ) : null}

          <View className='boji-footnotes'>
            <Text className='boji-privacy'>照片只用于这一次检测，不保存；只记录分数，用于排名和 PK。</Text>
            {analysis ? (
              <Text className='boji-privacy'>测试版：分数供自测和好友 PK 娱乐，不是医疗诊断。</Text>
            ) : null}
            {analysis && resultSex === 'female' ? <Text className='boji-privacy'>{BOJI_FEMALE_HEALTH_NOTE}</Text> : null}
          </View>
        </View>

        <View className='share-poster-canvas-wrap'>
          <Canvas type='2d' id={BOJI_CARD_CANVAS_ID} style={{ width: '500px', height: '400px' }} />
        </View>
        <SharePosterModal
          visible={shareImages.posterOpen}
          onClose={shareImages.closePoster}
          title='薄肌海报'
          canvasId={BOJI_POSTER_CANVAS_ID}
          canvasHeight={BOJI_POSTER_HEIGHT}
          posterImageUrl={shareImages.posterImageUrl}
          onShareImage={shareImages.sharePosterImage}
          onSaveImage={shareImages.savePoster}
          generating={shareImages.posterGenerating}
        />
      </View>
    </PageThemeRoot>
  )
}
