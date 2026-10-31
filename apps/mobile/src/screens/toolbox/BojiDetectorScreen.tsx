import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Alert, Image, Pressable, Share, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import * as FileSystem from 'expo-file-system/legacy'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from '@react-navigation/native'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import Svg, { Circle, Line, Polygon, Polyline, Text as SvgText } from 'react-native-svg'
import {
  BOJI_FEMALE_HEALTH_NOTE,
  BOJI_SEX_LABELS,
  BOJI_SHAPE_COLORS,
  bojiEnclosureColor,
  bojiMetricCards,
  bojiMetricOrder,
  bojiOverlayShapes,
  bojiPhotoTips,
  bojiQualityNotes,
  bojiReportSex,
  bojiTotalScore,
  isBojiSex,
  type BojiAnalysisDto,
  type BojiMetricKey,
  type BojiSex,
} from '@coachlink/core/src/bojiDetector'
import { bojiRadarAxes, bojiRingArc, bojiShortMetricLabel, bojiStrengths, bojiTrainingTip } from '@coachlink/core/src/bojiDisplay'
import {
  BOJI_DUEL_LABELS,
  BOJI_DUEL_LIGHTING_TIP,
  BOJI_DUEL_MIXED_TIP,
  bojiDuelHeadline,
  bojiDuelMetricLabel,
  bojiLookalikeText,
  bojiScoreSnapshot,
  bojiShareTitle,
  isBojiScoreId,
  type BojiChallengeView,
  type BojiMetricScores,
} from '@coachlink/core/src/bojiInsights'
import { apiClient, getStoredToken } from '../../api'
import { API_BASE_URL } from '../../config'
import { COMPATIBLE_IMAGE_OPTIONS } from '../../imagePickerOptions'
import { returnHereAfterLogin } from '../../navigation/navigationRef'
import type { RootStackParamList } from '../../navigation/types'
import { useAuth } from '../../providers/AuthProvider'
import { colors, radius, spacing } from '../../theme'
import { Card, InlineAvatar, ScreenShell, SolidButton } from '../me/MeShared'
import { BOJI_ANALYZE_TIMEOUT_MS, analyzeBojiQuery, bojiContentType, bojiDetailSummary, bojiUploadError, withTimeout } from './bojiModel'

type Props = NativeStackScreenProps<RootStackParamList, 'BojiDetector'>
type Phase = 'idle' | 'working' | 'done' | 'error'
type Photo = { uri: string; width: number; height: number }

const SEX_STORAGE_KEY = 'coachlink_boji_sex'
const PRIVACY_TEXT = '照片只用于这一次检测，不保存；腹部区域可能交给 AI 模型复核腹肌（不含脸，也不保存）；只记录分数，用于排名和 PK。'

const HEADLINES: Record<BojiSex, { title: string; desc: string }> = {
  male: { title: '一张正面照，测出你的薄肌等级', desc: '量腹肌分块、倒三角、手臂和左右对称，看看你超越了多少人、身材最像哪位明星，再拉好友 PK。' },
  female: { title: '一张正面照，测出你的马甲线和曲线', desc: '量马甲线、腰臀比、肩腰比和左右对称，看看你超越了多少人、身材最像哪位明星，再拉闺蜜 PK。' },
}

const METHOD_TEXT: Record<BojiSex, string> = {
  male: '先找到关节和人体轮廓，再量轮廓宽度（倒三角、手臂、对称），最后在腹部找腹白线和每条横沟，逐块计算被沟围住的比例。腹肌数值依赖阴影：同一个人，光越柔和数值越低，前后对比请用同一地点和光线。',
  female: '先找到关节和人体轮廓，量出最窄腰宽和髋部最宽处（腰臀比）、肩宽（肩腰比）和左右对称；马甲线不数块，只看腹白线和腹部两侧竖线有多清楚。线条数值依赖阴影：光越柔和数值越低，前后对比请用同一地点和光线。',
}

const STATUS_BADGE: Record<string, string> = { ok: '', low_confidence: '仅供参考', unavailable: '测不了' }

function fmt(value: number | null | undefined) {
  return typeof value === 'number' ? String(Math.round(value)) : '—'
}

/** 薄肌检测器，对应小程序 toolbox/boji，同一个 /api/toolbox/boji/analyze。照片不经过对象存储。 */
export function BojiDetectorScreen({ navigation, route }: Props) {
  const { isAuthenticated, logout } = useAuth()
  const startingRef = useRef(false)
  const challengeId = isBojiScoreId(route.params?.challenge) ? route.params?.challenge || null : null
  const [phase, setPhase] = useState<Phase>('idle')
  const [photo, setPhoto] = useState<Photo | null>(null)
  const [analysis, setAnalysis] = useState<BojiAnalysisDto | null>(null)
  const [error, setError] = useState('')
  const [showMarks, setShowMarks] = useState(true)
  const [showTips, setShowTips] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [sex, setSex] = useState<BojiSex>('male')
  const [challenge, setChallenge] = useState<BojiChallengeView | null>(null)

  useEffect(() => {
    AsyncStorage.getItem(SEX_STORAGE_KEY).then((value) => { if (isBojiSex(value)) setSex(value) }).catch(() => undefined)
  }, [])

  useEffect(() => {
    setChallenge(null)
  }, [challengeId])

  // 与小程序一样每次回到页面都刷新，发起人才能看到新的应战记录
  useFocusEffect(useCallback(() => {
    if (!challengeId) return undefined
    let alive = true
    apiClient.request<BojiChallengeView>(`/api/toolbox/boji/challenge/${challengeId}`, { timeoutMs: 12000 })
      .then((data) => { if (alive) setChallenge(data) })
      .catch(() => { if (alive) setChallenge(null) })
    return () => {
      alive = false
    }
  }, [challengeId, isAuthenticated]))

  const total = analysis ? bojiTotalScore(analysis) : null
  const resultSex = analysis ? bojiReportSex(analysis.report) : sex
  const snapshot = useMemo(() => (analysis ? bojiScoreSnapshot(analysis.report) : null), [analysis])
  const cards = useMemo(() => (analysis ? bojiMetricCards(analysis) : []), [analysis])
  const notes = analysis ? bojiQualityNotes(analysis) : []
  const strengths = snapshot ? bojiStrengths(snapshot.scores, snapshot.sex) : null
  const scoreId = analysis?.insights?.scoreId ?? null

  function chooseSex(next: BojiSex) {
    if (phase === 'working') return
    setSex(next)
    void AsyncStorage.setItem(SEX_STORAGE_KEY, next).catch(() => undefined)
  }

  function promptLogin() {
    Alert.alert('登录后可用', '薄肌检测需要登录。照片只用于这一次检测，不保存；腹部区域可能交给 AI 复核（不含脸）；只记录分数。', [
      { text: '取消', style: 'cancel' },
      {
        text: '去登录',
        onPress: () => {
          returnHereAfterLogin('BojiDetector', route.params)
          navigation.navigate('Login')
        },
      },
    ])
  }

  function promptSessionExpired() {
    Alert.alert('登录已过期', '请重新登录后再测。', [
      { text: '取消', style: 'cancel' },
      {
        text: '去登录',
        onPress: () => {
          returnHereAfterLogin('BojiDetector', route.params)
          void logout()
        },
      },
    ])
  }

  function goBack() {
    // 从链接直接打开时没有上一页
    if (navigation.canGoBack()) navigation.goBack()
    else navigation.navigate('MainTabs')
  }

  async function start(source: 'album' | 'camera') {
    if (!isAuthenticated) {
      promptLogin()
      return
    }
    // 连点会同时跑两次，标注可能画到另一张照片上，还多耗一次额度
    if (startingRef.current) return
    startingRef.current = true
    try {
      await pickAndAnalyze(source)
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : '检测失败，请稍后再试')
      setPhase('error')
    } finally {
      startingRef.current = false
    }
  }

  async function pickAndAnalyze(source: 'album' | 'camera') {
    let result: ImagePicker.ImagePickerResult
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync()
      if (!permission.granted) {
        Alert.alert('需要相机权限', '请在系统设置中允许 CoachLink 使用相机后重试。')
        return
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
    } else {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, ...COMPATIBLE_IMAGE_OPTIONS })
    }
    const asset = result.canceled ? null : result.assets[0]
    if (!asset?.uri) return
    // 看压缩后的文件：安卓选图结果里的 fileSize 是原图大小
    const info = await FileSystem.getInfoAsync(asset.uri)
    const tooLarge = bojiUploadError(info.exists ? info.size : undefined)
    if (tooLarge) throw new Error(tooLarge)
    setError('')
    setAnalysis(null)
    setPhase('working')
    setPhoto({ uri: asset.uri, width: asset.width, height: asset.height })
    const token = await getStoredToken()
    // 自己打开自己的 PK 卡时不算应战
    const query = analyzeBojiQuery(challenge?.isOwner ? null : challengeId, sex)
    // 不能用 fetch 发 Blob：Expo 的 fetch 读不出 Blob，发 Blob 还会丢掉 Content-Type
    const response = await withTimeout(FileSystem.uploadAsync(`${API_BASE_URL}/api/toolbox/boji/analyze${query}`, asset.uri, {
      httpMethod: 'POST',
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
      headers: { 'Content-Type': bojiContentType(asset.mimeType), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      sessionType: FileSystem.FileSystemSessionType.FOREGROUND,
    }), BOJI_ANALYZE_TIMEOUT_MS, '检测超时，请检查网络后重试')
    let json: { success?: boolean; message?: string; data?: unknown } | null = null
    try {
      json = JSON.parse(response.body)
    } catch {
      json = null
    }
    if (response.status === 401) {
      setPhase('idle')
      promptSessionExpired()
      return
    }
    if (response.status < 200 || response.status >= 300 || !json?.success || !json?.data) {
      throw new Error(json?.message || '检测失败，请稍后再试')
    }
    setAnalysis(json.data as BojiAnalysisDto)
    setPhase('done')
  }

  async function shareResult() {
    if (!analysis || !scoreId) return
    const title = bojiShareTitle(total, analysis.insights?.percentile ?? null)
    const url = `${API_BASE_URL.replace(/\/+$/, '')}/toolbox/boji?challenge=${scoreId}`
    try {
      await Share.share({ title, message: `${title}\n${url}` })
    } catch {
      Alert.alert('分享失败', '暂时无法调起系统分享，请稍后重试。')
    }
  }

  const look = analysis?.insights?.lookalike ?? null
  const duel = analysis?.insights?.challenge ?? null

  return (
    <ScreenShell title="薄肌检测器" subtitle="一张正面照测出薄肌等级" onBack={goBack}>
      {challenge && !analysis ? <ChallengeBanner view={challenge} /> : null}

      {analysis && snapshot ? (
        <>
          {duel ? (
            <Card>
              <View style={styles.vs}>
                <View style={styles.vsSide}><Text style={styles.vsName}>你</Text><Text style={styles.vsTotal}>{fmt(total)}</Text></View>
                <Text style={styles.vsMark}>VS</Text>
                <View style={styles.vsSide}>
                  <InlineAvatar uri={duel.opponent.avatarUrl} label={duel.opponent.nickname} size={40} />
                  <Text style={styles.vsName} numberOfLines={1}>{duel.opponent.nickname}</Text>
                  <Text style={styles.vsTotal}>{fmt(duel.opponent.total)}</Text>
                </View>
              </View>
              <Text style={styles.verdict}>{bojiDuelHeadline(duel.duel)}</Text>
              <Text style={styles.cardTitle}>逐项对比</Text>
              {duel.duel.lines.map((line) => (
                <View key={line.key} style={styles.duelRow}>
                  <Text style={[styles.duelNum, line.outcome === 'win' && styles.duelWin]}>{fmt(line.mine)}</Text>
                  <Text style={styles.duelLabel}>{bojiShortMetricLabel(line.key, resultSex)}</Text>
                  <Text style={[styles.duelNum, line.outcome === 'lose' && styles.duelWin]}>{fmt(line.theirs)}</Text>
                </View>
              ))}
              <Text style={styles.note}>{duel.mixedSex ? `${BOJI_DUEL_MIXED_TIP}${BOJI_DUEL_LIGHTING_TIP}` : BOJI_DUEL_LIGHTING_TIP}</Text>
            </Card>
          ) : null}

          <Card>
            <View style={styles.heroRow}>
              <ScoreRing total={total} />
              <View style={styles.heroRank}>
                <Text style={styles.kicker}>{resultSex === 'female' ? '你的线条' : '你的薄肌'}</Text>
                {analysis.insights?.percentile ? (
                  <Text style={styles.rankText}>超越了约 <Text style={styles.rankValue}>{analysis.insights.percentile.value}%</Text> 的人</Text>
                ) : (
                  <Text style={styles.rankText}>{total === null ? '这张照片能测的项目太少，不给综合分' : '综合分'}</Text>
                )}
              </View>
            </View>
            <View style={styles.chips}>
              {strengths ? <Text style={styles.chip}>长板 · {strengths.best.label} {strengths.best.score}</Text> : null}
              {strengths ? <Text style={styles.chip}>短板 · {strengths.weakest.label} {strengths.weakest.score}</Text> : null}
              {resultSex === 'male' && snapshot.absPackCount ? <Text style={styles.chip}>腹肌 {snapshot.absPackCount} 块</Text> : null}
            </View>
          </Card>
          {resultSex === 'female' ? <Text style={styles.note}>{BOJI_FEMALE_HEALTH_NOTE}</Text> : null}

          {look ? (
            <Card>
              <View style={styles.lookRow}>
                {look.photoPath ? <Image source={{ uri: `${API_BASE_URL}${look.photoPath}` }} style={styles.lookAvatar} accessibilityIgnoresInvertColors /> : <View style={[styles.lookAvatar, styles.lookEmpty]}><Text style={styles.cardTitle}>{look.name.slice(0, 1)}</Text></View>}
                <View style={styles.flex}>
                  <Text style={styles.kicker}>{look.closeness === 'close' ? '你的身材最接近' : '照这个方向练，最可能成为'}{look.similarity !== undefined ? ` · 相似度 ${look.similarity}%` : ''}</Text>
                  <Text style={styles.cardTitle}>{look.name}</Text>
                  <Text style={styles.desc}>{look.tagline}</Text>
                  <Text style={styles.note}>{look.groupLabel}</Text>
                </View>
              </View>
              {look.traits?.length ? <View style={styles.chips}>{look.traits.map((trait) => <Text key={trait} style={styles.chip}>{trait}</Text>)}</View> : null}
              {look.runnerUp ? <Text style={styles.note}>其次像：{look.runnerUp}</Text> : null}
              {look.photoCredit ? <Text style={styles.note}>人物照片：{look.name}，{look.photoCredit}</Text> : null}
            </Card>
          ) : null}

          {scoreId ? <SolidButton label="找好友 PK" onPress={() => void shareResult()} /> : null}

          <Card>
            <Text style={styles.cardTitle}>{resultSex === 'female' ? '四项线条' : '四项得分'}</Text>
            <RadarChart scores={snapshot.scores} sex={resultSex} />
            {strengths ? <Text style={styles.desc}>{bojiTrainingTip(strengths, resultSex)}</Text> : null}
          </Card>

          {photo ? (
            <Card>
              <View style={styles.rowBetween}>
                <Text style={styles.cardTitle}>测量位置</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={showMarks ? '隐藏标注' : '显示标注'} onPress={() => setShowMarks(!showMarks)} style={styles.linkButton}>
                  <Text style={styles.link}>{showMarks ? '隐藏标注' : '显示标注'}</Text>
                </Pressable>
              </View>
              <PhotoOverlay photo={photo} analysis={analysis} showMarks={showMarks} />
            </Card>
          ) : null}

          <Pressable accessibilityRole="button" accessibilityLabel={showDetails ? '收起详细数据' : '查看详细数据'} accessibilityState={{ expanded: showDetails }} onPress={() => setShowDetails(!showDetails)} style={styles.detailsToggle}>
            <Text style={styles.cardTitle}>{showDetails ? '收起详细数据' : '查看详细数据'}</Text>
            {bojiDetailSummary(snapshot) ? <Text style={styles.note}>{bojiDetailSummary(snapshot)}</Text> : null}
          </Pressable>
          {showDetails ? (
            <Card>
              {notes.map((note) => <Text key={note} style={styles.note}>· {note}</Text>)}
              {cards.map((card) => (
                <View key={card.key} style={styles.metric}>
                  <View style={styles.rowBetween}>
                    <View style={styles.flex}>
                      <Text style={styles.metricTitle}>{card.title}</Text>
                      <Text style={styles.note}>{card.explain}</Text>
                    </View>
                    <View style={styles.metricScore}>
                      <Text style={styles.cardTitle}>{card.score ?? '—'}</Text>
                      {STATUS_BADGE[card.status] ? <Text style={styles.note}>{STATUS_BADGE[card.status]}</Text> : null}
                    </View>
                  </View>
                  <Text style={styles.desc}>{card.headline}</Text>
                  {card.details.map((detail) => <Text key={detail} style={styles.note}>{detail}</Text>)}
                  {card.reasons.map((reason) => <Text key={reason} style={styles.note}>{reason}</Text>)}
                </View>
              ))}
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <Text style={styles.heroTitle}>{HEADLINES[sex].title}</Text>
          <Text style={styles.desc}>{HEADLINES[sex].desc}</Text>
          <View style={styles.chips}>{['超越比例', '明星同款', '好友 PK'].map((name) => <Text key={name} style={styles.chip}>{name}</Text>)}</View>
          <View style={styles.sexRow}>
            {(['male', 'female'] as BojiSex[]).map((option) => (
              <Pressable key={option} accessibilityRole="radio" accessibilityLabel={BOJI_SEX_LABELS[option]} accessibilityState={{ checked: sex === option, disabled: phase === 'working' }} disabled={phase === 'working'} onPress={() => chooseSex(option)} style={[styles.sexOption, sex === option && styles.sexOptionActive]}>
                <Text style={[styles.sexText, sex === option && styles.sexTextActive]}>{BOJI_SEX_LABELS[option]}</Text>
              </Pressable>
            ))}
          </View>
        </Card>
      )}

      <SolidButton label={analysis ? '换一张照片再测' : '从相册选一张，测测我的薄肌'} loading={phase === 'working'} onPress={() => void start('album')} />
      {phase === 'working' ? <Text style={styles.note}>正在检测，通常几秒…</Text> : null}
      <View style={styles.row}>
        <View style={styles.flex}><SolidButton label="现在拍一张" variant="secondary" disabled={phase === 'working'} onPress={() => void start('camera')} /></View>
        <View style={styles.flex}><SolidButton label={showTips ? '收起拍摄建议' : '怎么拍更准'} variant="secondary" onPress={() => setShowTips(!showTips)} /></View>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}

      {showTips ? (
        <Card>
          <Text style={styles.cardTitle}>怎么拍更准</Text>
          {bojiPhotoTips(analysis ? resultSex : sex).map((tip) => <Text key={tip} style={styles.desc}>· {tip}</Text>)}
          <Text style={styles.cardTitle}>它是怎么测的</Text>
          <Text style={styles.desc}>{METHOD_TEXT[analysis ? resultSex : sex]}</Text>
        </Card>
      ) : null}

      <Text style={styles.note}>{PRIVACY_TEXT}</Text>
      {analysis ? <Text style={styles.note}>测试版：分数供自测和好友 PK 娱乐，不是医疗诊断。</Text> : null}
    </ScreenShell>
  )
}

function ChallengeBanner({ view }: { view: BojiChallengeView }) {
  const { card, isOwner, responses } = view
  return (
    <Card>
      <Text style={styles.kicker}>{isOwner ? '你发起的薄肌 PK' : '有人向你发起薄肌 PK'}</Text>
      <View style={styles.rowBetween}>
        <InlineAvatar uri={card.avatarUrl} label={card.nickname} size={40} />
        <View style={styles.flex}>
          <Text style={styles.cardTitle}>{card.nickname}</Text>
          <Text style={styles.note}>{BOJI_SEX_LABELS[card.sex]}{card.lookalike ? ` · ${bojiLookalikeText(card.lookalike)}` : ''}</Text>
        </View>
        <View style={styles.metricScore}>
          <Text style={styles.note}>综合分</Text>
          <Text style={styles.vsTotal}>{fmt(card.total)}</Text>
        </View>
      </View>
      <View style={styles.chips}>
        {bojiMetricOrder(card.sex).map((key: BojiMetricKey) => (
          <Text key={key} style={styles.chip}>{bojiDuelMetricLabel(key, card.sex)} {fmt(card.scores[key as keyof BojiMetricScores])}</Text>
        ))}
      </View>
      {isOwner ? (
        <>
          <Text style={styles.metricTitle}>我的 PK 战绩</Text>
          {responses.length === 0 ? <Text style={styles.note}>还没有人应战，把链接转发给好友吧。</Text> : null}
          {responses.map((item, index) => (
            <View key={`${item.createdAt}-${index}`} style={styles.rowBetween}>
              <Text style={styles.desc}>{item.nickname}</Text>
              <Text style={styles.note}>{fmt(item.total)} 分</Text>
              <Text style={styles.link}>你{BOJI_DUEL_LABELS[item.overall]}</Text>
            </View>
          ))}
        </>
      ) : (
        <Text style={styles.note}>上传你的正面照，测完自动和 TA 逐项比输赢。对方看不到你的照片。</Text>
      )}
    </Card>
  )
}

function ScoreRing({ total }: { total: number | null }) {
  const size = 112
  const stroke = 10
  const r = (size - stroke) / 2
  const arc = bojiRingArc(total, r)
  return (
    <Svg width={size} height={size} accessibilityLabel={`综合分 ${fmt(total)}`}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surfaceMuted} strokeWidth={stroke} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.brand} strokeWidth={stroke} fill="none" strokeLinecap="round" strokeDasharray={`${arc.filled} ${arc.circumference}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <SvgText x={size / 2} y={size / 2 + 6} fontSize="28" fontWeight="700" fill={colors.text} textAnchor="middle">{fmt(total)}</SvgText>
      <SvgText x={size / 2} y={size / 2 + 24} fontSize="11" fill={colors.textTertiary} textAnchor="middle">综合分</SvgText>
    </Svg>
  )
}

function RadarChart({ scores, sex }: { scores: BojiMetricScores; sex: BojiSex }) {
  const width = 300
  const height = 240
  const cx = width / 2
  const cy = height / 2
  const r = Math.min(width, height) / 2 - 44
  const axes = bojiRadarAxes(scores, cx, cy, r, sex)
  const ring = (value: number) => bojiRadarAxes({ abs: value, v_taper: value, arms: value, symmetry: value, waist_hip: value }, cx, cy, r, sex).map((axis) => axis.point.join(',')).join(' ')
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      {[25, 50, 75, 100].map((value) => <Polygon key={value} points={ring(value)} fill="none" stroke={colors.border} strokeWidth="1" />)}
      <Line x1={cx} y1={cy - r} x2={cx} y2={cy + r} stroke={colors.border} strokeWidth="1" />
      <Line x1={cx - r} y1={cy} x2={cx + r} y2={cy} stroke={colors.border} strokeWidth="1" />
      <Polygon points={axes.map((axis) => axis.point.join(',')).join(' ')} fill={colors.brand} fillOpacity={0.25} stroke={colors.brand} strokeWidth="2" />
      {axes.map((axis, index) => {
        const [ex, ey] = axis.end
        const dy = index === 0 ? -12 : index === 2 ? 20 : 4
        const dx = index === 1 ? 8 : index === 3 ? -8 : 0
        const anchor = index === 1 ? 'start' : index === 3 ? 'end' : 'middle'
        return <SvgText key={axis.key} x={ex + dx} y={ey + dy} fontSize="12" fill={colors.text} textAnchor={anchor}>{`${axis.label} ${axis.score === null ? '—' : axis.score}`}</SvgText>
      })}
    </Svg>
  )
}

/** 照片和测量标注；坐标按报告的 original_size 缩放（用 viewBox 对齐）。 */
function PhotoOverlay({ photo, analysis, showMarks }: { photo: Photo; analysis: BojiAnalysisDto; showMarks: boolean }) {
  const [photoWidth, photoHeight] = analysis.report.original_size ?? [photo.width, photo.height]
  const shapes = useMemo(() => (showMarks ? bojiOverlayShapes(analysis.report) : []), [analysis.report, showMarks])
  const unit = Math.max(photoWidth, photoHeight) / 400
  return (
    <View style={[styles.photoWrap, { aspectRatio: photoWidth / Math.max(1, photoHeight) }]}>
      <Image source={{ uri: photo.uri }} style={StyleSheet.absoluteFill} resizeMode="cover" accessibilityIgnoresInvertColors />
      <Svg style={StyleSheet.absoluteFill} viewBox={`0 0 ${photoWidth} ${photoHeight}`} preserveAspectRatio="none">
        {shapes.map((shape, index) => {
          const points = shape.points.map(([x, y]) => `${x},${y}`).join(' ')
          if (shape.kind === 'block') {
            const color = bojiEnclosureColor(shape.enclosure ?? 0)
            return <Polygon key={index} points={points} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={1.5 * unit} />
          }
          return (
            <Polyline
              key={index}
              points={points}
              fill="none"
              stroke={BOJI_SHAPE_COLORS[shape.kind]}
              strokeWidth={(shape.kind === 'shoulder' || shape.kind === 'waist' || shape.kind === 'hip' ? 3 : 2) * unit}
              strokeLinecap="round"
              strokeDasharray={shape.kind === 'lateral' ? `${6 * unit} ${5 * unit}` : undefined}
            />
          )
        })}
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: 2 },
  row: { flexDirection: 'row', gap: spacing.xs },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  heroTitle: { color: colors.text, fontSize: 20, fontWeight: '700', lineHeight: 28 },
  desc: { color: colors.textSecondary, fontSize: 13, lineHeight: 20 },
  note: { color: colors.textTertiary, fontSize: 12, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 20 },
  cardTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  kicker: { color: colors.brand, fontSize: 12, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: { overflow: 'hidden', paddingHorizontal: spacing.sm, paddingVertical: 4, borderRadius: radius.pill, color: colors.textSecondary, backgroundColor: colors.surfaceMuted, fontSize: 12 },
  sexRow: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: radius.pill, backgroundColor: colors.surfaceMuted },
  sexOption: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill },
  sexOptionActive: { backgroundColor: colors.selected },
  sexText: { color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  sexTextActive: { color: colors.selectedText },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  heroRank: { flex: 1, gap: 4 },
  rankText: { color: colors.text, fontSize: 14, lineHeight: 22 },
  rankValue: { color: colors.brand, fontSize: 24, fontWeight: '700' },
  lookRow: { flexDirection: 'row', gap: spacing.sm },
  lookAvatar: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  lookEmpty: { alignItems: 'center', justifyContent: 'center' },
  vs: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  vsSide: { flex: 1, alignItems: 'center', gap: 2 },
  vsName: { color: colors.textSecondary, fontSize: 13 },
  vsTotal: { color: colors.text, fontSize: 26, fontWeight: '700' },
  vsMark: { color: colors.textTertiary, fontSize: 14, fontWeight: '700' },
  verdict: { color: colors.brand, fontSize: 15, fontWeight: '700', textAlign: 'center' },
  duelRow: { minHeight: 32, flexDirection: 'row', alignItems: 'center' },
  duelNum: { width: 48, textAlign: 'center', color: colors.textSecondary, fontSize: 14, fontWeight: '600' },
  duelWin: { color: colors.brand, fontWeight: '700' },
  duelLabel: { flex: 1, textAlign: 'center', color: colors.text, fontSize: 13 },
  linkButton: { minHeight: 48, justifyContent: 'center' },
  link: { color: colors.brand, fontSize: 13, fontWeight: '600' },
  photoWrap: { width: '100%', overflow: 'hidden', borderRadius: radius.md, backgroundColor: colors.surfaceMuted },
  detailsToggle: { minHeight: 56, justifyContent: 'center', gap: 2, padding: spacing.sm, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  metric: { gap: 4, paddingVertical: spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  metricTitle: { color: colors.text, fontSize: 14, fontWeight: '600' },
  metricScore: { alignItems: 'flex-end', gap: 2 },
})
