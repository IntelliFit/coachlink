import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ScrollView, Text, View } from '@tarojs/components'
import Taro, { useShareAppMessage, useShareTimeline } from '@tarojs/taro'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { useTheme } from '@/hooks/useTheme'
import {
  buildSharePath,
  createSharePayload,
  createTimelinePayload,
  openCoachLinkShareMenu
} from '@/utils/share'
import {
  MotionArcadeReplayRecorder,
  type ArcadeReplayFinalizeProgress,
  type ArcadeReplayItem
} from '../games/arcadeReplayRecorder'
import {
  type ArcadeFeedback,
  vibrateForArcadeFeedback
} from '../games/arcadeFeedback'
import {
  BodyPointTracker,
  type BodyTrackingRuntimeState
} from '../games/bodyPointTracker'
import {
  getHeadCompanionMetrics,
  headCompanionHitsRect,
  placeCompanionBesideHead,
  projectHeadAnchorToStage,
  USER_FACING_CAMERA
} from '../cameraTracking'
import MotionGameResultPanel from '../games/MotionGameResultPanel'
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
import '../games/motionArcade.scss'
import './index.scss'

type GameStatus = 'idle' | 'playing' | 'ended'

type RecordedVideo = {
  kind?: 'camera' | 'composite'
  tempThumbPath?: string
  tempVideoPath: string
}

type CachedRecordedVideo = RecordedVideo & {
  savedAt: number
}

type ReplayProgress = {
  detail: string
  label: string
  percent: number
  status: 'failed' | 'recording' | 'processing' | 'ready' | 'saving'
}

type HeadLockState = {
  estimated: boolean
  radiusX: number
  radiusY: number
  visible: boolean
  x: number
  y: number
}

type PipePair = {
  gapHeight: number
  gapY: number
  id: number
  passed: boolean
  width: number
  x: number
}

const GAME_TICK_MS = 32
const REPLAY_DURATION_SECONDS = 300
const REPLAY_FPS = 12
const REPLAY_FRAME_INTERVAL_MS = 1000 / REPLAY_FPS
const PULLUP_REPLAY_CACHE_KEY_PREFIX = 'pullup_rush_latest_replay_v1'
const PIPE_SPEED = 0.012
const PIPE_SPAWN_MS = 1180
const PULL_TRIGGER_COOLDOWN_MS = 260
const TRACKING_UI_INTERVAL_MS = 64
const MAX_LIVES = 2

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatSeconds(ms: number) {
  return Math.max(0, Math.floor(ms / 1000))
}

function formatPercent(value: number) {
  return Math.round(clamp(value, 0, 1) * 100)
}

function getReplayCacheKey() {
  try {
    const userId = String(Taro.getStorageSync('user')?.id || '').trim()
    return `${PULLUP_REPLAY_CACHE_KEY_PREFIX}:${userId || 'guest'}`
  } catch {
    return `${PULLUP_REPLAY_CACHE_KEY_PREFIX}:guest`
  }
}

function readCachedReplay() {
  try {
    const cached = Taro.getStorageSync(getReplayCacheKey()) as CachedRecordedVideo | undefined
    if (!cached?.tempVideoPath || !cached.savedAt) return null
    return cached
  } catch {
    return null
  }
}

function fileExists(filePath: string) {
  return new Promise<boolean>((resolve) => {
    try {
      Taro.getFileSystemManager().access({
        path: filePath,
        success: () => resolve(true),
        fail: () => resolve(false)
      })
    } catch {
      resolve(false)
    }
  })
}

function persistReplayFile(video: RecordedVideo) {
  return new Promise<RecordedVideo>((resolve, reject) => {
    Taro.saveFile({
      tempFilePath: video.tempVideoPath,
      success: (result) => {
        const savedVideo = {
          ...video,
          tempVideoPath: result.savedFilePath
        }
        try {
          const previous = readCachedReplay()
          Taro.setStorageSync(getReplayCacheKey(), {
            ...savedVideo,
            savedAt: Date.now()
          } satisfies CachedRecordedVideo)
          if (previous?.tempVideoPath && previous.tempVideoPath !== result.savedFilePath) {
            void Taro.removeSavedFile({ filePath: previous.tempVideoPath }).catch(() => undefined)
          }
        } catch (error) {
          console.warn('引体冲刺回放索引保存失败:', error)
        }
        resolve(savedVideo)
      },
      fail: (error) => reject(new Error(error?.errMsg || '回放保存到本地失败'))
    })
  })
}

function buildPipePair(id: number): PipePair {
  return {
    gapHeight: 0.24 + Math.random() * 0.06,
    gapY: 0.28 + Math.random() * 0.34,
    id,
    passed: false,
    width: 0.18,
    x: 1.12
  }
}

export default function PullupRushPage() {
  const { effectiveTheme } = useTheme()
  const cameraContextRef = useRef<any>(null)
  const replayRecorderRef = useRef<MotionArcadeReplayRecorder | null>(null)
  const frameListenerRef = useRef<any>(null)
  const lastReplayCaptureAtRef = useRef(0)
  const gameStatusRef = useRef<GameStatus>('idle')
  const lastPullTriggerAtRef = useRef(0)
  const pipesRef = useRef<PipePair[]>([])
  const nextPipeIdRef = useRef(1)
  const lastPipeSpawnAtRef = useRef(0)
  const isRecordingRef = useRef(false)
  const feedbackIdRef = useRef(0)
  const cameraStageSizeRef = useRef({ width: 0, height: 0 })
  const companionMetricsRef = useRef(getHeadCompanionMetrics(cameraStageSizeRef.current, 0))
  const lastTrackingUiAtRef = useRef(0)
  const headLockVisibleRef = useRef(false)
  const trackingLockedRef = useRef(false)
  const trackingActiveRef = useRef(false)
  const trackingPausedAtRef = useRef(0)
  const recordingModeRef = useRef<'camera' | 'composite' | null>(null)
  const gameStartedAtRef = useRef(0)
  const gameWallStartedAtRef = useRef(0)
  const gameSessionIdRef = useRef<string | null>(null)
  const gameRoundRef = useRef(0)
  const roundSyncStartedRef = useRef(false)
  const gameStartingRef = useRef(false)
  const scoreRef = useRef(0)
  const elapsedMsRef = useRef(0)
  const pullCountRef = useRef(0)
  const playerPositionRef = useRef({ x: 0.32, y: 0.52 })
  const bestScoreRef = useRef(0)
  const livesRef = useRef(MAX_LIVES)

  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [motionEnergy, setMotionEnergy] = useState(0)
  const [playerPosition, setPlayerPosition] = useState({ x: 0.32, y: 0.52 })
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [recording, setRecording] = useState(false)
  const [replayProcessing, setReplayProcessing] = useState(false)
  const [videoSaving, setVideoSaving] = useState(false)
  const [recordedVideo, setRecordedVideo] = useState<RecordedVideo | null>(null)
  const [replayProgress, setReplayProgress] = useState<ReplayProgress | null>(null)
  const [pipes, setPipes] = useState<PipePair[]>([])
  const [lives, setLives] = useState(MAX_LIVES)
  const [pullCount, setPullCount] = useState(0)
  const [rankingResult, setRankingResult] = useState<MotionGameRankingResult | null>(null)
  const [rankingSyncState, setRankingSyncState] = useState<'idle' | 'syncing' | 'synced' | 'local-only'>('idle')
  const [feedback, setFeedback] = useState<ArcadeFeedback | null>(null)
  const [trackingLocked, setTrackingLocked] = useState(false)
  const [trackingActive, setTrackingActive] = useState(false)
  const [trackingRuntimeState, setTrackingRuntimeState] = useState<BodyTrackingRuntimeState>('initializing')
  const [trackingRuntimeDetail, setTrackingRuntimeDetail] = useState('正在启动头部识别')
  const [headLock, setHeadLock] = useState<HeadLockState>({
    estimated: false,
    radiusX: 0.08,
    radiusY: 0.1,
    visible: false,
    x: 0.5,
    y: 0.28
  })

  const sharePayload = useMemo(
    () =>
      createSharePayload({
        title: '我在 CoachLink 试玩了引体冲刺小游戏',
        path: buildSharePath('/toolbox/pullup-rush/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    let active = true
    const restoreLatestReplay = async () => {
      const cached = readCachedReplay()
      if (!cached) return
      if (!(await fileExists(cached.tempVideoPath))) {
        Taro.removeStorageSync(getReplayCacheKey())
        return
      }
      if (!active) return
      setRecordedVideo(cached)
      setReplayProgress({
        detail: '已保存在小程序本地，可查看或另存到系统相册。',
        label: '上次回放可用',
        percent: 100,
        status: 'ready'
      })
    }
    void restoreLatestReplay()
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    elapsedMsRef.current = elapsedMs
  }, [elapsedMs])

  useEffect(() => {
    pipesRef.current = pipes
  }, [pipes])

  useEffect(() => {
    bestScoreRef.current = bestScore
  }, [bestScore])

  useEffect(() => {
    livesRef.current = lives
  }, [lives])

  useEffect(() => {
    gameStatusRef.current = gameStatus
  }, [gameStatus])

  useEffect(() => {
    const context = Taro.createCameraContext()
    cameraContextRef.current = context
    const updateTrackingActivity = (active: boolean) => {
      if (trackingActiveRef.current === active) return
      const now = Date.now()
      if (!active && gameStatusRef.current === 'playing' && !trackingPausedAtRef.current) {
        trackingPausedAtRef.current = now
      } else if (active && trackingPausedAtRef.current) {
        const pausedFor = now - trackingPausedAtRef.current
        gameStartedAtRef.current += pausedFor
        lastPipeSpawnAtRef.current += pausedFor
        trackingPausedAtRef.current = 0
      }
      trackingActiveRef.current = active
      setTrackingActive(active)
    }
    const tracker = new BodyPointTracker({
      anchorMode: 'head',
      headLockConfirmFrames: 3,
      headLostGraceMs: 720,
      onLockChange: (locked) => {
        trackingLockedRef.current = locked
        setTrackingLocked(locked)
        if (!locked) {
          updateTrackingActivity(false)
          setHeadLock((previous) => ({ ...previous, visible: false }))
        }
      },
      onRuntimeStateChange: (state, detail) => {
        setTrackingRuntimeState(state)
        setTrackingRuntimeDetail(detail)
      },
      onSnapshot: (snapshot) => {
        const now = Date.now()
        updateTrackingActivity(snapshot.locked && snapshot.lockState === 'locked')
        const frameSize = { width: snapshot.frameWidth, height: snapshot.frameHeight }
        const headLocked = snapshot.locked
        const projectedHead = headLocked
          ? projectHeadAnchorToStage(snapshot, frameSize, cameraStageSizeRef.current)
          : null
        if (projectedHead && snapshot.lockState === 'locked') {
          const metrics = companionMetricsRef.current
          playerPositionRef.current = placeCompanionBesideHead(projectedHead, {
            halfHeight: metrics.visualHalfHeight,
            halfWidth: metrics.visualHalfWidth
          })
        }
        if (
          now - lastTrackingUiAtRef.current >= TRACKING_UI_INTERVAL_MS
          || headLocked !== headLockVisibleRef.current
        ) {
          lastTrackingUiAtRef.current = now
          headLockVisibleRef.current = headLocked
          setMotionEnergy(snapshot.energy)
          if (projectedHead) {
            if (snapshot.lockState === 'locked') {
              setPlayerPosition(playerPositionRef.current)
            }
            setHeadLock({
              estimated: snapshot.lockState === 'holding' || snapshot.target === 'head-estimate',
              radiusX: projectedHead.radiusX,
              radiusY: projectedHead.radiusY,
              visible: true,
              x: projectedHead.x,
              y: projectedHead.y
            })
          } else {
            setHeadLock((previous) => ({ ...previous, visible: false }))
          }
        }

        const upwardThreshold = snapshot.source === 'pose' ? -0.012 : -0.022
        const energyThreshold = snapshot.source === 'pose' ? 0.05 : 0.12
        if (
          gameStatusRef.current === 'playing'
          && snapshot.locked
          && snapshot.energy >= energyThreshold
          && snapshot.velocityY <= upwardThreshold
          && now - lastPullTriggerAtRef.current >= PULL_TRIGGER_COOLDOWN_MS
        ) {
          lastPullTriggerAtRef.current = now
          setPullCount((prevCount) => {
            const nextCount = prevCount + 1
            pullCountRef.current = nextCount
            return nextCount
          })
        }
      }
    })

    let stopped = false
    const startFrameStream = () => {
      try {
        const listener = context.onCameraFrame((frame: any) => {
          if (stopped) return
          const now = Date.now()

          const width = Number(frame?.width || 0)
          const height = Number(frame?.height || 0)
          const data = frame?.data
          if (!width || !height || !(data instanceof ArrayBuffer)) return
          tracker.processFrame({ data, height, width }, now)

          if (
            recordingModeRef.current === 'composite'
            && now - lastReplayCaptureAtRef.current >= REPLAY_FRAME_INTERVAL_MS
          ) {
            lastReplayCaptureAtRef.current = now
            const rgba = new Uint8Array(data)
            const replayItems: ArcadeReplayItem[] = pipesRef.current.flatMap((pipe) => {
              const topHeight = pipe.gapY
              const bottomStart = pipe.gapY + pipe.gapHeight
              const bottomHeight = Math.max(0, 1 - bottomStart)
              return [
                {
                  height: topHeight,
                  shape: 'rect',
                  size: topHeight,
                  type: 'bad',
                  width: pipe.width,
                  x: pipe.x,
                  y: topHeight / 2
                },
                {
                  height: bottomHeight,
                  shape: 'rect',
                  size: bottomHeight,
                  type: 'bad',
                  width: pipe.width,
                  x: pipe.x,
                  y: bottomStart + bottomHeight / 2
                }
              ]
            })

            replayRecorderRef.current?.captureFrame({
              frameBuffer: new Uint8ClampedArray(rgba),
              frameHeight: height,
              frameWidth: width,
              items: replayItems,
              player: {
                x: playerPositionRef.current.x,
                y: playerPositionRef.current.y
              },
              replayFooterLabel: '引体冲刺回放',
              score: scoreRef.current,
              timerMode: 'elapsed',
              timeLeftMs: elapsedMsRef.current,
              visualKey: 'pullup'
            })
          }
        })

        frameListenerRef.current = listener
        listener.start()
      } catch (error: any) {
        setCameraError(error?.message || '当前微信环境不支持实时相机帧，无法启动试玩。')
      }
    }

    startFrameStream()

    return () => {
      stopped = true
      try {
        frameListenerRef.current?.stop?.()
      } catch {
        // ignore cleanup error
      }
      frameListenerRef.current = null
      tracker.destroy()
      void replayRecorderRef.current?.destroy()
      replayRecorderRef.current = null
      if (isRecordingRef.current) {
        try {
          context.stopRecord({})
        } catch {
          // ignore cleanup error
        }
      }
    }
  }, [])

  const syncFinishedRound = async () => {
    if (roundSyncStartedRef.current) return
    roundSyncStartedRef.current = true

    const roundId = gameRoundRef.current
    const sessionId = gameSessionIdRef.current
    const score = scoreRef.current
    const elapsedMs = elapsedMsRef.current
    const actionCount = pullCountRef.current
    const wallElapsedMs = Math.max(1, Date.now() - gameWallStartedAtRef.current)
    const lockRatio = Math.min(1, Math.max(0, elapsedMs / wallElapsedMs))
    let userId = ''
    try {
      userId = String(Taro.getStorageSync('user')?.id || '')
    } catch {
      // The result still remains visible even if local storage is unavailable.
    }

    const localRunId = userId
      ? persistMotionGameRunLocally(userId, {
          sessionId,
          gameKey: 'pullup-rush',
          score,
          elapsedMs,
          actionCount,
          lockRatio,
          finishedAt: Date.now()
        })
      : ''

    if (!sessionId) {
      if (roundId === gameRoundRef.current) setRankingSyncState('local-only')
      return
    }

    if (roundId === gameRoundRef.current) setRankingSyncState('syncing')
    const result = await motionGameLeaderboardService.finishSession({
      sessionId,
      gameKey: 'pullup-rush',
      score,
      elapsedMs,
      actionCount,
      lockRatio
    })

    if (result) {
      if (userId && localRunId) applyCloudMotionGameResult(userId, localRunId, result)
      if (roundId === gameRoundRef.current) {
        setRankingResult(result)
        setRankingSyncState('synced')
        setBestScore(result.bestScore)
        bestScoreRef.current = result.bestScore
      }
      return
    }

    if (userId && localRunId) markMotionGameRunLocalOnly(userId, localRunId)
    if (roundId === gameRoundRef.current) setRankingSyncState('local-only')
  }

  const endRound = (nextStatus: GameStatus) => {
    gameStatusRef.current = nextStatus
    setGameStatus(nextStatus)
    if (nextStatus === 'ended') void syncFinishedRound()
    if (isRecordingRef.current) {
      void stopRecording()
    }
  }

  useEffect(() => {
    if (gameStatus !== 'playing') return

    void Taro.setKeepScreenOn({ keepScreenOn: true }).catch(() => undefined)
    return () => {
      void Taro.setKeepScreenOn({ keepScreenOn: false }).catch(() => undefined)
    }
  }, [gameStatus])

  useEffect(() => {
    if (gameStatus !== 'playing') return

    const timer = setInterval(() => {
      const now = Date.now()
      if (!trackingActiveRef.current) return
      const elapsed = now - gameStartedAtRef.current
      const currentPlayer = playerPositionRef.current
      const metrics = companionMetricsRef.current
      setElapsedMs(elapsed)
      elapsedMsRef.current = elapsed

      let nextPipes = pipesRef.current
        .map((pipe) => ({ ...pipe, x: pipe.x - PIPE_SPEED }))
        .filter((pipe) => pipe.x + pipe.width / 2 > -0.16)

      if (now - lastPipeSpawnAtRef.current >= PIPE_SPAWN_MS) {
        nextPipes = [...nextPipes, buildPipePair(nextPipeIdRef.current++)]
        lastPipeSpawnAtRef.current = now
      }

      let passedCount = 0
      const outsideStage =
        currentPlayer.y - metrics.hitboxHalfHeight <= 0
        || currentPlayer.y + metrics.hitboxHalfHeight >= 1
      let crashed = outsideStage

      for (const pipe of nextPipes) {
        const topHeight = pipe.gapY
        const bottomStart = pipe.gapY + pipe.gapHeight
        if (
          headCompanionHitsRect(currentPlayer, metrics, {
            height: topHeight,
            width: pipe.width,
            x: pipe.x,
            y: topHeight / 2
          })
          || headCompanionHitsRect(currentPlayer, metrics, {
            height: 1 - bottomStart,
            width: pipe.width,
            x: pipe.x,
            y: bottomStart + (1 - bottomStart) / 2
          })
        ) {
          crashed = true
          break
        }

        if (!pipe.passed && pipe.x + pipe.width / 2 < currentPlayer.x) {
          pipe.passed = true
          passedCount += 1
        }
      }

      if (passedCount > 0 && !crashed) {
        const nextScore = scoreRef.current + passedCount
        scoreRef.current = nextScore
        setScore(nextScore)
        if (nextScore > bestScoreRef.current) {
          bestScoreRef.current = nextScore
          setBestScore(nextScore)
        }
        setFeedback({
          id: ++feedbackIdRef.current,
          text: `+${passedCount} 穿越`,
          tone: 'good'
        })
        vibrateForArcadeFeedback('good')
      }

      if (crashed) {
        setFeedback({
          id: ++feedbackIdRef.current,
          text: outsideStage ? '小鸟触边 -1 命' : '小鸟撞管道 -1 命',
          tone: 'bad'
        })
        vibrateForArcadeFeedback('bad')
        const nextLives = Math.max(0, livesRef.current - 1)
        setLives(nextLives)
        livesRef.current = nextLives
        setPipes([])
        pipesRef.current = []
        lastPipeSpawnAtRef.current = now
        if (nextLives <= 0) {
          clearInterval(timer)
          endRound('ended')
          return
        }
      } else {
        pipesRef.current = nextPipes
        setPipes(nextPipes)
      }
    }, GAME_TICK_MS)

    return () => clearInterval(timer)
  }, [gameStatus])

  const storeGeneratedReplay = async (video: RecordedVideo) => {
    setReplayProgress({
      detail: '第 3/3 步：正在把回放保存到小程序本地。',
      label: '正在保存回放',
      percent: 92,
      status: 'processing'
    })
    try {
      const savedVideo = await persistReplayFile(video)
      setRecordedVideo(savedVideo)
      setReplayProgress({
        detail: '已保存在小程序本地，重新进入页面后仍可查看。',
        label: '回放已就绪',
        percent: 100,
        status: 'ready'
      })
      return savedVideo
    } catch (error: any) {
      setRecordedVideo(video)
      setReplayProgress({
        detail: '回放已生成，但长期保存失败；请立即保存到系统相册。',
        label: '仅临时可用',
        percent: 100,
        status: 'ready'
      })
      Taro.showToast({ title: error?.message || '回放长期保存失败', icon: 'none' })
      return video
    }
  }

  const beginCameraFallbackRecording = () => {
    if (!cameraContextRef.current) {
      Taro.showToast({ title: '相机还没准备好', icon: 'none' })
      return
    }

    try {
      cameraContextRef.current.startRecord({
        timeout: 60,
        success: () => {
          setRecording(true)
          isRecordingRef.current = true
          recordingModeRef.current = 'camera'
          setReplayProgress({
            detail: '当前设备使用原相机录像，结束后会自动保存本地。',
            label: '正在录制原视频',
            percent: 0,
            status: 'recording'
          })
          Taro.showToast({ title: '已退回原视频录制', icon: 'none' })
        },
        fail: (error: any) => {
          setRecording(false)
          isRecordingRef.current = false
          recordingModeRef.current = null
          Taro.showToast({ title: error?.errMsg || '开始录像失败', icon: 'none' })
        },
        timeoutCallback: (res: RecordedVideo) => {
          setRecording(false)
          isRecordingRef.current = false
          recordingModeRef.current = null
          if (res?.tempVideoPath) {
            setReplayProcessing(true)
            void storeGeneratedReplay({
              ...res,
              kind: 'camera'
            }).finally(() => {
              setReplayProcessing(false)
            })
          }
        }
      })
    } catch (error: any) {
      Taro.showToast({ title: error?.message || '当前环境无法录像', icon: 'none' })
    }
  }

  const beginCompositeRecording = async () => {
    const recorder = new MotionArcadeReplayRecorder({
      durationSeconds: REPLAY_DURATION_SECONDS,
      fps: REPLAY_FPS
    })
    replayRecorderRef.current = recorder
    await recorder.start()
    setRecording(true)
    isRecordingRef.current = true
    recordingModeRef.current = 'composite'
    setReplayProgress({
      detail: '正在同步录制相机、角色和障碍，最多录制 5 分钟。',
      label: '正在录制回放',
      percent: 0,
      status: 'recording'
    })
  }

  const beginRecording = async () => {
    if (recording || isRecordingRef.current || replayProcessing) return
    if (!cameraContextRef.current) {
      Taro.showToast({ title: '相机还没准备好', icon: 'none' })
      return
    }

    if (MotionArcadeReplayRecorder.isSupported()) {
      try {
        await beginCompositeRecording()
        return
      } catch (error: any) {
        await replayRecorderRef.current?.destroy()
        replayRecorderRef.current = null
        console.warn('引体冲刺合成回放录制不可用:', error)
      }
    }

    beginCameraFallbackRecording()
  }

  const stopCameraFallbackRecording = () => {
    if (!cameraContextRef.current) return

    cameraContextRef.current.stopRecord({
      compressed: true,
      success: (res: RecordedVideo) => {
        setReplayProcessing(true)
        void storeGeneratedReplay({
          ...res,
          kind: 'camera'
        }).finally(() => {
          setReplayProcessing(false)
        })
      },
      fail: (error: any) => {
        Taro.showToast({ title: error?.errMsg || '停止录像失败', icon: 'none' })
      },
      complete: () => {
        setRecording(false)
        isRecordingRef.current = false
        recordingModeRef.current = null
      }
    })
  }

  const stopRecording = async () => {
    if (!isRecordingRef.current) return

    if (recordingModeRef.current === 'camera') {
      stopCameraFallbackRecording()
      return
    }

    const recorder = replayRecorderRef.current
    if (!recorder) return

    setRecording(false)
    isRecordingRef.current = false
    recordingModeRef.current = null
    setReplayProcessing(true)
    setReplayProgress({
      detail: '第 1/3 步：正在整理最后画面，请保持当前页面开启。',
      label: '正在生成回放',
      percent: 12,
      status: 'processing'
    })
    try {
      const res = await recorder.stop((progress: ArcadeReplayFinalizeProgress) => {
        setReplayProgress({
          detail: `${progress.percent < 70 ? '第 1/3 步' : '第 2/3 步'}：${progress.label}。`,
          label: '正在生成回放',
          percent: progress.percent,
          status: 'processing'
        })
      })
      if (res?.tempVideoPath) {
        await storeGeneratedReplay(res)
      } else {
        setReplayProgress({
          detail: recordedVideo
            ? '本次回放没有生成成功，上一次回放仍然可用。'
            : '本次回放没有生成成功，请重新录制。',
          label: '回放生成失败',
          percent: 0,
          status: 'failed'
        })
        Taro.showToast({ title: '回放生成失败，已尝试停止录制', icon: 'none' })
      }
    } catch (error: any) {
      setReplayProgress({
        detail: recordedVideo
          ? '本次生成超时或中断，上一次回放仍然可用。'
          : '生成超时或中断，请重新录制并保持当前页面开启。',
        label: '回放生成失败',
        percent: 0,
        status: 'failed'
      })
      Taro.showToast({ title: error?.message || '停止回放录制失败', icon: 'none' })
    } finally {
      await recorder.destroy()
      replayRecorderRef.current = null
      setReplayProcessing(false)
    }
  }

  const resetForNewGame = () => {
    setScore(0)
    scoreRef.current = 0
    setElapsedMs(0)
    elapsedMsRef.current = 0
    setPipes([])
    pipesRef.current = []
    nextPipeIdRef.current = 1
    setPullCount(0)
    pullCountRef.current = 0
    setRankingResult(null)
    setRankingSyncState('idle')
    roundSyncStartedRef.current = false
    setFeedback(null)
    lastReplayCaptureAtRef.current = 0
    lastPullTriggerAtRef.current = 0
    setMotionEnergy(0)
    setLives(MAX_LIVES)
    livesRef.current = MAX_LIVES
    lastPipeSpawnAtRef.current = Date.now()
    trackingPausedAtRef.current = 0
  }

  const startGame = async (withRecording: boolean) => {
    if (cameraError) {
      Taro.showToast({ title: '当前设备暂不支持试玩', icon: 'none' })
      return
    }
    if (!trackingLockedRef.current || !trackingActiveRef.current) {
      Taro.showToast({ title: '请先让头部进入画面并保持稳定', icon: 'none' })
      return
    }
    if (replayProcessing || replayRecorderRef.current) {
      Taro.showToast({ title: '回放还在生成中，请稍等', icon: 'none' })
      return
    }
    if (gameStartingRef.current) return
    gameStartingRef.current = true
    gameRoundRef.current += 1
    resetForNewGame()
    gameSessionIdRef.current = null
    try {
      const session = await motionGameLeaderboardService.startSession('pullup-rush')
      gameSessionIdRef.current = session?.sessionId || null
      if (session) {
        setBestScore(session.bestScore)
        bestScoreRef.current = session.bestScore
      }
      if (!session) {
        Taro.showToast({ title: '可继续试玩，本局暂不计入在线榜', icon: 'none' })
      }
      const startedAt = Date.now()
      gameWallStartedAtRef.current = startedAt
      gameStartedAtRef.current = startedAt
      setGameStatus('playing')
      gameStatusRef.current = 'playing'
      if (withRecording) {
        void beginRecording()
      }
    } finally {
      gameStartingRef.current = false
    }
  }

  const ensureReplayAvailable = async () => {
    if (!recordedVideo?.tempVideoPath) return false
    if (await fileExists(recordedVideo.tempVideoPath)) return true

    const cached = readCachedReplay()
    if (cached?.tempVideoPath === recordedVideo.tempVideoPath) {
      Taro.removeStorageSync(getReplayCacheKey())
    }
    setRecordedVideo(null)
    setReplayProgress({
      detail: '本地回放文件已失效，请重新录制。',
      label: '回放不可用',
      percent: 0,
      status: 'failed'
    })
    Taro.showToast({ title: '回放文件已失效，请重新录制', icon: 'none' })
    return false
  }

  const handlePreviewVideo = async () => {
    if (recording || replayProcessing || videoSaving) return
    if (!(await ensureReplayAvailable()) || !recordedVideo) return
    try {
      await Taro.previewMedia({
        current: 0,
        sources: [{ type: 'video', url: recordedVideo.tempVideoPath }]
      })
    } catch (error: any) {
      Taro.showToast({ title: error?.errMsg || '打开回放失败', icon: 'none' })
    }
  }

  const handleSaveVideo = async () => {
    if (!recordedVideo?.tempVideoPath || recording || replayProcessing || videoSaving) return
    if (!(await ensureReplayAvailable())) return
    try {
      setVideoSaving(true)
      setReplayProgress({
        detail: '正在写入系统相册，微信会在完成后返回结果。',
        label: '正在保存到相册',
        percent: 90,
        status: 'saving'
      })
      await Taro.saveVideoToPhotosAlbum({
        filePath: recordedVideo.tempVideoPath
      })
      setReplayProgress({
        detail: '已保存到系统相册，小程序本地回放也会继续保留。',
        label: '回放已保存',
        percent: 100,
        status: 'ready'
      })
      Taro.showToast({
        title: recordedVideo.kind === 'composite' ? '回放视频已存到相册' : '原视频已存到相册',
        icon: 'success'
      })
    } catch (error: any) {
      const denied = String(error?.errMsg || '').includes('auth deny')
      if (denied) {
        Taro.showToast({ title: '请先允许保存到相册', icon: 'none' })
      } else {
        Taro.showToast({ title: error?.errMsg || '保存失败', icon: 'none' })
      }
      setReplayProgress({
        detail: '保存到系统相册未完成，本地回放仍可查看，可稍后重试。',
        label: '回放仍在本地',
        percent: 100,
        status: 'ready'
      })
    } finally {
      setVideoSaving(false)
    }
  }

  const statusText =
    gameStatus === 'playing'
      ? '冲刺中'
      : gameStatus === 'ended'
        ? '已结束'
        : '待开始'

  const recordingText = replayProcessing
    ? '生成回放中'
    : recording
      ? elapsedMs >= REPLAY_DURATION_SECONDS * 1000
        ? `回放已录满 ${REPLAY_DURATION_SECONDS / 60} 分钟`
        : '引体回放录制中'
      : recordedVideo
        ? '回放已就绪'
        : '未录像'

  const visibleReplayProgress = replayProgress?.status === 'recording'
    ? elapsedMs >= REPLAY_DURATION_SECONDS * 1000
      ? {
          ...replayProgress,
          detail: `已保留本局前 ${REPLAY_DURATION_SECONDS / 60} 分钟，游戏可继续；结束本局后会自动生成。`,
          label: `已录满 ${REPLAY_DURATION_SECONDS / 60} 分钟`,
          percent: 100
        }
      : {
        ...replayProgress,
        detail: `已录制 ${formatSeconds(elapsedMs)} 秒，最多保留前 ${REPLAY_DURATION_SECONDS / 60} 分钟。`,
        percent: Math.min(100, Math.round((elapsedMs / (REPLAY_DURATION_SECONDS * 1000)) * 100))
      }
    : replayProgress

  return (
    <PageThemeRoot>
      <View className={`motion-arcade-page motion-arcade-page--pullup theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content'>
            <View className='intro-card'>
              <Text className='intro-kicker'>PULLUP FLIGHT</Text>
              <Text className='intro-title'>头部带小鸟穿过障碍</Text>
              <View className='intro-tags'>
                <Text className='intro-tag'>头部实时跟随</Text>
                <Text className='intro-tag'>上拉动作计数</Text>
                <Text className='intro-tag'>无限生存</Text>
                <Text className='intro-tag'>支持回放</Text>
              </View>
            </View>

            <View className='camera-shell'>
              <View className='camera-stage pullup-stage'>
                <Camera
                  className='camera-preview'
                  devicePosition={USER_FACING_CAMERA.devicePosition}
                  flash='off'
                  mode='normal'
                  frameSize={USER_FACING_CAMERA.frameSize}
                  resolution={USER_FACING_CAMERA.resolution}
                  onInitDone={() => {
                    setCameraReady(true)
                    setCameraError('')
                    Taro.nextTick(() => {
                      Taro.createSelectorQuery()
                        .select('.camera-stage')
                        .boundingClientRect((rect: any) => {
                          const stageSize = {
                            width: Number(rect?.width || 0),
                            height: Number(rect?.height || 0)
                          }
                          cameraStageSizeRef.current = stageSize
                          companionMetricsRef.current = getHeadCompanionMetrics(
                            stageSize,
                            Taro.getWindowInfo().windowWidth
                          )
                        })
                        .exec()
                    })
                  }}
                  onError={(event: any) => {
                    const message = event?.detail?.errMsg || '相机启动失败，请检查权限。'
                    setCameraError(message)
                  }}
                />
                <View className='stage-mask' />
                <View className='stage-grid' />

                <View className='stage-hud'>
                  <View className='hud-pill'>
                    <Text className='hud-pill-text'>状态 {statusText}</Text>
                  </View>
                  <View className={`hud-pill hud-pill--accent ${recording || replayProcessing ? 'alert' : ''}`}>
                    <Text className='hud-pill-text'>{recordingText}</Text>
                  </View>
                </View>

                <View className='stage-objective'>
                  <Text className='stage-objective-text'>上下移动头部，带小鸟穿过通道</Text>
                  <Text className='stage-objective-text stage-objective-text--bad'>小鸟始终在脸旁，不遮挡表情</Text>
                </View>

                {headLock.visible ? (
                  <View
                    className={`head-lock-indicator ${headLock.estimated ? 'head-lock-indicator--estimated' : ''}`}
                    style={{
                      height: `${clamp(headLock.radiusY * 2, 0.12, 0.3) * 100}%`,
                      left: `${headLock.x * 100}%`,
                      top: `${headLock.y * 100}%`,
                      width: `${clamp(headLock.radiusX * 2, 0.1, 0.24) * 100}%`
                    }}
                  >
                    <Text className='head-lock-label'>已锁定</Text>
                  </View>
                ) : null}

                {pipes.map((pipe) => {
                  const topHeight = pipe.gapY
                  const bottomTop = pipe.gapY + pipe.gapHeight
                  const bottomHeight = 1 - bottomTop
                  return (
                    <View key={pipe.id}>
                      <View
                        className='pullup-pipe'
                        style={{
                          height: `${topHeight * 100}%`,
                          left: `${pipe.x * 100}%`,
                          width: `${pipe.width * 100}%`,
                          top: '0%'
                        }}
                      />
                      <View
                        className='pullup-pipe pullup-pipe--bottom'
                        style={{
                          height: `${bottomHeight * 100}%`,
                          left: `${pipe.x * 100}%`,
                          width: `${pipe.width * 100}%`,
                          top: `${bottomTop * 100}%`
                        }}
                      />
                    </View>
                  )
                })}

                {headLock.visible ? (
                  <View
                    className='player-avatar head-bird pullup-bird'
                    style={{
                      left: `${playerPosition.x * 100}%`,
                      top: `${playerPosition.y * 100}%`
                    }}
                  >
                    <View className='head-bird-wing' />
                    <View className='head-bird-eye' />
                    <View className='head-bird-beak' />
                  </View>
                ) : null}

                {feedback ? (
                  <View key={feedback.id} className={`stage-feedback stage-feedback--${feedback.tone}`}>
                    <Text className='stage-feedback-text'>{feedback.text}</Text>
                  </View>
                ) : null}

                <View className='pullup-gap-line' />

                {!cameraReady && !cameraError ? (
                  <View className='stage-note'>
                    <Text className='stage-note-title'>正在准备摄像头</Text>
                    <Text className='stage-note-desc'>允许相机权限后，我们会用你向上的动作触发上冲。</Text>
                  </View>
                ) : null}

                {cameraReady && !cameraError && trackingRuntimeState === 'unavailable' ? (
                  <View className='stage-error'>
                    <Text className='stage-note-title'>当前设备无法启动头部识别</Text>
                    <Text className='stage-note-desc'>{trackingRuntimeDetail}</Text>
                  </View>
                ) : null}

                {cameraReady && !cameraError && trackingRuntimeState !== 'unavailable' && !trackingLocked ? (
                  <View className='stage-note'>
                    <Text className='stage-note-title'>
                      {trackingRuntimeState === 'initializing' ? '正在启动头部识别' : '请让脸完整进入画面'}
                    </Text>
                    <Text className='stage-note-desc'>
                      {trackingRuntimeState === 'initializing'
                        ? trackingRuntimeDetail
                        : '只需脸部出镜，无需全身出镜；绿色框跟随头部后即可开始。'}
                    </Text>
                  </View>
                ) : null}

                {cameraReady && !cameraError && trackingLocked && !trackingActive ? (
                  <View className='stage-note'>
                    <Text className='stage-note-title'>头部暂时丢失，游戏已暂停</Text>
                    <Text className='stage-note-desc'>回到原锁定区域后会自动继续；离开过久则重新锁定。</Text>
                  </View>
                ) : null}

                {cameraError ? (
                  <View className='stage-error'>
                    <Text className='stage-note-title'>相机暂时不可用</Text>
                    <Text className='stage-note-desc'>{cameraError}</Text>
                  </View>
                ) : null}

              </View>
            </View>

            <View className='stats-card'>
              <Text className='section-kicker'>实时状态</Text>
              <View className='stats-grid'>
                <View className='stat-item'>
                  <Text className='stat-label'>穿过障碍</Text>
                  <Text className='stat-value'>{score}</Text>
                </View>
                <View className='stat-item'>
                  <Text className='stat-label'>坚持秒数</Text>
                  <Text className='stat-value'>{formatSeconds(elapsedMs)}</Text>
                </View>
                <View className='stat-item'>
                  <Text className='stat-label'>历史最好</Text>
                  <Text className='stat-value'>{bestScore}</Text>
                </View>
              </View>

              <View className='pullup-stats-row'>
                <View className='pullup-mini-card'>
                  <Text className='pullup-mini-label'>上拉触发</Text>
                  <Text className='pullup-mini-value'>{pullCount}</Text>
                </View>
                <View className='pullup-mini-card'>
                  <Text className='pullup-mini-label'>剩余命数</Text>
                  <Text className='pullup-mini-value'>{lives}</Text>
                </View>
              </View>

              <View className='meter-wrap'>
                <View className='meter-header'>
                  <Text className='meter-label'>动作幅度</Text>
                  <Text className='meter-value'>{formatPercent(motionEnergy)}%</Text>
                </View>
                <View className='meter-track'>
                  <View className='meter-fill' style={{ width: `${formatPercent(motionEnergy)}%` }} />
                </View>
              </View>
            </View>

            {gameStatus === 'ended' ? (
              <MotionGameResultPanel
                actionCount={pullCount}
                actionLabel='引体次数'
                elapsedMs={elapsedMs}
                ranking={rankingResult}
                score={score}
                syncState={rankingSyncState}
                onReplay={() => { void startGame(false) }}
                onViewRanking={() => {
                  Taro.navigateTo({
                    url: `/discovery/ranking/detail?id=${rankingResult?.templateId || MOTION_GAME_TEMPLATE_IDS['pullup-rush']}`
                  })
                }}
              />
            ) : null}

            <View className='controls-card'>
              <Text className='section-kicker'>控制台</Text>

              <View className='controls-grid'>
                <View
                  className={`btn-primary ${cameraError || recording || replayProcessing || !trackingActive ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !recording && !replayProcessing && trackingActive) void startGame(false)
                  }}
                >
                  <Text className='btn-primary-text'>{gameStatus === 'playing' ? '重新开始' : '开始试玩'}</Text>
                </View>

                <View
                  className={`btn-secondary ${cameraError || recording || replayProcessing || !trackingActive ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !recording && !replayProcessing && trackingActive) void startGame(true)
                  }}
                >
                  <Text className='btn-secondary-text'>开始试玩并录回放</Text>
                </View>

                <View
                  className={`btn-secondary ${recording ? '' : 'disabled'}`}
                  onClick={() => {
                    if (recording) {
                      void stopRecording()
                    }
                  }}
                >
                  <Text className='btn-secondary-text'>停止录制</Text>
                </View>

                <View
                  className={`btn-secondary ${recordedVideo?.tempVideoPath && !recording && !replayProcessing && !videoSaving ? '' : 'disabled'}`}
                  onClick={() => {
                    if (recordedVideo?.tempVideoPath && !recording && !replayProcessing && !videoSaving) {
                      void handlePreviewVideo()
                    }
                  }}
                >
                  <Text className='btn-secondary-text'>观看回放</Text>
                </View>

                <View
                  className={`btn-primary btn-wide ${recordedVideo?.tempVideoPath && !recording && !replayProcessing && !videoSaving ? '' : 'disabled'}`}
                  onClick={() => {
                    if (recordedVideo?.tempVideoPath && !recording && !replayProcessing && !videoSaving) {
                      void handleSaveVideo()
                    }
                  }}
                >
                  <Text className='btn-primary-text'>{videoSaving ? '正在保存到相册' : '保存到系统相册'}</Text>
                </View>
              </View>

              {visibleReplayProgress ? (
                <View className={`replay-progress-card replay-progress-card--${visibleReplayProgress.status}`}>
                  <View className='replay-progress-header'>
                    <Text className='replay-progress-label'>{visibleReplayProgress.label}</Text>
                    <Text className='replay-progress-value'>{visibleReplayProgress.percent}%</Text>
                  </View>
                  <View className='replay-progress-track'>
                    <View
                      className='replay-progress-fill'
                      style={{ width: `${visibleReplayProgress.percent}%` }}
                    />
                  </View>
                  <Text className='replay-progress-detail'>{visibleReplayProgress.detail}</Text>
                </View>
              ) : null}

              <Text className='direction-note'>回放在本机生成，不需要从服务器下载；生成期间请保持当前页面开启。前置摄像头、头部跟踪和最终回放始终使用同一方向；合成回放为 360 × 480、12 fps 的流畅压缩画质。</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </PageThemeRoot>
  )
}
