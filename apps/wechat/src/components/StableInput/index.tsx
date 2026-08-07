import React from 'react'
import { Input as TaroInput, type InputProps } from '@tarojs/components'

/**
 * 微信原生 input 在聚焦时可能切换渲染层。
 *
 * - 数字输入在支持的平台启用同层状态，避免聚焦前后切换渲染层；
 * - 数字输入失焦后重建底层 input，避免第二次聚焦复用残留文字层；
 * - 页面和键盘位置调整完全沿用微信默认行为，避免原生文字层与页面滚动层错位；
 * - 文本输入和密码输入保留微信默认行为。
 */
export function StableInput(props: InputProps) {
  const [nativeGeneration, setNativeGeneration] = React.useState(0)
  const [isFocused, setIsFocused] = React.useState(false)
  const {
    type = 'text',
    value,
    alwaysEmbed,
    adjustPosition,
    onFocus,
    onInput,
    onBlur,
    ...restProps
  } = props
  const isNumericInput = type === 'number' || type === 'digit'
  const externalValue = value === undefined || value === null ? '' : String(value)
  const [draftValue, setDraftValue] = React.useState(externalValue)

  React.useEffect(() => {
    if (!isFocused) setDraftValue(externalValue)
  }, [externalValue, isFocused])

  const handleFocus: NonNullable<InputProps['onFocus']> = (event) => {
    setDraftValue(String(event.detail.value ?? externalValue))
    setIsFocused(true)
    onFocus?.(event)
  }

  const handleInput: NonNullable<InputProps['onInput']> = (event) => {
    setDraftValue(String(event.detail.value ?? ''))
    return onInput?.(event)
  }

  const handleBlur: NonNullable<InputProps['onBlur']> = (event) => {
    setDraftValue(String(event.detail.value ?? ''))
    setIsFocused(false)
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
      value={isFocused ? draftValue : externalValue}
      alwaysEmbed={alwaysEmbed ?? (isNumericInput ? true : undefined)}
      adjustPosition={adjustPosition}
      onFocus={handleFocus}
      onInput={handleInput}
      onBlur={handleBlur}
    />
  )
}
