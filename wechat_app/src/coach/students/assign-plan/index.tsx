import { View, Text, ScrollView, Input, Image } from '@tarojs/components'
import { useEffect, useMemo, useState } from 'react'
import Taro, { useRouter } from '@tarojs/taro'
import PlanCompactWeekCalendar, { PlanCompactWeekDay } from '@/components/PlanCompactWeekCalendar'
import PlanReferenceOneRMPanel from '@/components/PlanReferenceOneRMPanel'
import { coachService } from '@/services/coach/coachService'
import { planLibService } from '@/services/coach/planLibService'
import { actionLibService } from '@/services/coach/actionLibService'
import { isOneRMEligibleAction } from '@/utils/oneRmEligibility'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface CoachAction {
  id: string
  name: string
  type?: string | null
  canonical_action_id?: string | null
  enable_auto_weight_compute?: boolean | null
  enableAutoWeightCompute?: boolean | null
  attrs?: string[] | null
}

interface StudentAction {
  id: string
  name: string
  reference_1rm: number | null
  canonical_action_id: string | null
}

interface Template {
  id: string
  name: string
  description?: string
  days_count?: number
  tags?: string[]
}

interface TemplateStats {
  totalDays: number
  trainingDays: number
  restDays: number
  totalWeeks: number
  actionCount: number
}

const weekdayLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

const normalizeName = (v?: string | null) => (v || '').trim().toLowerCase()

const formatFitnessLevel = (value?: string | null) => {
  if (!value) return '未设置水平'
  const dict: Record<string, string> = {
    beginner: '零基础',
    novice: '入门',
    intermediate: '进阶',
    advanced: '高阶',
    elite: '精英 / 职业'
  }
  return dict[value] || value
}

const calculateStartedDays = (startDate?: string | null) => {
  if (!startDate) return null
  const start = new Date(startDate)
  const now = new Date()
  const diffTime = now.getTime() - start.getTime()
  return Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)))
}

export default function AssignPlanPage() {
  const router = useRouter()
  const subscriptionId = String(router.params.subscriptionId || '')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [searchDraft, setSearchDraft] = useState('')
  const [search, setSearch] = useState('')
  const [templates, setTemplates] = useState<Template[]>([])
  const [selectedTemplateId, setSelectedTemplateId] = useState('')
  const [selectedTemplateDays, setSelectedTemplateDays] = useState<any[]>([])
  const [templateActions, setTemplateActions] = useState<CoachAction[]>([])
  const [studentActions, setStudentActions] = useState<StudentAction[]>([])
  const [coachActions, setCoachActions] = useState<CoachAction[]>([])
  const [studentData, setStudentData] = useState<any | null>(null)
  const [oneRMValues, setOneRMValues] = useState<Record<string, number | null>>({})
  const [showOneRMPanel, setShowOneRMPanel] = useState(false)
  const [showScheduleOverview, setShowScheduleOverview] = useState(false)
  const [importMode, setImportMode] = useState<'overwrite' | 'new_instance'>('overwrite')
  const [existingInstanceId, setExistingInstanceId] = useState<string | null>(null)
  const [startWeek, setStartWeek] = useState(1)
  const [startDay, setStartDay] = useState(1)

  useEffect(() => {
    if (!subscriptionId) {
      Taro.showToast({ title: '缺少学员参数', icon: 'none' })
      setLoading(false)
      return
    }
    void loadData()
  }, [subscriptionId])

  const findStudentAction = (action: CoachAction): StudentAction | undefined => {
    return studentActions.find((studentAction) =>
      (action.canonical_action_id && studentAction.canonical_action_id && studentAction.canonical_action_id === action.canonical_action_id) ||
      normalizeName(studentAction.name) === normalizeName(action.name)
    )
  }

  const toTemplatePreview = (templatesRes: any) => (templatesRes?.templates || []).map((template: any) => ({
    id: template.id,
    name: template.name,
    description: template.description,
    days_count: template.days_count || template.trainingDaysCount || template.training_days_count || 0,
    tags: template.tags || []
  }))

  const loadData = async (nextSearch = search) => {
    try {
      setLoading(true)
      const [templatesRes, studentActionsRes, coachActionsRes, instanceRes, studentRes] = await Promise.all([
        planLibService.listTemplates({ page: 1, limit: 100, search: nextSearch }),
        coachService.getStudentActions({ subscriptionId }),
        actionLibService.listActions({ page: 1, limit: 1000 }),
        planLibService.getInstance({ subscriptionId }).catch(() => null),
        coachService.getStudent({ subscriptionId, need1RM: true }).catch(() => null)
      ])

      setTemplates(toTemplatePreview(templatesRes))
      setStudentActions(studentActionsRes?.actions || [])
      setCoachActions((coachActionsRes?.actions || []).map((action: any) => ({
        ...action,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? action.enable_auto_weight_compute ?? null
      })))
      setStudentData(studentRes?.student || null)

      if (instanceRes?.instance?.id) {
        setExistingInstanceId(instanceRes.instance.id)
      } else {
        setExistingInstanceId(null)
        setImportMode('new_instance')
      }
    } catch (error) {
      console.error('[coach/students/assign-plan] load failed:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    const nextSearch = searchDraft.trim()
    setSearch(nextSearch)
    await loadData(nextSearch)
  }

  const handleSelectTemplate = async (templateId: string) => {
    setSelectedTemplateId(templateId)
    setShowOneRMPanel(false)
    setShowScheduleOverview(false)
    setOneRMValues({})

    try {
      const templateRes = await planLibService.getTemplate(templateId)
      const days = Array.isArray(templateRes?.days) ? templateRes.days : []
      setSelectedTemplateDays(days)

      const coachActionMap = new Map<string, CoachAction>(coachActions.map((action) => [action.id, action]))
      const usedActions = new Map<string, CoachAction>()

      days.forEach((day: any) => {
        ;(day.actionSets || day.action_sets || []).forEach((set: any) => {
          const actionId = set.actionId || set.action_id || ''
          const actionName = set.actionName || set.action_name || set.setName || ''
          if (!actionId && !actionName) return

          const fromCoach = actionId ? coachActionMap.get(actionId) : undefined
          const key = actionId || `name:${normalizeName(actionName)}`
          if (usedActions.has(key)) return

          usedActions.set(key, {
            id: actionId || fromCoach?.id || actionName || key,
            name: fromCoach?.name || actionName || actionId || '未命名动作',
            type: fromCoach?.type ?? null,
            canonical_action_id: fromCoach?.canonical_action_id ?? null,
            attrs: fromCoach?.attrs ?? null,
            enableAutoWeightCompute: fromCoach?.enableAutoWeightCompute ?? fromCoach?.enable_auto_weight_compute ?? null
          })
        })
      })

      setTemplateActions(Array.from(usedActions.values()))
      setStartWeek(1)
      setStartDay(1)
    } catch (error) {
      console.error('[coach/students/assign-plan] load template failed:', error)
      setSelectedTemplateDays([])
      setTemplateActions([])
      Taro.showToast({ title: '模板加载失败', icon: 'none' })
    }
  }

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) || null,
    [templates, selectedTemplateId]
  )

  const eligibleActions = useMemo(() => {
    return templateActions.filter((action) => {
      const hasMeta =
        !!action.type ||
        Array.isArray(action.attrs) ||
        action.enableAutoWeightCompute !== null && action.enableAutoWeightCompute !== undefined

      if (!hasMeta) return true

      return isOneRMEligibleAction({
        type: action.type || undefined,
        attrs: action.attrs || undefined,
        enableAutoWeightCompute: action.enableAutoWeightCompute ?? action.enable_auto_weight_compute ?? undefined
      })
    })
  }, [templateActions])

  const getActionOneRM = (action: CoachAction): number | null => {
    if (oneRMValues[action.id] !== undefined) return oneRMValues[action.id]
    const studentAction = findStudentAction(action)
    return studentAction?.reference_1rm ?? null
  }

  const oneRMItems = useMemo(() => {
    return eligibleActions.map((action) => {
      const studentAction = findStudentAction(action)
      return {
        id: action.id,
        name: action.name,
        value: getActionOneRM(action),
        editable: Boolean(studentAction),
        badgeText: studentAction ? undefined : '未同步'
      }
    })
  }, [eligibleActions, oneRMValues, studentActions])

  const templateStats = useMemo<TemplateStats>(() => {
    const totalDays = selectedTemplateDays.length
    const actionCount = selectedTemplateDays.reduce((sum: number, day: any) => {
      const sets = Array.isArray(day?.actionSets) ? day.actionSets : (Array.isArray(day?.action_sets) ? day.action_sets : [])
      return sum + sets.length
    }, 0)
    const trainingDays = selectedTemplateDays.reduce((sum: number, day: any) => {
      const sets = Array.isArray(day?.actionSets) ? day.actionSets : (Array.isArray(day?.action_sets) ? day.action_sets : [])
      const isRest = day?.type === 'rest' || sets.length === 0
      return sum + (isRest ? 0 : 1)
    }, 0)

    return {
      totalDays,
      trainingDays,
      restDays: Math.max(totalDays - trainingDays, 0),
      totalWeeks: Math.max(1, Math.ceil(Math.max(totalDays, 1) / 7)),
      actionCount
    }
  }, [selectedTemplateDays])

  const activeStartWeek = Math.max(1, Math.min(startWeek, templateStats.totalWeeks))
  const activeStartDay = Math.max(1, Math.min(startDay, 7))
  const startExecutionDay = (activeStartWeek - 1) * 7 + activeStartDay
  const skippedDays = Math.max(0, startExecutionDay - 1)
  const studentStartedDays = calculateStartedDays(studentData?.start_date)

  const templateWeeks = useMemo<PlanCompactWeekDay[][]>(() => {
    if (selectedTemplateDays.length === 0) return []

    return Array.from({ length: templateStats.totalWeeks }, (_, weekIndex) => {
      const weekDays = selectedTemplateDays.slice(weekIndex * 7, weekIndex * 7 + 7)

      return weekDays.map((day: any, dayOffset: number) => {
        const dayIndex = weekIndex * 7 + dayOffset + 1
        const sets = Array.isArray(day?.actionSets) ? day.actionSets : (Array.isArray(day?.action_sets) ? day.action_sets : [])
        const rest = day?.type === 'rest' || sets.length === 0

        return {
          dayIndex,
          label: weekdayLabels[dayOffset],
          title: `第 ${dayIndex} 天`,
          meta: rest ? '休息' : `${sets.length} 项`,
          rest,
          completed: dayIndex < startExecutionDay
        }
      })
    })
  }, [selectedTemplateDays, startExecutionDay, templateStats.totalWeeks])

  const weekOptions = useMemo(
    () => Array.from({ length: templateStats.totalWeeks }, (_, index) => index + 1),
    [templateStats.totalWeeks]
  )

  const dayOptions = useMemo(
    () => Array.from({ length: 7 }, (_, index) => index + 1),
    []
  )

  const handleSaveOneRM = async () => {
    if (!subscriptionId) return

    const updates: Array<{ actionId: string; reference_1rm: number | null }> = []
    eligibleActions.forEach((action) => {
      if (oneRMValues[action.id] === undefined) return
      const studentAction = findStudentAction(action)
      if (!studentAction?.id) return
      updates.push({
        actionId: studentAction.id,
        reference_1rm: oneRMValues[action.id] ?? null
      })
    })

    if (updates.length === 0) {
      Taro.showToast({ title: '没有需要更新的 1RM', icon: 'none' })
      return
    }

    try {
      Taro.showLoading({ title: '保存中...' })
      const res = await coachService.batchUpdateStudent1RM({ subscriptionId, updates })
      if (!res) throw new Error('batch update 1rm failed')

      Taro.showToast({ title: `已更新 ${res.updated || updates.length} 项`, icon: 'success' })
      const studentActionsRes = await coachService.getStudentActions({ subscriptionId })
      setStudentActions(studentActionsRes?.actions || [])
    } catch (error) {
      console.error('[coach/students/assign-plan] save 1rm failed:', error)
      Taro.showToast({ title: '1RM 保存失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
    }
  }

  const handleAssignPlan = async () => {
    if (!selectedTemplateId || !subscriptionId) {
      Taro.showToast({ title: '请先选择模板', icon: 'none' })
      return
    }

    try {
      setSaving(true)
      Taro.showLoading({ title: '分配中...' })

      const trainingDays = Array.isArray(selectedTemplateDays) && selectedTemplateDays.length > 0
        ? selectedTemplateDays
        : (await planLibService.getTemplate(selectedTemplateId))?.days || []

      const daysToSubtract = (activeStartWeek - 1) * 7 + (activeStartDay - 1)
      const calculatedStartDate = new Date()
      calculatedStartDate.setDate(calculatedStartDate.getDate() - daysToSubtract)

      if (existingInstanceId && importMode === 'overwrite') {
        const res = await planLibService.updateInstance({
          id: existingInstanceId,
          templateId: selectedTemplateId,
          name: selectedTemplate?.name || '训练计划',
          description: selectedTemplate?.description || null,
          startExecutionDay,
          trainingDays
        })
        if (!res) throw new Error('overwrite instance failed')
      } else {
        const res = await planLibService.createInstance({
          templateId: selectedTemplateId,
          subscriptionId,
          name: selectedTemplate?.name || '训练计划',
          description: selectedTemplate?.description || null,
          trainingDays,
          startDate: calculatedStartDate.toISOString(),
          startWeek: activeStartWeek,
          startDay: activeStartDay
        })
        if (!res?.instance) throw new Error('create instance failed')
      }

      Taro.showToast({ title: '计划已分配', icon: 'success' })
      setTimeout(() => Taro.navigateBack(), 700)
    } catch (error) {
      console.error('[coach/students/assign-plan] assign failed:', error)
      Taro.showToast({ title: '分配失败', icon: 'none' })
    } finally {
      Taro.hideLoading()
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className='assign-plan-page'>
        <View className="loading"><LoadingSpinner size={48} /></View>
      </View>
    )
  }

  return (
    <ScrollView className='assign-plan-page' scrollY>
      <View className='assign-plan-page__inner'>
        <View className='assign-plan-hero'>
          <Text className='assign-plan-hero__eyebrow'>计划导入工作台</Text>
          <Text className='assign-plan-hero__title'>给学员导入计划</Text>
          <Text className='assign-plan-hero__desc'>先选择模板，再设置导入方式与起始进度，最后按需补齐学员 1RM。</Text>
          <View className='assign-plan-hero__meta'>
            <Text className='hero-pill'>{existingInstanceId ? '已有进行中计划' : '暂无当前计划'}</Text>
            <Text className='hero-pill'>{templates.length} 个模板</Text>
            {search ? <Text className='hero-pill'>搜索: {search}</Text> : null}
          </View>
        </View>

        {studentData?.profile ? (
          <View className='section student-card'>
            <View className='student-card__header'>
              <Image className='student-card__avatar' src={studentData.profile.avatar_url || 'https://via.placeholder.com/88'} />
              <View className='student-card__main'>
                <Text className='student-card__name'>{studentData.profile.nickname || studentData.profile.full_name || '学员'}</Text>
                <Text className='student-card__meta'>
                  {[studentData.profile.gender, formatFitnessLevel(studentData.profile.fitness_level)].filter(Boolean).join(' · ')}
                </Text>
                <Text className='student-card__sub'>
                  {studentStartedDays !== null ? `已开始 ${studentStartedDays} 天` : '尚未记录开始时间'}
                </Text>
              </View>
            </View>
            <View className='student-card__stats'>
              <View className='student-stat'>
                <Text className='student-stat__value'>{studentData.profile.height || '-'}</Text>
                <Text className='student-stat__label'>身高(cm)</Text>
              </View>
              <View className='student-stat'>
                <Text className='student-stat__value'>{studentData.profile.weight || '-'}</Text>
                <Text className='student-stat__label'>体重(kg)</Text>
              </View>
              <View className='student-stat'>
                <Text className='student-stat__value'>{studentData.profile.fitness_goal || '-'}</Text>
                <Text className='student-stat__label'>训练目标</Text>
              </View>
            </View>
          </View>
        ) : null}

        <View className='section'>
          <View className='section-header'>
            <View>
              <Text className='section-title'>搜索模板</Text>
              <Text className='section-caption'>按模板名或描述快速筛选，导入逻辑尽量贴近网站端。</Text>
            </View>
          </View>
          <View className='search-row'>
            <Input
              className='search-input'
              value={searchDraft}
              placeholder='搜索模板名称或描述'
              onInput={(event) => setSearchDraft(event.detail.value)}
              onConfirm={() => void handleSearch()}
            />
            <View className='search-btn' onClick={() => void handleSearch()}>
              <Text>搜索</Text>
            </View>
          </View>
        </View>

        <View className='section'>
          <View className='section-header'>
            <View>
              <Text className='section-title'>选择计划模板</Text>
              <Text className='section-caption'>像网站端一样，先锁定模板，再进行后续配置。</Text>
            </View>
            <Text className='section-side'>{templates.length} 个结果</Text>
          </View>
          <View className='template-list'>
            {templates.map((template) => (
              <View
                key={template.id}
                className={`template-item ${selectedTemplateId === template.id ? 'selected' : ''}`}
                onClick={() => void handleSelectTemplate(template.id)}
              >
                <View className='template-item__head'>
                  <View className='template-item__copy'>
                    <Text className='template-name'>{template.name}</Text>
                    <Text className='template-desc'>{template.description || '暂无描述'}</Text>
                  </View>
                  {selectedTemplateId === template.id ? <Text className='template-status'>已选中</Text> : null}
                </View>
                <View className='template-meta'>
                  <Text className='template-meta__pill'>{template.days_count || 0} 天</Text>
                  {Array.isArray(template.tags) && template.tags.slice(0, 3).map((tag) => (
                    <Text key={`${template.id}-${tag}`} className='template-meta__pill muted'>{tag}</Text>
                  ))}
                </View>
              </View>
            ))}
            {templates.length === 0 ? (
              <View className='empty-block'>
                <Text className='empty-block__title'>暂无可分配模板</Text>
                <Text className='empty-block__desc'>可以先去计划库补模板，再回到这里导入给学员。</Text>
              </View>
            ) : null}
          </View>
        </View>

        {selectedTemplate ? (
          <>
            <View className='section template-focus'>
              <View className='section-header'>
                <View>
                  <Text className='section-title'>已选模板</Text>
                  <Text className='section-caption'>先确认模板概况，再决定从哪里开始执行。</Text>
                </View>
              </View>
              <Text className='template-focus__name'>{selectedTemplate.name}</Text>
              <Text className='template-focus__desc'>{selectedTemplate.description || '暂无描述'}</Text>
              <View className='summary-pills'>
                <Text className='summary-pill'>{templateStats.totalWeeks} 周</Text>
                <Text className='summary-pill'>{templateStats.trainingDays} 个训练日</Text>
                <Text className='summary-pill'>{templateStats.restDays} 个休息日</Text>
                <Text className='summary-pill'>{templateStats.actionCount} 个动作项</Text>
                {eligibleActions.length > 0 ? <Text className='summary-pill accent'>{eligibleActions.length} 个 1RM 动作</Text> : null}
              </View>
              {Array.isArray(selectedTemplate.tags) && selectedTemplate.tags.length > 0 ? (
                <View className='template-meta'>
                  {selectedTemplate.tags.map((tag) => (
                    <Text key={`selected-${tag}`} className='template-meta__pill muted'>{tag}</Text>
                  ))}
                </View>
              ) : null}
            </View>

            <View className='section'>
              <View className='section-header'>
                <View>
                  <Text className='section-title'>导入方式</Text>
                  <Text className='section-caption'>网站端默认把“覆盖当前”和“新建阶段”分开表达，这里也沿用这个心智。</Text>
                </View>
              </View>
              <View className='mode-grid'>
                <View
                  className={`mode-card ${importMode === 'overwrite' ? 'active' : ''} ${!existingInstanceId ? 'disabled' : ''}`}
                  onClick={() => {
                    if (!existingInstanceId) return
                    setImportMode('overwrite')
                  }}
                >
                  <Text className='mode-card__title'>覆盖当前计划</Text>
                  <Text className='mode-card__desc'>保留历史执行记录，只替换当前实例的后续内容。</Text>
                  <Text className='mode-card__meta'>{existingInstanceId ? '适合直接更新学员当前计划' : '当前没有可覆盖的实例'}</Text>
                </View>
                <View
                  className={`mode-card ${importMode === 'new_instance' ? 'active' : ''}`}
                  onClick={() => setImportMode('new_instance')}
                >
                  <Text className='mode-card__title'>新建阶段</Text>
                  <Text className='mode-card__desc'>为学员开一个新的训练阶段，更适合周期切换或阶段进阶。</Text>
                  <Text className='mode-card__meta'>推荐在计划明显变更时使用</Text>
                </View>
              </View>
            </View>

            <View className='section'>
              <View className='section-header'>
                <View>
                  <Text className='section-title'>起始进度</Text>
                  <Text className='section-caption'>网站端是先定起始周/起始天，这里额外给到周历预览，方便直接点击起点。</Text>
                </View>
                <Text
                  className='section-link'
                  onClick={() => {
                    setStartWeek(1)
                    setStartDay(1)
                  }}
                >
                  从第 1 天开始
                </Text>
              </View>

              <View className='start-summary'>
                <Text className='start-summary__title'>从第 {activeStartWeek} 周第 {activeStartDay} 天开始执行</Text>
                <Text className='start-summary__desc'>
                  {skippedDays > 0 ? `系统会将前 ${skippedDays} 天视为已完成。` : '将从计划开头开始执行，不跳过任何天数。'}
                </Text>
              </View>

              {templateWeeks.length > 0 ? (
                <PlanCompactWeekCalendar
                  title='计划周历预览'
                  caption='点某一天就能把它作为起始执行日。'
                  weeks={templateWeeks}
                  currentWeekIndex={activeStartWeek - 1}
                  selectedDayIndex={startExecutionDay}
                  expanded={showScheduleOverview}
                  onSelectDay={(dayIndex) => {
                    const nextIndex = Math.max(1, Math.min(dayIndex, templateStats.totalDays || 1))
                    setStartWeek(Math.ceil(nextIndex / 7))
                    setStartDay(((nextIndex - 1) % 7) + 1)
                  }}
                  onPrevWeek={() => setStartWeek((current) => Math.max(1, current - 1))}
                  onNextWeek={() => setStartWeek((current) => Math.min(templateStats.totalWeeks, current + 1))}
                  onToggleExpanded={() => setShowScheduleOverview((current) => !current)}
                />
              ) : null}

              <View className='picker-block'>
                <Text className='picker-block__label'>起始周</Text>
                <View className='picker-grid'>
                  {weekOptions.map((week) => (
                    <Text
                      key={`week-${week}`}
                      className={`picker-chip ${activeStartWeek === week ? 'active' : ''}`}
                      onClick={() => setStartWeek(week)}
                    >
                      第 {week} 周
                    </Text>
                  ))}
                </View>
              </View>

              <View className='picker-block'>
                <Text className='picker-block__label'>起始天</Text>
                <View className='picker-grid'>
                  {dayOptions.map((day) => (
                    <Text
                      key={`day-${day}`}
                      className={`picker-chip ${activeStartDay === day ? 'active' : ''}`}
                      onClick={() => setStartDay(day)}
                    >
                      第 {day} 天
                    </Text>
                  ))}
                </View>
              </View>
            </View>

            {eligibleActions.length > 0 ? (
              <View className='section'>
                <PlanReferenceOneRMPanel
                  title='学员 1RM 配置'
                  caption='导入前补齐学员力量参考值，自动算重会直接使用这些数据。'
                  items={oneRMItems}
                  expanded={showOneRMPanel}
                  onToggle={() => setShowOneRMPanel((current) => !current)}
                  onSave={() => void handleSaveOneRM()}
                  saveLabel='保存 1RM'
                  emptyText='当前模板里还没有需要配置 1RM 的动作。'
                  onChange={(actionId, rawValue) => {
                    const value = rawValue === '' ? null : Number(rawValue)
                    setOneRMValues((current) => ({
                      ...current,
                      [actionId]: Number.isFinite(value as number) ? value : null
                    }))
                  }}
                />
              </View>
            ) : null}
          </>
        ) : (
          <View className='section empty-block'>
            <Text className='empty-block__title'>先选择一个模板</Text>
            <Text className='empty-block__desc'>选中模板后，这里会出现导入方式、起始周历和 1RM 配置。</Text>
          </View>
        )}
      </View>

      <View className='bottom-bar'>
        <View className='bottom-bar__summary'>
          <Text className='bottom-bar__title'>{selectedTemplate ? selectedTemplate.name : '尚未选择模板'}</Text>
          <Text className='bottom-bar__desc'>
            {selectedTemplate
              ? `${importMode === 'overwrite' ? '覆盖当前计划' : '新建阶段'} · 第 ${activeStartWeek} 周第 ${activeStartDay} 天`
              : '请选择模板后再分配给学员'}
          </Text>
        </View>
        <View className={`btn-primary ${saving || !selectedTemplateId ? 'disabled' : ''}`} onClick={() => !saving && void handleAssignPlan()}>
          <Text className='btn-text'>{saving ? '分配中...' : '确认分配计划'}</Text>
        </View>
      </View>
    </ScrollView>
  )
}
