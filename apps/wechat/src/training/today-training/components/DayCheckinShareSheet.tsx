import React, { useState } from 'react'
import { View, Text, Canvas } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { formatMonthDayTime } from '@/utils/dateFormat'
import { persistSharePosterFile } from '@/hooks/useSharePoster'
import './DayCheckinShareSheet.scss'

interface DayCheckinShareData {
  dateLabel: string
  planName: string
  nickname: string
  completedAt?: string | null
  dayIndex: number
  moduleCount: number
  completedModuleCount: number
  lightweightCompletedCount: number
  lightweightTotalCount: number
  trainingCompleted: boolean
  strengthTaskCount: number
  strengthCompletedSetCount: number
  strengthTotalSetCount: number
  strengthItems?: Array<{
    title: string
    completedSetCount: number
    setCount: number
  }>
  lightweightItems?: Array<{
    title: string
    type: string
    isCompleted: boolean
  }>
}

interface DayCheckinShareSheetProps {
  visible: boolean
  onClose: () => void
  data: DayCheckinShareData | null
}

const CANVAS_ID = 'day-checkin-share-canvas'

const drawRoundedRect = (
  ctx: any,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) => {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + width - r, y)
  ctx.quadraticCurveTo(x + width, y, x + width, y + r)
  ctx.lineTo(x + width, y + height - r)
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
  ctx.lineTo(x + r, y + height)
  ctx.quadraticCurveTo(x, y + height, x, y + height - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}

/** Canvas 的 fillText 不会自动换行；统一限制宽度，避免长文案越出卡片。 */
const drawLimitedText = (
  ctx: any,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines = 1
) => {
  const lines: string[] = []
  let line = ''

  for (const char of Array.from(String(text || ''))) {
    const next = `${line}${char}`
    if (!line || ctx.measureText(next).width <= maxWidth) {
      line = next
      continue
    }
    lines.push(line)
    line = char
  }
  if (line) lines.push(line)

  const visibleLines = lines.slice(0, maxLines)
  if (lines.length > maxLines && visibleLines.length > 0) {
    let lastLine = visibleLines[visibleLines.length - 1]
    while (lastLine && ctx.measureText(`${lastLine}…`).width > maxWidth) {
      lastLine = lastLine.slice(0, -1)
    }
    visibleLines[visibleLines.length - 1] = `${lastLine}…`
  }

  visibleLines.forEach((item, index) => ctx.fillText(item, x, y + index * lineHeight))
  return visibleLines.length
}

function DayCheckinShareSheet({
  visible,
  onClose,
  data
}: DayCheckinShareSheetProps) {
  const [saving, setSaving] = useState(false)

  if (!visible) return null

  const handleShare = async () => {
    if (!data || saving) return
    setSaving(true)

    try {
      const query = Taro.createSelectorQuery()
      query
        .select(`#${CANVAS_ID}`)
        .fields({ node: true, size: true })
        .exec((res) => {
          const target = res?.[0]
          if (!target?.node) {
            setSaving(false)
            Taro.showToast({ title: '画布初始化失败', icon: 'none' })
            return
          }

          const canvas = target.node
          const ctx = canvas.getContext('2d')
          canvas.width = 750
          canvas.height = 1180

          const gradient = ctx.createLinearGradient(0, 0, 750, 1180)
          gradient.addColorStop(0, '#CF6D4E')
          gradient.addColorStop(0.6, '#E59B7D')
          gradient.addColorStop(1, '#111827')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, 750, 1180)

          ctx.fillStyle = 'rgba(255,255,255,0.12)'
          ctx.beginPath()
          ctx.arc(640, 120, 130, 0, Math.PI * 2)
          ctx.fill()
          ctx.beginPath()
          ctx.arc(120, 1080, 120, 0, Math.PI * 2)
          ctx.fill()

          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 24px sans-serif'
          ctx.fillText('整日打卡', 56, 90)
          ctx.font = 'bold 64px sans-serif'
          ctx.fillText(`Day ${data.dayIndex}`, 56, 166)
          ctx.font = '28px sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,0.84)'
          ctx.fillText(data.dateLabel, 56, 212)

          drawRoundedRect(ctx, 52, 266, 646, 210, 34)
          ctx.fillStyle = 'rgba(255,255,255,0.14)'
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.font = '24px sans-serif'
          ctx.fillText('今日整日安排', 88, 324)
          ctx.font = 'bold 58px sans-serif'
          ctx.fillText(`${data.completedModuleCount}/${data.moduleCount} 模块已完成`, 88, 404)
          ctx.font = '24px sans-serif'
          ctx.fillStyle = 'rgba(255,255,255,0.86)'
          const summaryText =
            data.completedModuleCount >= data.moduleCount
              ? '今天的安排已经全部收尾，这是一张完整打卡快照。'
              : data.completedModuleCount > 0
                ? `今天已经推进 ${data.completedModuleCount} 个模块，还剩 ${Math.max(0, data.moduleCount - data.completedModuleCount)} 个模块。`
                : '今天还没完全展开，但也值得先记录当前状态。'
          drawLimitedText(ctx, summaryText, 88, 446, 574, 30)

          drawRoundedRect(ctx, 52, 520, 646, 610, 34)
          ctx.fillStyle = '#ffffff'
          ctx.fill()

          ctx.fillStyle = '#6B7280'
          ctx.font = '22px sans-serif'
          ctx.fillText('训练计划', 88, 584)
          ctx.fillStyle = '#111827'
          ctx.font = 'bold 38px sans-serif'
          drawLimitedText(ctx, data.planName || '今日安排', 88, 642, 574, 44)

          const cards = [
            {
              x: 88,
              y: 700,
              w: 270,
              h: 150,
              bg: '#F9FAFB',
              border: '#E5E7EB',
              title: '训练模块',
              value: data.trainingCompleted ? '已完成' : data.strengthTaskCount > 0 ? '未完成' : '今日无训练',
              desc:
                data.strengthTaskCount > 0
                  ? `${data.strengthCompletedSetCount}/${data.strengthTotalSetCount} 组`
                  : '以轻量任务为主',
              titleColor: '#6B7280',
              valueColor: '#111827',
              descColor: '#6B7280'
            },
            {
              x: 392,
              y: 700,
              w: 270,
              h: 150,
              bg: '#ECFDF5',
              border: '#BBF7D0',
              title: '轻量任务',
              value: `${data.lightweightCompletedCount}/${data.lightweightTotalCount}`,
              desc: '饮食 / 有氧 / 习惯',
              titleColor: '#047857',
              valueColor: '#065F46',
              descColor: '#047857'
            }
          ]

          cards.forEach((card) => {
            drawRoundedRect(ctx, card.x, card.y, card.w, card.h, 28)
            ctx.fillStyle = card.bg
            ctx.fill()
            ctx.strokeStyle = card.border
            ctx.lineWidth = 2
            ctx.stroke()

            ctx.fillStyle = card.titleColor
            ctx.font = 'bold 22px sans-serif'
            ctx.fillText(card.title, card.x + 24, card.y + 40)
            ctx.fillStyle = card.valueColor
            ctx.font = 'bold 42px sans-serif'
            drawLimitedText(ctx, card.value, card.x + 24, card.y + 92, card.w - 48, 44)
            ctx.fillStyle = card.descColor
            ctx.font = '20px sans-serif'
            drawLimitedText(ctx, card.desc, card.x + 24, card.y + 128, card.w - 48, 26)
          })

          drawRoundedRect(ctx, 88, 884, 574, 166, 28)
          ctx.fillStyle = '#FFF7ED'
          ctx.fill()
          ctx.strokeStyle = '#FED7AA'
          ctx.lineWidth = 2
          ctx.stroke()

          ctx.fillStyle = '#C2410C'
          ctx.font = 'bold 22px sans-serif'
          ctx.fillText('今日结论', 116, 926)
          ctx.fillStyle = '#7C2D12'
          ctx.font = 'bold 32px sans-serif'
          const conclusion =
            data.completedModuleCount >= data.moduleCount
              ? '今天不仅练到了，也把整天安排都推进完了。'
              : data.completedModuleCount > 0
                ? '今天已经推进了一部分计划，进度本身也值得记录。'
                : '今天还没完全开始，但状态也值得留下一张快照。'
          const conclusionLineCount = drawLimitedText(ctx, conclusion, 116, 980, 518, 36, 2)
          ctx.fillStyle = '#9A3412'
          ctx.font = '20px sans-serif'
          const completedLabel = formatMonthDayTime(data.completedAt || new Date())
          ctx.fillText(`状态时间 · ${completedLabel}`, 116, conclusionLineCount > 1 ? 1040 : 1024)

          ctx.fillStyle = '#111827'
          ctx.font = 'bold 22px sans-serif'
          ctx.fillText('COACHLINK', 88, 1092)
          drawRoundedRect(ctx, 538, 1060, 124, 44, 20)
          ctx.fillStyle = '#111827'
          ctx.fill()
          ctx.fillStyle = '#ffffff'
          ctx.font = 'bold 18px sans-serif'
          ctx.fillText(data.completedModuleCount >= data.moduleCount ? '已完成' : '今日状态', 554, 1088)

          Taro.canvasToTempFilePath({
            canvas,
            success: (fileRes) => {
              void (async () => {
                try {
                  const imagePath = await persistSharePosterFile(fileRes.tempFilePath, CANVAS_ID)
                  const showShareImageMenu = (Taro as any).showShareImageMenu
                  if (typeof showShareImageMenu !== 'function') {
                    Taro.showModal({
                      title: '图片已生成',
                      content: '当前微信版本不支持直接分享图片，可在预览中长按保存或发送。',
                      showCancel: false,
                      confirmText: '预览图片',
                      success: () => Taro.previewImage({ current: imagePath, urls: [imagePath] })
                    })
                    return
                  }

                  showShareImageMenu({
                    path: imagePath,
                    fail: (err: { errMsg?: string }) => {
                      if (String(err?.errMsg || '').includes('cancel')) return
                      console.error('[today-training] showShareImageMenu failed', err)
                      const isDevtools = String(Taro.getDeviceInfo?.().platform || '') === 'devtools'
                      Taro.showModal({
                        title: '图片已生成',
                        content: isDevtools
                          ? '开发者工具不支持好友、群聊或朋友圈图片分享，请在真机微信中验证。'
                          : '暂时无法调起图片分享菜单，可在预览中长按保存或发送。',
                        showCancel: false,
                        confirmText: '预览图片',
                        success: () => Taro.previewImage({ current: imagePath, urls: [imagePath] })
                      })
                    }
                  })
                } catch (error) {
                  console.error('[today-training] 持久化整日打卡图失败', error)
                  Taro.showToast({ title: '图片生成失败，请稍后重试', icon: 'none' })
                } finally {
                  setSaving(false)
                }
              })()
            },
            fail: () => {
              setSaving(false)
              Taro.showToast({ title: '生成失败，请稍后重试', icon: 'none' })
            }
          })
        })
    } catch (error) {
      console.error('[today-training] 生成整日打卡图失败', error)
      setSaving(false)
      Taro.showToast({ title: '生成失败，请稍后重试', icon: 'none' })
    }
  }

  return (
    <View className='day-share-mask' onClick={onClose}>
      <Canvas id={CANVAS_ID} type='2d' className='day-share-canvas' />
      <View className='day-share-sheet' onClick={(e) => e.stopPropagation()}>
        <View className='sheet-header'>
          <Text className='sheet-title'>分享整日打卡</Text>
        </View>
        {!data ? (
          <Text className='sheet-empty'>暂无可分享的数据</Text>
        ) : (
          <>
            <View className='share-preview-card'>
              <View className='preview-head'>
                <View>
                  <Text className='preview-day'>Day {data.dayIndex}</Text>
                  <Text className='preview-date'>{data.dateLabel}</Text>
                </View>
                <View className='preview-avatar'>
                  <Text>{(data.nickname || 'C').slice(0, 1).toUpperCase()}</Text>
                </View>
              </View>

              <View className='preview-summary'>
                <Text className='summary-title'>今日整日安排</Text>
                <Text className='summary-value'>
                  {data.completedModuleCount}/{data.moduleCount} 模块已完成
                </Text>
                <Text className='summary-desc'>
                  {data.completedModuleCount >= data.moduleCount
                    ? '今天的安排已经全部收尾。'
                    : data.completedModuleCount > 0
                      ? `已推进 ${data.completedModuleCount} 个模块。`
                      : '还没完全开始，但值得先留下一张记录。'}
                </Text>
              </View>

              <View className='preview-grid'>
                <View className='grid-card'>
                  <Text className='grid-label'>训练模块</Text>
                  <Text className='grid-value'>
                    {data.trainingCompleted ? '已完成' : data.strengthTaskCount > 0 ? '未完成' : '今日无训练'}
                  </Text>
                  <Text className='grid-desc'>
                    {data.strengthTaskCount > 0
                      ? `${data.strengthCompletedSetCount}/${data.strengthTotalSetCount} 组`
                      : '以轻量任务为主'}
                  </Text>
                </View>
                <View className='grid-card success'>
                  <Text className='grid-label'>轻量任务</Text>
                  <Text className='grid-value'>
                    {data.lightweightCompletedCount}/{data.lightweightTotalCount}
                  </Text>
                  <Text className='grid-desc'>饮食 / 有氧 / 习惯</Text>
                </View>
              </View>

              <View className='preview-detail-panel'>
                <View className='detail-panel-head'>
                  <Text className='detail-panel-title'>今日内容</Text>
                  <Text className='detail-panel-meta'>
                    {data.completedModuleCount}/{data.moduleCount} 模块
                  </Text>
                </View>
                {(data.strengthItems || []).length > 0 && (
                  <View className='detail-block'>
                    <Text className='detail-block-label'>训练</Text>
                    {(data.strengthItems || []).map((item, index) => (
                      <View key={`${item.title}-${index}`} className='detail-row'>
                        <Text className='detail-name'>{item.title}</Text>
                        <Text className='detail-status'>{item.completedSetCount}/{item.setCount}组</Text>
                      </View>
                    ))}
                  </View>
                )}
                {(data.lightweightItems || []).length > 0 && (
                  <View className='detail-block'>
                    <Text className='detail-block-label'>轻任务</Text>
                    {(data.lightweightItems || []).map((item, index) => (
                      <View key={`${item.title}-${index}`} className='detail-row'>
                        <Text className='detail-name'>{item.title}</Text>
                        <Text className={`detail-status ${item.isCompleted ? 'done' : ''}`}>
                          {item.isCompleted ? '已完成' : '待完成'}
                        </Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            </View>

            <View className='sheet-actions'>
              <View className='sheet-btn secondary' onClick={onClose}>
                <Text>取消</Text>
              </View>
              <View className={`sheet-btn primary ${saving ? 'disabled' : ''}`} onClick={handleShare}>
                <Text>{saving ? '生成中...' : '分享图片'}</Text>
              </View>
            </View>
          </>
        )}
      </View>
    </View>
  )
}

export default DayCheckinShareSheet
