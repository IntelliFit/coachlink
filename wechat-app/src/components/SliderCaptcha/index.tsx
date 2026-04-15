import { useState, useEffect, useRef } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Dialog, Loading } from '@nutui/nutui-react-taro'
import { captchaService } from '@/services/captchaService'
import { Icon } from '@/components/Icon'
import { Loader2, ChevronRight } from 'lucide-react'
import './index.scss'

interface SliderCaptchaProps {
  visible: boolean
  onHide: () => void
  onSuccess: (token: string) => void
}

const THUMB_SIZE = 40

export default function SliderCaptcha({ visible, onHide, onSuccess }: SliderCaptchaProps) {
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(false)
  const [id, setId] = useState<string | null>(null)
  const [targetPercent, setTargetPercent] = useState(50)
  const [position, setPosition] = useState(0)
  
  const positionRef = useRef(0)
  const startXRef = useRef(0)
  const trackWidthRef = useRef(280)
  const maxPositionRef = useRef(240)
  const isDraggingRef = useRef(false)

  const loadChallenge = async () => {
    setLoading(true)
    setId(null)
    setTargetPercent(50)
    setPosition(0)
    positionRef.current = 0
    try {
      const data = await captchaService.create()
      setId(data.id)
      setTargetPercent(data.targetPercent)
    } catch (e: any) {
      Taro.showToast({
        title: e?.message || '加载验证失败',
        icon: 'none'
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (visible) {
      loadChallenge()
    } else {
      setPosition(0)
      positionRef.current = 0
      isDraggingRef.current = false
    }
  }, [visible])

  const handleTouchStart = (e: any) => {
    if (!id || verifying) return
    e.stopPropagation()
    
    const touch = e.touches[0]
    startXRef.current = touch.clientX
    isDraggingRef.current = true
    
    Taro.createSelectorQuery()
      .select('.slider-track')
      .boundingClientRect((rect: any) => {
        if (rect && rect.width) {
          trackWidthRef.current = rect.width
          maxPositionRef.current = rect.width - THUMB_SIZE
        }
      })
      .exec()
  }

  const handleTouchMove = (e: any) => {
    if (!isDraggingRef.current || !id || verifying) return
    e.stopPropagation()
    
    const touch = e.touches[0]
    const deltaX = touch.clientX - startXRef.current
    let newPos = positionRef.current + deltaX
    newPos = Math.max(0, Math.min(maxPositionRef.current, newPos))
    
    setPosition(newPos)
    startXRef.current = touch.clientX
    positionRef.current = newPos
  }

  const handleTouchEnd = async () => {
    if (!isDraggingRef.current) return
    isDraggingRef.current = false
    
    if (!id || verifying) return
    
    const currentPos = positionRef.current
    
    // 计算用户滑块位置的百分比（基于滑块中心点）
    const thumbCenter = currentPos + THUMB_SIZE / 2
    const userPercent = Math.round((thumbCenter / trackWidthRef.current) * 100)
    
    setVerifying(true)
    try {
      const token = await captchaService.verify(id, userPercent)
      onSuccess(token)
      onHide()
    } catch (e: any) {
      setPosition(0)
      positionRef.current = 0
      Taro.showToast({
        title: e?.message || '验证失败，请重试',
        icon: 'none'
      })
      loadChallenge()
    } finally {
      setVerifying(false)
    }
  }

  return (
    <Dialog
      visible={visible}
      onClose={onHide}
      title="安全验证"
      className="slider-captcha-dialog"
    >
      <View className="slider-captcha-content">
        <Text className="slider-captcha-tip">请将滑块拖动到缺口位置</Text>

        {loading ? (
          <View className="slider-captcha-loading">
            <Loading type="spinner" />
          </View>
        ) : id ? (
          <View
            className="slider-track"
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
          >
            {/* 缺口指示器 */}
            <View
              className="slider-gap"
              style={{ left: `${targetPercent}%` }}
            />
            {/* 滑块 */}
            <View
              className="slider-thumb"
              style={{
                transform: `translateX(${position}px)`,
                width: `${THUMB_SIZE}px`,
                height: '36px'
              }}
            >
              {verifying ? (
                <Icon component={Loader2} size={16} className="spinning" />
              ) : (
                <Icon component={ChevronRight} size={20} />
              )}
            </View>
          </View>
        ) : null}
      </View>
    </Dialog>
  )
}
