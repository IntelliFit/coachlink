import Taro from '@tarojs/taro'
import type { MotionArcadeVisualKey } from './gameConfigs'

export type ArcadeReplayItem = {
  height?: number
  shape?: 'circle' | 'rect' | 'pill'
  type: 'good' | 'bad'
  width?: number
  x: number
  y: number
  size: number
}

export type ArcadeReplayCapture = {
  frameBuffer: Uint8ClampedArray
  frameHeight: number
  frameWidth: number
  items: ArcadeReplayItem[]
  player: {
    x: number
    y: number
  }
  replayFooterLabel: string
  score: number
  timeLeftMs: number
  visualKey: MotionArcadeVisualKey
}

export type ArcadeReplayResult = {
  kind: 'composite'
  tempVideoPath: string
}

type RecorderOptions = {
  durationSeconds?: number
  fps?: number
  height?: number
  videoBitsPerSecond?: number
  width?: number
}

type ReplayPalette = {
  badFill: string
  footerFill: string
  goodFill: string
  hudFill: string
  hudText: string
  playerCoreFill: string
  playerFill: string
}

const DEFAULT_WIDTH = 360
const DEFAULT_HEIGHT = 480

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function formatSeconds(ms: number) {
  return Math.max(0, Math.ceil(ms / 1000))
}

function drawAspectFill(
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

function drawRoundedRect(
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
  strokeStyle?: string,
  lineWidth = 1
) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
  ctx.fillStyle = fillStyle
  ctx.fill()
  if (strokeStyle) {
    ctx.lineWidth = lineWidth
    ctx.strokeStyle = strokeStyle
    ctx.stroke()
  }
}

function getReplayPalette(visualKey: MotionArcadeVisualKey): ReplayPalette {
  if (visualKey === 'pullup') {
    return {
      badFill: '#3f485a',
      footerFill: 'rgba(28, 36, 52, 0.82)',
      goodFill: '#f3b948',
      hudFill: 'rgba(37, 99, 235, 0.96)',
      hudText: '#ffffff',
      playerCoreFill: 'rgba(255, 255, 255, 0.24)',
      playerFill: '#2f80ed'
    }
  }

  if (visualKey === 'pushup') {
    return {
      badFill: '#6b4f3f',
      footerFill: 'rgba(49, 35, 28, 0.84)',
      goodFill: '#36c2a5',
      hudFill: 'rgba(207, 109, 78, 0.96)',
      hudText: '#ffffff',
      playerCoreFill: 'rgba(255, 255, 255, 0.26)',
      playerFill: '#ef7f59'
    }
  }

  return {
    badFill: '#27364b',
    footerFill: 'rgba(17, 24, 39, 0.78)',
    goodFill: '#f7c948',
    hudFill: 'rgba(207, 109, 78, 0.96)',
    hudText: '#ffffff',
    playerCoreFill: 'rgba(255, 255, 255, 0.32)',
    playerFill: '#cf6d4e'
  }
}

function drawReplayItem(
  ctx: any,
  item: ArcadeReplayItem,
  width: number,
  height: number,
  palette: ReplayPalette,
  visualKey: MotionArcadeVisualKey
) {
  const centerX = item.x * width
  const centerY = item.y * height
  const radius = Math.max(8, item.size * width * 0.5)
  const fill = item.type === 'good' ? palette.goodFill : palette.badFill
  const itemWidth = Math.max(radius * 2, (item.width || item.size) * width)
  const itemHeight = Math.max(radius * 2, (item.height || item.size) * height)

  if (item.shape === 'rect') {
    drawRoundedRect(
      ctx,
      centerX - itemWidth / 2,
      centerY - itemHeight / 2,
      itemWidth,
      itemHeight,
      Math.min(itemWidth, itemHeight) * 0.18,
      fill
    )
    return
  }

  if (item.shape === 'pill') {
    drawRoundedRect(
      ctx,
      centerX - itemWidth / 2,
      centerY - itemHeight / 2,
      itemWidth,
      itemHeight,
      Math.min(itemWidth, itemHeight) * 0.5,
      fill
    )
    return
  }

  if (visualKey === 'pullup' && item.type === 'good') {
    drawRoundedRect(ctx, centerX - radius * 1.3, centerY - radius * 0.5, radius * 2.6, radius, radius * 0.44, fill)
    ctx.beginPath()
    ctx.arc(centerX - radius * 0.84, centerY + radius * 0.12, radius * 0.3, 0, Math.PI * 2)
    ctx.arc(centerX + radius * 0.84, centerY + radius * 0.12, radius * 0.3, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()
    return
  }

  if (visualKey === 'pushup' && item.type === 'good') {
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
    ctx.fillStyle = fill
    ctx.fill()
    ctx.beginPath()
    ctx.arc(centerX, centerY, radius * 0.46, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.32)'
    ctx.fill()
    return
  }

  if (visualKey === 'pushup' && item.type === 'bad') {
    drawRoundedRect(ctx, centerX - radius, centerY - radius, radius * 2, radius * 2, radius * 0.32, fill)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.fillRect(centerX - radius * 0.7, centerY - 1, radius * 1.4, 2)
    return
  }

  ctx.beginPath()
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = fill
  ctx.fill()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.96)'
  ctx.stroke()
}

function drawPlayer(
  ctx: any,
  player: { x: number; y: number },
  width: number,
  height: number,
  palette: ReplayPalette,
  visualKey: MotionArcadeVisualKey
) {
  const playerX = player.x * width
  const playerY = player.y * height

  if (visualKey === 'pullup') {
    drawRoundedRect(ctx, playerX - 18, playerY - 24, 36, 48, 18, palette.playerFill, 'rgba(255,255,255,0.98)', 4)
    drawRoundedRect(ctx, playerX - 8, playerY - 10, 16, 20, 8, palette.playerCoreFill)
    return
  }

  if (visualKey === 'pushup') {
    drawRoundedRect(ctx, playerX - 26, playerY - 16, 52, 32, 16, palette.playerFill, 'rgba(255,255,255,0.98)', 4)
    drawRoundedRect(ctx, playerX - 10, playerY - 8, 20, 16, 8, palette.playerCoreFill)
    return
  }

  ctx.beginPath()
  ctx.arc(playerX, playerY, 22, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = palette.playerFill
  ctx.fill()
  ctx.lineWidth = 4
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)'
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(playerX, playerY, 10, 0, Math.PI * 2)
  ctx.closePath()
  ctx.fillStyle = palette.playerCoreFill
  ctx.fill()
}

export class MotionArcadeReplayRecorder {
  private readonly compositeCanvas: any
  private readonly compositeCtx: any
  private readonly height: number
  private readonly width: number
  private readonly recorderCanvas: any
  private readonly recorder: any
  private readonly gl: any
  private readonly program: any
  private readonly positionBuffer: any
  private readonly texCoordBuffer: any
  private readonly texture: any

  private captureQueue: ArcadeReplayCapture[] = []
  private cameraFrameCanvas: any = null
  private cameraFrameCtx: any = null
  private destroyed = false
  private rendering = false
  private started = false
  private stopPromise: Promise<ArcadeReplayResult | null>
  private resolveStop!: (value: ArcadeReplayResult | null) => void

  static isSupported() {
    return typeof (Taro as any).createOffscreenCanvas === 'function'
      && typeof (Taro as any).createMediaRecorder === 'function'
  }

  constructor(options: RecorderOptions = {}) {
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
      this.resolveStop(tempVideoPath ? { kind: 'composite', tempVideoPath } : null)
    })
  }

  async start() {
    if (this.started || this.destroyed) return
    await this.recorder.start()
    this.started = true
  }

  captureFrame(capture: ArcadeReplayCapture) {
    if (!this.started || this.destroyed) return

    const clonedCapture: ArcadeReplayCapture = {
      ...capture,
      frameBuffer: new Uint8ClampedArray(capture.frameBuffer),
      items: capture.items.map((item) => ({ ...item })),
      player: { ...capture.player }
    }

    if (this.captureQueue.length >= 2) {
      this.captureQueue.splice(0, this.captureQueue.length - 1)
    }
    this.captureQueue.push(clonedCapture)

    if (!this.rendering) {
      void this.flushQueue()
    }
  }

  async stop() {
    if (!this.started || this.destroyed) return null
    await this.waitForIdle()
    await this.recorder.stop()
    return this.stopPromise
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

  private async waitForIdle() {
    while ((this.rendering || this.captureQueue.length) && !this.destroyed) {
      if (!this.rendering && this.captureQueue.length) {
        void this.flushQueue()
      }
      await wait(16)
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

  private drawCapture(capture: ArcadeReplayCapture) {
    this.ensureCameraFrameCanvas(capture.frameWidth, capture.frameHeight)

    const frameImage = this.cameraFrameCtx.createImageData(capture.frameWidth, capture.frameHeight)
    frameImage.data.set(capture.frameBuffer)
    this.cameraFrameCtx.putImageData(frameImage, 0, 0)

    const ctx = this.compositeCtx
    const width = this.width
    const height = this.height
    const palette = getReplayPalette(capture.visualKey)

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

    ctx.fillStyle = 'rgba(15, 23, 42, 0.16)'
    ctx.fillRect(0, 0, width, height)

    const inset = 16
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.26)'
    ctx.lineWidth = 2
    drawRoundedRect(
      ctx,
      inset,
      inset,
      width - inset * 2,
      height - inset * 2,
      18,
      'rgba(0, 0, 0, 0)',
      'rgba(255, 255, 255, 0.26)',
      2
    )

    ctx.beginPath()
    ctx.moveTo(inset, height / 2)
    ctx.lineTo(width - inset, height / 2)
    ctx.moveTo(width / 2, inset)
    ctx.lineTo(width / 2, height - inset)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)'
    ctx.stroke()

    drawRoundedRect(ctx, 16, 16, 102, 34, 17, 'rgba(255,255,255,0.94)')
    drawRoundedRect(ctx, width - 132, 16, 116, 34, 17, palette.hudFill)

    ctx.fillStyle = '#111827'
    ctx.font = 'bold 14px sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(`分数 ${capture.score}`, 28, 33)

    ctx.fillStyle = palette.hudText
    ctx.fillText('回放录制中', width - 120, 33)

    capture.items.forEach((item) => {
      drawReplayItem(ctx, item, width, height, palette, capture.visualKey)
    })

    drawPlayer(ctx, capture.player, width, height, palette, capture.visualKey)

    drawRoundedRect(ctx, 16, height - 52, 132, 34, 17, palette.footerFill)
    drawRoundedRect(ctx, width - 132, height - 52, 116, 34, 17, palette.footerFill)
    ctx.fillStyle = '#ffffff'
    ctx.fillText(`剩余 ${formatSeconds(capture.timeLeftMs)} 秒`, 28, height - 35)
    ctx.fillText(capture.replayFooterLabel, width - 120, height - 35)

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
