import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { View, Text, Canvas, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { Icon } from '@/components/Icon'
import { TrendingUp, ChevronDown } from 'lucide-react'
import { studentService } from '@/services/studentService'
import './StrengthProgressSection.scss'

interface StrengthProgressSectionProps {
  user: any
  subscription: any
}

interface Current1RMRecord {
  key: string
  actionId?: string
  actionName: string
  current1RM: number
  lastUpdated?: string
}

interface E1RMHistoryPoint {
  date: string
  e1rm: number
  isPR: boolean
  weight?: number
  reps?: number
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const normalizeActionId = (value: unknown): string | undefined => {
  const text = String(value || '').trim()
  return UUID_REGEX.test(text) ? text : undefined
}

const isInvalidActionName = (value: unknown): boolean => {
  const text = String(value || '').trim()
  if (!text) return true
  if (UUID_REGEX.test(text)) return true
  if (/^\d+$/.test(text)) return true
  return false
}

const formatDate = (dateStr?: string) => {
  if (!dateStr) return '--'
  const date = new Date(dateStr)
  if (Number.isNaN(date.getTime())) return '--'
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const StrengthProgressSection: React.FC<StrengthProgressSectionProps> = ({ user }) => {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [records, setRecords] = useState<Current1RMRecord[]>([])
  const [selectedRecordKey, setSelectedRecordKey] = useState('')
  const [history, setHistory] = useState<E1RMHistoryPoint[]>([])
  const [historyError, setHistoryError] = useState('')

  const loadRecords = useCallback(async () => {
    try {
      setLoadingRecords(true)
      const res = await studentService.getCurrent1RM(user?.id)
      const source = Array.isArray(res?.records) ? res.records : []
      const normalized: Current1RMRecord[] = source
        .map((item: any, index: number): Current1RMRecord | null => {
          const rawActionName = String(item?.actionName || item?.exercise_name || '').trim()
          const actionName = isInvalidActionName(rawActionName) ? '' : rawActionName
          const actionId = normalizeActionId(item?.actionId) || normalizeActionId(item?.canonicalActionId)
          if (!actionId && !actionName) {
            // 避免把历史脏键（纯数字、UUID 占位等）渲染成动作标签
            return null
          }
          const key = actionId || `name:${actionName || 'unknown'}:${index}`
          const current1RM = Number(item?.current1RM)
          return {
            key,
            actionId,
            actionName: actionName || '未命名动作',
            current1RM: Number.isFinite(current1RM) ? current1RM : 0,
            lastUpdated: item?.lastUpdated
          }
        })
        .filter((item): item is Current1RMRecord => !!item)
        .sort((a, b) => b.current1RM - a.current1RM)

      setRecords(normalized)
      setSelectedRecordKey((prev) => {
        if (!normalized.length) return ''
        if (prev && normalized.some((item) => item.key === prev)) return prev
        return normalized[0].key
      })
    } catch (error) {
      console.error('获取当前 1RM 失败:', error)
      setRecords([])
      setSelectedRecordKey('')
    } finally {
      setLoadingRecords(false)
    }
  }, [user?.id])

  useEffect(() => {
    void loadRecords()
  }, [loadRecords])

  const selectedRecord = useMemo(() => {
    if (!records.length) return null
    return records.find((item) => item.key === selectedRecordKey) || records[0]
  }, [records, selectedRecordKey])

  useEffect(() => {
    if (!selectedRecord) {
      setHistory([])
      setHistoryError('')
      return
    }

    let cancelled = false

    const loadHistory = async () => {
      try {
        setLoadingHistory(true)
        setHistoryError('')

        const res = await studentService.getE1RMHistory({
          actionId: selectedRecord.actionId,
          actionName: selectedRecord.actionName,
          targetUserId: user?.id,
          limit: 30
        })

        if (cancelled) return

        const source = Array.isArray(res?.history) ? res.history : []
        const normalized: E1RMHistoryPoint[] = source
          .map((item: any) => ({
            date: String(item?.date || ''),
            e1rm: Number(item?.e1rm),
            isPR: !!item?.isPR,
            weight: item?.weight,
            reps: item?.reps
          }))
          .filter((item) => !!item.date && Number.isFinite(item.e1rm))

        setHistory(normalized)
      } catch (error) {
        console.error('获取 E1RM 历史失败:', error)
        if (!cancelled) {
          setHistory([])
          setHistoryError('历史数据加载失败')
        }
      } finally {
        if (!cancelled) {
          setLoadingHistory(false)
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [selectedRecord?.actionId, selectedRecord?.actionName, user?.id])

  const drawChart = useCallback(() => {
    if (!isExpanded || history.length < 2) return

    const query = Taro.createSelectorQuery()
    query
      .select('#strengthTrendCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvasNode = res?.[0]
        if (!canvasNode?.node) return

        const canvas = canvasNode.node
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const cssWidth = canvasNode.width || 320
        const cssHeight = canvasNode.height || 210
        const dpr = Taro.getSystemInfoSync().pixelRatio || 1

        canvas.width = cssWidth * dpr
        canvas.height = cssHeight * dpr

        ctx.scale(dpr, dpr)
        ctx.clearRect(0, 0, cssWidth, cssHeight)

        const points = history.map((item) => ({
          xLabel: formatDate(item.date).slice(5),
          value: item.e1rm,
          isPR: item.isPR
        }))
        const values = points.map((p) => p.value)
        let maxValue = Math.max(...values)
        let minValue = Math.min(...values)
        if (!Number.isFinite(maxValue) || !Number.isFinite(minValue)) return
        if (maxValue === minValue) {
          maxValue += 1
          minValue -= 1
        } else {
          const padding = (maxValue - minValue) * 0.12
          maxValue += padding
          minValue -= padding
        }

        const left = 36
        const right = cssWidth - 14
        const top = 18
        const bottom = cssHeight - 28
        const chartWidth = right - left
        const chartHeight = bottom - top

        const getX = (index: number) => {
          if (points.length <= 1) return left
          return left + (chartWidth * index) / (points.length - 1)
        }
        const getY = (value: number) => bottom - ((value - minValue) / (maxValue - minValue)) * chartHeight

        ctx.strokeStyle = '#e2e8f0'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(left, top)
        ctx.lineTo(left, bottom)
        ctx.lineTo(right, bottom)
        ctx.stroke()

        ctx.strokeStyle = '#f97316'
        ctx.lineWidth = 2
        ctx.beginPath()
        points.forEach((point, index) => {
          const x = getX(index)
          const y = getY(point.value)
          if (index === 0) {
            ctx.moveTo(x, y)
          } else {
            ctx.lineTo(x, y)
          }
        })
        ctx.stroke()

        points.forEach((point, index) => {
          const x = getX(index)
          const y = getY(point.value)
          ctx.beginPath()
          ctx.fillStyle = point.isPR ? '#dc2626' : '#f97316'
          ctx.arc(x, y, point.isPR ? 4 : 3, 0, Math.PI * 2)
          ctx.fill()
        })

        const xIndexes = Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]))
        ctx.fillStyle = '#94a3b8'
        ctx.font = '10px sans-serif'
        ctx.textAlign = 'center'
        xIndexes.forEach((idx) => {
          const point = points[idx]
          if (!point) return
          ctx.fillText(point.xLabel, getX(idx), cssHeight - 8)
        })

        ctx.fillStyle = '#64748b'
        ctx.textAlign = 'left'
        ctx.fillText(`${maxValue.toFixed(1)}kg`, 4, top + 4)
        ctx.fillText(`${minValue.toFixed(1)}kg`, 4, bottom + 4)
      })
  }, [history, isExpanded])

  useEffect(() => {
    if (!isExpanded || loadingHistory || history.length < 2) return
    const timer = setTimeout(() => drawChart(), 60)
    return () => clearTimeout(timer)
  }, [drawChart, history.length, isExpanded, loadingHistory])

  return (
    <View className={`strength-progress-section ${isExpanded ? 'expanded' : ''}`}>
      <View 
        className="progress-header"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <View className="header-left">
          <View className={`icon-wrapper ${isExpanded ? 'expanded' : ''}`}>
            <Icon component={TrendingUp} size={18} strokeWidth={3} />
          </View>
          <View className="header-text">
            <Text className="header-title">力量进步曲线</Text>
            {!isExpanded && (
              <Text className="header-subtitle">追踪您的 E1RM 增长趋势</Text>
            )}
          </View>
        </View>

        <View className="header-right">
          {!isExpanded && (
            <View className="data-badge">
              <Text className="badge-text">DATA</Text>
            </View>
          )}
          <Icon 
            component={ChevronDown} 
            size={16}
            className={`chevron-icon ${isExpanded ? 'expanded' : ''}`}
          />
        </View>
      </View>

      <View className={`content-wrapper ${isExpanded ? 'expanded' : ''}`}>
        <View className="content-inner">
          <View className="divider" />

          {loadingRecords ? (
            <View className='chart-placeholder'>
              <Text className='placeholder-text'>正在加载力量数据...</Text>
            </View>
          ) : records.length === 0 ? (
            <View className='chart-placeholder'>
              <Icon component={TrendingUp} size={32} color="#cbd5e1" />
              <Text className='placeholder-text'>暂无力量训练记录</Text>
              <Text className='placeholder-subtext'>完成训练后将自动显示进步曲线</Text>
            </View>
          ) : (
            <View className='chart-container'>
              <ScrollView className='action-selector' scrollX>
                {records.map((record) => {
                  const selected = selectedRecord?.key === record.key
                  return (
                    <View
                      key={record.key}
                      className={`action-tag ${selected ? 'selected' : ''}`}
                      onClick={() => setSelectedRecordKey(record.key)}
                    >
                      <Text>{record.actionName}</Text>
                    </View>
                  )
                })}
              </ScrollView>

              <View className='summary-row'>
                <View className='summary-item'>
                  <Text className='summary-label'>当前 E1RM</Text>
                  <Text className='summary-value'>{(selectedRecord?.current1RM || 0).toFixed(1)}kg</Text>
                </View>
                <View className='summary-item align-right'>
                  <Text className='summary-label'>最近更新</Text>
                  <Text className='summary-value date'>{formatDate(selectedRecord?.lastUpdated)}</Text>
                </View>
              </View>

              {loadingHistory ? (
                <View className='chart-placeholder'>
                  <Text className='placeholder-text'>正在加载历史曲线...</Text>
                </View>
              ) : history.length >= 2 ? (
                <View className='canvas-wrap'>
                  <Canvas id='strengthTrendCanvas' type='2d' className='trend-canvas' />
                </View>
              ) : (
                <View className='chart-placeholder'>
                  <Text className='placeholder-text'>{historyError || '该动作历史数据不足，无法绘制曲线'}</Text>
                  <Text className='placeholder-subtext'>至少需要两次训练记录</Text>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    </View>
  )
}

export default StrengthProgressSection
