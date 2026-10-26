import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, Canvas, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { usePageEnterTrace } from '@/utils/pageTrace'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import { USER_FACING_CAMERA } from '../cameraTracking'
import {
  advanceSim,
  BOUNCE_EXERCISES,
  BOUNCE_SPEEDS,
  COUNTDOWN_MS,
  createRound,
  createSim,
  sceneFromSim,
  WORLD_HEIGHT,
  type BounceScene,
  type BounceSim,
  type BounceSpeed,
  type BounceStatus
} from './bounceModel'
import {
  BOUNCE_REPLAY_FPS,
  BOUNCE_REPLAY_HEIGHT,
  BOUNCE_REPLAY_WIDTH,
  DumbbellBounceRecorder
} from './bounceRecorder'
import { drawBounceScene } from './bounceScene'
import './index.scss'

const CANVAS_ID = 'dumbbellBounceCanvas'
const PREFS_KEY = 'dumbbell_bounce_prefs_v1'
/** 哑铃掉出去后再录一小段结果画面，视频结尾能看清最终数字。 */
const RESULT_HOLD_MS = 2200
const MAX_FRAME_DELTA_MS = 64
const REPLAY_FRAME_INTERVAL_MS = 1000 / BOUNCE_REPLAY_FPS
/**
 * 录制上限 10 分钟（真实时间）。1× 下 99% 的局在 5 分钟内结束；更长的局到点后
 * 视频停在这里，游戏照常弹完，建议这种局开快进。
 */
const REPLAY_MAX_SECONDS = 600
/** 撞得很密时震动会连成一片，至少间隔这么久才震一次。 */
const HIT_VIBRATE_GAP_MS = 150
/** 还没开始时哑铃挂在两片上方。 */
const IDLE_SIM = createSim({ angle: 0, spin: 0, vx: 0, vy: 0, x: 0.5, y: WORLD_HEIGHT * 0.26 })

type BouncePrefs = {
  exerciseKey: string
  speed: BounceSpeed
}

type CanvasHandle = {
  canvas: any
  ctx: any
  height: number
  width: number
}

function readPrefs(): BouncePrefs {
  const fallback: BouncePrefs = { exerciseKey: BOUNCE_EXERCISES[0].key, speed: 1 }
  try {
    const stored = Taro.getStorageSync(PREFS_KEY) as Partial<BouncePrefs> | ''
    if (!stored) return fallback
    const exerciseKey = BOUNCE_EXERCISES.some((item) => item.key === stored.exerciseKey)
      ? String(stored.exerciseKey)
      : fallback.exerciseKey
    const speed = BOUNCE_SPEEDS.includes(stored.speed as BounceSpeed) ? (stored.speed as BounceSpeed) : fallback.speed
    return { exerciseKey, speed }
  } catch {
    return fallback
  }
}

function writePrefs(prefs: BouncePrefs) {
  try {
    Taro.setStorageSync(PREFS_KEY, prefs)
  } catch {
    // 偏好只是方便下次打开，写失败不影响玩
  }
}

function exerciseLabelOf(key: string) {
  return BOUNCE_EXERCISES.find((item) => item.key === key)?.label || BOUNCE_EXERCISES[0].label
}

export default function DumbbellBouncePage() {
  usePageEnterTrace()
  const initialPrefs = useMemo(readPrefs, [])
  const [status, setStatus] = useState<BounceStatus>('idle')
  const [speed, setSpeed] = useState<BounceSpeed>(initialPrefs.speed)
  const [exerciseKey, setExerciseKey] = useState(initialPrefs.exerciseKey)
  const [resultReps, setResultReps] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [recording, setRecording] = useState(false)
  const [processing, setProcessing] = useState(false)
  const [videoPath, setVideoPath] = useState('')
  const [saving, setSaving] = useState(false)

  const statusRef = useRef<BounceStatus>('idle')
  const speedRef = useRef<BounceSpeed>(initialPrefs.speed)
  const exerciseLabelRef = useRef(exerciseLabelOf(initialPrefs.exerciseKey))
  const simRef = useRef<BounceSim>(IDLE_SIM)
  const countdownStartedAtRef = useRef(0)
  const resultAtRef = useRef(0)
  const lastTickAtRef = useRef(0)
  const lastVibrateAtRef = useRef(0)
  const canvasRef = useRef<CanvasHandle | null>(null)
  const rafIdRef = useRef<number | null>(null)
  const recorderRef = useRef<DumbbellBounceRecorder | null>(null)
  const recordingRef = useRef(false)
  const lastCaptureAtRef = useRef(0)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const frameListenerRef = useRef<any>(null)
  const unmountedRef = useRef(false)

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '哑铃弹几下，我就做几个，你敢来吗？',
        path: buildSharePath('/toolbox/dumbbell-bounce/index')
      }),
    []
  )
  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  const buildScene = (now: number): BounceScene =>
    sceneFromSim(simRef.current, {
      countdownMs: now - countdownStartedAtRef.current,
      exerciseLabel: exerciseLabelRef.current,
      resultAgeMs: now - resultAtRef.current,
      status: statusRef.current
    })

  const changeStatus = (next: BounceStatus) => {
    statusRef.current = next
    setStatus(next)
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
        setVideoPath(result.tempVideoPath)
      } else {
        Taro.showToast({ title: '视频生成失败，再来一次试试', icon: 'none' })
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

  const finishRound = () => {
    if (statusRef.current !== 'bouncing') return
    resultAtRef.current = Date.now()
    setResultReps(simRef.current.hits)
    changeStatus('result')
    void Taro.vibrateShort({ type: 'heavy' }).catch(() => undefined)
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
    const delta = Math.min(MAX_FRAME_DELTA_MS, now - (lastTickAtRef.current || now))
    lastTickAtRef.current = now

    if (statusRef.current === 'countdown' && now - countdownStartedAtRef.current >= COUNTDOWN_MS) {
      changeStatus('bouncing')
    } else if (statusRef.current === 'bouncing') {
      const before = simRef.current.hits
      simRef.current = advanceSim(simRef.current, delta, speedRef.current)
      if (
        simRef.current.hits > before
        && speedRef.current === 1
        && now - lastVibrateAtRef.current >= HIT_VIBRATE_GAP_MS
      ) {
        lastVibrateAtRef.current = now
        void Taro.vibrateShort({ type: 'light' }).catch(() => undefined)
      }
      if (simRef.current.ended) finishRound()
    }

    handle.ctx.clearRect(0, 0, handle.width, handle.height)
    drawBounceScene(handle.ctx, handle.width, handle.height, buildScene(now))
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
        const dpr = Taro.getSystemInfoSync().pixelRatio || 2
        canvas.width = Math.round(found.width * dpr)
        canvas.height = Math.round(found.height * dpr)
        ctx.scale(dpr, dpr)
        if (rafIdRef.current !== null) canvasRef.current?.canvas.cancelAnimationFrame(rafIdRef.current)
        canvasRef.current = { canvas, ctx, height: found.height, width: found.width }
        lastTickAtRef.current = 0
        tick()
      })
  }

  const startFrameStream = () => {
    if (frameListenerRef.current) return
    try {
      const context = Taro.createCameraContext()
      const listener = context.onCameraFrame((frame: any) => {
        if (!recordingRef.current || !recorderRef.current) return
        const now = Date.now()
        if (now - lastCaptureAtRef.current < REPLAY_FRAME_INTERVAL_MS) return
        const width = Number(frame?.width || 0)
        const height = Number(frame?.height || 0)
        if (!width || !height || !(frame?.data instanceof ArrayBuffer)) return
        lastCaptureAtRef.current = now
        // 这里只建视图，recorder.captureFrame 会在入队时深拷贝。
        recorderRef.current.captureFrame({
          frameBuffer: new Uint8ClampedArray(frame.data),
          frameHeight: height,
          frameWidth: width,
          scene: buildScene(now)
        })
      })
      listener.start()
      frameListenerRef.current = listener
    } catch (error) {
      console.warn('哑铃弹弹相机帧监听启动失败:', error)
    }
  }

  const beginRecording = async () => {
    if (!DumbbellBounceRecorder.isSupported()) {
      Taro.showToast({ title: '当前微信版本不支持录视频，可以直接玩', icon: 'none' })
      return
    }
    try {
      const recorder = new DumbbellBounceRecorder({
        durationSeconds: REPLAY_MAX_SECONDS,
        fps: BOUNCE_REPLAY_FPS,
        height: BOUNCE_REPLAY_HEIGHT,
        videoBitsPerSecond: 2000,
        width: BOUNCE_REPLAY_WIDTH
      })
      recorderRef.current = recorder
      await recorder.start()
      lastCaptureAtRef.current = 0
      recordingRef.current = true
      setRecording(true)
    } catch (error) {
      console.warn('哑铃弹弹录制启动失败:', error)
      await recorderRef.current?.destroy()
      recorderRef.current = null
      Taro.showToast({ title: '录制没启动成功，本局只玩不录', icon: 'none' })
    }
  }

  const startRound = () => {
    if (!cameraReady || cameraError) {
      Taro.showToast({ title: '相机还没准备好', icon: 'none' })
      return
    }
    if (recording || processing) return
    // 每局随机松手：位置、角度、初速度、自转都不同，撞几下全看物理。
    simRef.current = createRound()
    setVideoPath('')
    setResultReps(0)
    countdownStartedAtRef.current = Date.now()
    changeStatus('countdown')
    void beginRecording()
  }

  const handleMainAction = () => {
    if (status === 'idle' || status === 'result') startRound()
  }

  const chooseSpeed = (next: BounceSpeed) => {
    speedRef.current = next
    setSpeed(next)
    writePrefs({ exerciseKey, speed: next })
  }

  const chooseExercise = (key: string) => {
    if (status === 'countdown' || status === 'bouncing') return
    exerciseLabelRef.current = exerciseLabelOf(key)
    setExerciseKey(key)
    writePrefs({ exerciseKey: key, speed })
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

  useEffect(() => {
    openCoachLinkShareMenu()
    return () => {
      unmountedRef.current = true
      if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
      if (rafIdRef.current !== null) canvasRef.current?.canvas.cancelAnimationFrame(rafIdRef.current)
      try {
        frameListenerRef.current?.stop?.()
      } catch {
        // ignore cleanup error
      }
      recordingRef.current = false
      void recorderRef.current?.destroy()
      recorderRef.current = null
    }
  }, [])

  const busy = status === 'countdown' || status === 'bouncing'
  const mainLabel = status === 'countdown'
    ? '准备松手…'
    : status === 'bouncing'
      ? '弹跳中…'
      : status === 'result'
        ? '再扔一次'
        : '松手扔哑铃'
  const mainDisabled = busy || recording || processing

  return (
    <PageThemeRoot>
      <View className='bounce-page'>
        <View className='bounce-stage'>
          <Camera
            className='bounce-camera'
            devicePosition={USER_FACING_CAMERA.devicePosition}
            flash='off'
            mode='normal'
            frameSize={USER_FACING_CAMERA.frameSize}
            resolution={USER_FACING_CAMERA.resolution}
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
          <Canvas type='2d' id={CANVAS_ID} className='bounce-canvas' />
          {recording ? (
            <View className='bounce-rec'>
              <View className='bounce-rec__dot' />
              <Text className='bounce-rec__text'>录制中</Text>
            </View>
          ) : null}
          {!cameraReady && !cameraError ? (
            <View className='bounce-note'>
              <Text className='bounce-note__text'>正在打开前置摄像头…</Text>
            </View>
          ) : null}
          {cameraError ? (
            <View className='bounce-note'>
              <Text className='bounce-note__text'>相机暂时不可用</Text>
              <Text className='bounce-note__sub'>{cameraError}</Text>
            </View>
          ) : null}
        </View>

        <View className='bounce-panel'>
          <View className='bounce-row'>
            <Text className='bounce-row__label'>速度</Text>
            <View className='bounce-chips'>
              {BOUNCE_SPEEDS.map((item) => (
                <View
                  key={item}
                  className={`bounce-chip ${speed === item ? 'bounce-chip--active' : ''}`}
                  onClick={() => chooseSpeed(item)}
                >
                  <Text className='bounce-chip__text cl-num'>{item}×</Text>
                </View>
              ))}
            </View>
          </View>

          <View className={`bounce-row ${busy ? 'bounce-row--locked' : ''}`}>
            <Text className='bounce-row__label'>动作</Text>
            <ScrollView className='bounce-exercises' scrollX enhanced showScrollbar={false}>
              <View className='bounce-chips bounce-chips--scroll'>
                {BOUNCE_EXERCISES.map((item) => (
                  <View
                    key={item.key}
                    className={`bounce-chip ${exerciseKey === item.key ? 'bounce-chip--active' : ''}`}
                    onClick={() => chooseExercise(item.key)}
                  >
                    <Text className='bounce-chip__text'>{item.label}</Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </View>

          <View className='bounce-actions'>
            <View
              className={`bounce-main ${mainDisabled ? 'bounce-main--disabled' : ''}`}
              onClick={() => !mainDisabled && handleMainAction()}
            >
              <Text className='bounce-main__text'>{mainLabel}</Text>
            </View>
            {status === 'result' && (processing || videoPath) ? (
              <View
                className={`bounce-save ${processing || saving ? 'bounce-save--disabled' : ''}`}
                onClick={() => !processing && void saveVideo()}
              >
                <Text className='bounce-save__text'>
                  {processing ? '视频生成中…' : saving ? '正在保存' : '保存视频'}
                </Text>
              </View>
            ) : null}
          </View>

          <Text className='bounce-hint'>
            {status === 'result'
              ? `今天的任务：${resultReps} 个${exerciseLabelOf(exerciseKey)}。视频免费保存，可以直接发抖音、小红书。`
              : '每次随机松手，撞一下杠铃片算 1 个，碰巧竖着掉进缝里才结束；弹得久就开 5×、10× 快进。'}
          </Text>
        </View>
      </View>
    </PageThemeRoot>
  )
}
