/**
 * 图标工具函数
 * 用于在小程序环境中处理 SVG 图标
 */

import type { LucideIcon } from 'lucide-react'
import React from 'react'
import { renderToString } from 'react-dom/server'

/**
 * 将 Lucide React 图标组件转换为 SVG 字符串
 */
export const iconToSvgString = (
  IconComponent: LucideIcon,
  size: number,
  color: string,
  strokeWidth: number
): string => {
  try {
    const svgElement = React.createElement(IconComponent, {
      size,
      color,
      strokeWidth,
    })
    
    // 使用 renderToString 将 React 元素转换为字符串
    // 注意：这需要 react-dom/server，在小程序中可能不可用
    // 作为备用方案，我们返回一个占位符
    if (typeof renderToString !== 'undefined') {
      return renderToString(svgElement)
    }
    
    // 如果 renderToString 不可用，返回空字符串
    return ''
  } catch (error) {
    console.error('Icon to SVG string conversion error:', error)
    return ''
  }
}

/**
 * 将 SVG 字符串转换为 base64 数据 URL
 */
export const svgToBase64 = (svgString: string): string => {
  if (!svgString) return ''
  
  try {
    // 在小程序中，我们需要使用 Taro 的 API
    // 或者直接返回 data URL
    const base64 = btoa(unescape(encodeURIComponent(svgString)))
    return `data:image/svg+xml;base64,${base64}`
  } catch (error) {
    console.error('SVG to base64 conversion error:', error)
    return ''
  }
}

/**
 * 将图标组件转换为 base64 图片 URL
 */
export const iconToBase64 = (
  IconComponent: LucideIcon,
  size: number,
  color: string,
  strokeWidth: number
): string => {
  const svgString = iconToSvgString(IconComponent, size, color, strokeWidth)
  return svgToBase64(svgString)
}
