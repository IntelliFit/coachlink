import { useEffect, useMemo, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { ArrowRight, Notice, Target } from '@nutui/icons-react-taro'
import {
  buildWeeklyTasks,
  buildCoachSupportCards,
  buildLearningCards,
  getPrimaryBlocker,
  isPathStage,
  isPainPointKey,
  loadStudentPathDiagnosis,
  painPointOptions,
  saveStudentPathDiagnosis,
  stageCards,
  stageOptions,
  type PainPointKey,
  type PathStage,
  type StudentPathDiagnosis,
} from '@/utils/studentPathDiagnosis'
import './index.scss'

const sevenDayStart = [
  { day: '第 1 天', title: '做一次 10 分钟起步训练', desc: '只要完成，不追求累到位。' },
  { day: '第 2 天', title: '学一个动作标准', desc: '先看一个动作的合格标准和常见错误。' },
  { day: '第 3 天', title: '饮食加一条规则', desc: '每餐先找一个蛋白质来源。' },
  { day: '第 4 天', title: '做一次身体自检', desc: '肩、腰、膝、手腕不舒服时先退阶。' },
  { day: '第 5 天', title: '第二次基础训练', desc: '重复主动作，记录完成度和感受。' },
  { day: '第 6 天', title: '低压力复盘', desc: '不用补偿式加练，只看哪里最卡。' },
  { day: '第 7 天', title: '生成下周调整', desc: '根据完成度决定继续、加量或找教练。' },
]

function PathPage() {
  const currentUserId = useMemo(() => {
    const session = authService.getAuthSession({ normalize: true })
    return session?.userId ? String(session.userId) : null
  }, [])

  const detectedStage = useMemo<PathStage>(() => {
    const session = authService.getAuthSession({ normalize: true })
    const level = String(session.user?.fitness_level || session.user?.training_level || '').toLowerCase()
    if (level.includes('advanced') || level.includes('pro')) return 'advanced'
    if (level.includes('intermediate')) return 'stuck'
    return 'safe-start'
  }, [])

  const [selectedStage, setSelectedStage] = useState<PathStage>(detectedStage)
  const [selectedPainPoints, setSelectedPainPoints] = useState<PainPointKey[]>(['knowledge', 'base'])
  const [diagnosisSavedAt, setDiagnosisSavedAt] = useState<number | null>(null)
  const [diagnosisExpanded, setDiagnosisExpanded] = useState(true)

  useEffect(() => {
    const saved = loadStudentPathDiagnosis(currentUserId)
    if (!saved) return
    if (isPathStage(saved.stage)) {
      setSelectedStage(saved.stage)
    }
    if (Array.isArray(saved.painPoints)) {
      const validPainPoints = saved.painPoints.filter(isPainPointKey)
      if (validPainPoints.length > 0) {
        setSelectedPainPoints(validPainPoints)
      }
    }
    if (typeof saved.savedAt === 'number') {
      setDiagnosisSavedAt(saved.savedAt)
      setDiagnosisExpanded(false)
    }
  }, [currentUserId])

  const stageInfo = stageCards[selectedStage]
  const primaryBlocker = useMemo(
    () => getPrimaryBlocker(selectedStage, selectedPainPoints),
    [selectedStage, selectedPainPoints]
  )
  const weeklyTasks = useMemo(
    () => buildWeeklyTasks(selectedStage, selectedPainPoints),
    [selectedStage, selectedPainPoints]
  )
  const learningCards = useMemo(
    () => buildLearningCards(selectedStage, selectedPainPoints),
    [selectedStage, selectedPainPoints]
  )
  const coachSupportCards = useMemo(
    () => buildCoachSupportCards(selectedStage, selectedPainPoints),
    [selectedStage, selectedPainPoints]
  )
  const activePainLabels = useMemo(
    () => painPointOptions
      .filter((item) => selectedPainPoints.includes(item.key))
      .map((item) => item.label),
    [selectedPainPoints]
  )

  const navigateTo = (url: string) => {
    Taro.navigateTo({ url }).catch(() => {
      Taro.redirectTo({ url }).catch(() => {
        Taro.showToast({ title: '页面跳转失败', icon: 'none' })
      })
    })
  }

  const togglePainPoint = (key: PainPointKey) => {
    setSelectedPainPoints((prev) => {
      if (prev.includes(key)) {
        const next = prev.filter((item) => item !== key)
        return next.length > 0 ? next : prev
      }
      return [...prev, key].slice(-5)
    })
  }

  const persistDiagnosis = (showSuccessToast = true) => {
    const payload: StudentPathDiagnosis = {
      stage: selectedStage,
      painPoints: selectedPainPoints,
      savedAt: Date.now(),
      userId: currentUserId,
    }
    if (saveStudentPathDiagnosis(payload, currentUserId)) {
      setDiagnosisSavedAt(payload.savedAt || null)
      setDiagnosisExpanded(false)
      if (showSuccessToast) {
        Taro.showToast({ title: '已生成本周路径', icon: 'success' })
      }
      return true
    }
    Taro.showToast({ title: '保存失败', icon: 'none' })
    return false
  }

  const saveDiagnosis = () => {
    persistDiagnosis(true)
  }

  const startTodayWithCurrentDiagnosis = () => {
    if (persistDiagnosis(false)) {
      navigateTo('/training/today-training')
    }
  }

  return (
    <View className='path-page page-with-float-nav'>
      <View className='path-content'>
        <View className='path-hero-card'>
          <View className='path-hero-eyebrow'>
            <Target size={16} color='#CF6D4E' />
            <Text>当前路径</Text>
          </View>
          <Text className='path-hero-title'>{stageInfo.title}</Text>
          <Text className='path-hero-desc'>{stageInfo.subtitle}</Text>
          <View className='path-focus-row'>
            {stageInfo.focus.map((item) => (
              <View key={item} className='path-focus-pill'>
                <Text>{item}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='path-section path-section--primary'>
          <View className='path-section-head'>
            <Text className='path-section-title'>本周只做这 3 件事</Text>
            <Text className='path-section-sub'>先给你一个明确答案，减少信息筛选成本</Text>
          </View>
          <View className='weekly-task-list'>
            {weeklyTasks.map((task, index) => (
              <View key={task} className='weekly-task-row'>
                <View className='weekly-task-index'>
                  <Text>{index + 1}</Text>
                </View>
                <Text className='weekly-task-text'>{task}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='path-safe-card' onClick={startTodayWithCurrentDiagnosis}>
          <View className='path-safe-icon'>
            <Notice size={18} color='#CF6D4E' />
          </View>
          <View className='path-safe-body'>
            <Text className='path-safe-title'>去今日完成主行动</Text>
            <Text className='path-safe-desc'>今日页只负责告诉你现在做什么。路径页负责解释为什么这样做。</Text>
          </View>
          <ArrowRight size={16} color='#9CA3AF' />
        </View>

        <View className='path-diagnosis-card'>
          <View className='path-section-head'>
            <Text className='path-section-title'>起点诊断</Text>
            <Text className='path-section-sub'>只在需要调整路线时打开，不让诊断表长期占住主线</Text>
          </View>

          {!diagnosisExpanded ? (
            <View className='diagnosis-compact'>
              <View className='diagnosis-result diagnosis-result--compact'>
                <Text className='diagnosis-result-kicker'>本周判断</Text>
                <Text className='diagnosis-result-title'>{primaryBlocker.title}</Text>
                <Text className='diagnosis-result-desc'>{primaryBlocker.desc}</Text>
                <View className='diagnosis-active-row'>
                  {activePainLabels.map((label) => (
                    <View key={label} className='diagnosis-active-pill'>
                      <Text>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View className='diagnosis-actions'>
                <View className='diagnosis-save-btn diagnosis-save-btn--secondary' onClick={() => setDiagnosisExpanded(true)}>
                  <Text>调整起点</Text>
                </View>
                <View className='diagnosis-start-btn' onClick={startTodayWithCurrentDiagnosis}>
                  <Text>去今日</Text>
                  <ArrowRight size={14} color='#CF6D4E' />
                </View>
              </View>
            </View>
          ) : (
            <>
              <View className='diagnosis-block'>
                <Text className='diagnosis-label'>你现在更像哪一段？</Text>
                <View className='stage-option-list'>
                  {stageOptions.map((item) => (
                    <View
                      key={item.key}
                      className={`stage-option ${selectedStage === item.key ? 'stage-option--active' : ''}`}
                      onClick={() => setSelectedStage(item.key)}
                    >
                      <Text className='stage-option-label'>{item.label}</Text>
                      <Text className='stage-option-desc'>{item.desc}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className='diagnosis-block'>
                <Text className='diagnosis-label'>现在最卡你的是什么？最多选 5 个</Text>
                <View className='pain-chip-list'>
                  {painPointOptions.map((item) => {
                    const active = selectedPainPoints.includes(item.key)
                    return (
                      <View
                        key={item.key}
                        className={`pain-chip ${active ? 'pain-chip--active' : ''}`}
                        onClick={() => togglePainPoint(item.key)}
                      >
                        <Text className='pain-chip-label'>{item.label}</Text>
                        <Text className='pain-chip-desc'>{item.desc}</Text>
                      </View>
                    )
                  })}
                </View>
              </View>

              <View className='diagnosis-result'>
                <Text className='diagnosis-result-kicker'>本周判断</Text>
                <Text className='diagnosis-result-title'>{primaryBlocker.title}</Text>
                <Text className='diagnosis-result-desc'>{primaryBlocker.desc}</Text>
                <View className='diagnosis-active-row'>
                  {activePainLabels.map((label) => (
                    <View key={label} className='diagnosis-active-pill'>
                      <Text>{label}</Text>
                    </View>
                  ))}
                </View>
              </View>

              <View className='diagnosis-actions'>
                <View className='diagnosis-save-btn' onClick={saveDiagnosis}>
                  <Text>{diagnosisSavedAt ? '更新本周路径' : '生成本周路径'}</Text>
                </View>
                <View className='diagnosis-start-btn' onClick={startTodayWithCurrentDiagnosis}>
                  <Text>去今日训练</Text>
                  <ArrowRight size={14} color='#CF6D4E' />
                </View>
              </View>
            </>
          )}
        </View>

        <View className='path-section'>
          <View className='path-section-head'>
            <Text className='path-section-title'>今天只学这些</Text>
            <Text className='path-section-sub'>内容不再是资料库，而是为当前卡点服务</Text>
          </View>
          <View className='path-action-list'>
            {learningCards.map((item) => (
              <View key={item.key} className='path-action-row' onClick={() => navigateTo(item.path)}>
                <View className='path-action-tag'>
                  <Text>{item.tag}</Text>
                </View>
                <View className='path-action-main'>
                  <Text className='path-action-title'>{item.title}</Text>
                  <Text className='path-action-desc'>{item.desc}</Text>
                </View>
                <ArrowRight size={16} color='#9CA3AF' />
              </View>
            ))}
          </View>
        </View>

        {coachSupportCards.length > 0 && (
          <View className='path-section'>
            <View className='path-section-head'>
              <Text className='path-section-title'>什么时候找教练</Text>
              <Text className='path-section-sub'>不是一进来就买课，而是在卡点明确时升级支持</Text>
            </View>
            <View className='path-action-list'>
              {coachSupportCards.map((item) => (
                <View
                  key={item.key}
                  className='path-action-row'
                  onClick={() => navigateTo(`/discovery/index?supportNeed=${item.query}`)}
                >
                  <View className='path-action-tag'>
                    <Text>支持</Text>
                  </View>
                  <View className='path-action-main'>
                    <Text className='path-action-title'>{item.title}</Text>
                    <Text className='path-action-desc'>{item.desc}</Text>
                  </View>
                  <ArrowRight size={16} color='#9CA3AF' />
                </View>
              ))}
            </View>
          </View>
        )}

        <View className='path-section'>
          <View className='path-section-head'>
            <Text className='path-section-title'>7 天安全起步</Text>
            <Text className='path-section-sub'>第一周的目标不是练狠，而是把开始、学习、反馈串起来</Text>
          </View>
          <View className='start-day-list'>
            {sevenDayStart.map((item) => (
              <View key={item.day} className='start-day-row'>
                <View className='start-day-badge'>
                  <Text>{item.day}</Text>
                </View>
                <View className='start-day-main'>
                  <Text className='start-day-title'>{item.title}</Text>
                  <Text className='start-day-desc'>{item.desc}</Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      </View>
      <BottomNav />
    </View>
  )
}

export default PathPage
