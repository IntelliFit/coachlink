import Taro from '@tarojs/taro'

/** 相机帧 + 叠层合成录制的公共输入：每帧带一份 RGBA 相机画面。 */
export type CameraFrameCapture = {
  frameBuffer: Uint8ClampedArray
  frameHeight: number
  frameWidth: number
}

export type CompositeReplayResult = {
  kind: 'composite'
  tempVideoPath: string
}

export type CompositeReplayFinalizeProgress = {
  label: string
  percent: number
}

export type CompositeRecorderOptions = {
  durationSeconds?: number
  fps?: number
  height?: number
  videoBitsPerSecond?: number
  width?: number
}

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 480

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function drawAspectFill(
  context: any,
  source: any,
  sourceWidth: number,
  sourceHeight: number,
  targetWidth: number,
  targetHeight: number
) {
  const sourceAspect = sourceWidth / Math.max(1, sourceHeight)
  const targetAspect = targetWidth / Math.max(1, targetHeight)
  let cropX = 0
  let cropY = 0
  let cropWidth = sourceWidth
  let cropHeight = sourceHeight

  if (sourceAspect > targetAspect) {
    cropWidth = sourceHeight * targetAspect
    cropX = (sourceWidth - cropWidth) / 2
  } else if (sourceAspect < targetAspect) {
    cropHeight = sourceWidth / targetAspect
    cropY = (sourceHeight - cropHeight) / 2
  }

  context.drawImage(
    source,
    cropX,
    cropY,
    cropWidth,
    cropHeight,
    0,
    0,
    targetWidth,
    targetHeight
  )
}

/**
 * 小程序里把“相机画面 + 游戏叠层”录成视频的公共管线：
 * 2D 离屏画布合成 → WebGL 离屏画布 → MediaRecorder。
 * 子类只负责复制自己的叠层状态（cloneCapture）和画叠层（drawOverlay）。
 */
export abstract class CameraCompositeRecorder<T extends CameraFrameCapture> {
  protected readonly height: number
  protected readonly width: number
  private readonly compositeCanvas: any
  private readonly compositeCtx: any
  private readonly recorderCanvas: any
  private readonly recorder: any
  private readonly gl: any
  private readonly program: any
  private readonly positionBuffer: any
  private readonly texCoordBuffer: any
  private readonly texture: any

  private captureQueue: T[] = []
  private cameraFrameCanvas: any = null
  private cameraFrameCtx: any = null
  private destroyed = false
  private rendering = false
  private started = false
  private stopped = false
  private stopRequested = false
  private stopPromise: Promise<CompositeReplayResult | null>
  private resolveStop!: (value: CompositeReplayResult | null) => void

  static isSupported() {
    return typeof (Taro as any).createOffscreenCanvas === 'function'
      && typeof (Taro as any).createMediaRecorder === 'function'
  }

  constructor(options: CompositeRecorderOptions = {}) {
    this.width = options.width || DEFAULT_WIDTH
    this.height = options.height || DEFAULT_HEIGHT

    this.compositeCanvas = (Taro as any).createOffscreenCanvas({
      type: '2d',
      width: this.width,
      height: this.height
    })
    this.compositeCtx = this.compositeCanvas?.getContext?.('2d')
    if (!this.compositeCtx) {
      throw new Error('当前设备不支持 2D 离屏画布，无法生成回放。')
    }

    this.recorderCanvas = (Taro as any).createOffscreenCanvas({
      type: 'webgl',
      width: this.width,
      height: this.height
    })
    this.gl = this.recorderCanvas?.getContext?.('webgl')
      || this.recorderCanvas?.getContext?.('experimental-webgl')
    if (!this.gl) {
      throw new Error('当前设备不支持 WebGL 合成录制，无法生成回放。')
    }

    const programSetup = this.createProgram(this.gl)
    this.program = programSetup.program
    this.positionBuffer = programSetup.positionBuffer
    this.texCoordBuffer = programSetup.texCoordBuffer
    this.texture = programSetup.texture

    this.recorder = (Taro as any).createMediaRecorder(this.recorderCanvas, {
      duration: options.durationSeconds || 35,
      fps: options.fps || 12,
      videoBitsPerSecond: options.videoBitsPerSecond || 1600
    })

    this.stopPromise = new Promise((resolve) => {
      this.resolveStop = resolve
    })

    void this.recorder.on('stop', (res?: { tempFilePath?: string }) => {
      const tempVideoPath = res?.tempFilePath || ''
      this.started = false
      this.stopped = true
      this.resolveStop(tempVideoPath ? { kind: 'composite', tempVideoPath } : null)
    })
  }

  /** 相机回调里的数据会被复用，入队前必须深拷贝。 */
  protected abstract cloneCapture(capture: T): T

  /** 在已铺好相机画面的合成画布上画叠层。 */
  protected abstract drawOverlay(ctx: any, capture: T, width: number, height: number): void

  async start() {
    if (this.started || this.destroyed) return
    await this.recorder.start()
    this.started = true
  }

  captureFrame(capture: T) {
    if (!this.started || this.destroyed) return

    if (this.captureQueue.length >= 2) {
      this.captureQueue.splice(0, this.captureQueue.length - 1)
    }
    this.captureQueue.push(this.cloneCapture(capture))

    if (!this.rendering) {
      void this.flushQueue()
    }
  }

  async stop(onProgress?: (progress: CompositeReplayFinalizeProgress) => void) {
    if (this.destroyed) return null
    if (this.stopped) return this.stopPromise
    if (!this.started) return null

    onProgress?.({ label: '正在整理最后画面', percent: 20 })
    await this.waitForIdle()
    onProgress?.({ label: '画面整理完成', percent: 55 })

    let stopFailure: Promise<never> | undefined
    if (!this.stopped && !this.stopRequested) {
      this.stopRequested = true
      stopFailure = this.requestRecorderStop()
    }

    onProgress?.({ label: '正在生成视频文件', percent: 75 })
    const result = await this.waitForStopResult(45000, stopFailure)
    onProgress?.({ label: '视频文件已生成', percent: 88 })
    return result
  }

  async destroy() {
    if (this.destroyed) return
    this.destroyed = true
    this.captureQueue = []
    try {
      await this.recorder.destroy?.()
    } catch {
      // ignore destroy failure
    }
  }

  private async flushQueue() {
    if (this.rendering || this.destroyed) return

    this.rendering = true
    try {
      while (this.captureQueue.length && !this.destroyed) {
        const nextCapture = this.captureQueue.shift()
        if (!nextCapture) continue
        try {
          await this.recorder.requestFrame(() => {
            this.drawCapture(nextCapture)
          })
        } catch (error) {
          console.warn('小游戏回放逐帧录制失败:', error)
          this.captureQueue = []
          break
        }
      }
    } finally {
      this.rendering = false
      if (this.captureQueue.length && !this.destroyed) {
        void this.flushQueue()
      }
    }
  }

  private async waitForIdle(timeoutMs = 10000) {
    const startedAt = Date.now()
    while ((this.rendering || this.captureQueue.length) && !this.destroyed) {
      if (Date.now() - startedAt >= timeoutMs) {
        throw new Error('回放画面整理超时，请重新录制并保持当前页面开启。')
      }
      if (!this.rendering && this.captureQueue.length) {
        void this.flushQueue()
      }
      await wait(16)
    }
  }

  private requestRecorderStop() {
    return new Promise<never>((_, reject) => {
      try {
        void Promise.resolve(this.recorder.stop()).catch((error) => {
          if (!this.stopped) reject(error)
        })
      } catch (error) {
        if (!this.stopped) reject(error)
      }
    })
  }

  private async waitForStopResult(timeoutMs = 45000, stopFailure?: Promise<never>) {
    let timeoutId: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        this.stopPromise,
        ...(stopFailure ? [stopFailure] : []),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(new Error('回放生成超时，请重新录制并保持当前页面开启。'))
          }, timeoutMs)
        })
      ])
    } finally {
      if (timeoutId) clearTimeout(timeoutId)
    }
  }

  private ensureCameraFrameCanvas(width: number, height: number) {
    if (this.cameraFrameCanvas && this.cameraFrameCanvas.width === width && this.cameraFrameCanvas.height === height) {
      return
    }

    this.cameraFrameCanvas = (Taro as any).createOffscreenCanvas({
      type: '2d',
      width,
      height
    })
    this.cameraFrameCtx = this.cameraFrameCanvas?.getContext?.('2d')
    if (!this.cameraFrameCtx) {
      throw new Error('当前设备不支持相机帧离屏绘制。')
    }
  }

  private drawCapture(capture: T) {
    this.ensureCameraFrameCanvas(capture.frameWidth, capture.frameHeight)

    const frameImage = this.cameraFrameCtx.createImageData(capture.frameWidth, capture.frameHeight)
    frameImage.data.set(capture.frameBuffer)
    this.cameraFrameCtx.putImageData(frameImage, 0, 0)

    const ctx = this.compositeCtx
    const width = this.width
    const height = this.height

    ctx.clearRect(0, 0, width, height)
    ctx.fillStyle = '#111827'
    ctx.fillRect(0, 0, width, height)

    drawAspectFill(
      ctx,
      this.cameraFrameCanvas,
      capture.frameWidth,
      capture.frameHeight,
      width,
      height
    )

    this.drawOverlay(ctx, capture, width, height)
    this.blitCompositeCanvasToWebGL()
  }

  private blitCompositeCanvasToWebGL() {
    const gl = this.gl
    gl.viewport(0, 0, this.width, this.height)
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.useProgram(this.program)
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    const positionLocation = gl.getAttribLocation(this.program, 'a_position')
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texCoordBuffer)
    const texCoordLocation = gl.getAttribLocation(this.program, 'a_texCoord')
    gl.enableVertexAttribArray(texCoordLocation)
    gl.vertexAttribPointer(texCoordLocation, 2, gl.FLOAT, false, 0, 0)

    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.compositeCanvas
    )

    const samplerLocation = gl.getUniformLocation(this.program, 'u_texture')
    gl.uniform1i(samplerLocation, 0)
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    gl.flush()
  }

  private createProgram(gl: any) {
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)
    gl.shaderSource(
      vertexShader,
      `
        attribute vec2 a_position;
        attribute vec2 a_texCoord;
        varying vec2 v_texCoord;
        void main() {
          gl_Position = vec4(a_position, 0.0, 1.0);
          v_texCoord = a_texCoord;
        }
      `
    )
    gl.compileShader(vertexShader)

    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)
    gl.shaderSource(
      fragmentShader,
      `
        precision mediump float;
        varying vec2 v_texCoord;
        uniform sampler2D u_texture;
        void main() {
          gl_FragColor = texture2D(u_texture, v_texCoord);
        }
      `
    )
    gl.compileShader(fragmentShader)

    const program = gl.createProgram()
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)

    const positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        -1, -1,
        1, -1,
        -1, 1,
        1, 1
      ]),
      gl.STATIC_DRAW
    )

    const texCoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer)
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([
        0, 0,
        1, 0,
        0, 1,
        1, 1
      ]),
      gl.STATIC_DRAW
    )

    const texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

    return {
      positionBuffer,
      program,
      texCoordBuffer,
      texture
    }
  }
}
