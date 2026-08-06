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
  type ArcadeFeedback,
  vibrateForArcadeFeedback
} from './arcadeFeedback'
import { MotionArcadeReplayRecorder, type ArcadeReplayItem } from './arcadeReplayRecorder'
import type { MotionArcadeGameConfig } from './gameConfigs'
import { BodyPointTracker } from './bodyPointTracker'

type GameStatus = 'idle' | 'playing' | 'ended'

type MotionItem = {
  id: number
  type: 'good' | 'bad'
  size: number
  speedX: number
  speedY: number
  x: number
  y: number
}

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

const GAME_DURATION_MS = 30000
const GAME_TICK_MS = 32
const PLAYER_SIZE = 0.09
const REPLAY_DURATION_SECONDS = 35
const REPLAY_FPS = 12
const REPLAY_FRAME_INTERVAL_MS = 1000 / REPLAY_FPS

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000))
}

function formatPercent(value: number) {
  return Math.round(clamp(value, 0, 1) * 100)
}

function distance(aX: number, aY: number, bX: number, bY: number) {
  const dx = aX - bX
  const dy = aY - bY
  return Math.sqrt(dx * dx + dy * dy)
}

function createMotionItem(config: MotionArcadeGameConfig, id: number): MotionItem {
  const isBad = Math.random() < 0.18
  const speed = isBad ? 0.015 : 0.012 + Math.random() * 0.01
  const sway = (Math.random() - 0.5) * 0.01

  if (config.travelMode === 'rise') {
    return {
      id,
      size: isBad ? 0.06 : 0.052,
      speedX: sway,
      speedY: -speed,
      type: isBad ? 'bad' : 'good',
      x: 0.12 + Math.random() * 0.76,
      y: 1.08
    }
  }

  if (config.travelMode === 'left') {
    return {
      id,
      size: isBad ? 0.062 : 0.054,
      speedX: -speed,
      speedY: sway,
      type: isBad ? 'bad' : 'good',
      x: 1.08,
      y: 0.2 + Math.random() * 0.64
    }
  }

  return {
    id,
    size: isBad ? 0.058 : 0.05,
    speedX: sway,
    speedY: speed,
    type: isBad ? 'bad' : 'good',
    x: 0.12 + Math.random() * 0.76,
    y: -0.08
  }
}

function itemOutOfBounds(config: MotionArcadeGameConfig, item: MotionItem) {
  if (config.travelMode === 'rise') {
    return item.y < -0.2 || item.x < -0.2 || item.x > 1.2
  }
  if (config.travelMode === 'left') {
    return item.x < -0.2 || item.y < -0.2 || item.y > 1.2
  }
  return item.y > 1.2 || item.x < -0.2 || item.x > 1.2
}

export function createMotionArcadePage(config: MotionArcadeGameConfig) {
  return function MotionArcadePage() {
    const { effectiveTheme } = useTheme()
    const cameraContextRef = useRef<any>(null)
    const replayRecorderRef = useRef<MotionArcadeReplayRecorder | null>(null)
    const frameListenerRef = useRef<any>(null)
    const lastReplayCaptureAtRef = useRef(0)
    const bestScoreRef = useRef(0)
    const itemsRef = useRef<MotionItem[]>([])
    const gameStartedAtRef = useRef(0)
    const nextItemIdRef = useRef(1)
    const isRecordingRef = useRef(false)
    const flipXRef = useRef(true)
    const feedbackIdRef = useRef(0)
    const motionRef = useRef<MotionSnapshot>({ x: 0.5, y: 0.7, energy: 0 })
    const playerPositionRef = useRef({ x: 0.5, y: 0.78 })
    const recordingModeRef = useRef<'camera' | 'composite' | null>(null)
    const scoreRef = useRef(0)
    const timeLeftMsRef = useRef(GAME_DURATION_MS)

    const [gameStatus, setGameStatus] = useState<GameStatus>('idle')
    const [cameraError, setCameraError] = useState('')
    const [cameraReady, setCameraReady] = useState(false)
    const [score, setScore] = useState(0)
    const [bestScore, setBestScore] = useState(0)
    const [timeLeftMs, setTimeLeftMs] = useState(GAME_DURATION_MS)
    const [playerPosition, setPlayerPosition] = useState({ x: 0.5, y: 0.78 })
    const [motionEnergy, setMotionEnergy] = useState(0)
    const [items, setItems] = useState<MotionItem[]>([])
    const [flipX, setFlipX] = useState(true)
    const [recording, setRecording] = useState(false)
    const [replayProcessing, setReplayProcessing] = useState(false)
    const [videoSaving, setVideoSaving] = useState(false)
    const [recordedVideo, setRecordedVideo] = useState<RecordedVideo | null>(null)
    const [feedback, setFeedback] = useState<ArcadeFeedback | null>(null)

    const sharePayload = useMemo(
      () =>
        createSharePayload({
          title: config.shareTitle,
          path: buildSharePath(config.path)
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
      bestScoreRef.current = bestScore
    }, [bestScore])

    useEffect(() => {
      itemsRef.current = items
    }, [items])

    useEffect(() => {
      playerPositionRef.current = playerPosition
    }, [playerPosition])

    useEffect(() => {
      flipXRef.current = flipX
    }, [flipX])

    useEffect(() => {
      scoreRef.current = score
    }, [score])

    useEffect(() => {
      timeLeftMsRef.current = timeLeftMs
    }, [timeLeftMs])

    useEffect(() => {
      const context = Taro.createCameraContext()
      cameraContextRef.current = context
      const tracker = new BodyPointTracker({
        onSnapshot: (snapshot) => {
          motionRef.current = {
            energy: snapshot.energy,
            x: snapshot.x,
            y: snapshot.y
          }
          setMotionEnergy(snapshot.energy)
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
              const replayItems: ArcadeReplayItem[] = itemsRef.current.map((item) => ({
                size: item.size,
                type: item.type,
                x: item.x,
                y: item.y
              }))

              replayRecorderRef.current?.captureFrame({
                frameBuffer: new Uint8ClampedArray(rgba),
                frameHeight: height,
                frameWidth: width,
                items: replayItems,
                mirrored: flipXRef.current,
                player: playerPositionRef.current,
                replayFooterLabel: config.replayFooterLabel,
                score: scoreRef.current,
                timeLeftMs: timeLeftMsRef.current,
                visualKey: config.visualKey
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

    useEffect(() => {
      if (gameStatus !== 'playing') return

      const timer = setInterval(() => {
        const elapsed = Date.now() - gameStartedAtRef.current
        const nextTimeLeft = Math.max(0, GAME_DURATION_MS - elapsed)
        const motion = motionRef.current
        const targetX = clamp(flipX ? 1 - motion.x : motion.x, 0.08, 0.92)
        const targetY = clamp(0.16 + motion.y * 0.72, 0.18, 0.9)
        let nextPlayer = playerPositionRef.current

        setPlayerPosition((prev) => {
          nextPlayer = {
            x: prev.x * 0.12 + targetX * 0.88,
            y: prev.y * 0.12 + targetY * 0.88
          }
          playerPositionRef.current = nextPlayer
          return nextPlayer
        })

        setItems((prevItems) => {
          let itemList = prevItems.map((item) => ({
            ...item,
            x: item.x + item.speedX,
            y: item.y + item.speedY
          }))

          if (Math.random() < 0.34) {
            itemList = [...itemList, createMotionItem(config, nextItemIdRef.current++)]
          }

          let scoreDelta = 0
          let goodHits = 0
          let badHits = 0
          itemList = itemList.filter((item) => {
            if (itemOutOfBounds(config, item)) return false
            const hitDistance = distance(item.x, item.y, nextPlayer.x, nextPlayer.y)
            const hitRadius = item.size * 0.55 + PLAYER_SIZE * 0.5
            if (hitDistance <= hitRadius) {
              scoreDelta += item.type === 'good' ? config.scoreGood : config.scoreBad
              if (item.type === 'good') goodHits += 1
              else badHits += 1
              return false
            }
            return true
          })

          if (scoreDelta !== 0) {
            const tone: ArcadeFeedback['tone'] = badHits > 0 ? 'bad' : 'good'
            const hitCount = badHits > 0 ? badHits : goodHits
            const itemLabel = badHits > 0 ? config.badItemLabel : config.goodItemLabel
            setFeedback({
              id: ++feedbackIdRef.current,
              text: `${badHits > 0 ? '' : '+'}${scoreDelta} ${itemLabel}${hitCount > 1 ? ` ×${hitCount}` : ''}`,
              tone
            })
            vibrateForArcadeFeedback(tone)
            setScore((prevScore) => {
              const nextScore = Math.max(0, prevScore + scoreDelta)
              if (nextScore > bestScoreRef.current) {
                bestScoreRef.current = nextScore
                setBestScore(nextScore)
              }
              return nextScore
            })
          }

          itemsRef.current = itemList
          return itemList
        })

        setTimeLeftMs(nextTimeLeft)

        if (nextTimeLeft <= 0) {
          clearInterval(timer)
          setGameStatus('ended')
          setItems([])
          itemsRef.current = []
          if (isRecordingRef.current) {
            void stopRecording()
          }
        }
      }, GAME_TICK_MS)

      return () => clearInterval(timer)
    }, [flipX, gameStatus])

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
            Taro.showToast({
              title: error?.errMsg || '开始录像失败',
              icon: 'none'
            })
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
        Taro.showToast({
          title: error?.message || '当前环境无法录像',
          icon: 'none'
        })
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
          console.warn('小游戏合成回放录制不可用:', error)
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
          Taro.showToast({
            title: error?.errMsg || '停止录像失败',
            icon: 'none'
          })
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
          Taro.showToast({
            title: '回放生成失败，已尝试停止录制',
            icon: 'none'
          })
        }
      } catch (error: any) {
        Taro.showToast({
          title: error?.message || '停止回放录制失败',
          icon: 'none'
        })
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
      setItems([])
      itemsRef.current = []
      setFeedback(null)
      lastReplayCaptureAtRef.current = 0
      nextItemIdRef.current = 1
      motionRef.current = { energy: 0, x: 0.5, y: 0.72 }
      setMotionEnergy(0)
      const resetPlayer = { x: 0.5, y: 0.78 }
      playerPositionRef.current = resetPlayer
      setPlayerPosition(resetPlayer)
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
        ? '试玩中'
        : gameStatus === 'ended'
          ? '已结束'
          : '待开始'

    const recordingText = replayProcessing
      ? '生成回放中'
      : recording
        ? config.recordingActiveLabel
        : recordedVideo?.kind === 'composite'
          ? '回放已生成'
          : '未录像'

    const saveButtonText = recordedVideo?.kind === 'composite'
      ? (videoSaving ? '正在保存' : '保存回放视频')
      : (videoSaving ? '正在保存' : '保存原视频')

    return (
      <PageThemeRoot>
        <View className={`motion-arcade-page motion-arcade-page--${config.visualKey} theme-${effectiveTheme}`}>
          <ScrollView className='page-scroll' scrollY>
            <View className='page-content'>
              <View className='intro-card'>
                <Text className='intro-kicker'>{config.heroKicker}</Text>
                <Text className='intro-title'>{config.heroTitle}</Text>
                <View className='intro-tags'>
                  <Text className='intro-tag'>30 秒快开一局</Text>
                  <Text className='intro-tag'>支持保存回放</Text>
                  <Text className='intro-tag'>本地体感驱动</Text>
                </View>
              </View>

              <View className='camera-shell'>
                <View className='camera-stage'>
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
                    <Text className='stage-objective-text'>碰到 {config.goodItemLabel} 加分</Text>
                    <Text className='stage-objective-text stage-objective-text--bad'>
                      碰到 {config.badItemLabel} 扣分
                    </Text>
                  </View>

                  {items.map((item) => (
                    <View
                      key={item.id}
                      className={`arcade-item ${item.type}`}
                      style={{
                        left: `${item.x * 100}%`,
                        top: `${item.y * 100}%`,
                        width: `${item.size * 100}%`,
                        height: `${item.size * 100}%`
                      }}
                    >
                      <View className='arcade-item-core' />
                    </View>
                  ))}

                  <View
                    className='player-avatar'
                    style={{
                      left: `${playerPosition.x * 100}%`,
                      top: `${playerPosition.y * 100}%`
                    }}
                  >
                    <View className='player-core' />
                  </View>

                  {feedback ? (
                    <View key={feedback.id} className={`stage-feedback stage-feedback--${feedback.tone}`}>
                      <Text className='stage-feedback-text'>{feedback.text}</Text>
                    </View>
                  ) : null}

                  {!cameraReady && !cameraError ? (
                    <View className='stage-note'>
                      <Text className='stage-note-title'>正在准备摄像头</Text>
                      <Text className='stage-note-desc'>请允许使用相机。</Text>
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
                    <Text className='stat-label'>{config.scoreLabel}</Text>
                    <Text className='stat-value'>{score}</Text>
                  </View>
                  <View className='stat-item'>
                    <Text className='stat-label'>剩余秒数</Text>
                    <Text className='stat-value'>{formatSeconds(timeLeftMs)}</Text>
                  </View>
                  <View className='stat-item'>
                    <Text className='stat-label'>{config.bestLabel}</Text>
                    <Text className='stat-value'>{bestScore}</Text>
                  </View>
                </View>

                <View className='meter-wrap'>
                  <View className='meter-header'>
                    <Text className='meter-label'>动作幅度</Text>
                    <Text className='meter-value'>{formatPercent(motionEnergy)}%</Text>
                  </View>
                  <View className='meter-track'>
                    <View
                      className='meter-fill'
                      style={{ width: `${formatPercent(motionEnergy)}%` }}
                    />
                  </View>
                </View>

              </View>

              <View className='controls-card'>
                <Text className='section-kicker'>控制台</Text>

                <View className='controls-grid'>
                  <View
                    className={`btn-primary ${cameraError || replayProcessing ? 'disabled' : ''}`}
                    onClick={() => {
                      if (!cameraError && !replayProcessing) startGame(false)
                    }}
                  >
                    <Text className='btn-primary-text'>
                      {gameStatus === 'playing' ? '重新开始' : '开始试玩'}
                    </Text>
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
                    <Text className='btn-primary-text'>{saveButtonText}</Text>
                  </View>
                </View>

                <View className='toggle-row'>
                  <View
                    className={`toggle-chip ${flipX ? 'active' : ''}`}
                    onClick={() => changeDirection(true)}
                  >
                    <Text className='toggle-chip-text'>镜像同向（推荐）</Text>
                  </View>
                  <View
                    className={`toggle-chip ${flipX ? '' : 'active'}`}
                    onClick={() => changeDirection(false)}
                  >
                    <Text className='toggle-chip-text'>原始方向</Text>
                  </View>
                </View>
                <Text className='direction-note'>该方向会同时用于实时操作和最终合成回放。</Text>
                <Text className='direction-note'>合成回放为 360 × 480、12 fps 的流畅压缩画质，不是相机原画质。</Text>
              </View>

              {recordedVideo?.tempVideoPath ? (
                <View className='video-card'>
                  <Text className='section-kicker'>最近一次录像</Text>
                  <Text className='video-note'>
                    {recordedVideo.kind === 'composite'
                      ? '这次保存的是带角色和道具叠层的合成回放视频。当前回放默认不带原声，先优先满足“看得见玩法动画”。'
                      : '当前设备回退成了原摄像头视频录制，所以这次文件里不会带游戏叠层。'}
                  </Text>
                  <View className='video-meta'>
                    <View className='video-meta-item'>
                      <Text className='video-meta-label'>视频文件</Text>
                      <Text className='video-meta-value'>{recordedVideo.tempVideoPath}</Text>
                    </View>
                    {recordedVideo.tempThumbPath ? (
                      <View className='video-meta-item'>
                        <Text className='video-meta-label'>封面文件</Text>
                        <Text className='video-meta-value'>{recordedVideo.tempThumbPath}</Text>
                      </View>
                    ) : null}
                  </View>
                </View>
              ) : null}

            </View>
          </ScrollView>
        </View>
      </PageThemeRoot>
    )
  }
}
