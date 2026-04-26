/**
 * Icon 组件 - Lucide React 图标适配器（小程序优化版）
 * 
 * 在 Taro 4.x 中，配合 @tarojs/plugin-html 插件，SVG 应该可以正常渲染
 * 如果 SVG 无法显示，请检查：
 * 1. @tarojs/plugin-html 插件是否正确配置
 * 2. 小程序基础库版本是否支持 SVG
 * 
 * 使用方式：
 * ```tsx
 * import { Icon } from '@/components/Icon'
 * import { Home } from 'lucide-react'
 * 
 * <Icon component={Home} size={24} color="#333" />
 * ```
 */

import React from 'react'
import { View } from '@tarojs/components'
import type { LucideIcon } from 'lucide-react'
import './Icon.scss'

interface IconProps {
  /** 图标组件（推荐使用，支持按需导入） */
  component?: LucideIcon
  /** 图标名称（备选方案，需要动态导入） */
  name?: string
  /** 图标大小，默认 24 */
  size?: number | string
  /** 图标颜色，默认 currentColor（继承文字颜色） */
  color?: string
  /** 自定义样式类名 */
  className?: string
  /** 线条粗细，默认 2 */
  strokeWidth?: number
}

/**
 * Icon 组件 - 小程序优化版
 * 
 * 使用 React.createElement 直接渲染 SVG 组件
 * 配合 @tarojs/plugin-html 插件，SVG 应该可以在小程序中正常渲染
 */
export const Icon: React.FC<IconProps> = ({
  component,
  name,
  size = 24,
  color = 'currentColor',
  className = '',
  strokeWidth = 2,
}) => {
  const iconSize = typeof size === 'number' ? size : parseInt(size as string)

  // 优先使用 component（推荐方式）
  if (component) {
    const IconComponent = component
    
    // 直接使用 React.createElement 渲染 SVG 组件
    // Taro 4.x + @tarojs/plugin-html 应该支持 SVG 渲染
    return (
      <View
        className={`icon-wrapper ${className}`}
        style={{
          width: `${iconSize}px`,
          height: `${iconSize}px`,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          flexShrink: 0,
        }}
      >
        <IconComponent
          size={iconSize}
          color={color}
          strokeWidth={strokeWidth}
        />
      </View>
    )
  }

  console.warn('Icon component: "component" prop is required. Please import the icon directly from lucide-react.')
  return null
}

export default Icon
