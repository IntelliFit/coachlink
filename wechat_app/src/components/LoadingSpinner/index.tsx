import { View } from '@tarojs/components'
import './index.scss'

type Props = {
  /** 直径，单位 rpx，8 的整数倍 */
  size?: number
  className?: string
}

/**
 * 全站统一的加载指示器（旋转圆环），替代「加载中...」纯文案。
 */
export function LoadingSpinner({ size = 40, className = '' }: Props) {
  const s = Math.round(size / 8) * 8 || 40
  return (
    <View
      className={`loading-spinner ${className}`.trim()}
      style={{ width: `${s}rpx`, height: `${s}rpx` }}
    />
  )
}
