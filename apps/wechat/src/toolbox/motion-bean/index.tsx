import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Canvas, Text, View } from '@tarojs/components'
import Taro, { useDidHide, useDidShow, useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { PageThemeRoot } from '@/components/PageThemeRoot'
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
import { BirdAudio } from '../happy-bird/birdAudio'
import {
  BIRD_REPLAY_FPS,
  BIRD_REPLAY_MAX_SECONDS,
  chooseReplayQuality,
  replayHeightFor
} from '../happy-bird/birdRecorderSize'
import { fileExists, keepReplay, readLatestReplayPath, readLocalBest, writeLocalBest } from '../happy-bird/birdReplayStore'
import { addSoundtrackToVideo } from '../happy-bird/birdVideoAudio'
import {
  advanceBeanGame,
  cancelBeanToIdle,
  createBeanGame,
  endBeanRun,
  startBeanCountdown,
  type BeanEvent,
  type BeanGame,
  type BeanInput,
  type BeanStatus
} from './beanModel'
import { BeanRecorder, soundForBeanEvent } from './beanRecorder'
import { drawBeanScene } from './beanScene'
import './index.scss'

const CANVAS_ID = 'motionBeanCanvas'
const PREFS_KEY = 'motion_bean_prefs_v1'
const STORE_KEY = 'motion_bean'
const MAX_CANVAS_DPR = 2
const REPLAY_FRAME_INTERVAL_MS = 1000 / BIRD_REPLAY_FPS
/** 结算卡多录一会儿，视频结尾能看清分数。 */
const RESULT_HOLD_MS = 2600
const NO_FACE_INPUT: BeanInput = { face: null, tracking: false }

type BeanPrefs = {
  record: boolean
  sound: boolean
}

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

const DEFAULT_PREFS: BeanPrefs = { record: true, sound: true }

function readPrefs(): BeanPrefs {
  try {
    const stored = Taro.getStorageSync(PREFS_KEY) as Partial<BeanPrefs> | ''
    return stored ? { ...DEFAULT_PREFS, ...stored } : DEFAULT_PREFS
  } catch {
    return DEFAULT_PREFS
  }
}

function writePrefs(prefs: BeanPrefs) {
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

function vibrate(type: 'heavy' | 'light' | 'medium') {
  void Taro.vibrateShort({ type }).catch(() => undefined)
}

export default function MotionBeanPage() {
  usePageEnterTrace()

  const initialPrefs = useMemo(readPrefs, [])
  const replayQuality = useMemo(() => chooseReplayQuality(readBenchmarkLevel()), [])
  const [status, setStatus] = useState<BeanStatus>('idle')
  const [prefs, setPrefs] = useState<BeanPrefs>(initialPrefs)
  const [cameraError, setCameraError] = useState('')
  const [cameraReady, setCameraReady] = useState(false)
  const [runtimeState, setRuntimeState] = useState<BodyTrackingRuntimeState>('initializing')
  const [runtimeDetail, setRuntimeDetail] = useState('正在启动头部识别')
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [videoPath, setVideoPath] = useState('')
  const [saving, setSaving] = useState(false)

  const gameRef = useRef<BeanGame>(createBeanGame())
  const inputRef = useRef<BeanInput>(NO_FACE_INPUT)
  const prefsRef = useRef(initialPrefs)
  const stageSizeRef = useRef({ height: 0, width: 0 })
  const canvasRef = useRef<CanvasHandle | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const lastTickAtRef = useRef(0)
  const audioRef = useRef<BirdAudio | null>(null)
  const trackerRef = useRef<BodyPointTracker | null>(null)
  const frameListenerRef = useRef<any>(null)
  const recorderRef = useRef<BeanRecorder | null>(null)
  const recordingRef = useRef(false)
  const lastCaptureAtRef = useRef(0)
  const latestFrameRef = useRef<HeldCameraFrame | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const bestScoreRef = useRef(readLocalBest(STORE_KEY))
  const hiddenRef = useRef(false)
  const unmountedRef = useRef(false)

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '接豆派对：用脸接豆子，45 秒你能吃多少？',
        path: buildSharePath('/toolbox/motion-bean/index')
      }),
    []
  )
  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  const sceneExtras = () => ({ bestScore: bestScoreRef.current })

  const withSoundtrack = async (path: string, recorder: BeanRecorder) => {
    try {
      return await addSoundtrackToVideo(path, recorder.soundtrackPlan())
    } catch (error: any) {
      console.warn('接豆派对合成声音失败:', error)
      Taro.showToast({ title: `声音没合成进去，已保存无声视频：${String(error?.message || '').slice(0, 24)}`, icon: 'none', duration: 3000 })
      return path
    }
  }

  const finishRecording = async () => {
    const recorder = recorderRef.current
    if (!recorder || !recordingRef.current) return
    recordingRef.current = false
    setRecording(false)
    setProcessing(true)
    try {
      const result = await recorder.stop()
      if (unmountedRef.current) return
      if (result?.tempVideoPath) {
        const finalPath = await withSoundtrack(result.tempVideoPath, recorder)
        if (unmountedRef.current) return
        setVideoPath(await keepReplay(finalPath, STORE_KEY))
      } else {
        Taro.showToast({ title: '视频生成失败，再来一局试试', icon: 'none' })
      }
    } catch (error: any) {
      if (!unmountedRef.current) {
        Taro.showToast({ title: error?.message || '视频生成失败', icon: 'none' })
      }
    } finally {
      await recorder.destroy()
      if (recorderRef.current === recorder) recorderRef.current = null
      if (!unmountedRef.current) setProcessing(false)
    }
  }

  const stopMusic = () => {
    audioRef.current?.stopMusic()
    if (recordingRef.current) recorderRef.current?.noteMusicStop()
  }

  const handleEvent = (event: BeanEvent) => {
    if (event.type === 'gameOver') stopMusic()
    const sound = soundForBeanEvent(event.type)
    if (sound) {
      audioRef.current?.play(sound.name, sound.volume)
      if (recordingRef.current) recorderRef.current?.noteSound(sound)
    }
    switch (event.type) {
      case 'go':
        audioRef.current?.startMusic()
        if (recordingRef.current) recorderRef.current?.noteMusicStart()
        vibrate('medium')
        break
      case 'gold':
      case 'comboUp':
        vibrate('light')
        break
      case 'sprint':
        vibrate('medium')
        break
      case 'bad':
        vibrate('heavy')
        break
      default:
        break
    }
  }

  const changeStatus = (next: BeanStatus) => {
    setStatus(next)
    if (next !== 'result') return
    if (gameRef.current.score > readLocalBest(STORE_KEY)) writeLocalBest(gameRef.current.score, STORE_KEY)
    if (recordingRef.current) {
      holdTimerRef.current = setTimeout(() => {
        holdTimerRef.current = null
        void finishRecording()
      }, RESULT_HOLD_MS)
    }
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

  /** 录制按固定时钟出帧，不跟着相机回调走，否则相机帧率低时视频会比真实时间快。 */
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

  const tick = () => {
    const handle = canvasRef.current
    if (!handle || unmountedRef.current) return
    const now = Date.now()
    const delta = now - (lastTickAtRef.current || now)
    lastTickAtRef.current = now

    const before = gameRef.current.status
    const input = hiddenRef.current ? NO_FACE_INPUT : inputRef.current
    const step = advanceBeanGame(gameRef.current, delta, input)
    gameRef.current = step.game
    step.events.forEach(handleEvent)
    if (step.game.status !== before) changeStatus(step.game.status)

    handle.ctx.clearRect(0, 0, handle.width, handle.height)
    drawBeanScene(handle.ctx, handle.width, handle.height, step.game, sceneExtras())
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

  const startFrameStream = () => {
    if (frameListenerRef.current) return
    try {
      const listener = Taro.createCameraContext().onCameraFrame((frame: any) => {
        const width = Number(frame?.width || 0)
        const height = Number(frame?.height || 0)
        if (!width || !height || !(frame?.data instanceof ArrayBuffer)) return
        trackerRef.current?.processFrame({ data: frame.data, height, width }, Date.now())
        if (recordingRef.current) holdCameraFrame(frame.data, width, height)
      })
      listener.start()
      frameListenerRef.current = listener
    } catch (error: any) {
      setCameraError(error?.message || '当前微信环境不支持实时相机帧，无法开始游戏。')
    }
  }

  const beginRecording = async () => {
    if (!prefsRef.current.record || !BeanRecorder.isSupported()) return
    try {
      const recorder = new BeanRecorder({
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
      console.warn('接豆派对录制启动失败:', error)
      await recorderRef.current?.destroy()
      recorderRef.current = null
      Taro.showToast({ title: '录制没启动成功，本局只玩不录', icon: 'none' })
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
    bestScoreRef.current = Math.max(bestScoreRef.current, gameRef.current.score, readLocalBest(STORE_KEY))
    gameRef.current = startBeanCountdown(gameRef.current, Math.floor(Math.random() * 0x7fffffff))
    setVideoPath('')
    setStatus('countdown')
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
    gameRef.current = cancelBeanToIdle(gameRef.current)
    setStatus('idle')
    void stopRoundRecording()
  }

  const finishEarly = () => {
    stopMusic()
    gameRef.current = endBeanRun(gameRef.current)
    changeStatus('result')
  }

  const togglePref = (key: keyof BeanPrefs) => {
    const next = { ...prefsRef.current, [key]: !prefsRef.current[key] }
    prefsRef.current = next
    setPrefs(next)
    writePrefs(next)
    if (key === 'sound') audioRef.current?.setEnabled(next.sound)
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
    // 'holding' 是短暂没检测到（运动模糊等），位置沿用上次，游戏不因此卡顿。
    if (snapshot.lockState !== 'locked') {
      inputRef.current = { ...inputRef.current, tracking: true }
      return
    }
    const frameSize = { height: snapshot.frameHeight, width: snapshot.frameWidth }
    const head = projectHeadAnchorToStage(snapshot, frameSize, stageSizeRef.current)
    inputRef.current = { face: { radiusX: head.radiusX, x: head.x, y: head.y }, tracking: true }
  }

  useEffect(() => {
    openCoachLinkShareMenu()
    const audio = new BirdAudio(initialPrefs.sound)
    audioRef.current = audio
    void audio.prepare()
    void readLatestReplayPath(STORE_KEY).then((path) => {
      if (path && !unmountedRef.current) setVideoPath(path)
    })
    trackerRef.current = new BodyPointTracker({
      anchorMode: 'head',
      headLockConfirmFrames: 3,
      headLostGraceMs: 720,
      onLockChange: (locked) => {
        if (!locked) inputRef.current = NO_FACE_INPUT
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

  return (
    <PageThemeRoot>
      <View className='bean-page'>
        <View className='bean-stage'>
          <Camera
            className='bean-camera'
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
          <Canvas type='2d' id={CANVAS_ID} className='bean-canvas' />

          {recording ? (
            <View className='bean-rec'>
              <View className='bean-rec__dot' />
              <Text className='bean-rec__text'>录制中</Text>
            </View>
          ) : null}

          {!cameraReady && !cameraError ? (
            <View className='bean-note'>
              <Text className='bean-note__title'>正在打开前置摄像头…</Text>
            </View>
          ) : null}
          {cameraError ? (
            <View className='bean-note'>
              <Text className='bean-note__title'>相机暂时不可用</Text>
              <Text className='bean-note__desc'>{cameraError}</Text>
            </View>
          ) : null}
          {cameraReady && !cameraError && runtimeState === 'unavailable' ? (
            <View className='bean-note'>
              <Text className='bean-note__title'>当前设备无法启动头部识别</Text>
              <Text className='bean-note__desc'>{runtimeDetail}</Text>
            </View>
          ) : null}

          {showStartPanel ? (
            <View className='bean-controls'>
              <View className='bean-chips'>
                <View className={`bean-chip ${prefs.record ? 'bean-chip--on' : ''}`} onClick={() => togglePref('record')}>
                  <Text className='bean-chip__text'>录视频</Text>
                </View>
                <View className={`bean-chip ${prefs.sound ? 'bean-chip--on' : ''}`} onClick={() => togglePref('sound')}>
                  <Text className='bean-chip__text'>声音</Text>
                </View>
              </View>
              <View className='bean-actions'>
                <View className='bean-btn bean-btn--primary' onClick={startRound}>
                  <Text className='bean-btn__text'>{status === 'result' ? '再来一局' : '开始'}</Text>
                </View>
                {processing || videoPath ? (
                  <View
                    className={`bean-btn bean-btn--secondary ${processing || saving ? 'bean-btn--disabled' : ''}`}
                    onClick={() => !processing && void saveVideo()}
                  >
                    <Text className='bean-btn__text'>
                      {processing ? '视频生成中…' : saving ? '正在保存' : '保存视频'}
                    </Text>
                  </View>
                ) : null}
              </View>
              {videoPath && !processing ? (
                <View className='bean-link'>
                  <Text className='bean-link__text' onClick={() => void previewVideo()}>看回放</Text>
                </View>
              ) : null}
              {status === 'idle' ? (
                <Text className='bean-hint'>手机竖着放好，站远一点，左右走动、下蹲去接。一局 45 秒。</Text>
              ) : null}
            </View>
          ) : null}

          {status === 'countdown' ? (
            <View className='bean-controls bean-controls--bare'>
              <View className='bean-btn bean-btn--ghost' onClick={cancelCountdown}>
                <Text className='bean-btn__text'>取消</Text>
              </View>
            </View>
          ) : null}
          {status === 'playing' ? (
            <View className='bean-controls bean-controls--bare'>
              <View className='bean-btn bean-btn--ghost' onClick={finishEarly}>
                <Text className='bean-btn__text'>结束本局</Text>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </PageThemeRoot>
  )
}
