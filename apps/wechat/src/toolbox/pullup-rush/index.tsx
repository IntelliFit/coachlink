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
import { MotionArcadeReplayRecorder, type ArcadeReplayItem } from '../games/arcadeReplayRecorder'
import {
  type ArcadeFeedback,
  vibrateForArcadeFeedback
} from '../games/arcadeFeedback'
import { BodyPointTracker } from '../games/bodyPointTracker'
import { projectCameraPointToStage, USER_FACING_CAMERA } from '../cameraTracking'
import '../games/motionArcade.scss'
import './index.scss'

type GameStatus = 'idle' | 'playing' | 'ended'

type RecordedVideo = {
  kind?: 'camera' | 'composite'
  tempThumbPath?: string
  tempVideoPath: string
}

type MotionSnapshot = {
  energy: number
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

const GAME_DURATION_MS = 30000
const GAME_TICK_MS = 32
const REPLAY_DURATION_SECONDS = 35
const REPLAY_FPS = 12
const REPLAY_FRAME_INTERVAL_MS = 1000 / REPLAY_FPS
const PLAYER_X = 0.32
const PLAYER_RADIUS = 0.058
const GRAVITY = 0.002
const JUMP_VELOCITY = -0.034
const PIPE_SPEED = 0.012
const PIPE_SPAWN_MS = 1180
const PULL_TRIGGER_COOLDOWN_MS = 260
const MAX_LIVES = 2

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000))
}

function formatPercent(value: number) {
  return Math.round(clamp(value, 0, 1) * 100)
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

function circleHitsRect(
  circleX: number,
  circleY: number,
  radius: number,
  rectCenterX: number,
  rectCenterY: number,
  rectWidth: number,
  rectHeight: number
) {
  const dx = Math.abs(circleX - rectCenterX)
  const dy = Math.abs(circleY - rectCenterY)
  const halfWidth = rectWidth / 2
  const halfHeight = rectHeight / 2

  if (dx > halfWidth + radius || dy > halfHeight + radius) return false
  if (dx <= halfWidth || dy <= halfHeight) return true

  const cornerDx = dx - halfWidth
  const cornerDy = dy - halfHeight
  return cornerDx * cornerDx + cornerDy * cornerDy <= radius * radius
}

export default function PullupRushPage() {
  const { effectiveTheme } = useTheme()
  const cameraContextRef = useRef<any>(null)
  const replayRecorderRef = useRef<MotionArcadeReplayRecorder | null>(null)
  const frameListenerRef = useRef<any>(null)
  const lastReplayCaptureAtRef = useRef(0)
  const motionRef = useRef<MotionSnapshot>({ energy: 0, x: 0.5, y: 0.7 })
  const gameStatusRef = useRef<GameStatus>('idle')
  const headLockedRef = useRef(false)
  const headLockLostAtRef = useRef(0)
  const lastPullTriggerAtRef = useRef(0)
  const pendingPullRef = useRef(false)
  const pipesRef = useRef<PipePair[]>([])
  const nextPipeIdRef = useRef(1)
  const lastPipeSpawnAtRef = useRef(0)
  const isRecordingRef = useRef(false)
  const feedbackIdRef = useRef(0)
  const cameraStageSizeRef = useRef({ width: 0, height: 0 })
  const recordingModeRef = useRef<'camera' | 'composite' | null>(null)
  const gameStartedAtRef = useRef(0)
  const scoreRef = useRef(0)
  const timeLeftMsRef = useRef(GAME_DURATION_MS)
  const playerYRef = useRef(0.52)
  const playerVelocityRef = useRef(0)
  const bestScoreRef = useRef(0)
  const livesRef = useRef(MAX_LIVES)

  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
  const [headLocked, setHeadLocked] = useState(false)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [motionEnergy, setMotionEnergy] = useState(0)
  const [playerY, setPlayerY] = useState(0.52)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS)
  const [recording, setRecording] = useState(false)
  const [replayProcessing, setReplayProcessing] = useState(false)
  const [videoSaving, setVideoSaving] = useState(false)
  const [recordedVideo, setRecordedVideo] = useState<RecordedVideo | null>(null)
  const [pipes, setPipes] = useState<PipePair[]>([])
  const [lives, setLives] = useState(MAX_LIVES)
  const [pullCount, setPullCount] = useState(0)
  const [feedback, setFeedback] = useState<ArcadeFeedback | null>(null)

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
    playerYRef.current = playerY
  }, [playerY])

  useEffect(() => {
    scoreRef.current = score
  }, [score])

  useEffect(() => {
    timeLeftMsRef.current = timeLeftMs
  }, [timeLeftMs])

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
    const tracker = new BodyPointTracker({
      anchor: 'head',
      onLockChange: (locked) => {
        const now = Date.now()
        if (!locked && gameStatusRef.current === 'playing' && !headLockLostAtRef.current) {
          headLockLostAtRef.current = now
        } else if (locked && headLockLostAtRef.current) {
          const pausedFor = now - headLockLostAtRef.current
          gameStartedAtRef.current += pausedFor
          lastPipeSpawnAtRef.current += pausedFor
          headLockLostAtRef.current = 0
        }
        headLockedRef.current = locked
        setHeadLocked(locked)
      },
      onSnapshot: (snapshot) => {
        const projected = projectCameraPointToStage(
          snapshot,
          { width: snapshot.frameWidth, height: snapshot.frameHeight },
          cameraStageSizeRef.current
        )
        motionRef.current = {
          energy: snapshot.energy,
          x: projected.x,
          y: projected.y
        }
        setMotionEnergy(snapshot.energy)

        const upwardThreshold = snapshot.source === 'pose' ? -0.012 : -0.022
        const energyThreshold = snapshot.source === 'pose' ? 0.05 : 0.12
        const now = Date.now()
        if (
          headLockedRef.current
          && gameStatusRef.current === 'playing'
          && snapshot.energy >= energyThreshold
          && snapshot.velocityY <= upwardThreshold
          && now - lastPullTriggerAtRef.current >= PULL_TRIGGER_COOLDOWN_MS
        ) {
          pendingPullRef.current = true
          lastPullTriggerAtRef.current = now
          setPullCount((prevCount) => prevCount + 1)
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
                x: PLAYER_X,
                y: playerYRef.current
              },
              replayFooterLabel: '引体冲刺回放',
              score: scoreRef.current,
              timeLeftMs: timeLeftMsRef.current,
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

  const endRound = (nextStatus: GameStatus) => {
    gameStatusRef.current = nextStatus
    setGameStatus(nextStatus)
    if (isRecordingRef.current) {
      void stopRecording()
    }
  }

  useEffect(() => {
    if (gameStatus !== 'playing') return

    const timer = setInterval(() => {
      if (!headLockedRef.current) return
      const elapsed = Date.now() - gameStartedAtRef.current
      const nextTimeLeft = Math.max(0, GAME_DURATION_MS - elapsed)
      const now = Date.now()

      if (pendingPullRef.current) {
        playerVelocityRef.current = JUMP_VELOCITY
        pendingPullRef.current = false
      } else {
        playerVelocityRef.current += GRAVITY
      }

      const nextPlayerY = clamp(playerYRef.current + playerVelocityRef.current, 0.08, 0.92)
      playerYRef.current = nextPlayerY
      setPlayerY(nextPlayerY)
      setTimeLeftMs(nextTimeLeft)

      let crashed = nextPlayerY <= 0.09 || nextPlayerY >= 0.91

      setPipes((prevPipes) => {
        let nextPipes = prevPipes.map((pipe) => ({
          ...pipe,
          x: pipe.x - PIPE_SPEED
        }))

        if (now - lastPipeSpawnAtRef.current >= PIPE_SPAWN_MS) {
          nextPipes = [...nextPipes, buildPipePair(nextPipeIdRef.current++)]
          lastPipeSpawnAtRef.current = now
        }

        nextPipes = nextPipes
          .filter((pipe) => pipe.x + pipe.width / 2 > -0.16)
          .map((pipe) => {
            if (!pipe.passed && pipe.x + pipe.width / 2 < PLAYER_X) {
              pipe.passed = true
              setFeedback({
                id: ++feedbackIdRef.current,
                text: '+1 穿越',
                tone: 'good'
              })
              vibrateForArcadeFeedback('good')
              setScore((prevScore) => {
                const nextScore = prevScore + 1
                if (nextScore > bestScoreRef.current) {
                  bestScoreRef.current = nextScore
                  setBestScore(nextScore)
                }
                return nextScore
              })
            }
            return pipe
          })

        for (const pipe of nextPipes) {
          const topHeight = pipe.gapY
          const bottomStart = pipe.gapY + pipe.gapHeight
          if (
            circleHitsRect(PLAYER_X, nextPlayerY, PLAYER_RADIUS, pipe.x, topHeight / 2, pipe.width, topHeight)
            || circleHitsRect(PLAYER_X, nextPlayerY, PLAYER_RADIUS, pipe.x, bottomStart + (1 - bottomStart) / 2, pipe.width, 1 - bottomStart)
          ) {
            crashed = true
            break
          }
        }

        pipesRef.current = nextPipes
        return nextPipes
      })

      if (crashed) {
        setFeedback({
          id: ++feedbackIdRef.current,
          text: '碰撞 -1 命',
          tone: 'bad'
        })
        vibrateForArcadeFeedback('bad')
        const nextLives = Math.max(0, livesRef.current - 1)
        setLives(nextLives)
        livesRef.current = nextLives
        playerVelocityRef.current = 0
        playerYRef.current = 0.52
        setPlayerY(0.52)
        setPipes([])
        pipesRef.current = []
        lastPipeSpawnAtRef.current = now
        if (nextLives <= 0) {
          clearInterval(timer)
          endRound('ended')
          return
        }
      }

      if (nextTimeLeft <= 0) {
        clearInterval(timer)
        endRound('ended')
      }
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
    setTimeLeftMs(GAME_DURATION_MS)
    timeLeftMsRef.current = GAME_DURATION_MS
    setPipes([])
    pipesRef.current = []
    nextPipeIdRef.current = 1
    setPullCount(0)
    setFeedback(null)
    lastReplayCaptureAtRef.current = 0
    lastPullTriggerAtRef.current = 0
    motionRef.current = { energy: 0, x: 0.5, y: 0.7 }
    setMotionEnergy(0)
    playerYRef.current = 0.52
    setPlayerY(0.52)
    playerVelocityRef.current = 0
    setLives(MAX_LIVES)
    livesRef.current = MAX_LIVES
    pendingPullRef.current = false
    headLockLostAtRef.current = 0
    lastPipeSpawnAtRef.current = Date.now()
  }

  const startGame = (withRecording: boolean) => {
    if (cameraError) {
      Taro.showToast({ title: '当前设备暂不支持试玩', icon: 'none' })
      return
    }
    if (replayProcessing) {
      Taro.showToast({ title: '回放还在生成中，请稍等', icon: 'none' })
      return
    }
    if (!headLockedRef.current) {
      Taro.showToast({ title: '请先让头部保持在画面内', icon: 'none' })
      return
    }
    resetForNewGame()
    setRecordedVideo(null)
    setGameStatus('playing')
    gameStatusRef.current = 'playing'
    gameStartedAtRef.current = Date.now()
    if (withRecording) {
      void beginRecording()
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
      ? '冲刺中'
      : gameStatus === 'ended'
        ? '已结束'
        : '待开始'

  const recordingText = replayProcessing
    ? '生成回放中'
    : recording
      ? '引体回放录制中'
      : recordedVideo?.kind === 'composite'
        ? '回放已生成'
        : '未录像'

  return (
    <PageThemeRoot>
      <View className={`motion-arcade-page motion-arcade-page--pullup theme-${effectiveTheme}`}>
        <ScrollView className='page-scroll' scrollY>
          <View className='page-content'>
            <View className='intro-card'>
              <Text className='intro-kicker'>PULLUP FLIGHT</Text>
              <Text className='intro-title'>向上拉，穿过障碍</Text>
              <View className='intro-tags'>
                <Text className='intro-tag'>上拉触发上升</Text>
                <Text className='intro-tag'>穿缝得分</Text>
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
                          cameraStageSizeRef.current = {
                            width: Number(rect?.width || 0),
                            height: Number(rect?.height || 0)
                          }
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
                  <Text className='stage-objective-text'>上拉一下就上冲一次</Text>
                  <Text className='stage-objective-text stage-objective-text--bad'>撞柱子或上下边界会掉命</Text>
                </View>

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

                <View
                  className='player-avatar pullup-bird'
                  style={{
                    left: `${PLAYER_X * 100}%`,
                    top: `${playerY * 100}%`
                  }}
                >
                  <View className='player-core pullup-bird-core' />
                </View>

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

                {cameraReady && !cameraError && !headLocked ? (
                  <View className='stage-note'>
                    <Text className='stage-note-title'>正在锁定头部</Text>
                    <Text className='stage-note-desc'>请正对镜头，让头部完整进入画面并短暂停留。</Text>
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
                  <Text className='stat-label'>剩余秒数</Text>
                  <Text className='stat-value'>{formatSeconds(timeLeftMs)}</Text>
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

            <View className='controls-card'>
              <Text className='section-kicker'>控制台</Text>

              <View className='controls-grid'>
                <View
                  className={`btn-primary ${cameraError || replayProcessing || !headLocked ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !replayProcessing && headLocked) startGame(false)
                  }}
                >
                  <Text className='btn-primary-text'>{gameStatus === 'playing' ? '重新开始' : '开始试玩'}</Text>
                </View>

                <View
                  className={`btn-secondary ${cameraError || replayProcessing || !headLocked ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !replayProcessing && headLocked) startGame(true)
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
