import Taro from '@tarojs/taro'
import { API_BASE_URL } from '@/utils/request'

declare const wx: any

export type BodyTrackingSource = 'motion' | 'pose'

export type BodyTrackingSnapshot = {
  confidence: number
  energy: number
  source: BodyTrackingSource
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
  onSnapshot: (snapshot: BodyTrackingSnapshot) => void
  onSourceChange?: (source: BodyTrackingSource) => void
}

type PosePoint = {
  score: number
  x: number
  y: number
}

const MODEL_FILE_NAME = 'coachlink-movenet-lightning-v4.onnx'
const MODEL_FILE_SIZE = 9_466_715
const MODEL_INPUT_SIZE = 192
const POSE_INTERVAL_MS = 58
const MOTION_INTERVAL_MS = 42
const MOTION_SAMPLE_STEP = 8
const MOTION_THRESHOLD = 22
const POSE_SCORE_THRESHOLD = 0.28

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

export class BodyPointTracker {
  private destroyed = false
  private inferenceRunning = false
  private inferenceFailures = 0
  private lastMotionAt = 0
  private lastPoseAt = 0
  private lastPoseSnapshotAt = 0
  private lastSnapshot: BodyTrackingSnapshot = {
    confidence: 0,
    energy: 0,
    source: 'motion',
    velocityX: 0,
    velocityY: 0,
    x: 0.5,
    y: 0.55
  }
  private options: TrackerOptions
  private poseSession: any = null
  private previousGray: Uint8Array | null = null
  private source: BodyTrackingSource = 'motion'

  constructor(options: TrackerOptions) {
    this.options = options
    void this.preparePoseSession()
  }

  processFrame(frame: CameraFrame, at = Date.now()) {
    if (this.destroyed || !frame.width || !frame.height || !(frame.data instanceof ArrayBuffer)) return

    const rgba = new Uint8Array(frame.data)
    if (this.poseSession) {
      if (!this.inferenceRunning && at - this.lastPoseAt >= POSE_INTERVAL_MS) {
        this.lastPoseAt = at
        this.runPose(rgba, frame.width, frame.height, at)
      }
      if (this.lastPoseSnapshotAt && at - this.lastPoseSnapshotAt < 420) return
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
    let outputIndex = 0

    for (let targetY = 0; targetY < MODEL_INPUT_SIZE; targetY += 1) {
      const sourceY = Math.min(height - 1, Math.floor((targetY + 0.5) * height / MODEL_INPUT_SIZE))
      for (let targetX = 0; targetX < MODEL_INPUT_SIZE; targetX += 1) {
        const sourceX = Math.min(width - 1, Math.floor((targetX + 0.5) * width / MODEL_INPUT_SIZE))
        const sourceIndex = (sourceY * width + sourceX) * 4
        input[outputIndex++] = rgba[sourceIndex] || 0
        input[outputIndex++] = rgba[sourceIndex + 1] || 0
        input[outputIndex++] = rgba[sourceIndex + 2] || 0
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
          points.push({
            y: values[index * 3],
            x: values[index * 3 + 1],
            score: values[index * 3 + 2]
          })
        }

        const shoulders = averageVisible(points, [5, 6])
        const hips = averageVisible(points, [11, 12])
        const head = averageVisible(points, [0, 1, 2, 3, 4])
        const anchor = shoulders || head || hips
        if (!anchor || anchor.score < POSE_SCORE_THRESHOLD) return

        const torsoCenter = shoulders && hips
          ? {
              score: (shoulders.score + hips.score) / 2,
              x: shoulders.x * 0.68 + hips.x * 0.32,
              y: shoulders.y * 0.76 + hips.y * 0.24
            }
          : anchor
        const previous = this.lastSnapshot
        const rawVelocityX = torsoCenter.x - previous.x
        const rawVelocityY = torsoCenter.y - previous.y
        const speed = Math.hypot(rawVelocityX, rawVelocityY)
        const alpha = speed > 0.035 ? 0.86 : 0.68
        const x = previous.x * (1 - alpha) + torsoCenter.x * alpha
        const y = previous.y * (1 - alpha) + torsoCenter.y * alpha

        this.lastPoseSnapshotAt = Date.now()
        this.inferenceFailures = 0
        this.emit({
          confidence: torsoCenter.score,
          energy: clamp(speed * 11, 0, 1),
          source: 'pose',
          velocityX: x - previous.x,
          velocityY: y - previous.y,
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
      source: 'motion' as const,
      velocityX: (x - previous.x) / elapsedScale,
      velocityY: (y - previous.y) / elapsedScale,
      x: clamp(x, 0.04, 0.96),
      y: clamp(y, 0.06, 0.94)
    }
  }

  private emit(snapshot: BodyTrackingSnapshot) {
    this.lastSnapshot = snapshot
    if (snapshot.source !== this.source) {
      this.source = snapshot.source
      this.options.onSourceChange?.(snapshot.source)
    }
    this.options.onSnapshot(snapshot)
  }
}
