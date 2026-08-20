import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/utils/request'

declare const wx: any

export type BodyTrackingSource = 'motion' | 'pose'

export type BodyTrackingTarget = 'body' | 'head' | 'head-estimate' | 'motion'

export type BodyTrackingSnapshot = {
  anchor: BodyTrackingAnchor
  confidence: number
  energy: number
  frameHeight: number
  frameWidth: number
  headRadiusX: number
  headRadiusY: number
  locked: boolean
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
  anchor?: BodyTrackingAnchor
  onLockChange?: (locked: boolean) => void
  onSnapshot: (snapshot: BodyTrackingSnapshot) => void
  onSourceChange?: (source: BodyTrackingSource) => void
  poseIntervalMs?: number
}

type PosePoint = {
  score: number
  x: number
  y: number
}

const MODEL_FILE_NAME = 'coachlink-movenet-lightning-v4.onnx'
const MODEL_FILE_SIZE = 9_466_715
const MODEL_INPUT_SIZE = 192
const POSE_INTERVAL_MS = 48
const MOTION_INTERVAL_MS = 42
const MOTION_SAMPLE_STEP = 8
const MOTION_THRESHOLD = 22
const POSE_SCORE_THRESHOLD = 0.28
const HEAD_LOCK_ACQUIRE_FRAMES = 3
const HEAD_LOCK_CANDIDATE_GAP_MS = 220
const HEAD_LOCK_LOST_MS = 720
const HEAD_LOCK_MAX_JUMP = 0.18
const HEAD_MOTION_ROI_RADIUS = 0.22

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

function buildHeadAnchor(points: PosePoint[], frameAspect: number) {
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
    locked: true,
        target: 'body' as const
      }
    : null
}

export class BodyPointTracker {
  private destroyed = false
  private inferenceRunning = false
  private inferenceFailures = 0
  private lastMotionAt = 0
  private lastHeadCandidateAt = 0
  private lastHeadSeenAt = 0
  private lastPoseAt = 0
  private lastPoseSnapshotAt = 0
  private lastPoseSnapshot: BodyTrackingSnapshot | null = null
  private lastSnapshot: BodyTrackingSnapshot = {
    anchor: 'body',
    confidence: 0,
    energy: 0,
    frameHeight: 0,
    frameWidth: 0,
    headRadiusX: 0,
    headRadiusY: 0,
    source: 'motion',
    target: 'motion',
    velocityX: 0,
    velocityY: 0,
    x: 0.5,
    y: 0.55
  }
  private options: TrackerOptions
  private poseIntervalMs: number
  private headCandidateFrames = 0
  private headLocked = false
  private lastHeadPoint: PosePoint | null = null
  private poseSession: any = null
  private previousGray: Uint8Array | null = null
  private source: BodyTrackingSource = 'motion'

  constructor(options: TrackerOptions) {
    this.options = options
    this.poseIntervalMs = clamp(Number(options.poseIntervalMs || POSE_INTERVAL_MS), 40, 120)
    void this.preparePoseSession()
  }

  processFrame(frame: CameraFrame, at = Date.now()) {
    if (this.destroyed || !frame.width || !frame.height || !(frame.data instanceof ArrayBuffer)) return

    this.updateHeadLock(at)

    const rgba = new Uint8Array(frame.data)
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
    if (snapshot) this.emit(snapshot)
  }

  destroy() {
    this.destroyed = true
    this.previousGray = null
    try {
      this.poseSession?.destroy?.()
    } catch {
      // Ignore runtimes without an explicit destroy method.
    }
    this.poseSession = null
  }

  private async preparePoseSession() {
    try {
      if (typeof wx === 'undefined' || typeof wx.createInferenceSession !== 'function') return

      const fileSystem = Taro.getFileSystemManager()
      const modelPath = `${wx.env.USER_DATA_PATH}/${MODEL_FILE_NAME}`
      if (!(await fileIsValid(fileSystem, modelPath))) {
        const response = await Taro.downloadFile({
          url: `${API_BASE_URL.replace(/\/+$/, '')}/api/toolbox/pose-model`
        })
        if (response.statusCode !== 200 || !response.tempFilePath) return
        await copyFile(fileSystem, response.tempFilePath, modelPath)
      }

      if (this.destroyed) return
      const session = wx.createInferenceSession({
        allowNPU: true,
        model: modelPath,
        precisionLevel: 2
      })
      await waitForSession(session)
      if (this.destroyed) {
        session.destroy?.()
        return
      }
      this.poseSession = session
      this.previousGray = null
    } catch (error) {
      console.warn('人体关键点模型不可用，已使用快速动作跟踪:', error)
    }
  }

  private runPose(rgba: Uint8Array, width: number, height: number, at: number) {
    if (!this.poseSession) return
    this.inferenceRunning = true
    const input = new Int32Array(MODEL_INPUT_SIZE * MODEL_INPUT_SIZE * 3)
    const scale = Math.min(MODEL_INPUT_SIZE / width, MODEL_INPUT_SIZE / height)
    const scaledWidth = Math.max(1, Math.round(width * scale))
    const scaledHeight = Math.max(1, Math.round(height * scale))
    const offsetX = Math.floor((MODEL_INPUT_SIZE - scaledWidth) / 2)
    const offsetY = Math.floor((MODEL_INPUT_SIZE - scaledHeight) / 2)

    for (let targetY = 0; targetY < MODEL_INPUT_SIZE; targetY += 1) {
      for (let targetX = 0; targetX < MODEL_INPUT_SIZE; targetX += 1) {
        if (
          targetX < offsetX
          || targetX >= offsetX + scaledWidth
          || targetY < offsetY
          || targetY >= offsetY + scaledHeight
        ) {
          continue
        }
        const sourceX = Math.min(
          width - 1,
          Math.max(0, Math.floor((targetX - offsetX + 0.5) * width / scaledWidth))
        )
        const sourceY = Math.min(
          height - 1,
          Math.max(0, Math.floor((targetY - offsetY + 0.5) * height / scaledHeight))
        )
        const sourceIndex = (sourceY * width + sourceX) * 4
        const outputIndex = (targetY * MODEL_INPUT_SIZE + targetX) * 3
        input[outputIndex] = rgba[sourceIndex] || 0
        input[outputIndex + 1] = rgba[sourceIndex + 1] || 0
        input[outputIndex + 2] = rgba[sourceIndex + 2] || 0
      }
    }

    let inference: Promise<any>
    try {
      inference = Promise.resolve(this.poseSession.run({
        input: {
          data: input.buffer,
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
        if (!values || values.length < 51) return

        const points: PosePoint[] = []
        for (let index = 0; index < 17; index += 1) {
          const modelY = values[index * 3] * MODEL_INPUT_SIZE
          const modelX = values[index * 3 + 1] * MODEL_INPUT_SIZE
          points.push({
            y: clamp((modelY - offsetY) / scaledHeight, 0, 1),
            x: clamp((modelX - offsetX) / scaledWidth, 0, 1),
            score: values[index * 3 + 2]
          })
        }

        const detectedAnchor = buildHeadAnchor(points, width / Math.max(1, height))
        const head = averageVisible(points, [0, 1, 2, 3, 4])
        const anchor = this.options.anchor === 'head' ? head : detectedAnchor
        if (!anchor || anchor.score < POSE_SCORE_THRESHOLD) return

        const completedAt = Date.now()
        if (this.options.anchor === 'head') {
          this.observeHead(anchor, completedAt)
          this.lastPoseSnapshotAt = completedAt
          if (!this.headLocked) return
        }
        const previous = this.lastPoseSnapshot || this.lastSnapshot
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
        this.inferenceFailures = 0
        this.emit({
          anchor: this.options.anchor || 'body',
          confidence: anchor.score,
          energy: clamp(speed * 11, 0, 1),
          frameHeight: height,
          frameWidth: width,
          headRadiusX: this.options.anchor === 'head' ? 0 : detectedAnchor?.headRadiusX || 0,
          headRadiusY: this.options.anchor === 'head' ? 0 : detectedAnchor?.headRadiusY || 0,
          locked: this.options.anchor !== 'head' || this.headLocked,
          source: 'pose',
          target: this.options.anchor === 'head' ? 'head' : detectedAnchor?.target || 'body',
          velocityX: (x - previous.x) / elapsedScale,
          velocityY: (y - previous.y) / elapsedScale,
          x: clamp(x, 0.04, 0.96),
          y: clamp(y, 0.06, 0.94)
        })
      })
      .catch((error: unknown) => {
        this.handleInferenceFailure(error)
      })
      .finally(() => {
        this.inferenceRunning = false
        this.lastPoseAt = Math.max(this.lastPoseAt, at)
      })
  }

  private handleInferenceFailure(error: unknown) {
    this.inferenceRunning = false
    this.inferenceFailures += 1
    if (this.inferenceFailures >= 3) {
      console.warn('人体关键点推理连续失败，已切换快速动作跟踪:', error)
      try {
        this.poseSession?.destroy?.()
      } catch {
        // Ignore cleanup errors and keep the fallback tracker available.
      }
      this.poseSession = null
      this.previousGray = null
      return
    }
    console.warn('人体关键点单帧推理失败，继续使用最近点位:', error)
  }

  private trackMotion(rgba: Uint8Array, width: number, height: number, at: number) {
    const headLockActive = this.options.anchor === 'head'
    if (headLockActive && (!this.headLocked || !this.lastHeadPoint || at - this.lastHeadSeenAt > HEAD_LOCK_LOST_MS)) return null

    const gridWidth = Math.ceil(width / MOTION_SAMPLE_STEP)
    const gridHeight = Math.ceil(height / MOTION_SAMPLE_STEP)
    const current = new Uint8Array(gridWidth * gridHeight)
    const weights = new Uint8Array(gridWidth * gridHeight)
    let activeCells = 0
    let sampleIndex = 0

    for (let y = 0; y < height; y += MOTION_SAMPLE_STEP) {
      for (let x = 0; x < width; x += MOTION_SAMPLE_STEP) {
        const pixelIndex = (y * width + x) * 4
        const gray = ((rgba[pixelIndex] || 0) * 3 + (rgba[pixelIndex + 1] || 0) * 4 + (rgba[pixelIndex + 2] || 0)) >> 3
        current[sampleIndex] = gray
        if (this.previousGray) {
          const difference = Math.abs(gray - this.previousGray[sampleIndex])
          if (difference >= MOTION_THRESHOLD) {
            weights[sampleIndex] = difference
            activeCells += 1
          }
        }
        sampleIndex += 1
      }
    }

    const previousGray = this.previousGray
    this.previousGray = current
    if (!previousGray || activeCells < 3 || activeCells > weights.length * 0.42) return null

    const visited = new Uint8Array(weights.length)
    const queue = new Int32Array(weights.length)
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

        const neighbors = [index - 1, index + 1, index - gridWidth, index + gridWidth]
        for (const neighbor of neighbors) {
          if (neighbor < 0 || neighbor >= weights.length || visited[neighbor] || !weights[neighbor]) continue
          const neighborX = neighbor % gridWidth
          if (Math.abs(neighborX - cellX) > 1) continue
          visited[neighbor] = 1
          queue[tail++] = neighbor
        }
      }

      if (cells < 3 || totalWeight <= 0) continue
      const x = weightedX / totalWeight / gridWidth
      const y = weightedY / totalWeight / gridHeight
      if (headLockActive && this.lastHeadPoint && Math.hypot(x - this.lastHeadPoint.x, y - this.lastHeadPoint.y) > HEAD_MOTION_ROI_RADIUS) continue
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
      anchor: this.options.anchor || 'body',
      confidence: clamp(best.weight / 5200, 0, 1),
      energy: clamp(best.weight / 7200, 0, 1),
      locked: !headLockActive || this.headLocked,
      frameHeight: height,
      frameWidth: width,
      headRadiusX: 0,
      headRadiusY: 0,
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
  private observeHead(head: PosePoint, at: number) {
    const previousHead = this.lastHeadPoint
    const candidateIsContinuous = Boolean(
      previousHead
      && at - this.lastHeadCandidateAt <= HEAD_LOCK_CANDIDATE_GAP_MS
      && Math.hypot(head.x - previousHead.x, head.y - previousHead.y) <= HEAD_LOCK_MAX_JUMP
    )

    this.headCandidateFrames = candidateIsContinuous ? this.headCandidateFrames + 1 : 1
    this.lastHeadCandidateAt = at
    this.lastHeadSeenAt = at
    this.lastHeadPoint = head

    if (!this.headLocked && this.headCandidateFrames >= HEAD_LOCK_ACQUIRE_FRAMES) {
      this.headLocked = true
      this.options.onLockChange?.(true)
      this.lastSnapshot = {
        anchor: 'head',
        confidence: head.score,
        energy: 0,
        frameHeight: 0,
        frameWidth: 0,
        headRadiusX: 0,
        headRadiusY: 0,
        locked: true,
        source: 'pose',
        target: 'head',
        velocityX: 0,
        velocityY: 0,
        x: head.x,
        y: head.y
      }
    }
  }

  private updateHeadLock(at: number) {
    if (this.options.anchor !== 'head' || !this.headLocked || at - this.lastHeadSeenAt <= HEAD_LOCK_LOST_MS) return
    this.headLocked = false
    this.headCandidateFrames = 0
    this.options.onLockChange?.(false)
  }
}
