import React, { useState, useMemo, useEffect, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import './index.scss'
import { svgToDataUri } from '@/utils/svgToDataUri'

import maleFrontSvgRaw from '@/assets/body-map/maleFrontSvg'
import maleBackSvgRaw from '@/assets/body-map/maleBackSvg'
import femaleFrontSvgRaw from '@/assets/body-map/femaleFrontSvg'
import femaleBackSvgRaw from '@/assets/body-map/femaleBackSvg'

type BodyView = 'front' | 'back'
type Gender = 'male' | 'female' | 'unknown'
type DisplayMode = 'normal' | 'professional'

/** 从 SVG 字符串中提取 data-name -> category 映射 */
function parseSvgCategoryMap(svg: string): Record<string, string> {
  const map: Record<string, string> = {}
  // 匹配单行的 <g data-name="..." category="...">
  const singleLineRegex = /<g[^>]*data-name="([^"]+)"[^>]*category="([^"]+)"[^>]*>/g
  let match: RegExpExecArray | null
  while ((match = singleLineRegex.exec(svg)) !== null) {
    if (match[1] !== '肌肉' && match[1] !== '关节' && match[1] !== '全身轮廓') {
      map[match[1]] = match[2]
    }
  }
  // 匹配多行的 <g\n  data-name="..."\n  category="...">
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
  categoryMap: Record<string, string>,
  displayMode: DisplayMode
): string {
  let result = svg

  // 确定要高亮的所有 data-name
  const dataNamesToHighlight = new Set<string>()
  for (const part of selectedParts) {
    if (displayMode === 'professional') {
      dataNamesToHighlight.add(part)
    } else {
      // normal mode: part is a category, find all data-names in that category
      for (const [dataName, category] of Object.entries(categoryMap)) {
        if (category === part) {
          dataNamesToHighlight.add(dataName)
        }
      }
    }
  }

  for (const dataName of dataNamesToHighlight) {
    // 匹配 <g ... data-name="dataName"> ... </g>（非贪婪，假设内部无嵌套 <g>）
    const regex = new RegExp(
      `(<g[^>]*data-name="${dataName}"[^>]*>)([\\s\\S]*?)(</g>)`,
      'g'
    )
    result = result.replace(regex, (match, open, content, close) => {
      const highlighted = content.replace(
        new RegExp(MUSCLE_FILL_ORIGIN_STYLE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
        MUSCLE_FILL_HIGHLIGHT_STYLE
      )
      return open + highlighted + close
    })
  }
  return result
}

const BodyPartsPage: React.FC = () => {
  const params = Taro.getCurrentInstance().router?.params as any
  const initialSelected = params?.selected ? JSON.parse(params.selected) : []
  const initialGender = (params?.gender as Gender) || 'male'
  const initialDisplayMode = (params?.displayMode as DisplayMode) || 'normal'

  const initialView = (params?.view as BodyView) || 'front'
  const [view, setView] = useState<BodyView>(initialView)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelected))
  const [gender] = useState<Gender>(initialGender)
  const [displayMode] = useState<DisplayMode>(initialDisplayMode)

  const effectiveGender = gender === 'female' ? 'female' : 'male'

  const svgRaw = useMemo(() => {
    if (effectiveGender === 'female') {
      return view === 'front' ? femaleFrontSvgRaw : femaleBackSvgRaw
    }
    return view === 'front' ? maleFrontSvgRaw : maleBackSvgRaw
  }, [view, effectiveGender])

  const categoryMap = useMemo(() => parseSvgCategoryMap(svgRaw), [svgRaw])

  // 根据 displayMode 构建可选项列表
  const options = useMemo(() => {
    if (displayMode === 'professional') {
      // 专业模式：按 data-name 列表，过滤掉关节
      return Object.entries(categoryMap)
        .filter(([, category]) => category !== '关节')
        .map(([name]) => ({
          id: name,
          label: name,
        }))
    }
    // 普通模式：按 category 去重，过滤掉关节
    const categories = Array.from(new Set(Object.values(categoryMap)))
      .filter((cat) => cat !== '关节')
    return categories.map((cat) => ({
      id: cat,
      label: cat,
    }))
  }, [categoryMap, displayMode])

  const svgDataUri = useMemo(() => {
    const baseSvg = svgRaw
      .replace(/fill:#fff/gi, 'fill:#222222')
      .replace(/fill="#fff"/gi, 'fill="#222222"')
    const highlighted = highlightSvgParts(baseSvg, Array.from(selectedIds), categoryMap, displayMode)
    const svgStr = highlighted.replace(
      /<svg\s/,
      '<svg style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" '
    )
    return svgToDataUri(svgStr)
  }, [svgRaw, selectedIds, categoryMap, displayMode])

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleFinish = () => {
    const list = Array.from(selectedIds)
    Taro.eventCenter.trigger('onboarding:bodyParts', { parts: list })
    Taro.navigateBack()
  }

  return (
    <View className='body-parts-page'>
      <View className='bp-header'>
        <View className='bp-step-dots'>
          <View className='bp-step-dot' />
          <View className='bp-step-dot' />
          <View className='bp-step-dot bp-step-dot--active' />
        </View>
        <Text className='bp-title'>目标部位</Text>
        <Text className='bp-desc'>
          {displayMode === 'professional' ? '选择你感兴趣的专业部位' : '选择你感兴趣的健身品类'}
        </Text>
      </View>

      <View className='bp-view-toggle'>
        <View
          className={`bp-view-btn ${view === 'front' ? 'bp-view-btn--active' : ''}`}
          onClick={() => setView('front')}
        >
          <Text className='bp-view-btn-text'>正面</Text>
        </View>
        <View
          className={`bp-view-btn ${view === 'back' ? 'bp-view-btn--active' : ''}`}
          onClick={() => setView('back')}
        >
          <Text className='bp-view-btn-text'>背面</Text>
        </View>
      </View>

      <View className='bp-main'>
        <View className='bp-list'>
          {options.map((m) => {
            const isSelected = selectedIds.has(m.id)
            return (
              <View
                key={m.id}
                className={`bp-muscle-chip ${isSelected ? 'bp-muscle-chip--selected' : ''}`}
                onClick={() => toggleSelection(m.id)}
              >
                <View className={`bp-check ${isSelected ? 'bp-check--checked' : ''}`}>
                  {isSelected && <Text className='bp-check-icon'>✓</Text>}
                </View>
                <Text className={`bp-muscle-label ${isSelected ? 'bp-muscle-label--selected' : ''}`}>{m.label}</Text>
              </View>
            )
          })}
        </View>

        <View className='bp-map-wrap'>
          <Image
            className='bp-map-svg'
            src={svgDataUri}
            mode='aspectFit'
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </View>

      <View className='bp-footer'>
        <View className='bp-count'>
          <Text className='bp-count-text'>已选 {selectedIds.size} 个部位</Text>
        </View>
        <View className='bp-btn' onClick={handleFinish}>
          <Text className='bp-btn-text'>完成</Text>
        </View>
      </View>
    </View>
  )
}

export default BodyPartsPage
