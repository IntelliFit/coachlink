import { View, Text, Image, Canvas } from '@tarojs/components'
import React from 'react'
import { STRENGTH_POSTER_DISPLAY_HEIGHT } from '@/streetlifting/index/calculator/poster'

import './index.scss'

export interface SharePosterModalProps {
  visible: boolean
  onClose: () => void
  title?: string
  canvasId: string
  canvasHeight?: number
  posterImageUrl: string | null
  onShareImage: () => void
  onSaveImage: () => void
  generating?: boolean
}

/**
 * 分享海报预览：浅色主题、少层级，仅遮罩 + 顶栏 + 滚动图 + 底栏。
 */
export const SharePosterModal: React.FC<SharePosterModalProps> = ({
  visible,
  onClose,
  title = '分享卡片',
  canvasId,
  canvasHeight = STRENGTH_POSTER_DISPLAY_HEIGHT,
  posterImageUrl,
  onShareImage,
  onSaveImage,
  generating = false
}) => {
  const handleSave = () => {
    if (!posterImageUrl) return
    onSaveImage()
  }

  return (
    <>
      <View className='share-poster-canvas-wrap'>
        <Canvas
          type='2d'
          id={canvasId}
          className='share-poster-canvas'
          style={{ width: '750px', height: `${canvasHeight}px` }}
        />
      </View>

      {visible && (
        <View className='share-poster-modal' catchMove>
          <View className='share-poster-bar' catchMove>
            <View className='share-poster-close' onClick={onClose}>
              <Text className='share-poster-close-x'>×</Text>
            </View>
            <Text className='share-poster-title'>{title}</Text>
          </View>

          <View className='share-poster-body'>
            {generating && !posterImageUrl && (
              <View className='share-poster-loading'>
                <View className='share-poster-spinner' />
                <Text className='share-poster-loading-text'>生成中...</Text>
              </View>
            )}
            {posterImageUrl && (
              <Image src={posterImageUrl} mode='widthFix' className='share-poster-image' />
            )}
          </View>

          <View className='share-poster-bottom-bar'>
            <View className='share-poster-channel' onClick={onShareImage}>
              <View className='share-poster-channel-icon share-poster-channel-icon-wechat'>
                <Text className='iconfont icon-share share-poster-channel-glyph' />
              </View>
              <Text className='share-poster-channel-label'>微信</Text>
            </View>
            <View className='share-poster-channel' onClick={handleSave}>
              <View className='share-poster-channel-icon share-poster-channel-icon-save'>
                <Text className='iconfont icon-download share-poster-channel-glyph' />
              </View>
              <Text className='share-poster-channel-label'>保存图片</Text>
            </View>
          </View>
        </View>
      )}
    </>
  )
}
