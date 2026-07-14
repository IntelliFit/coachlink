import React from 'react'
import Taro from '@tarojs/taro'
import { Input as TaroInput, type InputProps } from '@tarojs/components'

let isAndroidRuntime = false

try {
  isAndroidRuntime = Taro.getSystemInfoSync().platform === 'android'
} catch {
  // 构建期和非微信运行环境没有完整系统信息，沿用微信默认的页面上推行为。
}

/**
 * 微信原生 input 在聚焦时可能切换渲染层。数字键盘叠加 scroll-view 与页面自动上推后，
 * 部分安卓设备会偶发出现文字层和输入框坐标不同步。
 *
 * - 所有平台强制同层输入，避免聚焦前后切换渲染层；
 * - 安卓数字输入关闭微信的自动页面上推，避免页面与原生输入层被重复移动；
 * - 文本输入和非安卓环境保留微信默认的自动上推行为。
 */
export function StableInput(props: InputProps) {
  const [nativeGeneration, setNativeGeneration] = React.useState(0)
  const {
    type = 'text',
    alwaysEmbed,
    adjustPosition,
    onBlur,
    ...restProps
  } = props
  const isNumericInput = type === 'number' || type === 'digit'

  const handleBlur: NonNullable<InputProps['onBlur']> = (event) => {
    onBlur?.(event)
    if (isNumericInput) {
      // 某些真机会在第二次聚焦时复用上一次残留的原生文字层。
      // 失焦后重建底层 input，下一次聚焦从全新的原生层开始。
      setNativeGeneration((current) => current + 1)
    }
  }

  return (
    <TaroInput
      key={nativeGeneration}
      {...restProps}
      type={type}
      alwaysEmbed={alwaysEmbed ?? true}
      adjustPosition={adjustPosition ?? !(isAndroidRuntime && isNumericInput)}
      onBlur={handleBlur}
    />
  )
}
