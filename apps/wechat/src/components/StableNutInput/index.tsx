import React from 'react'
import Taro from '@tarojs/taro'
import { Input as NutInput } from '@nutui/nutui-react-taro'

type StableNutInputProps = React.ComponentProps<typeof NutInput>

let isAndroidRuntime = false

try {
  isAndroidRuntime = Taro.getSystemInfoSync().platform === 'android'
} catch {
  // 构建期和非微信运行环境没有完整系统信息，沿用微信默认的页面上推行为。
}

/** NutUI Input 的微信原生 input 兼容层，策略与 StableInput 保持一致。 */
export const StableNutInput = React.forwardRef<unknown, StableNutInputProps>(
  function StableNutInput(props, ref) {
    const [nativeGeneration, setNativeGeneration] = React.useState(0)
    const {
      type = 'text',
      alwaysEmbed,
      adjustPosition,
      onBlur,
      ...restProps
    } = props
    const isNumericInput = type === 'number' || type === 'digit'

    const handleBlur: NonNullable<StableNutInputProps['onBlur']> = (value) => {
      onBlur?.(value)
      if (isNumericInput) {
        setNativeGeneration((current) => current + 1)
      }
    }

    return (
      <NutInput
        key={nativeGeneration}
        ref={ref}
        {...restProps}
        type={type}
        alwaysEmbed={alwaysEmbed ?? (isNumericInput ? true : undefined)}
        adjustPosition={adjustPosition ?? (isAndroidRuntime && isNumericInput ? false : undefined)}
        onBlur={handleBlur}
      />
    )
  }
)
