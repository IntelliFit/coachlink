import React, { useState, useMemo, useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import './index.scss'
import { svgToDataUri } from '@/utils/svgToDataUri'

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
const BODY_PART_OPTION_ORDER = ['胸部', '背部', '肩部', '大臂', '小臂', '腹部', '臀部', '大腿', '小腿']

function buildBodyPartOptions(frontSvg: string, backSvg: string) {
  const categories = new Set([
    ...Object.values(parseSvgCategoryMap(frontSvg)),
    ...Object.values(parseSvgCategoryMap(backSvg)),
  ])
  return BODY_PART_OPTION_ORDER
    .filter((cat) => cat !== '关节' && categories.has(cat))
    .map((cat) => ({
      id: cat,
      label: cat,
    }))
}

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

  const effectiveGender = gender === 'female' ? 'female' : 'male'

  const svgRaw = useMemo(() => {
    if (effectiveGender === 'female') {
      return view === 'front' ? femaleFrontSvgRaw : femaleBackSvgRaw
    }
    return view === 'front' ? maleFrontSvgRaw : maleBackSvgRaw
  }, [view, effectiveGender])

  const frontSvgRaw = effectiveGender === 'female' ? femaleFrontSvgRaw : maleFrontSvgRaw
  const backSvgRaw = effectiveGender === 'female' ? femaleBackSvgRaw : maleBackSvgRaw
  const categoryMap = useMemo(() => parseSvgCategoryMap(svgRaw), [svgRaw])
  const options = useMemo(() => buildBodyPartOptions(frontSvgRaw, backSvgRaw), [frontSvgRaw, backSvgRaw])

  const svgDataUri = useMemo(() => {
    const baseSvg = svgRaw
      .replace(/fill:#fff/gi, 'fill:#222222')
      .replace(/fill="#fff"/gi, 'fill="#222222"')
    const highlighted = highlightSvgParts(baseSvg, selectedIds, categoryMap)
    const svgStr = highlighted.replace(
      /<svg\s/,
      '<svg style="width:100%;height:100%;display:block;" preserveAspectRatio="xMidYMid meet" '
    )
    return svgToDataUri(svgStr)
  }, [svgRaw, selectedIds, categoryMap])

  const handleSetView = useCallback((nextView: BodyView) => {
    setView(nextView)
  }, [])

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
          onClick={() => handleSetView('front')}
        >
          <Text className='bmis-view-btn-text'>正面</Text>
        </View>
        <View
          className={`bmis-view-btn ${view === 'back' ? 'bmis-view-btn--active' : ''}`}
          onClick={() => handleSetView('back')}
        >
          <Text className='bmis-view-btn-text'>背面</Text>
        </View>
      </View>

      <View className='bmis-help-card'>
        <Text className='bmis-help-title'>正面 / 背面只是观察角度</Text>
        <Text className='bmis-help-desc'>左侧是统一肌群列表，切换视图不会清掉选择；不同肌群会在最容易看懂的一面高亮。</Text>
      </View>

      <View className='bmis-main'>
        <View className='bmis-list'>
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
        </View>

        <View className='bmis-map-wrap'>
          <Image
            className='bmis-map-svg'
            src={svgDataUri}
            mode='aspectFit'
            style={{ width: '100%', height: '100%' }}
          />
        </View>
      </View>
    </View>
  )
}

export default BodyMapInterestSelector
