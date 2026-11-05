import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Canvas, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import {
  MOTION_GAME_TEMPLATE_IDS,
  motionGameLeaderboardService,
  type MotionGameRankingResult
} from '@/services/motionGameLeaderboardService'
import {
  applyCloudMotionGameResult,
  markMotionGameRunLocalOnly,
  persistMotionGameRunLocally
} from '@/utils/motionGameLeaderboardCache'
import { readMiniProgramEnvVersion } from '@/utils/apiBaseUrl'
import { usePageEnterTrace } from '@/utils/pageTrace'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import { projectHeadAnchorToStage, USER_FACING_CAMERA } from '../cameraTracking'
import {
  BodyPointTracker,
  type BodyTrackingRuntimeState,
  type BodyTrackingSnapshot
} from '../games/bodyPointTracker'
import { BirdAudio } from './birdAudio'
import { addLaneSample, laneFromSamples } from './birdLane'
import {
  advanceGame,
  cancelToIdle,
  createGame,
  endRun,
  startCountdown,
  WARMUP_GATES,
  type BirdEvent,
  type BirdGame,
  type BirdInput,
  type Lane,
  type BirdStatus
} from './birdModel'
import { HappyBirdRecorder } from './birdRecorder'
import {
  BIRD_REPLAY_FPS,
  BIRD_REPLAY_MAX_SECONDS,
  chooseReplayQuality,
  replayHeightFor
} from './birdRecorderSize'
import { fileExists, keepReplay, readLatestReplayPath, readLocalBest, writeLocalBest } from './birdReplayStore'
import { drawBirdScene } from './birdScene'
import { soundForEvent } from './birdSoundtrack'
import { addSoundtrackToVideo } from './birdVideoAudio'
import './index.scss'

const CANVAS_ID = 'happyBirdCanvas'
const PREFS_KEY = 'happy_bird_prefs_v1'
const GAME_KEY = 'happy-bird'
const MAX_CANVAS_DPR = 2
const REPLAY_FRAME_INTERVAL_MS = 1000 / BIRD_REPLAY_FPS
/** 结算卡多录一会儿，视频结尾能看清分数。 */
const RESULT_HOLD_MS = 2600

type BirdPrefs = {
  record: boolean
  sound: boolean
}

type SyncState = 'idle' | 'local-only' | 'synced' | 'syncing'

type HeldCameraFrame = {
  buffer: Uint8ClampedArray
  height: number
  width: number
}

type CanvasHandle = {
  canvas: any
  ctx: any
  height: number
  width: number
}

const DEFAULT_PREFS: BirdPrefs = { record: true, sound: true }
const NO_HEAD_INPUT: BirdInput = { targetY: null, tracking: false }

function readPrefs(): BirdPrefs {
  try {
    const stored = Taro.getStorageSync(PREFS_KEY) as Partial<BirdPrefs> | ''
    return stored ? { ...DEFAULT_PREFS, ...stored } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: BirdPrefs) {
  try {
    Taro.setStorageSync(PREFS_KEY, prefs)
  } catch {
    // 偏好只是方便下次打开，写失败不影响玩
  }
}

function readBenchmarkLevel() {
  try {
    return (Taro.getSystemInfoSync() as any).benchmarkLevel as number | undefined
  } catch {
    return undefined
  }
}

function roundSeed() {
  return Math.floor(Math.random() * 0x7fffffff)
}

function vibrate(type: 'heavy' | 'light' | 'medium') {
  void Taro.vibrateShort({ type }).catch(() => undefined)
}

function storedUserId() {
  try {
    return String(Taro.getStorageSync('user')?.id || '')
  } catch {
    return ''
  }
}

/** 体验版、开发版在开始页显示小鸟跟随是哪一版，测的时候一眼能确认；正式版不显示。改跟随逻辑时一起改。 */
const TRACKING_BUILD_TAG = '跟随版本：眼睛 1:1 锁定 · 11-06'
const SHOW_TRACKING_BUILD_TAG = readMiniProgramEnvVersion() !== 'release'

export default function HappyBirdPage() {
  usePageEnterTrace()

  const initialPrefs = useMemo(readPrefs, [])
  const replayQuality = useMemo(() => chooseReplayQuality(readBenchmarkLevel()), [])
  const [status, setStatus] = useState<BirdStatus>('idle')
  const [prefs, setPrefs] = useState<BirdPrefs>(initialPrefs)
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [runtimeState, setRuntimeState] = useState<BodyTrackingRuntimeState>('initializing')
  const [runtimeDetail, setRuntimeDetail] = useState('正在启动头部识别')
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [processingLabel, setProcessingLabel] = useState('')
  const [processingSeconds, setProcessingSeconds] = useState(0)
  const [videoPath, setVideoPath] = useState('')
  const [saving, setSaving] = useState(false)
  const [ranking, setRanking] = useState<MotionGameRankingResult | null>(null)
  const [syncState, setSyncState] = useState<SyncState>('idle')

  const gameRef = useRef<BirdGame>(createGame())
  const inputRef = useRef<BirdInput>(NO_HEAD_INPUT)
  const prefsRef = useRef(initialPrefs)
  const stageSizeRef = useRef({ height: 0, width: 0 })
  const canvasRef = useRef<CanvasHandle | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const lastTickAtRef = useRef(0)
  // 门的通道：开飞后记录眼睛上下的范围，热身门出完就固定，一局之内不再变。
  const laneSamplesRef = useRef<number[]>([])
  // 眼睛比头部中心高多少：偶尔识别拿不到眼睛时沿用它，小鸟不跳到头中心。
  const eyeOffsetRef = useRef<number | null>(null)
  const laneFrozenRef = useRef<Lane | null>(null)
  const audioRef = useRef<BirdAudio | null>(null)
  const trackerRef = useRef<BodyPointTracker | null>(null)
  const frameListenerRef = useRef<any>(null)
  const recorderRef = useRef<HappyBirdRecorder | null>(null)
  const recordingRef = useRef(false)
  const lastCaptureAtRef = useRef(0)
  const latestFrameRef = useRef<HeldCameraFrame | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bestScoreRef = useRef(readLocalBest())
  const sessionIdRef = useRef<string | null>(null)
  const roundIdRef = useRef(0)
  const roundSyncedRef = useRef(false)
  const playStartedAtRef = useRef(0)
  const hiddenRef = useRef(false)
  const unmountedRef = useRef(false)

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '快乐小鸟：引体、俯卧撑都能玩，你能撑几关？',
        path: buildSharePath('/toolbox/happy-bird/index')
      }),
    []
  )
  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  const sceneExtras = () => ({
    bestScore: bestScoreRef.current
  })

  const withSoundtrack = async (videoPath: string, recorder: HappyBirdRecorder, stopMs: number) => {
    try {
      return await addSoundtrackToVideo(videoPath, recorder.soundtrackPlan(), {
        logFields: { game: 'happy-bird', stopMs },
        onStage: () => setProcessingLabel('写入声音')
      })
    } catch (error: any) {
      console.warn('快乐小鸟合成声音失败:', error)
      Taro.showToast({ title: `声音没合成进去，已保存无声视频：${String(error?.message || '').slice(0, 24)}`, icon: 'none', duration: 3000 })
      return videoPath
    }
  }

  const finishRecording = async () => {
    const recorder = recorderRef.current
    if (!recorder || !recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    setProcessing(true)
    setProcessingLabel('整理画面')
    const startedAt = Date.now()
    setProcessingSeconds(0)
    // 生成可能要几十秒，按秒显示进度，用户知道没卡住。
    const secondsTimer = setInterval(() => setProcessingSeconds(Math.floor((Date.now() - startedAt) / 1000)), 1000)
    try {
      const result = await recorder.stop()
      if (unmountedRef.current) return
      if (result?.tempVideoPath) {
        const finalPath = await withSoundtrack(result.tempVideoPath, recorder, Date.now() - startedAt)
        if (unmountedRef.current) return
        setVideoPath(await keepReplay(finalPath))
      } else {
        Taro.showToast({ title: '视频生成失败，再来一局试试', icon: 'none' })
      }
    } catch (error: any) {
      if (!unmountedRef.current) {
        Taro.showToast({ title: error?.message || '视频生成失败', icon: 'none' })
      }
    } finally {
      clearInterval(secondsTimer)
      await recorder.destroy()
      if (recorderRef.current === recorder) recorderRef.current = null
      if (!unmountedRef.current) setProcessing(false)
    }
  }

  const syncFinishedRound = async () => {
    if (roundSyncedRef.current) return
    roundSyncedRef.current = true
    const roundId = roundIdRef.current
    const game = gameRef.current
    const sessionId = sessionIdRef.current
    const wallElapsedMs = Math.max(1, Date.now() - playStartedAtRef.current)
    const lockRatio = Math.min(1, Math.max(0, game.elapsedMs / wallElapsedMs))
    const elapsedMs = Math.round(game.elapsedMs)
    const userId = storedUserId()
    const localRunId = userId
      ? persistMotionGameRunLocally(userId, {
          actionCount: game.reps,
          elapsedMs,
          finishedAt: Date.now(),
          gameKey: GAME_KEY,
          lockRatio,
          score: game.score,
          sessionId
        })
      : ''

    if (game.score > readLocalBest()) writeLocalBest(game.score)
    if (!sessionId) {
      if (roundId === roundIdRef.current) setSyncState('local-only')
      return
    }

    setSyncState('syncing')
    const result = await motionGameLeaderboardService.finishSession({
      actionCount: game.reps,
      elapsedMs,
      gameKey: GAME_KEY,
      lockRatio,
      score: game.score,
      sessionId
    })
    if (result) {
      if (userId && localRunId) applyCloudMotionGameResult(userId, localRunId, result)
      if (roundId === roundIdRef.current) {
        setRanking(result)
        setSyncState('synced')
      }
      return
    }
    if (userId && localRunId) markMotionGameRunLocalOnly(userId, localRunId)
    if (roundId === roundIdRef.current) setSyncState('local-only')
  }

  const stopMusic = () => {
    audioRef.current?.stopMusic()
    if (recordingRef.current) recorderRef.current?.noteMusicStop()
  }

  const handleEvent = (event: BirdEvent) => {
    if (event.type === 'gameOver') stopMusic()
    const sound = soundForEvent(event.type)
    if (sound) {
      audioRef.current?.play(sound.name, sound.volume)
      if (recordingRef.current) recorderRef.current?.noteSound(sound)
    }
    switch (event.type) {
      case 'go':
        // 倒计时里人还在走位，这段位移不算：开飞后重新量通道。
        laneSamplesRef.current = []
        laneFrozenRef.current = null
        playStartedAtRef.current = Date.now()
        audioRef.current?.startMusic()
        if (recordingRef.current) recorderRef.current?.noteMusicStart()
        vibrate('medium')
        break
      case 'perfect':
      case 'shieldUp':
        vibrate('light')
        break
      case 'level':
      case 'bump':
      case 'smash':
      case 'shieldBreak':
        vibrate('medium')
        break
      case 'fever':
      case 'hit':
        vibrate('heavy')
        break
      default:
        break
    }
  }

  const changeStatus = (next: BirdStatus) => {
    setStatus(next)
    if (next !== 'result') return
    void syncFinishedRound()
    if (recordingRef.current) {
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null
        void finishRecording()
      }, RESULT_HOLD_MS)
    }
  }

  const tick = () => {
    const handle = canvasRef.current
    if (!handle || unmountedRef.current) return
    const now = Date.now()
    const delta = now - (lastTickAtRef.current || now)
    lastTickAtRef.current = now

    const before = gameRef.current.status
    if (!laneFrozenRef.current && before === 'playing' && gameRef.current.gatesSpawned >= WARMUP_GATES) {
      laneFrozenRef.current = laneFromSamples(laneSamplesRef.current, gameRef.current.bird.y)
    }
    const input = hiddenRef.current ? NO_HEAD_INPUT : inputRef.current
    const step = advanceGame(gameRef.current, delta, input)
    gameRef.current = step.game
    step.events.forEach(handleEvent)
    // 主动结束时跳过 gameOver 事件也要收掉音乐。
    if (step.game.status === 'crashing' && before === 'playing') stopMusic()
    if (step.game.status !== before) changeStatus(step.game.status)

    handle.ctx.clearRect(0, 0, handle.width, handle.height)
    drawBirdScene(handle.ctx, handle.width, handle.height, step.game, sceneExtras())
    captureReplayFrame(now)
    rafIdRef.current = handle.canvas.requestAnimationFrame(tick)
  }

  const setupCanvas = () => {
    Taro.createSelectorQuery()
      .select(`#${CANVAS_ID}`)
      .fields({ node: true, size: true })
      .exec((res) => {
        const found = res?.[0]
        if (!found?.node || unmountedRef.current) return
        const canvas = found.node
        const ctx = canvas.getContext('2d')
        // 全屏 3 倍图太吃性能，2 倍已经足够清晰。
        const dpr = Math.min(MAX_CANVAS_DPR, Taro.getWindowInfo().pixelRatio || 2)
        canvas.width = Math.round(found.width * dpr)
        canvas.height = Math.round(found.height * dpr)
        ctx.scale(dpr, dpr)
        if (rafIdRef.current !== null) canvasRef.current?.canvas.cancelAnimationFrame(rafIdRef.current)
        canvasRef.current = { canvas, ctx, height: found.height, width: found.width }
        stageSizeRef.current = { height: found.height, width: found.width }
        gameRef.current = { ...gameRef.current, aspect: found.height / Math.max(1, found.width) }
        lastTickAtRef.current = 0
        tick()
      })
  }

  /** 相机回调的内存会被复用，录制时留一份最新画面给画面时钟用；只有一块缓冲区，不每帧新建。 */
  const holdCameraFrame = (data: ArrayBuffer, width: number, height: number) => {
    const rgba = new Uint8ClampedArray(data)
    const held = latestFrameRef.current
    if (held && held.buffer.length === rgba.length) {
      held.buffer.set(rgba)
      latestFrameRef.current = { ...held, height, width }
      return
    }
    latestFrameRef.current = { buffer: new Uint8ClampedArray(rgba), height, width }
  }

  /**
   * 录制按固定时钟出帧，不跟着相机回调走。相机帧率常低于录制帧率，跟着它走视频会比
   * 真实时间快（实测 22 秒的一局录出来只有 17 秒），音效也就对不上了。
   */
  const captureReplayFrame = (now: number) => {
    const frame = latestFrameRef.current
    if (!recordingRef.current || !recorderRef.current || !frame) return
    if (!lastCaptureAtRef.current) lastCaptureAtRef.current = now - REPLAY_FRAME_INTERVAL_MS
    if (now - lastCaptureAtRef.current < REPLAY_FRAME_INTERVAL_MS) return
    // 卡顿后不补帧连发，只往前追到当前时间。
    lastCaptureAtRef.current = Math.max(lastCaptureAtRef.current + REPLAY_FRAME_INTERVAL_MS, now - REPLAY_FRAME_INTERVAL_MS)
    recorderRef.current.captureFrame({
      extras: sceneExtras(),
      frameBuffer: frame.buffer,
      frameHeight: frame.height,
      frameWidth: frame.width,
      game: gameRef.current
    })
  }

  const startFrameStream = () => {
    if (frameListenerRef.current) return
    try {
      const listener = Taro.createCameraContext().onCameraFrame((frame: any) => {
        const width = Number(frame?.width || 0)
        const height = Number(frame?.height || 0)
        if (!width || !height || !(frame?.data instanceof ArrayBuffer)) return
        const now = Date.now()
        trackerRef.current?.processFrame({ data: frame.data, height, width }, now)
        if (recordingRef.current) holdCameraFrame(frame.data, width, height)
      })
      listener.start()
      frameListenerRef.current = listener
    } catch (error: any) {
      setCameraError(error?.message || '当前微信环境不支持实时相机帧，无法开始游戏。')
    }
  }

  const beginRecording = async () => {
    if (!prefsRef.current.record || !HappyBirdRecorder.isSupported()) return
    try {
      const recorder = new HappyBirdRecorder({
        durationSeconds: BIRD_REPLAY_MAX_SECONDS,
        fps: BIRD_REPLAY_FPS,
        height: replayHeightFor(stageSizeRef.current.width, stageSizeRef.current.height, replayQuality.width),
        videoBitsPerSecond: replayQuality.videoBitsPerSecond,
        width: replayQuality.width
      })
      recorderRef.current = recorder
      await recorder.start()
      lastCaptureAtRef.current = 0
      latestFrameRef.current = null
      recordingRef.current = true
      setRecording(true)
    } catch (error) {
      console.warn('快乐小鸟录制启动失败:', error)
      await recorderRef.current?.destroy()
      recorderRef.current = null
      Taro.showToast({ title: '录制没启动成功，本局只玩不录', icon: 'none' })
    }
  }

  const openLeaderboardSession = async (roundId: number) => {
    const session = await motionGameLeaderboardService.startSession(GAME_KEY)
    if (roundId !== roundIdRef.current) return
    sessionIdRef.current = session?.sessionId || null
    if (session) {
      bestScoreRef.current = Math.max(bestScoreRef.current, session.bestScore)
    } else {
      Taro.showToast({ title: '可以继续玩，本局暂不计入在线榜', icon: 'none' })
    }
  }

  const startRound = () => {
    if (cameraError || !cameraReady) {
      Taro.showToast({ title: '相机还没准备好', icon: 'none' })
      return
    }
    if (runtimeState === 'unavailable') {
      Taro.showToast({ title: '当前设备无法识别头部', icon: 'none' })
      return
    }
    if (processing) {
      Taro.showToast({ title: '回放还在生成，请稍等', icon: 'none' })
      return
    }
    if (holdTimerRef.current) {
      // 上一局的结算卡还在录，先收尾生成视频，等它好了再开新局。
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      void finishRecording()
      Taro.showToast({ title: '回放还在生成，请稍等', icon: 'none' })
      return
    }
    roundIdRef.current += 1
    roundSyncedRef.current = false
    sessionIdRef.current = null
    bestScoreRef.current = Math.max(bestScoreRef.current, gameRef.current.score, readLocalBest())
    gameRef.current = startCountdown(gameRef.current, roundSeed())
    setRanking(null)
    setSyncState('idle')
    setVideoPath('')
    setStatus('countdown')
    void openLeaderboardSession(roundIdRef.current)
    void beginRecording()
  }

  const stopRoundRecording = async () => {
    if (!recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    const recorder = recorderRef.current
    recorderRef.current = null
    await recorder?.destroy()
  }

  const cancelCountdown = () => {
    roundIdRef.current += 1
    gameRef.current = cancelToIdle(gameRef.current)
    setStatus('idle')
    void stopRoundRecording()
  }

  const finishEarly = () => {
    gameRef.current = endRun(gameRef.current)
  }

  const togglePref = (key: keyof BirdPrefs) => {
    const next = { ...prefsRef.current, [key]: !prefsRef.current[key] }
    prefsRef.current = next
    setPrefs(next)
    writePrefs(next)
    if (key === 'sound') audioRef.current?.setEnabled(next.sound)
  }

  const openRanking = () => {
    Taro.navigateTo({
      url: `/discovery/ranking/detail?id=${ranking?.templateId || MOTION_GAME_TEMPLATE_IDS[GAME_KEY]}`
    })
  }

  const previewVideo = async () => {
    if (!videoPath) return
    if (!(await fileExists(videoPath))) {
      setVideoPath('')
      Taro.showToast({ title: '回放文件已失效', icon: 'none' })
      return
    }
    try {
      await Taro.previewMedia({ current: 0, sources: [{ type: 'video', url: videoPath }] })
    } catch (error: any) {
      Taro.showToast({ title: error?.errMsg || '打开回放失败', icon: 'none' })
    }
  }

  const saveVideo = async () => {
    if (!videoPath || saving) return
    setSaving(true)
    try {
      await Taro.saveVideoToPhotosAlbum({ filePath: videoPath })
      Taro.showToast({ title: '已存到相册', icon: 'success' })
    } catch (error: any) {
      const message = String(error?.errMsg || '')
      if (message.includes('auth deny') || message.includes('authorize')) {
        Taro.showModal({
          title: '需要相册权限',
          content: '保存视频需要允许“添加到相册”，去设置里打开吗？',
          confirmText: '去设置',
          success: (res) => {
            if (res.confirm) Taro.openSetting()
          }
        })
      } else if (!message.includes('cancel')) {
        Taro.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSnapshot = (snapshot: BodyTrackingSnapshot) => {
    if (!snapshot.locked) return
    const frameSize = { height: snapshot.frameHeight, width: snapshot.frameWidth }
    // 跟眼睛那一条线，不跟脸框中心：用力张嘴时脸框被下巴撑大，中心会往下跑。
    if (snapshot.eyeY !== undefined) eyeOffsetRef.current = snapshot.eyeY - snapshot.y
    const eyeY = snapshot.eyeY ?? snapshot.y + (eyeOffsetRef.current ?? 0)
    const head = projectHeadAnchorToStage({ ...snapshot, y: eyeY }, frameSize, stageSizeRef.current)
    // 'holding' 是短暂没检测到（运动模糊等），高度沿用上次，游戏不因此卡顿。
    if (snapshot.lockState === 'locked') {
      // 小鸟 1:1 停在眼睛那条线上，不放大：放大会让它相对脸一会儿在眼睛、一会儿在嘴巴，抖动也跟着放大。
      if (!laneFrozenRef.current && gameRef.current.status === 'playing') {
        laneSamplesRef.current = addLaneSample(laneSamplesRef.current, head.y)
      }
      inputRef.current = {
        lane: laneFrozenRef.current ?? laneFromSamples(laneSamplesRef.current, head.y),
        targetY: head.y,
        tracking: true
      }
      return
    }
    inputRef.current = { ...inputRef.current, tracking: true }
  }

  useEffect(() => {
    openCoachLinkShareMenu()
    const audio = new BirdAudio(initialPrefs.sound)
    audioRef.current = audio
    void audio.prepare()
    void readLatestReplayPath().then((path) => {
      if (path && !unmountedRef.current) setVideoPath(path)
    })
    trackerRef.current = new BodyPointTracker({
      anchorMode: 'head',
      logLabel: 'happy-bird',
      headLockConfirmFrames: 3,
      headLostGraceMs: 720,
      onLockChange: (locked) => {
        if (locked) return
        inputRef.current = NO_HEAD_INPUT
        eyeOffsetRef.current = null
      },
      onRuntimeStateChange: (state, detail) => {
        setRuntimeState(state)
        setRuntimeDetail(detail)
      },
      onSnapshot: handleSnapshot
    })
    void Taro.setKeepScreenOn({ keepScreenOn: true }).catch(() => undefined)
    return () => {
      unmountedRef.current = true
      void Taro.setKeepScreenOn({ keepScreenOn: false }).catch(() => undefined)
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (rafIdRef.current !== null) canvasRef.current?.canvas.cancelAnimationFrame(rafIdRef.current)
      try {
        frameListenerRef.current?.stop?.()
      } catch {
        // ignore cleanup error
      }
      trackerRef.current?.destroy()
      trackerRef.current = null
      recordingRef.current = false
      void recorderRef.current?.destroy()
      recorderRef.current = null
      audio.destroy()
      audioRef.current = null
    }
  }, [])

  useDidHide(() => {
    hiddenRef.current = true
    audioRef.current?.suspend()
  })

  useDidShow(() => {
    hiddenRef.current = false
    audioRef.current?.resume()
  })

  const showStartPanel = status === 'idle' || status === 'result'
  const rankLine = ranking
    ? `全榜第 ${ranking.rank} 名 · 超过 ${ranking.percentile}% 的玩家`
    : syncState === 'syncing'
      ? '正在同步成绩…'
      : syncState === 'local-only'
        ? '成绩已保存在本机，本局未计入在线榜'
        : ''

  return (
    <PageThemeRoot>
      <View className='bird-page'>
        <View className='bird-stage'>
          <Camera
            className='bird-camera'
            devicePosition={USER_FACING_CAMERA.devicePosition}
            flash='off'
            mode='normal'
            frameSize={replayQuality.cameraFrameSize}
            resolution={replayQuality.cameraResolution}
            onInitDone={() => {
              setCameraReady(true)
              setCameraError('')
              Taro.nextTick(() => {
                setupCanvas()
                startFrameStream()
              })
            }}
            onError={(event: any) => {
              setCameraReady(false)
              setCameraError(event?.detail?.errMsg || '相机启动失败，请检查权限')
            }}
          />
          <Canvas type='2d' id={CANVAS_ID} className='bird-canvas' />

          {recording ? (
            <View className='bird-rec'>
              <View className='bird-rec__dot' />
              <Text className='bird-rec__text'>录制中</Text>
            </View>
          ) : null}

          {!cameraReady && !cameraError ? (
            <View className='bird-note'>
              <Text className='bird-note__title'>正在打开前置摄像头…</Text>
            </View>
          ) : null}
          {cameraError ? (
            <View className='bird-note'>
              <Text className='bird-note__title'>相机暂时不可用</Text>
              <Text className='bird-note__desc'>{cameraError}</Text>
            </View>
          ) : null}
          {cameraReady && !cameraError && runtimeState === 'unavailable' ? (
            <View className='bird-note'>
              <Text className='bird-note__title'>当前设备无法启动头部识别</Text>
              <Text className='bird-note__desc'>{runtimeDetail}</Text>
            </View>
          ) : null}

          {showStartPanel ? (
            <View className='bird-controls'>
              {status === 'result' && rankLine ? <Text className='bird-rank'>{rankLine}</Text> : null}
              <View className='bird-chips'>
                <View className={`bird-chip ${prefs.record ? 'bird-chip--on' : ''}`} onClick={() => togglePref('record')}>
                  <Text className='bird-chip__text'>录视频</Text>
                </View>
                <View className={`bird-chip ${prefs.sound ? 'bird-chip--on' : ''}`} onClick={() => togglePref('sound')}>
                  <Text className='bird-chip__text'>声音</Text>
                </View>
              </View>
              <View className='bird-actions'>
                <View className='bird-btn bird-btn--primary' onClick={startRound}>
                  <Text className='bird-btn__text'>{status === 'result' ? '再来一局' : '开始'}</Text>
                </View>
                {processing || videoPath ? (
                  <View
                    className={`bird-btn bird-btn--secondary ${processing || saving ? 'bird-btn--disabled' : ''}`}
                    onClick={() => !processing && void saveVideo()}
                  >
                    <Text className='bird-btn__text'>
                      {processing ? `${processingLabel || '视频生成'}中… ${processingSeconds}s` : saving ? '正在保存' : '保存视频'}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className='bird-link'>
                <Text className='bird-link__text' onClick={openRanking}>排行榜</Text>
                {videoPath && !processing ? (
                  <Text className='bird-link__text' onClick={() => void previewVideo()}>看回放</Text>
                ) : null}
              </View>
              {status === 'idle' ? (
                <Text className='bird-hint'>
                  手机竖着放远一点。引体、俯卧撑、深蹲都能玩。
                </Text>
              ) : null}
              {status === 'idle' && SHOW_TRACKING_BUILD_TAG ? (
                <Text className='bird-hint bird-hint--build'>{TRACKING_BUILD_TAG}</Text>
              ) : null}
            </View>
          ) : null}

          {status === 'countdown' ? (
            <View className='bird-controls bird-controls--bare'>
              <View className='bird-btn bird-btn--ghost' onClick={cancelCountdown}>
                <Text className='bird-btn__text'>取消</Text>
              </View>
            </View>
          ) : null}
          {status === 'playing' ? (
            <View className='bird-controls bird-controls--bare'>
              <View className='bird-btn bird-btn--ghost' onClick={finishEarly}>
                <Text className='bird-btn__text'>结束本局</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </PageThemeRoot>
  )
}
