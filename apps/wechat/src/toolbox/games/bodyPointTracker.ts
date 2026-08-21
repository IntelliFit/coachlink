import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/utils/request'

declare const wx: any

export type BodyTrackingSource = 'motion' | 'pose'

export type BodyTrackingTarget = 'body' | 'head' | 'head-estimate' | 'motion'

export type BodyTrackingLockState = 'holding' | 'locked' | 'searching'

export type BodyTrackingRuntimeState = 'face' | 'initializing' | 'motion' | 'pose' | 'unavailable'

export type BodyTrackingSnapshot = {
  confidence: number
  energy: number
  frameHeight: number
  frameWidth: number
  headRadiusX: number
  headRadiusY: number
  locked: boolean
  lockState: BodyTrackingLockState
  source: BodyTrackingSource
  target: BodyTrackingTarget
  velocityX: number
  velocityY: number
  x: number
  y: number
}

type CameraFrame = {
  data: ArrayBuffer
  height: number
  width: number
}

type TrackerOptions = {
  anchorMode?: 'auto' | 'head'
  headLockConfirmFrames?: number
  headLostGraceMs?: number
  onLockChange?: (locked: boolean) => void
  onRuntimeStateChange?: (state: BodyTrackingRuntimeState, detail: string) => void
  onSnapshot: (snapshot: BodyTrackingSnapshot) => void
  onSourceChange?: (source: BodyTrackingSource) => void
  poseIntervalMs?: number
}

type PosePoint = {
  score: number
  x: number
  y: number
}

type HeadAnchor = PosePoint & {
  headRadiusX: number
  headRadiusY: number
  target: 'body' | 'head' | 'head-estimate'
}

const MODEL_FILE_NAME = 'coachlink-movenet-lightning-v4.onnx'
const MODEL_FILE_SIZE = 9_466_715
const MODEL_INPUT_SIZE = 192
const MODEL_INPUT_PIXEL_COUNT = MODEL_INPUT_SIZE * MODEL_INPUT_SIZE
// Camera callbacks normally arrive at about 30fps. The pose model and the
// JavaScript fallback do not need every frame for the arcade controls, while
// attempting to inspect each one can monopolise the mini-program JS thread.
// These rates keep input responsive while leaving time for rendering and game
// state updates on lower-end devices.
const FRAME_PROCESS_INTERVAL_MS = 66
const POSE_INTERVAL_MS = 96
const MOTION_INTERVAL_MS = 66
const MOTION_SAMPLE_STEP = 8
const MOTION_THRESHOLD = 22
const POSE_SCORE_THRESHOLD = 0.28
const HEAD_LOCK_CONFIRM_FRAMES = 3
const HEAD_LOST_GRACE_MS = 720
// 全局相机帧已限制为约 15fps；这里略低于全局间隔，避免二次节流后
// 人脸与角色只剩约 7.5fps 的跟随速度。
const FACE_DETECT_INTERVAL_MS = 60
const FACE_DETECT_TIMEOUT_MS = 320
const FACE_SCORE_THRESHOLD = 0.62

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}

function fileIsValid(fileSystem: any, path: string) {
  return new Promise<boolean>((resolve) => {
    fileSystem.stat({
      path,
      success: (result: any) => resolve(Number(result?.stats?.size || 0) === MODEL_FILE_SIZE),
      fail: () => resolve(false)
    })
  })
}

function copyFile(fileSystem: any, sourcePath: string, destinationPath: string) {
  return new Promise<void>((resolve, reject) => {
    fileSystem.copyFile({
      srcPath: sourcePath,
      destPath: destinationPath,
      success: () => resolve(),
      fail: reject
    })
  })
}

function waitForSession(session: any) {
  return new Promise<void>((resolve, reject) => {
    session.onLoad(() => resolve())
    session.onError((error: unknown) => reject(error))
  })
}

function tensorData(value: any) {
  const data = value?.data
  if (data instanceof ArrayBuffer) return new Float32Array(data)
  if (ArrayBuffer.isView(data)) {
    return new Float32Array(data.buffer, data.byteOffset, Math.floor(data.byteLength / 4))
  }
  return null
}

function averageVisible(points: PosePoint[], indices: number[]) {
  const visible = indices.map((index) => points[index]).filter((point) => point?.score >= POSE_SCORE_THRESHOLD)
  if (!visible.length) return null
  const totalScore = visible.reduce((sum, point) => sum + point.score, 0)
  return {
    score: totalScore / visible.length,
    x: visible.reduce((sum, point) => sum + point.x * point.score, 0) / totalScore,
    y: visible.reduce((sum, point) => sum + point.y * point.score, 0) / totalScore
  }
}

function buildHeadAnchor(points: PosePoint[], frameAspect: number): HeadAnchor | null {
  const visibleHead = [0, 1, 2, 3, 4]
    .map((index) => points[index])
    .filter((point) => point?.score >= POSE_SCORE_THRESHOLD)
  const leftShoulder = points[5]
  const rightShoulder = points[6]
  const shoulderSpan = leftShoulder?.score >= POSE_SCORE_THRESHOLD
    && rightShoulder?.score >= POSE_SCORE_THRESHOLD
    ? Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y)
    : 0.16
  const head = averageVisible(points, [0, 1, 2, 3, 4])
  if (head) {
    const headWidth = visibleHead.length >= 2
      ? Math.max(...visibleHead.map((point) => point.x)) - Math.min(...visibleHead.map((point) => point.x))
      : 0
    const radiusX = clamp(Math.max(headWidth * 0.82, shoulderSpan * 0.28), 0.055, 0.14)
    return {
      ...head,
      headRadiusX: radiusX,
      headRadiusY: clamp(radiusX * frameAspect * 1.32, 0.06, 0.18),
      target: 'head' as const
    }
  }

  const shoulders = averageVisible(points, [5, 6])
  if (shoulders) {
    const radiusX = clamp(shoulderSpan * 0.3, 0.06, 0.14)
    return {
      headRadiusX: radiusX,
      headRadiusY: clamp(radiusX * frameAspect * 1.32, 0.065, 0.18),
      score: shoulders.score * 0.82,
      target: 'head-estimate' as const,
      x: shoulders.x,
      y: clamp(shoulders.y - clamp(shoulderSpan * 0.72, 0.07, 0.2), 0.03, 0.97)
    }
  }

  const hips = averageVisible(points, [11, 12])
  return hips
    ? {
        ...hips,
        headRadiusX: 0,
        headRadiusY: 0,
        target: 'body' as const
      }
    : null
}

export class BodyPointTracker {
  private anchorMode: 'auto' | 'head'
  private destroyed = false
  private faceActiveDetectionId = 0
  private faceDetectionBusy = false
  private faceDetectionFailures = 0
  private faceDetectionTimer: ReturnType<typeof setTimeout> | null = null
  private faceFrameHeight = 0
  private faceFrameWidth = 0
  private faceHandledDetectionId = 0
  private facePreparing = false
  private faceReady = false
  private faceSession: any = null
  private faceUnavailable = false
  private headCandidate: HeadAnchor | null = null
  private headCandidateFrames = 0
  private headLockConfirmFrames: number
  private headLocked = false
  private headLostGraceMs: number
  private inferenceRunning = false
  private inferenceFailures = 0
  private lastDirectHeadAt = 0
  private lastFaceAt = 0
  private lastFrameAt = 0
  private lastLockedHeadSnapshot: BodyTrackingSnapshot | null = null
  private lastMotionAt = 0
  private lastPoseAt = 0
  private lastPoseSnapshotAt = 0
  private lastPoseSnapshot: BodyTrackingSnapshot | null = null
  private lastSnapshot: BodyTrackingSnapshot = {
    confidence: 0,
    energy: 0,
    frameHeight: 0,
    frameWidth: 0,
    headRadiusX: 0,
    headRadiusY: 0,
    locked: false,
    lockState: 'searching',
    source: 'motion',
    target: 'motion',
    velocityX: 0,
    velocityY: 0,
    x: 0.5,
    y: 0.55
  }
  private options: TrackerOptions
  private poseFrameHeight = 0
  private poseFrameWidth = 0
  private poseInput = new Int32Array(MODEL_INPUT_PIXEL_COUNT * 3)
  private poseIntervalMs: number
  private posePreparing = false
  private poseSession: any = null
  private poseSourceIndices: Int32Array | null = null
  private poseUnavailable = false
  private motionQueue: Int32Array | null = null
  private motionScratchGray: Uint8Array | null = null
  private motionVisited: Uint8Array | null = null
  private motionWeights: Uint8Array | null = null
  private previousGray: Uint8Array | null = null
  private runtimeDetail = ''
  private runtimeState: BodyTrackingRuntimeState | null = null
  private source: BodyTrackingSource = 'motion'

  constructor(options: TrackerOptions) {
    this.options = options
    this.anchorMode = options.anchorMode || 'auto'
    this.headLockConfirmFrames = Math.max(2, Math.round(options.headLockConfirmFrames || HEAD_LOCK_CONFIRM_FRAMES))
    this.headLostGraceMs = clamp(Number(options.headLostGraceMs || HEAD_LOST_GRACE_MS), 480, 1500)
    this.poseIntervalMs = clamp(Number(options.poseIntervalMs || POSE_INTERVAL_MS), 40, 120)
    this.setRuntimeState('initializing', this.anchorMode === 'head' ? '正在启动微信端侧人脸识别' : '正在启动人体关键点识别')
    if (this.anchorMode === 'head') {
      this.prepareFaceSession()
    } else {
      void this.preparePoseSession()
    }
  }

  processFrame(frame: CameraFrame, at = Date.now()) {
    if (this.destroyed || !frame.width || !frame.height || !(frame.data instanceof ArrayBuffer)) return

    this.expireHeadLock(at)
    if (at - this.lastFrameAt < FRAME_PROCESS_INTERVAL_MS) return
    this.lastFrameAt = at

    const rgba = new Uint8Array(frame.data)
    if (this.anchorMode === 'head') {
      if (this.faceReady) {
        this.runFace(frame, at)
        return
      }

      if (this.facePreparing) return
      if (this.poseSession) {
        if (!this.inferenceRunning && at - this.lastPoseAt >= this.poseIntervalMs) {
          this.lastPoseAt = at
          this.runPose(rgba, frame.width, frame.height, at)
        }
        return
      }

      if (!this.posePreparing && !this.poseUnavailable && this.faceUnavailable) void this.preparePoseSession()
      this.emitHeldHead(at)
      return
    }

    if (this.poseSession) {
      if (!this.inferenceRunning && at - this.lastPoseAt >= this.poseIntervalMs) {
        this.lastPoseAt = at
        this.runPose(rgba, frame.width, frame.height, at)
      }
      if (this.lastPoseSnapshotAt && at - this.lastPoseSnapshotAt < 650) return
    }

    if (at - this.lastMotionAt < MOTION_INTERVAL_MS) return
    const snapshot = this.trackMotion(rgba, frame.width, frame.height, at)
    this.lastMotionAt = at
    if (!snapshot) return
    this.emit(snapshot)
  }

  destroy() {
    this.destroyed = true
    this.previousGray = null
    this.clearFaceDetectionTimer()
    try {
      this.faceSession?.stop?.()
      this.faceSession?.destroy?.()
    } catch {
      // Ignore runtimes without explicit VisionKit cleanup methods.
    }
    this.faceSession = null
    this.faceReady = false
    this.motionScratchGray = null
    this.motionWeights = null
    this.motionVisited = null
    this.motionQueue = null
    try {
      this.poseSession?.destroy?.()
    } catch {
      // Ignore runtimes without an explicit destroy method.
    }
    this.poseSession = null
  }

  private prepareFaceSession() {
    if (this.destroyed || this.facePreparing || this.faceReady || this.faceUnavailable) return
    this.facePreparing = true

    try {
      const runtime = Taro as any
      if (typeof runtime.createVKSession !== 'function') {
        this.disableFace('当前微信版本不支持端侧人脸识别')
        return
      }

      const session = runtime.createVKSession({
        track: { face: { mode: 2 } }
      })
      this.faceSession = session

      const handleAnchors = (value: any) => this.handleFaceAnchors(value)
      session.on('addAnchors', handleAnchors)
      session.on('updateAnchors', handleAnchors)
      session.on('removeAnchors', () => {
        setTimeout(() => this.handleFaceAnchors([]), 0)
      })
      session.start((status: number | null) => {
        if (this.destroyed) {
          try {
            session.stop?.()
            session.destroy?.()
          } catch {
            // Ignore cleanup errors after the page has already closed.
          }
          return
        }

        this.facePreparing = false
        if (status && Number(status) !== 0) {
          this.disableFace(`微信人脸识别启动失败（${status}）`)
          return
        }

        this.faceReady = true
        this.faceDetectionFailures = 0
        this.setRuntimeState('face', '微信端侧人脸识别已启动，只需让脸进入画面')
      })
    } catch (error: any) {
      this.disableFace(error?.message || '微信端侧人脸识别初始化失败')
    }
  }

  private runFace(frame: CameraFrame, at: number) {
    if (
      !this.faceReady
      || !this.faceSession
      || this.faceDetectionBusy
      || at - this.lastFaceAt < FACE_DETECT_INTERVAL_MS
    ) {
      return
    }

    this.lastFaceAt = at
    this.faceDetectionBusy = true
    this.faceFrameWidth = frame.width
    this.faceFrameHeight = frame.height
    const detectionId = ++this.faceActiveDetectionId

    try {
      this.faceSession.detectFace({
        frameBuffer: frame.data,
        height: frame.height,
        modelModel: 0,
        scoreThreshold: FACE_SCORE_THRESHOLD,
        sourceType: 0,
        width: frame.width
      })
      this.clearFaceDetectionTimer()
      this.faceDetectionTimer = setTimeout(() => {
        if (this.destroyed || detectionId !== this.faceActiveDetectionId) return
        this.faceDetectionBusy = false
        this.faceHandledDetectionId = detectionId
        this.handleHeadPoseAnchor(null, this.faceFrameWidth, this.faceFrameHeight, Date.now())
      }, FACE_DETECT_TIMEOUT_MS)
    } catch (error: any) {
      this.faceDetectionBusy = false
      this.faceDetectionFailures += 1
      this.handleHeadPoseAnchor(null, frame.width, frame.height, Date.now())
      if (this.faceDetectionFailures >= 3) {
        this.disableFace(error?.message || '微信人脸识别连续调用失败')
      }
    }
  }

  private handleFaceAnchors(value: any) {
    if (this.destroyed || !this.faceReady) return
    const detectionId = this.faceActiveDetectionId
    if (!detectionId || this.faceHandledDetectionId === detectionId) return

    this.faceHandledDetectionId = detectionId
    this.faceDetectionBusy = false
    this.faceDetectionFailures = 0
    this.clearFaceDetectionTimer()

    const anchors = Array.isArray(value)
      ? value
      : Array.isArray(value?.anchors)
        ? value.anchors
        : Array.isArray(value?.detail)
          ? value.detail
          : Array.isArray(value?.detail?.anchors)
            ? value.detail.anchors
            : []

    const faces = anchors
      .map((anchor: any) => {
        const originX = Number(anchor?.origin?.x)
        const originY = Number(anchor?.origin?.y)
        const sizeWidth = Number(anchor?.size?.width)
        const sizeHeight = Number(anchor?.size?.height)
        const rawConfidence = Number(anchor?.confidence)
        if (
          !Number.isFinite(originX)
          || !Number.isFinite(originY)
          || !Number.isFinite(sizeWidth)
          || !Number.isFinite(sizeHeight)
          || sizeWidth <= 0
          || sizeHeight <= 0
        ) {
          return null
        }
        const confidence = Number.isFinite(rawConfidence) ? clamp(rawConfidence, 0, 1) : 1
        return {
          anchor: {
            headRadiusX: clamp(sizeWidth * 0.5, 0.045, 0.22),
            headRadiusY: clamp(sizeHeight * 0.5, 0.055, 0.25),
            score: confidence,
            target: 'head' as const,
            x: clamp(originX + sizeWidth * 0.5, 0.02, 0.98),
            y: clamp(originY + sizeHeight * 0.5, 0.02, 0.98)
          },
          rank: confidence * 2 + sizeWidth * sizeHeight
        }
      })
      .filter((item): item is { anchor: HeadAnchor; rank: number } => Boolean(item))
      .sort((a, b) => b.rank - a.rank)

    this.handleHeadPoseAnchor(
      faces[0]?.anchor || null,
      this.faceFrameWidth,
      this.faceFrameHeight,
      Date.now()
    )
  }

  private disableFace(detail: string) {
    if (this.faceUnavailable) return
    this.faceUnavailable = true
    this.facePreparing = false
    this.faceReady = false
    this.faceDetectionBusy = false
    this.clearFaceDetectionTimer()
    try {
      this.faceSession?.stop?.()
      this.faceSession?.destroy?.()
    } catch {
      // Ignore cleanup errors and continue to the compatible pose detector.
    }
    this.faceSession = null
    this.setRuntimeState('initializing', `${detail}，正在加载兼容头部识别`)
    void this.preparePoseSession()
  }

  private clearFaceDetectionTimer() {
    if (!this.faceDetectionTimer) return
    clearTimeout(this.faceDetectionTimer)
    this.faceDetectionTimer = null
  }

  private setRuntimeState(state: BodyTrackingRuntimeState, detail: string) {
    if (this.runtimeState === state && this.runtimeDetail === detail) return
    this.runtimeState = state
    this.runtimeDetail = detail
    this.options.onRuntimeStateChange?.(state, detail)
  }

  private markPoseUnavailable(detail: string) {
    this.posePreparing = false
    this.poseUnavailable = true
    try {
      this.poseSession?.destroy?.()
    } catch {
      // Ignore cleanup errors and report the detector state to the page.
    }
    this.poseSession = null
    this.previousGray = null
    if (this.anchorMode === 'head') {
      this.setRuntimeState('unavailable', `${detail}。请更新微信后重试`)
    } else {
      this.setRuntimeState('motion', `${detail}，已使用画面动作跟踪`)
    }
    console.warn('人体关键点识别不可用:', detail)
  }

  private async preparePoseSession() {
    if (this.destroyed || this.posePreparing || this.poseSession || this.poseUnavailable) return
    this.posePreparing = true
    try {
      if (typeof wx === 'undefined' || typeof wx.createInferenceSession !== 'function') {
        this.markPoseUnavailable('当前微信版本不支持兼容头部识别')
        return
      }

      const fileSystem = Taro.getFileSystemManager()
      const modelPath = `${wx.env.USER_DATA_PATH}/${MODEL_FILE_NAME}`
      if (!(await fileIsValid(fileSystem, modelPath))) {
        const token = String(Taro.getStorageSync('token') || '').trim()
        const response = await Taro.downloadFile({
          url: `${API_BASE_URL.replace(/\/+$/, '')}/api/toolbox/pose-model`,
          header: token ? { Authorization: `Bearer ${token}` } : {}
        })
        if (response.statusCode !== 200 || !response.tempFilePath) {
          this.markPoseUnavailable(`兼容头部模型下载失败（HTTP ${response.statusCode || 0}）`)
          return
        }
        await copyFile(fileSystem, response.tempFilePath, modelPath)
      }

      if (this.destroyed) return
      const session = wx.createInferenceSession({
        allowNPU: true,
        model: modelPath,
        precesionLevel: 2
      })
      await waitForSession(session)
      if (this.destroyed) {
        session.destroy?.()
        return
      }
      this.poseSession = session
      this.posePreparing = false
      this.poseUnavailable = false
      this.previousGray = null
      this.setRuntimeState('pose', this.anchorMode === 'head' ? '已启用兼容头部识别' : '人体关键点识别已启动')
    } catch (error) {
      this.markPoseUnavailable(error instanceof Error ? error.message : '人体关键点模型初始化失败')
    }
  }

  private runPose(rgba: Uint8Array, width: number, height: number, at: number) {
    if (!this.poseSession) return
    this.inferenceRunning = true
    const geometry = this.preparePoseInput(rgba, width, height)

    let inference: Promise<any>
    try {
      inference = Promise.resolve(this.poseSession.run({
        input: {
          data: this.poseInput.buffer,
          shape: [1, MODEL_INPUT_SIZE, MODEL_INPUT_SIZE, 3],
          type: 'int32'
        }
      }))
    } catch (error) {
      this.handleInferenceFailure(error)
      return
    }

    inference
      .then((result: any) => {
        if (this.destroyed) return
        const firstOutput = result?.output_0 || result?.[Object.keys(result || {})[0]]
        const values = tensorData(firstOutput)
        if (!values || values.length < 51) {
          if (this.anchorMode === 'head') this.handleHeadPoseAnchor(null, width, height, Date.now())
          return
        }

        const points: PosePoint[] = []
        for (let index = 0; index < 17; index += 1) {
          const modelY = values[index * 3] * MODEL_INPUT_SIZE
          const modelX = values[index * 3 + 1] * MODEL_INPUT_SIZE
          points.push({
            y: clamp((modelY - geometry.offsetY) / geometry.scaledHeight, 0, 1),
            x: clamp((modelX - geometry.offsetX) / geometry.scaledWidth, 0, 1),
            score: values[index * 3 + 2]
          })
        }

        const anchor = buildHeadAnchor(points, width / Math.max(1, height))
        const completedAt = Date.now()
        this.inferenceFailures = 0
        const visibleAnchor = anchor && anchor.score >= POSE_SCORE_THRESHOLD ? anchor : null
        if (this.anchorMode === 'head') {
          this.handleHeadPoseAnchor(visibleAnchor, width, height, completedAt)
          return
        }
        if (!visibleAnchor) return
        this.emit(this.createPoseSnapshot(visibleAnchor, width, height, completedAt, true, 'locked'))
      })
      .catch((error: unknown) => {
        this.handleInferenceFailure(error)
      })
      .finally(() => {
        this.inferenceRunning = false
        this.lastPoseAt = Math.max(this.lastPoseAt, at)
      })
  }

  private createPoseSnapshot(
    anchor: HeadAnchor,
    width: number,
    height: number,
    completedAt: number,
    locked: boolean,
    lockState: BodyTrackingLockState
  ): BodyTrackingSnapshot {
    const previous = this.lastPoseSnapshot && completedAt - this.lastPoseSnapshotAt < 650
      ? this.lastPoseSnapshot
      : this.lastSnapshot
    const elapsedScale = this.lastPoseSnapshotAt
      ? clamp((completedAt - this.lastPoseSnapshotAt) / this.poseIntervalMs, 0.7, 3)
      : 1
    const rawVelocityX = (anchor.x - previous.x) / elapsedScale
    const rawVelocityY = (anchor.y - previous.y) / elapsedScale
    const speed = Math.hypot(rawVelocityX, rawVelocityY)
    const alpha = speed > 0.035 ? 0.94 : speed > 0.012 ? 0.88 : 0.78
    const x = previous.x * (1 - alpha) + anchor.x * alpha
    const y = previous.y * (1 - alpha) + anchor.y * alpha

    this.lastPoseSnapshotAt = completedAt
    return {
      confidence: anchor.score,
      energy: clamp(speed * 11, 0, 1),
      frameHeight: height,
      frameWidth: width,
      headRadiusX: anchor.headRadiusX,
      headRadiusY: anchor.headRadiusY,
      locked,
      lockState,
      source: 'pose',
      target: anchor.target,
      velocityX: (x - previous.x) / elapsedScale,
      velocityY: (y - previous.y) / elapsedScale,
      x: clamp(x, 0.04, 0.96),
      y: clamp(y, 0.06, 0.94)
    }
  }

  private handleHeadPoseAnchor(
    anchor: HeadAnchor | null,
    width: number,
    height: number,
    completedAt: number
  ) {
    const directHead = anchor?.target === 'head' ? anchor : null

    if (!this.headLocked) {
      if (!directHead) {
        this.headCandidate = null
        this.headCandidateFrames = 0
        if (anchor) {
          this.emit(this.createPoseSnapshot(anchor, width, height, completedAt, false, 'searching'))
        }
        return
      }

      const candidateDistance = this.headCandidate
        ? Math.hypot(directHead.x - this.headCandidate.x, directHead.y - this.headCandidate.y)
        : Number.POSITIVE_INFINITY
      const confirmationRadius = Math.max(0.08, directHead.headRadiusX * 1.8)
      this.headCandidateFrames = candidateDistance <= confirmationRadius
        ? this.headCandidateFrames + 1
        : 1
      this.headCandidate = directHead

      const confirmed = this.headCandidateFrames >= this.headLockConfirmFrames
      if (confirmed) {
        this.lastDirectHeadAt = completedAt
        this.setHeadLocked(true)
      }
      const snapshot = this.createPoseSnapshot(
        directHead,
        width,
        height,
        completedAt,
        confirmed,
        confirmed ? 'locked' : 'searching'
      )
      if (confirmed) this.lastLockedHeadSnapshot = snapshot
      this.emit(snapshot)
      return
    }

    if (directHead) {
      const previous = this.lastLockedHeadSnapshot
      const distance = previous
        ? Math.hypot(directHead.x - previous.x, directHead.y - previous.y)
        : 0
      const maximumReacquireDistance = Math.max(0.24, directHead.headRadiusX * 3)
      if (previous && distance > maximumReacquireDistance) {
        this.emitHeldHead(completedAt)
        return
      }

      this.lastDirectHeadAt = completedAt
      const snapshot = this.createPoseSnapshot(directHead, width, height, completedAt, true, 'locked')
      this.lastLockedHeadSnapshot = snapshot
      this.emit(snapshot)
      return
    }

    const previous = this.lastLockedHeadSnapshot
    if (anchor?.target === 'head-estimate' && previous) {
      const distance = Math.hypot(anchor.x - previous.x, anchor.y - previous.y)
      const maximumEstimateDistance = Math.max(0.18, previous.headRadiusX * 2.6)
      if (distance <= maximumEstimateDistance && completedAt - this.lastDirectHeadAt <= this.headLostGraceMs) {
        const snapshot = this.createPoseSnapshot(anchor, width, height, completedAt, true, 'holding')
        this.lastLockedHeadSnapshot = snapshot
        this.emit(snapshot)
        return
      }
    }

    this.emitHeldHead(completedAt)
  }

  private emitHeldHead(at: number) {
    if (!this.headLocked || !this.lastLockedHeadSnapshot) return
    if (at - this.lastDirectHeadAt > this.headLostGraceMs) {
      this.expireHeadLock(at)
      return
    }

    const progress = clamp((at - this.lastDirectHeadAt) / this.headLostGraceMs, 0, 1)
    const held: BodyTrackingSnapshot = {
      ...this.lastLockedHeadSnapshot,
      confidence: this.lastLockedHeadSnapshot.confidence * (1 - progress * 0.55),
      energy: 0,
      locked: true,
      lockState: 'holding',
      target: 'head-estimate',
      velocityX: 0,
      velocityY: 0
    }
    this.lastPoseSnapshotAt = at
    this.lastLockedHeadSnapshot = held
    this.emit(held)
  }

  private emitRestrictedHeadMotion(snapshot: BodyTrackingSnapshot, at: number) {
    const previous = this.lastLockedHeadSnapshot
    if (!this.headLocked || !previous) {
      this.emit({ ...snapshot, locked: false, lockState: 'searching' })
      return
    }

    const distance = Math.hypot(snapshot.x - previous.x, snapshot.y - previous.y)
    const maximumDistance = Math.max(0.16, previous.headRadiusX * 2.6)
    if (distance > maximumDistance) {
      this.emitHeldHead(at)
      return
    }

    const x = previous.x * 0.72 + snapshot.x * 0.28
    const y = previous.y * 0.72 + snapshot.y * 0.28
    const restricted: BodyTrackingSnapshot = {
      ...snapshot,
      confidence: snapshot.confidence * 0.7,
      headRadiusX: previous.headRadiusX,
      headRadiusY: previous.headRadiusY,
      locked: true,
      lockState: 'holding',
      target: 'head-estimate',
      velocityX: x - previous.x,
      velocityY: y - previous.y,
      x,
      y
    }
    this.lastLockedHeadSnapshot = restricted
    this.emit(restricted)
  }

  private expireHeadLock(at: number) {
    if (!this.headLocked || !this.lastDirectHeadAt || at - this.lastDirectHeadAt <= this.headLostGraceMs) return
    this.headCandidate = null
    this.headCandidateFrames = 0
    this.setHeadLocked(false)
    if (this.lastLockedHeadSnapshot) {
      this.emit({
        ...this.lastLockedHeadSnapshot,
        confidence: 0,
        energy: 0,
        locked: false,
        lockState: 'searching',
        velocityX: 0,
        velocityY: 0
      })
    }
  }

  private setHeadLocked(locked: boolean) {
    if (this.headLocked === locked) return
    this.headLocked = locked
    this.options.onLockChange?.(locked)
  }

  private preparePoseInput(rgba: Uint8Array, width: number, height: number) {
    const scale = Math.min(MODEL_INPUT_SIZE / width, MODEL_INPUT_SIZE / height)
    const scaledWidth = Math.max(1, Math.round(width * scale))
    const scaledHeight = Math.max(1, Math.round(height * scale))
    const offsetX = Math.floor((MODEL_INPUT_SIZE - scaledWidth) / 2)
    const offsetY = Math.floor((MODEL_INPUT_SIZE - scaledHeight) / 2)

    if (
      !this.poseSourceIndices
      || this.poseFrameWidth !== width
      || this.poseFrameHeight !== height
    ) {
      const indices = new Int32Array(MODEL_INPUT_PIXEL_COUNT)
      indices.fill(-1)
      for (let targetY = offsetY; targetY < offsetY + scaledHeight; targetY += 1) {
        const sourceY = Math.min(
          height - 1,
          Math.max(0, Math.floor((targetY - offsetY + 0.5) * height / scaledHeight))
        )
        for (let targetX = offsetX; targetX < offsetX + scaledWidth; targetX += 1) {
          const sourceX = Math.min(
            width - 1,
            Math.max(0, Math.floor((targetX - offsetX + 0.5) * width / scaledWidth))
          )
          indices[targetY * MODEL_INPUT_SIZE + targetX] = (sourceY * width + sourceX) * 4
        }
      }
      this.poseSourceIndices = indices
      this.poseFrameWidth = width
      this.poseFrameHeight = height
    }

    this.poseInput.fill(0)
    for (let targetIndex = 0; targetIndex < MODEL_INPUT_PIXEL_COUNT; targetIndex += 1) {
      const sourceIndex = this.poseSourceIndices[targetIndex]
      if (sourceIndex < 0) continue
      const outputIndex = targetIndex * 3
      this.poseInput[outputIndex] = rgba[sourceIndex] || 0
      this.poseInput[outputIndex + 1] = rgba[sourceIndex + 1] || 0
      this.poseInput[outputIndex + 2] = rgba[sourceIndex + 2] || 0
    }

    return { offsetX, offsetY, scaledHeight, scaledWidth }
  }

  private handleInferenceFailure(error: unknown) {
    this.inferenceRunning = false
    this.inferenceFailures += 1
    if (this.inferenceFailures >= 3) {
      this.markPoseUnavailable(error instanceof Error ? error.message : '人体关键点连续推理失败')
      return
    }
    console.warn('人体关键点单帧推理失败，继续使用最近点位:', error)
  }

  private trackMotion(rgba: Uint8Array, width: number, height: number, at: number) {
    const gridWidth = Math.ceil(width / MOTION_SAMPLE_STEP)
    const gridHeight = Math.ceil(height / MOTION_SAMPLE_STEP)
    const gridSize = gridWidth * gridHeight
    const current = this.motionScratchGray?.length === gridSize
      ? this.motionScratchGray
      : new Uint8Array(gridSize)
    const weights = this.motionWeights?.length === gridSize
      ? this.motionWeights
      : new Uint8Array(gridSize)
    const visited = this.motionVisited?.length === gridSize
      ? this.motionVisited
      : new Uint8Array(gridSize)
    const queue = this.motionQueue?.length === gridSize
      ? this.motionQueue
      : new Int32Array(gridSize)
    const previousGray = this.previousGray?.length === gridSize ? this.previousGray : null
    weights.fill(0)
    visited.fill(0)
    this.motionWeights = weights
    this.motionVisited = visited
    this.motionQueue = queue
    let activeCells = 0
    let sampleIndex = 0

    for (let y = 0; y < height; y += MOTION_SAMPLE_STEP) {
      for (let x = 0; x < width; x += MOTION_SAMPLE_STEP) {
        const pixelIndex = (y * width + x) * 4
        const gray = ((rgba[pixelIndex] || 0) * 3 + (rgba[pixelIndex + 1] || 0) * 4 + (rgba[pixelIndex + 2] || 0)) >> 3
        current[sampleIndex] = gray
        if (previousGray) {
          const difference = Math.abs(gray - previousGray[sampleIndex])
          if (difference >= MOTION_THRESHOLD) {
            weights[sampleIndex] = difference
            activeCells += 1
          }
        }
        sampleIndex += 1
      }
    }

    this.previousGray = current
    this.motionScratchGray = previousGray
    if (!previousGray || activeCells < 3 || activeCells > weights.length * 0.42) return null
    const previous = this.lastSnapshot
    let best: { score: number; weight: number; x: number; y: number } | null = null

    for (let start = 0; start < weights.length; start += 1) {
      if (!weights[start] || visited[start]) continue
      let head = 0
      let tail = 0
      let totalWeight = 0
      let weightedX = 0
      let weightedY = 0
      let cells = 0
      queue[tail++] = start
      visited[start] = 1

      while (head < tail) {
        const index = queue[head++]
        const cellX = index % gridWidth
        const cellY = Math.floor(index / gridWidth)
        const weight = weights[index]
        totalWeight += weight
        weightedX += (cellX + 0.5) * weight
        weightedY += (cellY + 0.5) * weight
        cells += 1

        if (cellX > 0) {
          const neighbor = index - 1
          if (!visited[neighbor] && weights[neighbor]) {
            visited[neighbor] = 1
            queue[tail++] = neighbor
          }
        }
        if (cellX + 1 < gridWidth) {
          const neighbor = index + 1
          if (!visited[neighbor] && weights[neighbor]) {
            visited[neighbor] = 1
            queue[tail++] = neighbor
          }
        }
        if (cellY > 0) {
          const neighbor = index - gridWidth
          if (!visited[neighbor] && weights[neighbor]) {
            visited[neighbor] = 1
            queue[tail++] = neighbor
          }
        }
        if (cellY + 1 < gridHeight) {
          const neighbor = index + gridWidth
          if (!visited[neighbor] && weights[neighbor]) {
            visited[neighbor] = 1
            queue[tail++] = neighbor
          }
        }
      }

      if (cells < 3 || totalWeight <= 0) continue
      const x = weightedX / totalWeight / gridWidth
      const y = weightedY / totalWeight / gridHeight
      const distance = Math.hypot(x - previous.x, y - previous.y)
      const continuity = clamp(1.15 - distance, 0.38, 1.08)
      const score = totalWeight * continuity * Math.min(1.6, 0.72 + cells / 18)
      if (!best || score > best.score) best = { score, weight: totalWeight, x, y }
    }

    if (!best) return null
    const alpha = Math.hypot(best.x - previous.x, best.y - previous.y) > 0.05 ? 0.88 : 0.72
    const x = previous.x * (1 - alpha) + best.x * alpha
    const y = previous.y * (1 - alpha) + best.y * alpha
    const elapsedScale = this.lastMotionAt
      ? clamp((at - this.lastMotionAt) / MOTION_INTERVAL_MS, 0.75, 2)
      : 1

    return {
      confidence: clamp(best.weight / 5200, 0, 1),
      energy: clamp(best.weight / 7200, 0, 1),
      frameHeight: height,
      frameWidth: width,
      headRadiusX: 0,
      headRadiusY: 0,
      locked: this.anchorMode !== 'head',
      lockState: this.anchorMode === 'head' ? 'searching' : 'locked',
      source: 'motion' as const,
      target: 'motion' as const,
      velocityX: (x - previous.x) / elapsedScale,
      velocityY: (y - previous.y) / elapsedScale,
      x: clamp(x, 0.04, 0.96),
      y: clamp(y, 0.06, 0.94)
    }
  }

  private emit(snapshot: BodyTrackingSnapshot) {
    this.lastSnapshot = snapshot
    if (snapshot.source === 'pose') this.lastPoseSnapshot = snapshot
    if (snapshot.source !== this.source) {
      this.source = snapshot.source
      this.options.onSourceChange?.(snapshot.source)
    }
    this.options.onSnapshot(snapshot)
  }
}
