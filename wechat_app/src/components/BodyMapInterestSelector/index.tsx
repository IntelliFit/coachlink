import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'

// 微信小程序原生 API，Taro 未完全封装 env
/* eslint-disable no-var */
declare var wx: any

import maleFrontSvgRaw from '@/assets/body-map/maleFrontSvg'
import maleBackSvgRaw from '@/assets/body-map/maleBackSvg'
import femaleFrontSvgRaw from '@/assets/body-map/femaleFrontSvg'
import femaleBackSvgRaw from '@/assets/body-map/femaleBackSvg'

type BodyView = 'front' | 'back'
type Gender = 'male' | 'female' | 'unknown'

/** 从 SVG 字符串中提取 data-name -> category 映射 */
function parseSvgCategoryMap(svg: string): Record<string, string> {
  const map: Record<string, string> = {}
  const singleLineRegex = /<g[^>]*data-name="([^"]+)"[^>]*category="([^"]+)"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = singleLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  const multiLineRegex = /<g\s*\n?\s*data-name="([^"]+)"\s*\n?\s*category="([^"]+)"/g
  while ((match = multiLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  return map
}

const MUSCLE_FILL_ORIGIN_STYLE = 'fill:#222222'
const MUSCLE_FILL_HIGHLIGHT_STYLE = 'fill:#CF6D4E'

function highlightSvgParts(
  svg: string,
  selectedParts: string[],
  categoryMap: Record<string, string>
): string {
  let result = svg

  const dataNamesToHighlight = new Set<string>()
  for (const part of selectedParts) {
    for (const [dataName, category] of Object.entries(categoryMap)) {
      if (category === part) {
        dataNamesToHighlight.add(dataName)
      }
    }
  }

  for (const dataName of dataNamesToHighlight) {
    const regex = new RegExp(
      `(<g[^>]*data-name="${dataName}"[^>]*>)([\\s\\S]*?)(</g>)`,
      'g'
    )
    result = result.replace(regex, (_match, open, content, close) => {
      const highlighted = content.replace(
        new RegExp(MUSCLE_FILL_ORIGIN_STYLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        MUSCLE_FILL_HIGHLIGHT_STYLE
      )
      return open + highlighted + close
    })
  }
  return result
}

interface BodyMapInterestSelectorProps {
  gender: Gender
  selectedIds: string[]
  onChange: (selectedIds: string[]) => void
}

const BodyMapInterestSelector: React.FC<BodyMapInterestSelectorProps> = ({
  gender,
  selectedIds,
  onChange,
}) => {
  const [view, setView] = useState<BodyView>('front')
  const [svgFilePath, setSvgFilePath] = useState('')

  const effectiveGender = gender === 'female' ? 'female' : 'male'

  const svgRaw = useMemo(() => {
    if (effectiveGender === 'female') {
      return view === 'front' ? femaleFrontSvgRaw : femaleBackSvgRaw
    }
    return view === 'front' ? maleFrontSvgRaw : maleBackSvgRaw
  }, [view, effectiveGender])

  const categoryMap = useMemo(() => parseSvgCategoryMap(svgRaw), [svgRaw])

  const options = useMemo(() => {
    const categories = Array.from(new Set(Object.values(categoryMap)))
    return categories.map((cat) => ({
      id: cat,
      label: cat,
    }))
  }, [categoryMap])

  // 将 SVG 写入本地临时文件，Image 组件通过本地路径加载
  // 微信小程序 Image 组件对 data URL (base64/encodeURIComponent) 支持不稳定
  const prevFilePathRef = useRef('')
  useEffect(() => {
    const highlighted = highlightSvgParts(svgRaw, selectedIds, categoryMap)
    const cleaned = highlighted
      .replace(/fill:#fff/gi, 'fill:#222222')
      .replace(/fill="#fff"/gi, 'fill="#222222"')

    try {
      const fs = Taro.getFileSystemManager()
      // wx.env.USER_DATA_PATH 是小程序原生 API，Taro.env 可能没有 USER_DATA_PATH
      const userDataPath = wx.env.USER_DATA_PATH
      const dir = `${userDataPath}/bodymap`
      
      // 确保目录存在
      try { fs.accessSync(dir) } catch { fs.mkdirSync(dir, true) }

      // 使用简单命名避免文件名过长，并用时间戳保证唯一性
      const selectedHash = selectedIds.length > 0
        ? selectedIds.map(s => s.charCodeAt(0)).reduce((a, b) => a + b, 0)
        : 0
      const fileName = `bm_${effectiveGender}_${view}_${selectedHash}_${Date.now()}.svg`
      const filePath = `${dir}/${fileName}`

      fs.writeFileSync(filePath, cleaned, 'utf8')
      setSvgFilePath(filePath)

      // 清理上一个临时文件
      const prev = prevFilePathRef.current
      if (prev && prev !== filePath) {
        try { fs.unlinkSync(prev) } catch {}
      }
      prevFilePathRef.current = filePath
    } catch (err) {
      console.error('BodyMap SVG write failed:', err)
    }
  }, [svgRaw, selectedIds, categoryMap, effectiveGender, view])

  const toggleSelection = useCallback((id: string) => {
    const next = new Set(selectedIds)
    if (next.has(id)) {
      next.delete(id)
    } else {
      next.add(id)
    }
    onChange(Array.from(next))
  }, [selectedIds, onChange])

  return (
    <View className='bmis-wrap'>
      <View className='bmis-view-toggle'>
        <View
          className={`bmis-view-btn ${view === 'front' ? 'bmis-view-btn--active' : ''}`}
          onClick={() => setView('front')}
        >
          <Text className='bmis-view-btn-text'>正面</Text>
        </View>
        <View
          className={`bmis-view-btn ${view === 'back' ? 'bmis-view-btn--active' : ''}`}
          onClick={() => setView('back')}
        >
          <Text className='bmis-view-btn-text'>背面</Text>
        </View>
      </View>

      <View className='bmis-main'>
        <ScrollView scrollY className='bmis-list'>
          {options.map((m) => {
            const isSelected = selectedIds.includes(m.id)
            return (
              <View
                key={m.id}
                className={`bmis-chip ${isSelected ? 'bmis-chip--selected' : ''}`}
                onClick={() => toggleSelection(m.id)}
              >
                <View className={`bmis-check ${isSelected ? 'bmis-check--checked' : ''}`}>
                  {isSelected && <Text className='bmis-check-icon'>✓</Text>}
                </View>
                <Text className='bmis-chip-label'>{m.label}</Text>
              </View>
            )
          })}
        </ScrollView>

        <View className='bmis-map-wrap'>
          {svgFilePath ? (
            <Image
              className='bmis-map-img'
              src={svgFilePath}
              mode='aspectFit'
            />
          ) : (
            <View className='bmis-map-placeholder'>
              <Text className='bmis-map-placeholder-text'>加载中...</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

export default BodyMapInterestSelector
