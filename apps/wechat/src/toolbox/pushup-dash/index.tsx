import { useEffect, useMemo, useRef, useState } from 'react'
import { usePageEnterTrace } from '@/utils/pageTrace'
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
import { MotionArcadeReplayRecorder, type ArcadeReplayItem } from '../games/arcadeReplayRecorder'
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

type DashWall = {
  gapHeight: number
  gapY: number
  id: number
  passed: boolean
  width: number
  x: number
}

type GameStatus = 'idle' | 'playing' | 'ended'

type HeadLockState = {
  estimated: boolean
  radiusX: number
  radiusY: number
  visible: boolean
  x: number
  y: number
}

type RecordedVideo = {
  kind?: 'camera' | 'composite'
  tempThumbPath?: string
  tempVideoPath: string
}

type RepPhase = 'down' | 'idle' | 'up'

const GAME_TICK_MS = 32
const REPLAY_DURATION_SECONDS = 35
const REPLAY_FPS = 12
const REPLAY_FRAME_INTERVAL_MS = 1000 / REPLAY_FPS
const WALL_SPEED = 0.012
const WALL_SPAWN_MS = 1180
const DASH_DURATION_MS = 720
const TRACKING_UI_INTERVAL_MS = 64
const MAX_LIVES = 3

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatSeconds(ms: number) {
  return Math.max(0, Math.floor(ms / 1000))
}

function formatPercent(value: number) {
  return Math.round(clamp(value, 0, 1) * 100)
}

function buildWall(id: number): DashWall {
  return {
    gapHeight: 0.3 + Math.random() * 0.06,
    gapY: 0.22 + Math.random() * 0.32,
    id,
    passed: false,
    width: 0.16,
    x: 1.08
  }
}

export default function PushupDashPage() {
  usePageEnterTrace()

  const { effectiveTheme } = useTheme()
  const cameraContextRef = useRef<any>(null)
  const replayRecorderRef = useRef<MotionArcadeReplayRecorder | null>(null)
  const frameListenerRef = useRef<any>(null)
  const lastReplayCaptureAtRef = useRef(0)
  const repPhaseRef = useRef<RepPhase>('idle')
  const repStartedAtRef = useRef(0)
  const repDownYRef = useRef(0)
  const gameStatusRef = useRef<GameStatus>('idle')
  const dashUntilRef = useRef(0)
  const wallsRef = useRef<DashWall[]>([])
  const nextWallIdRef = useRef(1)
  const lastWallSpawnAtRef = useRef(0)
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
  const scoreRef = useRef(0)
  const elapsedMsRef = useRef(0)
  const repCountRef = useRef(0)
  const bestScoreRef = useRef(0)
  const livesRef = useRef(MAX_LIVES)
  const gameStartedAtRef = useRef(0)
  const gameWallStartedAtRef = useRef(0)
  const gameSessionIdRef = useRef<string | null>(null)
  const gameRoundRef = useRef(0)
  const roundSyncStartedRef = useRef(false)
  const gameStartingRef = useRef(false)
  const playerPositionRef = useRef({ x: 0.32, y: 0.52 })

  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [motionEnergy, setMotionEnergy] = useState(0)
  const [dashActive, setDashActive] = useState(false)
  const [playerPosition, setPlayerPosition] = useState({ x: 0.32, y: 0.52 })
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [recording, setRecording] = useState(false)
  const [replayProcessing, setReplayProcessing] = useState(false)
  const [videoSaving, setVideoSaving] = useState(false)
  const [recordedVideo, setRecordedVideo] = useState<RecordedVideo | null>(null)
  const [walls, setWalls] = useState<DashWall[]>([])
  const [lives, setLives] = useState(MAX_LIVES)
  const [repCount, setRepCount] = useState(0)
  const [rankingResult, setRankingResult] = useState<MotionGameRankingResult | null>(null)
  const [rankingSyncState, setRankingSyncState] = useState<'idle' | 'syncing' | 'synced' | 'local-only'>('idle')
  const [phaseLabel, setPhaseLabel] = useState('等待下压')
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
        title: '我在 CoachLink 试玩了俯卧撑突围小游戏',
        path: buildSharePath('/toolbox/pushup-dash/index')
      }),
    []
  )

  useShareAppMessage(() => sharePayload)
  useShareTimeline(() => createTimelinePayload(sharePayload))

  useEffect(() => {
    openCoachLinkShareMenu()
  }, [])

  useEffect(() => {
    wallsRef.current = walls
  }, [walls])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    elapsedMsRef.current = elapsedMs
  }, [elapsedMs])

  useEffect(() => {
    bestScoreRef.current = bestScore
  }, [bestScore])

  useEffect(() => {
    livesRef.current = lives
  }, [lives])

  useEffect(() => {
    gameStatusRef.current = gameStatus
  }, [gameStatus])

  const beginDashFromRep = () => {
    const now = Date.now()
    dashUntilRef.current = now + DASH_DURATION_MS
    setDashActive(true)
    setRepCount((prevCount) => {
      const nextCount = prevCount + 1
      repCountRef.current = nextCount
      return nextCount
    })
    setFeedback({
      id: ++feedbackIdRef.current,
      text: '完整动作，推进！',
      tone: 'action'
    })
    vibrateForArcadeFeedback('action')
  }

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
        lastWallSpawnAtRef.current += pausedFor
        if (repStartedAtRef.current) repStartedAtRef.current += pausedFor
        if (dashUntilRef.current) dashUntilRef.current += pausedFor
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

        if (gameStatusRef.current !== 'playing' || !snapshot.locked) return
        const directionThreshold = snapshot.source === 'pose' ? 0.008 : 0.016
        const energyThreshold = snapshot.source === 'pose' ? 0.04 : 0.1
        const travelThreshold = snapshot.source === 'pose' ? 0.026 : 0.04

        if (
          repPhaseRef.current === 'idle'
          && snapshot.energy >= energyThreshold
          && snapshot.velocityY >= directionThreshold
        ) {
          repPhaseRef.current = 'down'
          repStartedAtRef.current = now
          repDownYRef.current = snapshot.y
          setPhaseLabel('已下压，准备撑起')
          return
        }

        if (repPhaseRef.current === 'down') {
          repDownYRef.current = Math.max(repDownYRef.current, snapshot.y)
          if (
            now - repStartedAtRef.current >= 120
            && snapshot.velocityY <= -directionThreshold
            && repDownYRef.current - snapshot.y >= travelThreshold
          ) {
            repPhaseRef.current = 'up'
            repStartedAtRef.current = now
            beginDashFromRep()
            setPhaseLabel('完整俯卧撑，已推进')
          } else if (now - repStartedAtRef.current > 1800) {
            repPhaseRef.current = 'idle'
            setPhaseLabel('动作幅度不足，请重新下压')
          }
          return
        }

        if (repPhaseRef.current === 'up' && now - repStartedAtRef.current >= 360) {
          repPhaseRef.current = 'idle'
          setPhaseLabel('等待下一次下压')
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
            const replayItems: ArcadeReplayItem[] = wallsRef.current.flatMap((wall) => {
              const topHeight = wall.gapY
              const bottomStart = wall.gapY + wall.gapHeight
              const bottomHeight = Math.max(0, 1 - bottomStart)
              return [
                {
                  height: topHeight,
                  shape: 'rect',
                  size: topHeight,
                  type: 'bad',
                  width: wall.width,
                  x: wall.x,
                  y: topHeight / 2
                },
                {
                  height: bottomHeight,
                  shape: 'rect',
                  size: bottomHeight,
                  type: 'bad',
                  width: wall.width,
                  x: wall.x,
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
              replayFooterLabel: '俯卧撑突围回放',
              score: scoreRef.current,
              timerMode: 'elapsed',
              timeLeftMs: elapsedMsRef.current,
              visualKey: 'pushup'
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
    const actionCount = repCountRef.current
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
          gameKey: 'pushup-dash',
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
      gameKey: 'pushup-dash',
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

  const endRound = () => {
    gameStatusRef.current = 'ended'
    setGameStatus('ended')
    void syncFinishedRound()
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
      setElapsedMs(elapsed)
      elapsedMsRef.current = elapsed

      const nextDashActive = now <= dashUntilRef.current
      setDashActive(nextDashActive)
      const currentPlayer = playerPositionRef.current
      const metrics = companionMetricsRef.current
      let nextWalls = wallsRef.current
        .map((wall) => ({ ...wall, x: wall.x - WALL_SPEED }))
        .filter((wall) => wall.x + wall.width / 2 > -0.16)

      if (now - lastWallSpawnAtRef.current >= WALL_SPAWN_MS) {
        nextWalls = [...nextWalls, buildWall(nextWallIdRef.current++)]
        lastWallSpawnAtRef.current = now
      }

      let collidedWallId: number | null = null
      let passedCount = 0
      const outsideStage =
        currentPlayer.y - metrics.hitboxHalfHeight <= 0
        || currentPlayer.y + metrics.hitboxHalfHeight >= 1

      for (const wall of nextWalls) {
        const topHeight = wall.gapY
        const bottomStart = wall.gapY + wall.gapHeight
        if (
          headCompanionHitsRect(currentPlayer, metrics, {
            height: topHeight,
            width: wall.width,
            x: wall.x,
            y: topHeight / 2
          })
          || headCompanionHitsRect(currentPlayer, metrics, {
            height: 1 - bottomStart,
            width: wall.width,
            x: wall.x,
            y: bottomStart + (1 - bottomStart) / 2
          })
        ) {
          collidedWallId = wall.id
          break
        }

        if (!wall.passed && wall.x + wall.width / 2 < currentPlayer.x) {
          wall.passed = true
          passedCount += 1
        }
      }

      if (outsideStage || collidedWallId !== null) {
        const nextLives = Math.max(0, livesRef.current - 1)
        nextWalls = outsideStage
          ? []
          : nextWalls.filter((wall) => wall.id !== collidedWallId)
        wallsRef.current = nextWalls
        setWalls(nextWalls)
        setFeedback({
          id: ++feedbackIdRef.current,
          text: outsideStage ? '小鸟触边 -1 命' : '小鸟撞管道 -1 命',
          tone: 'bad'
        })
        vibrateForArcadeFeedback('bad')
        setLives(nextLives)
        livesRef.current = nextLives
        if (nextLives <= 0) {
          clearInterval(timer)
          endRound()
        }
        return
      }

      if (passedCount > 0) {
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

      wallsRef.current = nextWalls
      setWalls(nextWalls)
    }, GAME_TICK_MS)

    return () => clearInterval(timer)
  }, [gameStatus])

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
            setRecordedVideo({
              ...res,
              kind: 'camera'
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
        console.warn('俯卧撑突围合成回放录制不可用:', error)
      }
    }

    beginCameraFallbackRecording()
  }

  const stopCameraFallbackRecording = () => {
    if (!cameraContextRef.current) return

    cameraContextRef.current.stopRecord({
      compressed: true,
      success: (res: RecordedVideo) => {
        setRecordedVideo({
          ...res,
          kind: 'camera'
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
    try {
      const res = await recorder.stop()
      if (res?.tempVideoPath) {
        setRecordedVideo(res)
      } else {
        Taro.showToast({ title: '回放生成失败，已尝试停止录制', icon: 'none' })
      }
    } catch (error: any) {
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
    setWalls([])
    wallsRef.current = []
    nextWallIdRef.current = 1
    setRepCount(0)
    repCountRef.current = 0
    setRankingResult(null)
    setRankingSyncState('idle')
    roundSyncStartedRef.current = false
    setFeedback(null)
    lastReplayCaptureAtRef.current = 0
    setLives(MAX_LIVES)
    livesRef.current = MAX_LIVES
    dashUntilRef.current = 0
    setDashActive(false)
    repPhaseRef.current = 'idle'
    repDownYRef.current = 0
    setPhaseLabel('等待下压')
    setMotionEnergy(0)
    trackingPausedAtRef.current = 0
    lastWallSpawnAtRef.current = Date.now()
  }

  const startGame = async (withRecording: boolean) => {
    if (cameraError) {
      Taro.showToast({ title: '当前设备暂不支持试玩', icon: 'none' })
      return
    }
    if (!trackingLockedRef.current || !trackingActiveRef.current) {
      Taro.showToast({ title: '请先让头部进入画面并等待锁定', icon: 'none' })
      return
    }
    if (replayProcessing) {
      Taro.showToast({ title: '回放还在生成中，请稍等', icon: 'none' })
      return
    }
    if (gameStartingRef.current) return
    gameStartingRef.current = true
    gameRoundRef.current += 1
    resetForNewGame()
    setRecordedVideo(null)
    gameSessionIdRef.current = null
    try {
      const session = await motionGameLeaderboardService.startSession('pushup-dash')
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

  const handleSaveVideo = async () => {
    if (!recordedVideo?.tempVideoPath || videoSaving) return
    try {
      setVideoSaving(true)
      await Taro.saveVideoToPhotosAlbum({
        filePath: recordedVideo.tempVideoPath
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
    } finally {
      setVideoSaving(false)
    }
  }

  const statusText =
    gameStatus === 'playing'
      ? '突围中'
      : gameStatus === 'ended'
        ? '已结束'
        : '待开始'

  const recordingText = replayProcessing
    ? '生成回放中'
    : recording
      ? '俯卧撑回放录制中'
      : recordedVideo?.kind === 'composite'
        ? '回放已生成'
        : '未录像'

  return (
    <PageThemeRoot>
      <View className={`motion-arcade-page motion-arcade-page--pushup theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content'>
            <View className='intro-card'>
              <Text className='intro-kicker'>PUSHUP DRIVE</Text>
              <Text className='intro-title'>俯卧起伏，带小鸟穿过障碍</Text>
              <View className='intro-tags'>
                <Text className='intro-tag'>头部实时跟随</Text>
                <Text className='intro-tag'>上下管道穿越</Text>
                <Text className='intro-tag'>无限生存</Text>
                <Text className='intro-tag'>支持回放</Text>
              </View>
            </View>

            <View className='camera-shell'>
              <View className='camera-stage pushup-stage'>
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
                  <Text className='stage-objective-text stage-objective-text--bad'>完整俯卧撑会点亮冲刺反馈</Text>
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

                {walls.map((wall) => {
                  const topHeight = wall.gapY
                  const bottomTop = wall.gapY + wall.gapHeight
                  const bottomHeight = 1 - bottomTop
                  return (
                    <View key={wall.id}>
                      <View
                        className='pushup-wall'
                        style={{
                          height: `${topHeight * 100}%`,
                          left: `${wall.x * 100}%`,
                          width: `${wall.width * 100}%`,
                          top: '0%'
                        }}
                      />
                      <View
                        className='pushup-wall pushup-wall--bottom'
                        style={{
                          height: `${bottomHeight * 100}%`,
                          left: `${wall.x * 100}%`,
                          width: `${wall.width * 100}%`,
                          top: `${bottomTop * 100}%`
                        }}
                      />
                    </View>
                  )
                })}

                {headLock.visible ? (
                  <View
                    className={`player-avatar head-bird pushup-runner ${dashActive ? 'head-bird--boost' : ''}`}
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

                {!cameraReady && !cameraError ? (
                  <View className='stage-note'>
                    <Text className='stage-note-title'>正在准备摄像头</Text>
                    <Text className='stage-note-desc'>允许相机权限后，我们会监测你“下压再撑起”的完整节奏。</Text>
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
                  <Text className='stat-label'>穿越通道</Text>
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
                  <Text className='pullup-mini-label'>完整次数</Text>
                  <Text className='pullup-mini-value'>{repCount}</Text>
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

              <View className='pushup-phase-card'>
                <Text className='pushup-phase-label'>当前识别阶段</Text>
                <Text className='pushup-phase-value'>{phaseLabel}</Text>
              </View>
            </View>

            {gameStatus === 'ended' ? (
              <MotionGameResultPanel
                actionCount={repCount}
                actionLabel='俯卧撑次数'
                elapsedMs={elapsedMs}
                ranking={rankingResult}
                score={score}
                syncState={rankingSyncState}
                onReplay={() => { void startGame(false) }}
                onViewRanking={() => {
                  Taro.navigateTo({
                    url: `/discovery/ranking/detail?id=${rankingResult?.templateId || MOTION_GAME_TEMPLATE_IDS['pushup-dash']}`
                  })
                }}
              />
            ) : null}

            <View className='controls-card'>
              <Text className='section-kicker'>控制台</Text>

              <View className='controls-grid'>
                <View
                  className={`btn-primary ${cameraError || replayProcessing || !trackingActive ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !replayProcessing && trackingActive) void startGame(false)
                  }}
                >
                  <Text className='btn-primary-text'>{gameStatus === 'playing' ? '重新开始' : '开始试玩'}</Text>
                </View>

                <View
                  className={`btn-secondary ${cameraError || replayProcessing || !trackingActive ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !replayProcessing && trackingActive) void startGame(true)
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
                  className={`btn-primary ${recordedVideo?.tempVideoPath && !replayProcessing ? '' : 'disabled'}`}
                  onClick={() => {
                    if (recordedVideo?.tempVideoPath && !replayProcessing) {
                      void handleSaveVideo()
                    }
                  }}
                >
                  <Text className='btn-primary-text'>{videoSaving ? '正在保存' : '保存回放视频'}</Text>
                </View>
              </View>
              <Text className='direction-note'>前置摄像头、头部跟踪和最终回放始终使用同一方向；合成回放为 360 × 480、12 fps 的流畅压缩画质。</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </PageThemeRoot>
  )
}
