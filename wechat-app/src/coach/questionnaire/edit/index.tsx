import React, { useState, useEffect } from 'react'
import { View, Text, Input, Button, ScrollView, Picker, Checkbox } from '@tarojs/components'
import { Check, File, List, Calendar, Ticket, Power } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import { actionLibService } from '@/services/coach/actionLibService'
import './index.scss'

type QuestionType = 'text' | 'option' | 'times' | 'tags' | 'rm'

interface Question {
  id: string
  type: QuestionType
  question?: string
  options?: string[] | number[]
  actionIds?: string[]
  scope?: 'global' | 'action'
  branching?: any
  media?: any[]
}

function CoachQuestionnaireEdit() {
  const routerParams = Taro.getCurrentInstance().router?.params || {}
  const questionnaireId = routerParams?.id
  const isEdit = !!questionnaireId && questionnaireId.trim() !== ''
  const initialMode = routerParams?.mode === 'online' ? 'online' : 'draft'
  const [questions, setQuestions] = useState<Question[]>([])
  const [questionId, setQuestionId] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [coachId, setCoachId] = useState<string>('')
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [actions, setActions] = useState<any[]>([])
  const [loadingActions, setLoadingActions] = useState(false)
  const [showActionSelector, setShowActionSelector] = useState(false)
  const [selectingQuestionIndex, setSelectingQuestionIndex] = useState<number | null>(null)
  const [mode, setMode] = useState<'online' | 'draft'>(initialMode)
  const [templates, setTemplates] = useState<any[]>([])
  const [loadingTemplates, setLoadingTemplates] = useState(false)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/questionnaire/edit') })
      return
    }
    loadCoach()
  }, [])

  useEffect(() => {
    if (coachId) {
      loadTemplates()
    }
  }, [coachId])

  useEffect(() => {
    if (coachId && mode) {
      loadQuestionnaire()
    }
  }, [coachId, mode])

  useEffect(() => {
    if (coachId) {
      loadActions()
    }
  }, [coachId])

  async function loadCoach() {
    try {
      const user = Taro.getStorageSync('user')
      const coachRes = await coachService.getCoach({ userId: user?.id })
      if (coachRes?.coach?.id) {
        setCoachId(coachRes.coach.id)
      }
    } catch (e) {
      console.error('[coach/questionnaire/edit] load coach:', e)
    }
  }

  async function loadActions() {
    try {
      setLoadingActions(true)
      const res = await actionLibService.listActions({ page: 1, limit: 100 })
      if (res?.actions) {
        setActions(res.actions)
      }
    } catch (e) {
      console.error('[coach/questionnaire/edit] load actions:', e)
    } finally {
      setLoadingActions(false)
    }
  }

  async function loadTemplates() {
    if (!coachId) return
    try {
      setLoadingTemplates(true)
      const res = await coachService.listQuestionnaires({ coachId })
      if (res) {
        setTemplates(res.items || [])
        // 根据模式选择对应的模板
        const targetTemplate = mode === 'draft' 
          ? res.items.find((i: any) => !i.is_active)
          : res.items.find((i: any) => i.is_active)
        
        if (targetTemplate?.id) {
          setQuestionId(targetTemplate.id)
        }
      }
    } catch (e) {
      console.error('[coach/questionnaire/edit] load templates:', e)
    } finally {
      setLoadingTemplates(false)
    }
  }

  async function loadQuestionnaire() {
    if (!coachId || !mode) return
    try {
      setLoading(true)
      
      // 先获取模板列表
      const templatesRes = await coachService.listQuestionnaires({ coachId })
      if (!templatesRes) {
        setLoading(false)
        return
      }

      const targetTemplate = mode === 'draft' 
        ? templatesRes.items.find((i: any) => !i.is_active)
        : templatesRes.items.find((i: any) => i.is_active)

      if (!targetTemplate?.id) {
        // 如果没有对应模板，创建新的
        setQuestions([])
        setQuestionId('')
        setLoading(false)
        return
      }

      setQuestionId(targetTemplate.id)
      
      // 根据ID获取问卷详情
      const res = await coachService.getQuestionnaireById({ id: targetTemplate.id })
      if (res) {
        const trainingQuestions: Question[] = []
        if (res.questionnaires && Array.isArray(res.questionnaires)) {
          for (const item of res.questionnaires) {
            trainingQuestions.push({
              id: item.id || `q_${Date.now()}_${Math.random()}`,
              type: item.type,
              question: item.question || '',
              options: item.options || [],
              actionIds: item.actionIds || [],
              scope: item.scope,
              branching: item.branching,
              media: item.media
            })
          }
        }
        setQuestions(trainingQuestions)
      } else {
        setQuestions([])
      }
    } catch (e) {
      console.error('[coach/questionnaire/edit] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  function generateId(): string {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  function handleAddQuestion(type: QuestionType) {
    const newQuestion: Question = {
      id: generateId(),
      type,
      question: '',
      options: type === 'option' ? ['选项1', '选项2'] : type === 'times' ? [1, 2, 3, 4, 5, 6, 7] : type === 'tags' ? [] : undefined,
      actionIds: type === 'rm' ? [] : undefined,
      scope: type === 'option' ? 'action' : undefined
    }
    
    if (type === 'text') {
      newQuestion.question = '请输入问题'
    } else if (type === 'times') {
      newQuestion.question = '您希望每周训练几次？'
    }

    setQuestions([...questions, newQuestion])
    setShowAddMenu(false)
    setEditingIndex(questions.length)
  }

  function handleDeleteQuestion(index: number) {
    Taro.showModal({
      title: '确认删除',
      content: '确定要删除这个问题吗？',
      success: (res) => {
        if (res.confirm) {
          const newQuestions = questions.filter((_, i) => i !== index)
          setQuestions(newQuestions)
          if (editingIndex === index) {
            setEditingIndex(null)
          } else if (editingIndex !== null && editingIndex > index) {
            setEditingIndex(editingIndex - 1)
          }
        }
      }
    })
  }

  function handleQuestionChange(index: number, field: string, value: any) {
    const newQuestions = [...questions]
    newQuestions[index] = {
      ...newQuestions[index],
      [field]: value
    }
    setQuestions(newQuestions)
  }

  function handleAddOption(index: number) {
    const question = questions[index]
    if (question.type === 'option') {
      const options = Array.isArray(question.options) ? [...question.options] : []
      options.push(`选项${options.length + 1}`)
      handleQuestionChange(index, 'options', options)
    }
  }

  function handleRemoveOption(index: number, optionIndex: number) {
    const question = questions[index]
    if (question.type === 'option' && Array.isArray(question.options)) {
      const options = [...question.options]
      if (options.length > 1) {
        options.splice(optionIndex, 1)
        handleQuestionChange(index, 'options', options)
      } else {
        Taro.showToast({ title: '至少保留一个选项', icon: 'none' })
      }
    }
  }

  function handleOptionChange(index: number, optionIndex: number, value: string) {
    const question = questions[index]
    if (question.type === 'option' && Array.isArray(question.options)) {
      const options = [...question.options]
      options[optionIndex] = value
      handleQuestionChange(index, 'options', options)
    }
  }

  function handleToggleTimesOption(index: number, num: number) {
    const question = questions[index]
    if (question.type !== 'times') return
    
    const opts: number[] = Array.isArray(question.options) ? [...question.options] : [1, 2, 3, 4, 5, 6, 7]
    const currentIndex = opts.indexOf(num)
    
    if (currentIndex > -1) {
      // 如果已选中，取消选中（但至少保留一个）
      if (opts.length > 1) {
        opts.splice(currentIndex, 1)
        handleQuestionChange(index, 'options', opts)
      } else {
        Taro.showToast({ title: '至少保留一个选项', icon: 'none' })
      }
    } else {
      // 如果未选中，添加
      opts.push(num)
      opts.sort((a, b) => a - b)
      handleQuestionChange(index, 'options', opts)
    }
  }

  function handleAddTagOption(index: number) {
    const question = questions[index]
    if (question.type !== 'tags') return
    const options = Array.isArray(question.options) ? [...question.options] : []
    options.push('')
    handleQuestionChange(index, 'options', options)
  }

  function handleRemoveTagOption(index: number, optionIndex: number) {
    const question = questions[index]
    if (question.type !== 'tags' || !Array.isArray(question.options)) return
    const options = [...question.options]
    options.splice(optionIndex, 1)
    handleQuestionChange(index, 'options', options)
  }

  function handleTagOptionChange(index: number, optionIndex: number, value: string) {
    const question = questions[index]
    if (question.type !== 'tags' || !Array.isArray(question.options)) return
    const options = [...question.options]
    options[optionIndex] = value
    handleQuestionChange(index, 'options', options)
  }

  function handleSelectActions(index: number) {
    setSelectingQuestionIndex(index)
    setShowActionSelector(true)
  }

  function handleToggleAction(actionId: string) {
    if (selectingQuestionIndex === null) return
    const question = questions[selectingQuestionIndex]
    const currentIds = Array.isArray(question.actionIds) ? [...question.actionIds] : []
    const index = currentIds.indexOf(actionId)
    
    if (index > -1) {
      currentIds.splice(index, 1)
    } else {
      currentIds.push(actionId)
    }
    
    handleQuestionChange(selectingQuestionIndex, 'actionIds', currentIds)
  }

  function handleConfirmActionSelection() {
    setShowActionSelector(false)
    setSelectingQuestionIndex(null)
  }

  function handleClearActions() {
    if (selectingQuestionIndex === null) return
    handleQuestionChange(selectingQuestionIndex, 'actionIds', [])
    setShowActionSelector(false)
    setSelectingQuestionIndex(null)
  }

  async function handleSave() {
    if (!coachId) {
      Taro.showToast({ title: '教练信息加载失败', icon: 'none' })
      return
    }

    // 验证必填项
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i]
      if (q.type === 'text' && !q.question?.trim()) {
        Taro.showToast({ title: `第${i + 1}个问题不能为空`, icon: 'none' })
        return
      }
      if (q.type === 'option' && (!q.question?.trim() || !q.options || q.options.length === 0)) {
        Taro.showToast({ title: `第${i + 1}个问题或选项不能为空`, icon: 'none' })
        return
      }
      if (q.type === 'times' && (!q.options || !Array.isArray(q.options) || q.options.length === 0)) {
        Taro.showToast({ title: `第${i + 1}个问题至少选择一个可选次数`, icon: 'none' })
        return
      }
      if (q.type === 'tags' && (!q.options || !Array.isArray(q.options) || q.options.length === 0)) {
        Taro.showToast({ title: `第${i + 1}个问题至少添加一个训练项目选项`, icon: 'none' })
        return
      }
    }

    try {
      setSaving(true)
      const res = await coachService.updateQuestionnaires({
        coachId,
        questionnaires: questions,
        id: questionId || undefined,
        mode: mode
      })
      if (res?.success) {
        const newId = res.data?.id || questionId
        if (newId) {
          setQuestionId(newId)
        }
        Taro.showToast({ title: '保存成功', icon: 'success' })
        // 刷新模板列表
        await loadTemplates()
      } else {
        Taro.showToast({ title: res?.message || '保存失败', icon: 'none' })
      }
    } catch (e) {
      console.error('[coach/questionnaire/edit] save:', e)
      Taro.showToast({ title: '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!coachId || !questionId) {
      Taro.showToast({ title: '问卷信息不完整', icon: 'none' })
      return
    }

    if (mode !== 'draft') {
      Taro.showToast({ title: '只能发布草稿版本', icon: 'none' })
      return
    }

    const res = await Taro.showModal({
      title: '确认发布',
      content: '确定要将草稿版本发布为线上版本吗？线上版本将被替换。',
      confirmText: '发布',
      confirmColor: '#10b981'
    })

    if (!res.confirm) return

    try {
      setSaving(true)
      const publishRes = await coachService.publishQuestionnaire({ id: questionId })
      if (publishRes?.success) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        // 切换到线上模式并重新加载
        setMode('online')
        await loadTemplates()
        await loadQuestionnaire()
      } else {
        Taro.showToast({ title: publishRes?.message || '发布失败', icon: 'none' })
      }
    } catch (e) {
      console.error('[coach/questionnaire/edit] publish:', e)
      Taro.showToast({ title: '发布失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  async function handleCopyFromOnline() {
    if (!coachId) {
      Taro.showToast({ title: '教练信息加载失败', icon: 'none' })
      return
    }

    const onlineTemplate = templates.find((i: any) => i.is_active)
    if (!onlineTemplate?.id) {
      Taro.showToast({ title: '没有线上版本可复制', icon: 'none' })
      return
    }

    try {
      setSaving(true)
      const res = await coachService.duplicateQuestionnaire({ id: onlineTemplate.id })
      if (res?.success) {
        Taro.showToast({ title: '复制成功', icon: 'success' })
        // 切换到草稿模式并重新加载
        setMode('draft')
        await loadTemplates()
        await loadQuestionnaire()
      } else {
        Taro.showToast({ title: res?.message || '复制失败', icon: 'none' })
      }
    } catch (e) {
      console.error('[coach/questionnaire/edit] copy:', e)
      Taro.showToast({ title: '复制失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  function getQuestionTypeLabel(type: QuestionType): string {
    const labels: Record<QuestionType, string> = {
      text: '文本问题',
      option: '选项问题',
      times: '训练次数',
      tags: '训练项目偏好',
      rm: '1RM测试'
    }
    return labels[type] || type
  }

  function renderQuestionEditor(question: Question, index: number) {
    const isEditing = editingIndex === index

    return (
      <View key={question.id} className="question-card">
        <View className="question-header">
          <View className="question-info">
            <Text className="question-type-badge">{getQuestionTypeLabel(question.type)}</Text>
            <Text className="question-index">#{index + 1}</Text>
          </View>
          <View className="question-actions">
            <Button
              className="edit-btn"
              onClick={() => setEditingIndex(isEditing ? null : index)}
            >
              {isEditing ? '收起' : '编辑'}
            </Button>
            <Button
              className="delete-btn"
              onClick={() => handleDeleteQuestion(index)}
            >
              删除
            </Button>
          </View>
        </View>

        {isEditing && (
          <View className="question-editor">
            {question.type === 'text' && (
              <View className="form-item">
                <Text className="label">问题内容</Text>
                <Input
                  className="input"
                  value={question.question || ''}
                  onInput={(e) => handleQuestionChange(index, 'question', e.detail.value)}
                  placeholder="请输入问题"
                />
              </View>
            )}

            {question.type === 'option' && (
              <>
                <View className="form-item">
                  <Text className="label">问题内容</Text>
                  <Input
                    className="input"
                    value={question.question || ''}
                    onInput={(e) => handleQuestionChange(index, 'question', e.detail.value)}
                    placeholder="请输入问题"
                  />
                </View>
                <View className="form-item">
                  <View className="label-row">
                    <Text className="label">选项</Text>
                    <Button className="add-option-btn" onClick={() => handleAddOption(index)}>
                      + 添加选项
                    </Button>
                  </View>
                  {Array.isArray(question.options) && question.options.map((opt, optIdx) => (
                    <View key={optIdx} className="option-row">
                      <Input
                        className="option-input"
                        value={String(opt)}
                        onInput={(e) => handleOptionChange(index, optIdx, e.detail.value)}
                        placeholder={`选项 ${optIdx + 1}`}
                      />
                      {question.options && question.options.length > 1 && (
                        <Button
                          className="remove-option-btn"
                          onClick={() => handleRemoveOption(index, optIdx)}
                        >
                          删除
                        </Button>
                      )}
                    </View>
                  ))}
                </View>
                <View className="form-item">
                  <Text className="label">作用范围</Text>
                  <Picker
                    mode="selector"
                    range={['action', 'global']}
                    rangeKey="label"
                    value={question.scope === 'global' ? 1 : 0}
                    onChange={(e) => {
                      const scope = e.detail.value === 1 ? 'global' : 'action'
                      handleQuestionChange(index, 'scope', scope)
                    }}
                  >
                    <View className="picker-view">
                      <Text>{question.scope === 'global' ? '全局匹配' : '动作选择'}</Text>
                    </View>
                  </Picker>
                </View>
              </>
            )}

            {question.type === 'times' && (
              <>
                <View className="form-item">
                  <Text className="label">问题内容</Text>
                  <Input
                    className="input"
                    value={question.question || ''}
                    onInput={(e) => handleQuestionChange(index, 'question', e.detail.value)}
                    placeholder="例如：您希望每周训练几次？"
                  />
                </View>
                <View className="form-item">
                  <Text className="label">可选次数</Text>
                  <View className="times-options">
                    {[1, 2, 3, 4, 5, 6, 7].map((num) => {
                      const opts: number[] = Array.isArray(question.options) ? question.options : [1, 2, 3, 4, 5, 6, 7]
                      const isChecked = opts.includes(num)
                      return (
                        <View key={num} className="times-option-item">
                          <Checkbox
                            checked={isChecked}
                            value={String(num)}
                            onClick={() => handleToggleTimesOption(index, num)}
                          />
                          <Text className="times-option-label" onClick={() => handleToggleTimesOption(index, num)}>
                            {num} 次
                          </Text>
                        </View>
                      )
                    })}
                  </View>
                  <Text className="hint">至少选择1个选项；学员端将只显示您勾选的次数</Text>
                </View>
              </>
            )}

            {question.type === 'tags' && (
              <View className="form-item">
                <View className="label-row">
                  <Text className="label">训练项目选项</Text>
                  <Button className="add-option-btn" onClick={() => handleAddTagOption(index)}>
                    + 添加选项
                  </Button>
                </View>
                {Array.isArray(question.options) && question.options.length > 0 ? (
                  question.options.map((opt, optIdx) => (
                    <View key={optIdx} className="option-row">
                      <Input
                        className="option-input"
                        value={String(opt)}
                        onInput={(e) => handleTagOptionChange(index, optIdx, e.detail.value)}
                        placeholder={`训练项目 ${optIdx + 1}`}
                      />
                      <Button
                        className="remove-option-btn"
                        onClick={() => handleRemoveTagOption(index, optIdx)}
                      >
                        删除
                      </Button>
                    </View>
                  ))
                ) : (
                  <Text className="hint">暂无选项，请添加训练项目选项</Text>
                )}
                <Text className="hint">建议配置6-15个选项；学员端可多选。这些选项同时会作为模板的可选标签。</Text>
              </View>
            )}

            {question.type === 'rm' && (
              <View className="form-item">
                <Text className="label">1RM测试动作</Text>
                <Button
                  className="select-actions-btn"
                  onClick={() => handleSelectActions(index)}
                >
                  {Array.isArray(question.actionIds) && question.actionIds.length > 0
                    ? `已选择 ${question.actionIds.length} 个动作`
                    : '选择动作'}
                </Button>
                {Array.isArray(question.actionIds) && question.actionIds.length > 0 && (
                  <View className="selected-actions">
                    {question.actionIds.map((actionId) => {
                      const action = actions.find(a => a.id === actionId)
                      return action ? (
                        <View key={actionId} className="action-tag">
                          <Text>{action.name}</Text>
                        </View>
                      ) : null
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {!isEditing && (
          <View className="question-preview">
            {question.type === 'text' && (
              <Text className="preview-text">{question.question || '（未设置）'}</Text>
            )}
            {question.type === 'option' && (
              <>
                <Text className="preview-text">{question.question || '（未设置）'}</Text>
                {Array.isArray(question.options) && question.options.length > 0 && (
                  <View className="preview-options">
                    {question.options.map((opt, idx) => (
                      <Text key={idx} className="option-tag">{idx + 1}. {opt}</Text>
                    ))}
                  </View>
                )}
              </>
            )}
            {question.type === 'times' && (
              <Text className="preview-text">{question.question || '（未设置）'}</Text>
            )}
            {question.type === 'tags' && (
              <>
                <Text className="preview-text">训练项目偏好（多选）</Text>
                {Array.isArray(question.options) && question.options.length > 0 && (
                  <View className="preview-options">
                    {question.options.map((opt, idx) => (
                      <Text key={idx} className="option-tag">{opt || `选项${idx + 1}`}</Text>
                    ))}
                  </View>
                )}
              </>
            )}
            {question.type === 'rm' && (
              <Text className="preview-text">
                1RM测试动作：{Array.isArray(question.actionIds) && question.actionIds.length > 0
                  ? `已选择 ${question.actionIds.length} 个动作`
                  : '未选择'}
              </Text>
            )}
          </View>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <View className="coach-questionnaire-edit-page">
        <View className="loading-wrap">加载中...</View>
      </View>
    )
  }

  return (
    <View className="coach-questionnaire-edit-page">
      <View className="header">
        <Button className="back-btn" onClick={() => Taro.navigateBack()}>返回</Button>
        <Text className="title">{mode === 'draft' ? '编辑草稿' : '查看线上'}</Text>
        <View className="header-placeholder"></View>
      </View>

      <View className="mode-switcher">
        <Button
          className={`mode-btn ${mode === 'online' ? 'active' : ''}`}
          onClick={() => {
            setMode('online')
            loadQuestionnaire()
          }}
        >
          线上版本
        </Button>
        <Button
          className={`mode-btn ${mode === 'draft' ? 'active' : ''}`}
          onClick={() => {
            setMode('draft')
            loadQuestionnaire()
          }}
        >
          草稿版本
        </Button>
      </View>

      {mode === 'draft' && (
        <View className="draft-actions">
          <Button className="copy-btn" onClick={handleCopyFromOnline}>
            从线上复制
          </Button>
          {questionId && (
            <Button className="publish-btn" onClick={handlePublish}>
              发布为线上
            </Button>
          )}
        </View>
      )}

      <ScrollView scrollY className="form-content">
        {questions.length === 0 ? (
          <View className="empty-wrap">
            <View className="empty-icon"><File size={48} color="#9CA3AF" /></View>
            <Text className="empty-text">还没有问题</Text>
            <Text className="empty-hint">点击下方按钮添加第一个问题</Text>
          </View>
        ) : (
          questions.map((q, index) => renderQuestionEditor(q, index))
        )}

        <View className="add-question-section">
          {showAddMenu ? (
            <View className="add-menu">
              <Text className="menu-title">选择问题类型</Text>
              <Button
                className="menu-item"
                onClick={() => handleAddQuestion('text')}
              >
                文本问题
              </Button>
              <Button
                className="menu-item"
                onClick={() => handleAddQuestion('option')}
              >
                选项问题
              </Button>
              <Button
                className="menu-item"
                onClick={() => handleAddQuestion('times')}
              >
                训练次数
              </Button>
              <Button
                className="menu-item"
                onClick={() => handleAddQuestion('tags')}
                disabled={questions.some(q => q.type === 'tags')}
              >
                训练项目偏好
              </Button>
              <Button
                className="menu-item"
                onClick={() => handleAddQuestion('rm')}
                disabled={questions.some(q => q.type === 'rm')}
              >
                1RM测试
              </Button>
              <Button
                className="menu-item cancel"
                onClick={() => setShowAddMenu(false)}
              >
                取消
              </Button>
            </View>
          ) : (
            <Button
              className="add-question-btn"
              onClick={() => setShowAddMenu(true)}
            >
              + 添加问题
            </Button>
          )}
        </View>
      </ScrollView>

      <View className="footer">
        <Button className="save-btn" onClick={handleSave} loading={saving}>
          保存
        </Button>
      </View>

      {showActionSelector && (
        <View className="action-selector-modal">
          <View className="modal-mask" onClick={handleConfirmActionSelection}></View>
          <View className="modal-content">
            <View className="modal-header">
              <Text className="modal-title">选择1RM测试动作</Text>
              <Button className="close-btn" onClick={handleConfirmActionSelection}>关闭</Button>
            </View>
            <ScrollView scrollY className="modal-body">
              {loadingActions ? (
                <View className="loading-text">加载中...</View>
              ) : actions.length === 0 ? (
                <View className="empty-text">暂无动作，请先添加动作</View>
              ) : (
                actions.map((action) => {
                  const question = selectingQuestionIndex !== null ? questions[selectingQuestionIndex] : null
                  const selectedIds = Array.isArray(question?.actionIds) ? question.actionIds : []
                  const isSelected = selectedIds.includes(action.id)
                  
                  return (
                    <View
                      key={action.id}
                      className={`action-item ${isSelected ? 'selected' : ''}`}
                      onClick={() => handleToggleAction(action.id)}
                    >
                      <View className="action-checkbox">
                        {isSelected && <View className="checkmark"><Check size={14} color="#fff" /></View>}
                      </View>
                      <View className="action-info">
                        <Text className="action-name">{action.name || '未命名'}</Text>
                        {action.type && (
                          <Text className="action-type">{action.type}</Text>
                        )}
                      </View>
                    </View>
                  )
                })
              )}
            </ScrollView>
            <View className="modal-footer">
              <Button className="clear-btn" onClick={handleClearActions}>清除已选</Button>
              <Button className="confirm-btn" onClick={handleConfirmActionSelection}>确定</Button>
            </View>
          </View>
        </View>
      )}
    </View>
  )
}

export default CoachQuestionnaireEdit
