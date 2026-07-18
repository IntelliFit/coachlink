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
const GAME_TICK_MS = 64
const CAMERA_FRAME_COOLDOWN_MS = 72
const MOTION_SAMPLE_STEP = 6
const MOTION_THRESHOLD = 24
const REPLAY_DURATION_SECONDS = 35
const REPLAY_FPS = 12
const PLAYER_X = 0.32
const PLAYER_RADIUS = 0.058
const GRAVITY = 0.008
const JUMP_VELOCITY = -0.068
const PIPE_SPEED = 0.024
const PIPE_SPAWN_MS = 1180
const PULL_TRIGGER_COOLDOWN_MS = 320
const PULL_TRIGGER_ENERGY = 0.2
const PULL_TRIGGER_DELTA = 0.045
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
  const prevGrayFrameRef = useRef<Uint8Array | null>(null)
  const lastCameraProcessRef = useRef(0)
  const motionRef = useRef<MotionSnapshot>({ energy: 0, x: 0.5, y: 0.7 })
  const lastPullTriggerAtRef = useRef(0)
  const pendingPullRef = useRef(false)
  const pipesRef = useRef<PipePair[]>([])
  const nextPipeIdRef = useRef(1)
  const lastPipeSpawnAtRef = useRef(0)
  const isRecordingRef = useRef(false)
  const flipXRef = useRef(true)
  const feedbackIdRef = useRef(0)
  const recordingModeRef = useRef<'camera' | 'composite' | null>(null)
  const gameStartedAtRef = useRef(0)
  const scoreRef = useRef(0)
  const timeLeftMsRef = useRef(GAME_DURATION_MS)
  const playerYRef = useRef(0.52)
  const playerVelocityRef = useRef(0)
  const bestScoreRef = useRef(0)
  const livesRef = useRef(MAX_LIVES)

  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
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
  const [flipX, setFlipX] = useState(true)
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

  const changeDirection = (mirrored: boolean) => {
    flipXRef.current = mirrored
    setFlipX(mirrored)
  }

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
    flipXRef.current = flipX
  }, [flipX])

  useEffect(() => {
    const context = Taro.createCameraContext()
    cameraContextRef.current = context

    let stopped = false
    const startFrameStream = () => {
      try {
        const listener = context.onCameraFrame((frame: any) => {
          if (stopped) return
          const now = Date.now()
          if (now - lastCameraProcessRef.current < CAMERA_FRAME_COOLDOWN_MS) return
          lastCameraProcessRef.current = now

          const width = Number(frame?.width || 0)
          const height = Number(frame?.height || 0)
          const data = frame?.data
          if (!width || !height || !(data instanceof ArrayBuffer)) return

          const prev = prevGrayFrameRef.current
          const current = new Uint8Array(Math.ceil((width / MOTION_SAMPLE_STEP) * (height / MOTION_SAMPLE_STEP)))
          let sampleIndex = 0
          let weightedX = 0
          let weightedY = 0
          let weightSum = 0
          const rgba = new Uint8Array(data)

          for (let y = 0; y < height; y += MOTION_SAMPLE_STEP) {
            for (let x = 0; x < width; x += MOTION_SAMPLE_STEP) {
              const idx = (y * width + x) * 4
              const gray = ((rgba[idx] || 0) * 3 + (rgba[idx + 1] || 0) * 4 + (rgba[idx + 2] || 0)) >> 3
              current[sampleIndex] = gray
              if (prev) {
                const diff = Math.abs(gray - prev[sampleIndex])
                if (diff > MOTION_THRESHOLD) {
                  weightedX += x * diff
                  weightedY += y * diff
                  weightSum += diff
                }
              }
              sampleIndex += 1
            }
          }

          prevGrayFrameRef.current = current
          if (!prev || weightSum <= 0) return

          const rawX = weightedX / weightSum / width
          const rawY = weightedY / weightSum / height
          const nextEnergy = clamp(weightSum / 8500, 0, 1)
          const currentMotion = motionRef.current
          const nextX = currentMotion.x * 0.42 + clamp(rawX, 0.06, 0.94) * 0.58
          const nextY = currentMotion.y * 0.42 + clamp(rawY, 0.12, 0.9) * 0.58
          const pullDelta = currentMotion.y - nextY

          motionRef.current = {
            energy: nextEnergy,
            x: nextX,
            y: nextY
          }
          setMotionEnergy(nextEnergy)

          if (
            gameStatus === 'playing'
            && nextEnergy >= PULL_TRIGGER_ENERGY
            && pullDelta >= PULL_TRIGGER_DELTA
            && now - lastPullTriggerAtRef.current >= PULL_TRIGGER_COOLDOWN_MS
          ) {
            pendingPullRef.current = true
            lastPullTriggerAtRef.current = now
            setPullCount((prevCount) => prevCount + 1)
          }

          if (recordingModeRef.current === 'composite') {
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
              mirrored: flipXRef.current,
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
      prevGrayFrameRef.current = null
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
  }, [gameStatus])

  const endRound = (nextStatus: GameStatus) => {
    setGameStatus(nextStatus)
    if (isRecordingRef.current) {
      void stopRecording()
    }
  }

  useEffect(() => {
    if (gameStatus !== 'playing') return

    const timer = setInterval(() => {
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

    if (flipXRef.current) {
      Taro.showToast({
        title: '当前设备不支持镜像合成回放，可切到原始方向后录制',
        icon: 'none'
      })
      return
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
    motionRef.current = { energy: 0, x: 0.5, y: 0.7 }
    setMotionEnergy(0)
    playerYRef.current = 0.52
    setPlayerY(0.52)
    playerVelocityRef.current = 0
    setLives(MAX_LIVES)
    livesRef.current = MAX_LIVES
    pendingPullRef.current = false
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
    resetForNewGame()
    setRecordedVideo(null)
    setGameStatus('playing')
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
              <Text className='intro-title'>像小鸟穿柱子一样往上拉，但每次上升都要靠你的上拉动作触发</Text>
              <Text className='intro-desc'>
                这一版不再是“引体主题换皮”，而是改成真正的穿障碍玩法。
                角色会自然下坠，你做一次明显的上拉式动作，角色就会上冲一下，穿过上下障碍缝隙。
              </Text>
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
                  devicePosition='front'
                  flash='off'
                  mode='normal'
                  frameSize='small'
                  onInitDone={() => {
                    setCameraReady(true)
                    setCameraError('')
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

                {cameraError ? (
                  <View className='stage-error'>
                    <Text className='stage-note-title'>相机暂时不可用</Text>
                    <Text className='stage-note-desc'>{cameraError}</Text>
                  </View>
                ) : null}

                <View className='stage-tip-card'>
                  <Text className='stage-note-title'>玩法提示</Text>
                  <Text className='stage-note-desc'>
                    角色会自动往下掉。你做明显的“往上拉”动作，比如抬肩、上提手臂、上身快速上移，它就会上冲一下。
                  </Text>
                </View>
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
                  <Text className='meter-label'>动作感应强度</Text>
                  <Text className='meter-value'>{formatPercent(motionEnergy)}%</Text>
                </View>
                <View className='meter-track'>
                  <View className='meter-fill' style={{ width: `${formatPercent(motionEnergy)}%` }} />
                </View>
              </View>
            </View>

            <View className='controls-card'>
              <Text className='section-kicker'>控制台</Text>
              <Text className='intro-desc'>
                现在这局的核心不是左右接东西，而是像 `Flappy Bird` 那样找时机穿缝。录像也会优先保存带柱子和角色动画的回放。
              </Text>

              <View className='controls-grid'>
                <View
                  className={`btn-primary ${cameraError || replayProcessing ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !replayProcessing) startGame(false)
                  }}
                >
                  <Text className='btn-primary-text'>{gameStatus === 'playing' ? '重新开始' : '开始试玩'}</Text>
                </View>

                <View
                  className={`btn-secondary ${cameraError || replayProcessing ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!cameraError && !replayProcessing) startGame(true)
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

              <View className='toggle-row'>
                <View className={`toggle-chip ${flipX ? 'active' : ''}`} onClick={() => changeDirection(true)}>
                  <Text className='toggle-chip-text'>镜像同向（推荐）</Text>
                </View>
                <View className={`toggle-chip ${flipX ? '' : 'active'}`} onClick={() => changeDirection(false)}>
                  <Text className='toggle-chip-text'>原始方向</Text>
                </View>
              </View>
              <Text className='direction-note'>该方向会同步写入回放；合成回放为 360 × 480、12 fps 的流畅压缩画质。</Text>
            </View>
          </View>
        </ScrollView>
      </View>
    </PageThemeRoot>
  )
}
