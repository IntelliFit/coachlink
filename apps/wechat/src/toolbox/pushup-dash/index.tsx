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
import '../games/motionArcade.scss'
import './index.scss'

type DashWall = {
  height: number
  id: number
  width: number
  x: number
}

type GameStatus = 'idle' | 'playing' | 'ended'

type MotionSnapshot = {
  energy: number
  x: number
  y: number
}

type RecordedVideo = {
  kind?: 'camera' | 'composite'
  tempThumbPath?: string
  tempVideoPath: string
}

type RepPhase = 'down' | 'idle' | 'up'

const GAME_DURATION_MS = 30000
const GAME_TICK_MS = 64
const CAMERA_FRAME_COOLDOWN_MS = 72
const MOTION_SAMPLE_STEP = 6
const MOTION_THRESHOLD = 24
const REPLAY_DURATION_SECONDS = 35
const REPLAY_FPS = 12
const PLAYER_X = 0.24
const WALL_SPEED = 0.024
const WALL_SPAWN_MS = 1100
const DASH_DURATION_MS = 720
const DASH_COLLISION_WINDOW_MS = 820
const DOWN_THRESHOLD = 0.68
const UP_THRESHOLD = 0.56
const REP_ENERGY_THRESHOLD = 0.16
const MAX_LIVES = 3

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000))
}

function formatPercent(value: number) {
  return Math.round(clamp(value, 0, 1) * 100)
}

function buildWall(id: number): DashWall {
  return {
    height: 0.22 + Math.random() * 0.08,
    id,
    width: 0.12,
    x: 1.08
  }
}

export default function PushupDashPage() {
  const { effectiveTheme } = useTheme()
  const cameraContextRef = useRef<any>(null)
  const replayRecorderRef = useRef<MotionArcadeReplayRecorder | null>(null)
  const frameListenerRef = useRef<any>(null)
  const prevGrayFrameRef = useRef<Uint8Array | null>(null)
  const lastCameraProcessRef = useRef(0)
  const motionRef = useRef<MotionSnapshot>({ energy: 0, x: 0.5, y: 0.7 })
  const repPhaseRef = useRef<RepPhase>('idle')
  const repStartedAtRef = useRef(0)
  const dashUntilRef = useRef(0)
  const dashAvailableUntilRef = useRef(0)
  const wallsRef = useRef<DashWall[]>([])
  const nextWallIdRef = useRef(1)
  const lastWallSpawnAtRef = useRef(0)
  const isRecordingRef = useRef(false)
  const recordingModeRef = useRef<'camera' | 'composite' | null>(null)
  const scoreRef = useRef(0)
  const timeLeftMsRef = useRef(GAME_DURATION_MS)
  const bestScoreRef = useRef(0)
  const livesRef = useRef(MAX_LIVES)
  const gameStartedAtRef = useRef(0)

  const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState('')
  const [motionEnergy, setMotionEnergy] = useState(0)
  const [dashActive, setDashActive] = useState(false)
  const [score, setScore] = useState(0)
  const [bestScore, setBestScore] = useState(0)
  const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS)
  const [recording, setRecording] = useState(false)
  const [replayProcessing, setReplayProcessing] = useState(false)
  const [videoSaving, setVideoSaving] = useState(false)
  const [recordedVideo, setRecordedVideo] = useState<RecordedVideo | null>(null)
  const [walls, setWalls] = useState<DashWall[]>([])
  const [lives, setLives] = useState(MAX_LIVES)
  const [repCount, setRepCount] = useState(0)
  const [phaseLabel, setPhaseLabel] = useState('等待下压')

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
    timeLeftMsRef.current = timeLeftMs
  }, [timeLeftMs])

  useEffect(() => {
    bestScoreRef.current = bestScore
  }, [bestScore])

  useEffect(() => {
    livesRef.current = lives
  }, [lives])

  const beginDashFromRep = () => {
    const now = Date.now()
    dashUntilRef.current = now + DASH_DURATION_MS
    dashAvailableUntilRef.current = now + DASH_COLLISION_WINDOW_MS
    setDashActive(true)
    setRepCount((prevCount) => prevCount + 1)
  }

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

          motionRef.current = {
            energy: nextEnergy,
            x: nextX,
            y: nextY
          }
          setMotionEnergy(nextEnergy)

          if (gameStatus === 'playing') {
            if (
              repPhaseRef.current === 'idle'
              && nextEnergy >= REP_ENERGY_THRESHOLD
              && nextY >= DOWN_THRESHOLD
            ) {
              repPhaseRef.current = 'down'
              repStartedAtRef.current = now
              setPhaseLabel('已下压，准备撑起')
            } else if (
              repPhaseRef.current === 'down'
              && now - repStartedAtRef.current >= 120
              && nextY <= UP_THRESHOLD
            ) {
              repPhaseRef.current = 'up'
              beginDashFromRep()
              setPhaseLabel('一次完整俯卧撑已触发推进')
            } else if (repPhaseRef.current === 'up' && nextY >= 0.6) {
              repPhaseRef.current = 'idle'
              setPhaseLabel('等待下一次下压')
            }
          }

          if (recordingModeRef.current === 'composite') {
            const replayItems: ArcadeReplayItem[] = wallsRef.current.map((wall) => ({
              height: wall.height,
              shape: 'rect',
              size: wall.height,
              type: 'bad',
              width: wall.width,
              x: wall.x,
              y: 1 - wall.height / 2
            }))

            replayRecorderRef.current?.captureFrame({
              frameBuffer: new Uint8ClampedArray(rgba),
              frameHeight: height,
              frameWidth: width,
              items: replayItems,
              mirrored: true,
              player: {
                x: dashActive ? PLAYER_X + 0.08 : PLAYER_X,
                y: 0.78
              },
              replayFooterLabel: '俯卧撑突围回放',
              score: scoreRef.current,
              timeLeftMs: timeLeftMsRef.current,
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
  }, [dashActive, gameStatus])

  const endRound = () => {
    setGameStatus('ended')
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
      setTimeLeftMs(nextTimeLeft)

      const nextDashActive = now <= dashUntilRef.current
      setDashActive(nextDashActive)

      setWalls((prevWalls) => {
        let nextWalls = prevWalls.map((wall) => ({
          ...wall,
          x: wall.x - WALL_SPEED
        }))

        if (now - lastWallSpawnAtRef.current >= WALL_SPAWN_MS) {
          nextWalls = [...nextWalls, buildWall(nextWallIdRef.current++)]
          lastWallSpawnAtRef.current = now
        }

        const remainingWalls: DashWall[] = []
        for (const wall of nextWalls) {
          const collisionPoint = nextDashActive ? PLAYER_X + 0.12 : PLAYER_X + 0.04
          const hitWindowStart = wall.x - wall.width / 2
          if (hitWindowStart <= collisionPoint && wall.x + wall.width / 2 >= PLAYER_X - 0.02) {
            if (now <= dashAvailableUntilRef.current) {
              setScore((prevScore) => {
                const nextScore = prevScore + 1
                if (nextScore > bestScoreRef.current) {
                  bestScoreRef.current = nextScore
                  setBestScore(nextScore)
                }
                return nextScore
              })
              dashAvailableUntilRef.current = 0
              dashUntilRef.current = now
              setDashActive(false)
              continue
            }

            const nextLives = Math.max(0, livesRef.current - 1)
            setLives(nextLives)
            livesRef.current = nextLives
            if (nextLives <= 0) {
              setTimeout(() => {
                endRound()
              }, 0)
            }
            continue
          }

          if (wall.x + wall.width / 2 > -0.16) {
            remainingWalls.push(wall)
          }
        }

        wallsRef.current = remainingWalls
        return remainingWalls
      })

      if (nextTimeLeft <= 0) {
        clearInterval(timer)
        endRound()
      }
    }, GAME_TICK_MS)

    return () => clearInterval(timer)
  }, [gameStatus])

  const handleBack = () => {
    Taro.navigateBack({ delta: 1 }).catch(() => {
      Taro.navigateTo({ url: '/toolbox/index' }).catch(() => {
        Taro.switchTab({ url: '/pages/index/index' })
      })
    })
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
        console.warn('俯卧撑突围合成回放录制不可用，回退到原视频录制:', error)
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
    setWalls([])
    wallsRef.current = []
    nextWallIdRef.current = 1
    setRepCount(0)
    setLives(MAX_LIVES)
    livesRef.current = MAX_LIVES
    dashUntilRef.current = 0
    dashAvailableUntilRef.current = 0
    setDashActive(false)
    repPhaseRef.current = 'idle'
    setPhaseLabel('等待下压')
    motionRef.current = { energy: 0, x: 0.5, y: 0.7 }
    setMotionEnergy(0)
    lastWallSpawnAtRef.current = Date.now()
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
        <View className='nav-bar'>
          <Text className='nav-back' onClick={handleBack}>返回</Text>
          <Text className='nav-title'>俯卧撑突围</Text>
        </View>

        <ScrollView className='page-scroll' scrollY>
          <View className='page-content'>
            <View className='intro-card'>
              <Text className='intro-kicker'>PUSHUP DRIVE</Text>
              <Text className='intro-title'>不是左右躲障碍了，而是做完整一下俯卧撑才会触发一次推进</Text>
              <Text className='intro-desc'>
                这一版把规则改成“下压一次，再撑起一次”才算一次完整驱动。每完成一次，角色就会往前顶出去一段，把迎面来的墙撞开。
              </Text>
              <View className='intro-tags'>
                <Text className='intro-tag'>下压 + 撑起</Text>
                <Text className='intro-tag'>完整一次才推进</Text>
                <Text className='intro-tag'>支持回放</Text>
              </View>
            </View>

            <View className='camera-shell'>
              <View className='camera-stage pushup-stage'>
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
                  <Text className='stage-objective-text'>先下压，再撑起，才会冲一次</Text>
                  <Text className='stage-objective-text stage-objective-text--bad'>来不及顶开墙就会掉命</Text>
                </View>

                <View className='pushup-ground' />

                {walls.map((wall) => (
                  <View
                    key={wall.id}
                    className='pushup-wall'
                    style={{
                      height: `${wall.height * 100}%`,
                      left: `${wall.x * 100}%`,
                      width: `${wall.width * 100}%`,
                      top: `${(1 - wall.height) * 100}%`
                    }}
                  />
                ))}

                <View
                  className={`player-avatar pushup-runner ${dashActive ? 'pushup-runner--dash' : ''}`}
                  style={{
                    left: `${(dashActive ? PLAYER_X + 0.08 : PLAYER_X) * 100}%`,
                    top: '78%'
                  }}
                >
                  <View className='player-core pushup-runner-core' />
                </View>

                {!cameraReady && !cameraError ? (
                  <View className='stage-note'>
                    <Text className='stage-note-title'>正在准备摄像头</Text>
                    <Text className='stage-note-desc'>允许相机权限后，我们会监测你“下压再撑起”的完整节奏。</Text>
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
                    先做明显的下压动作，再快速撑起。只有完整走完这两个阶段，角色才会往前顶出去一次。
                  </Text>
                </View>
              </View>
            </View>

            <View className='stats-card'>
              <Text className='section-kicker'>实时状态</Text>
              <View className='stats-grid'>
                <View className='stat-item'>
                  <Text className='stat-label'>顶开墙数</Text>
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
                  <Text className='meter-label'>动作感应强度</Text>
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

            <View className='controls-card'>
              <Text className='section-kicker'>控制台</Text>
              <Text className='intro-desc'>
                这局不再是横向躲东西，而是完整做一下动作来换一次推进。录像会优先保存带墙体和冲刺动画的回放。
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
            </View>
          </View>
        </ScrollView>
      </View>
    </PageThemeRoot>
  )
}
