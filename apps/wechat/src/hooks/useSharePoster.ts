import { useState, useCallback, useRef } from 'react'
import Taro, { getCurrentInstance } from '@tarojs/taro'

export interface UseSharePosterOptions<T> {
  /** Canvas 组件 id */
  canvasId: string
  /** 画布逻辑宽度（px），导出时会乘以 dpr */
  width: number
  /**
   * 绘制回调：在 Canvas 2D 上下文上执行绘制。
   * ctx 已按 dpr 缩放，直接按逻辑坐标绘制即可。
   */
  draw: (ctx: CanvasRenderingContext2D, options: T, canvas: HTMLCanvasElement) => void | Promise<void>
  /** 绘制完成后的回调，可接收 draw 函数的返回值用于诊断 */
  onDrawResult?: (result: unknown) => void
}

/** 小程序 Canvas 2D：绘制后需等待合成再导出，否则首帧常为空白 */
function waitForCanvasPaint(canvas: HTMLCanvasElement | undefined, msFallback = 64): Promise<void> {
  return new Promise((resolve) => {
    const done = () => setTimeout(() => resolve(), msFallback)
    const c = canvas as any
    if (c && typeof c.requestAnimationFrame === 'function') {
      c.requestAnimationFrame(() => {
        c.requestAnimationFrame(done)
      })
    } else {
      done()
    }
  })
}

/**
 * Canvas 导出的 http://tmp / wxfile://tmp 文件可能很快被基础库清理。
 * 立即复制到 USER_DATA_PATH，后续分享菜单和相册保存都使用稳定路径。
 */
export function persistSharePosterFile(tempFilePath: string, canvasId: string): Promise<string> {
  const userDataPath = String(Taro.env?.USER_DATA_PATH || '').replace(/\/$/, '')
  if (!userDataPath || typeof Taro.getFileSystemManager !== 'function') {
    return Promise.resolve(tempFilePath)
  }

  const safeCanvasId = canvasId.replace(/[^a-zA-Z0-9_-]/g, '_') || 'share-poster'
  const savedFilePath = `${userDataPath}/${safeCanvasId}.png`
  const fileSystemManager = Taro.getFileSystemManager()

  try {
    fileSystemManager.unlinkSync(savedFilePath)
  } catch {
    // 首次生成时目标文件不存在，直接继续复制。
  }

  return new Promise((resolve, reject) => {
    fileSystemManager.copyFile({
      srcPath: tempFilePath,
      destPath: savedFilePath,
      success: () => resolve(savedFilePath),
      fail: (error) => reject(error)
    })
  })
}

export interface UseSharePosterResult<T> {
  /** 触发海报生成，返回临时图片路径或 null */
  generate: (options: T) => Promise<string | null>
  /** 是否正在生成 */
  generating: boolean
  /** 已生成的图片临时路径 */
  imageUrl: string | null
  /** 重置状态（关闭弹窗时调用） */
  reset: () => void
}

/**
 * 通用分享海报 Hook
 * 封装 Canvas 2D 节点获取、绘制、导出为临时图片的完整流程。
 * 业务方只需提供 draw 函数和 canvasId，即可生成海报图片。
 */
export function useSharePoster<T>(options: UseSharePosterOptions<T>): UseSharePosterResult<T> {
  const { canvasId, width, draw, onDrawResult } = options
  const [generating, setGenerating] = useState(false)
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const dprRef = useRef(2)
  /** 避免 React state 异步导致重复进入；也避免 generating 卡住后永久无法重试 */
  const inFlightRef = useRef(false)

  const generate = useCallback(
    async (drawOptions: T): Promise<string | null> => {
      if (inFlightRef.current) {
        Taro.showToast({ title: '正在生成中…', icon: 'none' })
        return null
      }
      inFlightRef.current = true
      setGenerating(true)

      return new Promise((resolve) => {
        let settled = false
        let failSafeTimer: ReturnType<typeof setTimeout> | undefined
        const finish = (path: string | null) => {
          if (settled) return
          settled = true
          if (failSafeTimer !== undefined) clearTimeout(failSafeTimer)
          inFlightRef.current = false
          setGenerating(false)
          resolve(path)
        }

        const execDraw = (attempt: number) => {
          const query = Taro.createSelectorQuery()
          const page = getCurrentInstance()?.page
          if (page) {
            query.in(page as any)
          }
          query
            .select(`#${canvasId}`)
            .fields({ node: true, size: true })
            .exec(async (res) => {
              const canvas = res?.[0]?.node as HTMLCanvasElement | undefined
              if (!canvas) {
                if (attempt < 5) {
                  setTimeout(() => execDraw(attempt + 1), 80)
                  return
                }
                Taro.showToast({ title: '画布未就绪，请重试', icon: 'none' })
                finish(null)
                return
              }

              const ctx = canvas.getContext('2d')
              if (!ctx) {
                Taro.showToast({ title: '画布不可用', icon: 'none' })
                finish(null)
                return
              }

              try {
                const drawResult = await draw(ctx, drawOptions, canvas)
                if (onDrawResult) {
                  try { onDrawResult(drawResult) } catch { /* ignore */ }
                }
                await waitForCanvasPaint(canvas, 56)

                Taro.canvasToTempFilePath({
                  canvas: canvas as any,
                  destWidth: width * dprRef.current,
                  destHeight: canvas.height,
                  fileType: 'png',
                  /** 不透明导出，避免部分基础库 transparent 首帧空白 */
                  transparent: false,
                  success: async (resp) => {
                    try {
                      const savedFilePath = await persistSharePosterFile(resp.tempFilePath, canvasId)
                      setImageUrl(savedFilePath)
                      finish(savedFilePath)
                    } catch (error) {
                      console.error('[useSharePoster] persist poster file fail', error)
                      if (attempt < 2) {
                        setTimeout(() => execDraw(attempt + 1), 80)
                        return
                      }
                      Taro.showToast({ title: '分享图文件生成失败，请重试', icon: 'none' })
                      finish(null)
                    }
                  },
                  fail: (err) => {
                    console.error('[useSharePoster] canvasToTempFilePath fail', err)
                    Taro.showToast({ title: '生成失败', icon: 'none' })
                    finish(null)
                  }
                })
              } catch (e) {
                console.error('[useSharePoster] draw error', e)
                Taro.showToast({ title: '绘制失败', icon: 'none' })
                finish(null)
              }
            })
        }

        failSafeTimer = setTimeout(() => {
          if (!settled) {
            console.error('[useSharePoster] generate timeout')
            Taro.showToast({ title: '生成超时，请重试', icon: 'none' })
            finish(null)
          }
        }, 25000)

        execDraw(0)
      })
    },
    [canvasId, width, draw]
  )

  const reset = useCallback(() => {
    setImageUrl(null)
    setGenerating(false)
    inFlightRef.current = false
  }, [])

  return { generate, generating, imageUrl, reset }
}
