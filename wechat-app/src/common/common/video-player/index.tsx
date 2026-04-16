import React, { useState } from 'react'
import { View, Text, Video } from '@tarojs/components'
import { Notice } from '@nutui/icons-react-taro'
import Taro, { useRouter, useDidHide } from '@tarojs/taro'
import './index.scss'

export default function VideoPlayer() {
  const router = useRouter()
  const url =
    router.params?.source === 'pr'
      ? (Taro.getStorageSync('pr_video_url') || '')
      : (router.params?.url ? decodeURIComponent(router.params.url) : '')
  const [loadError, setLoadError] = useState(false)

  useDidHide(() => {
    if (router.params?.source === 'pr') {
      Taro.removeStorageSync('pr_video_url')
    }
  })

  if (!url) {
    return (
      <View className='video-player-page'>
        <View className='error-wrap'>
          <Text className='error-text'>视频地址无效</Text>
          <Text className='back-btn' onClick={() => Taro.navigateBack()}>返回</Text>
        </View>
      </View>
    )
  }

  const handleCopyLink = () => {
    Taro.setClipboardData({
      data: url,
      success: () => Taro.showToast({ title: '已复制到剪贴板，可在浏览器中打开', icon: 'success', duration: 2500 })
    })
  }

  return (
    <View className='video-player-page'>
      <View className='nav-bar'>
        <Text className='nav-back' onClick={() => Taro.navigateBack()}>返回</Text>
        <Text className='nav-title'>PR 视频</Text>
      </View>
      <View className='video-wrap'>
        {!loadError ? (
          <Video
            src={url}
            controls
            autoplay={false}
            show-center-play-btn
            className='video-element'
            onError={() => setLoadError(true)}
          />
        ) : (
          <View className='video-fallback'>
            <View className='fallback-icon'><Notice size={48} color="#CF6D4E" /></View>
            <Text className='fallback-title'>视频无法在小程序内播放</Text>
            <Text className='fallback-desc'>
              可能与视频域名限制有关。请复制链接到浏览器中打开观看。
            </Text>
            <View className='fallback-btn' onClick={handleCopyLink}>
              <Text>复制链接在浏览器打开</Text>
            </View>
            <Text className='fallback-back' onClick={() => Taro.navigateBack()}>返回</Text>
          </View>
        )}
      </View>
      <View className='video-footer'>
        <Text className='footer-hint'>若画面黑屏或无法播放，</Text>
        <Text className='footer-link' onClick={handleCopyLink}>点此复制链接到浏览器打开</Text>
      </View>
    </View>
  )
}
