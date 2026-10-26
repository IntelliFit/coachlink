import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { useSharePoster } from '@/hooks/useSharePoster'
import { API_BASE_URL } from '@/utils/request'
import { readMiniProgramEnvVersion } from '@/utils/apiBaseUrl'
import {
  BOJI_CARD_WIDTH,
  BOJI_POSTER_WIDTH,
  drawBojiPoster,
  drawBojiShareCard,
  type BojiShareImageData
} from './bojiPoster'

export const BOJI_POSTER_CANVAS_ID = 'boji-poster-canvas'
export const BOJI_CARD_CANVAS_ID = 'boji-card-canvas'

/** 海报上的 PK 小程序码：体验版扫出来进体验版，正式版进正式版 */
export function bojiChallengeCodeUrl(scoreId: string): string {
  const env = readMiniProgramEnvVersion() ?? 'release'
  return `${API_BASE_URL}/api/miniapp/qrcode/boji-challenge?id=${scoreId}&envVersion=${env}`
}

/**
 * 薄肌分享图：
 * - 好友卡片：有成绩后自动生成，作为「发给好友」的封面图；
 * - 朋友圈海报：点「存海报发朋友圈」时生成，可保存或用微信图片菜单直接发朋友圈。
 */
export function useBojiShareImages(data: BojiShareImageData | null, scoreId: string | null) {
  const card = useSharePoster<BojiShareImageData>({
    canvasId: BOJI_CARD_CANVAS_ID,
    width: BOJI_CARD_WIDTH,
    draw: (ctx, d) => drawBojiShareCard(ctx, d)
  })
  const poster = useSharePoster<BojiShareImageData>({
    canvasId: BOJI_POSTER_CANVAS_ID,
    width: BOJI_POSTER_WIDTH,
    draw: (ctx, d) => drawBojiPoster(ctx, d)
  })
  const [posterOpen, setPosterOpen] = useState(false)
  const cardFor = useRef<string | null>(null)
  const { generate: generateCard, reset: resetCard } = card

  useEffect(() => {
    if (!data || !scoreId || cardFor.current === scoreId) return
    cardFor.current = scoreId
    resetCard()
    // 等结果页渲染完再画，避免和标注画布抢首帧
    const timer = setTimeout(() => {
      generateCard(data).catch(() => undefined)
    }, 400)
    return () => clearTimeout(timer)
  }, [data, scoreId, generateCard, resetCard])

  const openPoster = useCallback(async () => {
    if (!data) return
    setPosterOpen(true)
    poster.reset()
    await new Promise((resolve) => setTimeout(resolve, 40))
    await poster.generate({ ...data, qrUrl: scoreId ? bojiChallengeCodeUrl(scoreId) : null })
  }, [data, poster, scoreId])

  const closePoster = useCallback(() => {
    setPosterOpen(false)
    poster.reset()
  }, [poster])

  const sharePosterImage = useCallback(() => {
    if (!poster.imageUrl) return
    // 微信的图片分享菜单里可以直接「分享到朋友圈」
    Taro.showShareImageMenu({
      path: poster.imageUrl,
      fail: () => Taro.showToast({ title: '分享失败，请先保存图片再发朋友圈', icon: 'none' })
    } as Parameters<typeof Taro.showShareImageMenu>[0])
  }, [poster.imageUrl])

  const savePoster = useCallback(() => {
    if (!poster.imageUrl) return
    Taro.saveImageToPhotosAlbum({
      filePath: poster.imageUrl,
      success: () => {
        Taro.showToast({ title: '已保存到相册', icon: 'success' })
        closePoster()
      },
      fail: (err: { errMsg?: string }) => {
        if (err.errMsg?.includes('auth deny') || err.errMsg?.includes('authorize')) {
          Taro.showModal({
            title: '提示',
            content: '需要你授权保存图片到相册',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) Taro.openSetting()
            }
          })
          return
        }
        if (!err.errMsg?.includes('cancel')) Taro.showToast({ title: '保存失败', icon: 'none' })
      }
    })
  }, [closePoster, poster.imageUrl])

  return {
    cardImageUrl: card.imageUrl,
    posterOpen,
    posterImageUrl: poster.imageUrl,
    posterGenerating: poster.generating,
    openPoster,
    closePoster,
    sharePosterImage,
    savePoster
  }
}
