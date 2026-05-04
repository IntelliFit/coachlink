import React, { useState, useEffect } from 'react'
import { View, Text, Input, Button, ScrollView, Checkbox, Textarea, RadioGroup, Radio } from '@tarojs/components'
import { File } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

type QuestionType = 'text' | 'option' | 'times' | 'tags' | 'rm'
type EditorType = 'simple' | 'flow'
type SelectionMode = 'single' | 'multiple'

interface Question {
  id: string
  type: QuestionType
  question?: string
  options?: string[] | number[]
  selectionMode?: SelectionMode
  allowOther?: boolean
  actionIds?: string[]
  branching?: any
  media?: any[]
}

const LEGACY_TYPES: QuestionType[] = ['tags', 'times', 'rm']

function generateId(): string {
  return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function CoachQuestionnaireEdit() {
  const routerParams = Taro.getCurrentInstance().router?.params || {}
  const questionnaireId = routerParams?.id || ''

  const [questions, setQuestions] = useState<Question[]>([])
  const [questionId, setQuestionId] = useState<string>(questionnaireId)
  const [templateName, setTemplateName] = useState<string>('')
  const [templateStatus, setTemplateStatus] = useState<'active' | 'draft'>('draft')
  const [editorType, setEditorType] = useState<EditorType>('simple')
  const [editorTypeLocked, setEditorTypeLocked] = useState<boolean>(false)
  const [showTypePicker, setShowTypePicker] = useState<boolean>(false)
  const [coachId, setCoachId] = useState<string>('')

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showAddMenu, setShowAddMenu] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({ url: '/auth/login?returnTo=' + encodeURIComponent('/coach/questionnaire/edit') })
      return
    }
    loadCoach()
  }, [])

  useEffect(() => {
    if (!coachId) return
    if (questionnaireId) {
      loadQuestionnaire(questionnaireId)
    } else {
      // 新建：先弹出"选择问卷类型"
      setShowTypePicker(true)
      setEditorTypeLocked(false)
      setQuestions([])
      setTemplateStatus('draft')
      setTemplateName('')
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

  async function loadQuestionnaire(id: string) {
    try {
      setLoading(true)
      const res: any = await coachService.getQuestionnaireById({ id })
      if (!res) {
        Taro.showToast({ title: '加载失败', icon: 'none' })
        setQuestions([])
        return
      }

      const trainingQuestions: Question[] = []
      const items = Array.isArray(res.questionnaires) ? res.questionnaires : []
      for (const item of items) {
        trainingQuestions.push({
          id: item.id || generateId(),
          type: item.type,
          question: item.question || '',
          options: item.options || [],
          selectionMode: item.selectionMode === 'multiple' ? 'multiple' : 'single',
          allowOther: Boolean(item.allowOther),
          actionIds: item.actionIds || [],
          branching: item.branching,
          media: item.media,
        })
      }

      setQuestions(trainingQuestions)
      setQuestionId(res.id)
      setTemplateName(res.name || (res.editorType === 'flow' ? '流程图问卷' : '列表问卷'))
      setTemplateStatus(res.status === 'active' ? 'active' : 'draft')
      setEditorType(res.editorType === 'flow' ? 'flow' : 'simple')
      setEditorTypeLocked(true)
      setShowTypePicker(false)
    } catch (e) {
      console.error('[coach/questionnaire/edit] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
      setQuestions([])
    } finally {
      setLoading(false)
    }
  }

  function pickEditorType(type: EditorType) {
    setEditorType(type)
    setEditorTypeLocked(true)
    setShowTypePicker(false)
    setTemplateName(type === 'flow' ? '流程图问卷' : '列表问卷')
  }

  function handleAddQuestion(type: 'text' | 'option-single' | 'option-multiple') {
    let newQuestion: Question
    if (type === 'text') {
      newQuestion = { id: generateId(), type: 'text', question: '' }
    } else if (type === 'option-single') {
      newQuestion = {
        id: generateId(),
        type: 'option',
        question: '',
        options: ['选项1', '选项2'],
        selectionMode: 'single',
        allowOther: false,
      }
    } else {
      newQuestion = {
        id: generateId(),
        type: 'option',
        question: '',
        options: ['选项1', '选项2'],
        selectionMode: 'multiple',
        allowOther: false,
      }
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
      const options = Array.isArray(question.options) ? [...(question.options as string[])] : []
      options.push(`选项${options.length + 1}`)
      handleQuestionChange(index, 'options', options)
    }
  }

  function handleRemoveOption(index: number, optionIndex: number) {
    const question = questions[index]
    if (question.type === 'option' && Array.isArray(question.options)) {
      const options = [...(question.options as string[])]
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
      const options = [...(question.options as string[])]
      options[optionIndex] = value
      handleQuestionChange(index, 'options', options)
    }
  }

  async function handleSave() {
    if (!coachId) {
      Taro.showToast({ title: '教练信息加载失败', icon: 'none' })
      return
    }

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
    }

    try {
      setSaving(true)
      const res = await coachService.updateQuestionnaires({
        questionnaires: questions,
        id: questionId || undefined,
        name: templateName.trim() || (editorType === 'flow' ? '流程图问卷' : '列表问卷'),
        editorType,
      })
      if (res?.success) {
        const newId = res.data?.id || questionId
        if (newId) {
          setQuestionId(newId)
        }
        Taro.showToast({ title: '保存成功', icon: 'success' })
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
    if (!questionId) {
      Taro.showToast({ title: '请先保存问卷', icon: 'none' })
      return
    }
    if (templateStatus === 'active') {
      Taro.showToast({ title: '该问卷已经是已发布版本', icon: 'none' })
      return
    }

    const res = await Taro.showModal({
      title: '确认发布',
      content: '确定要发布这份问卷吗？发布后将替换当前生效版本。',
      confirmText: '发布',
      confirmColor: '#10b981',
    })

    if (!res.confirm) return

    try {
      setSaving(true)
      const publishRes = await coachService.publishQuestionnaire({ id: questionId })
      if (publishRes?.success) {
        Taro.showToast({ title: '发布成功', icon: 'success' })
        await loadQuestionnaire(questionId)
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

  function getQuestionTypeLabel(question: Question): string {
    if (LEGACY_TYPES.includes(question.type)) {
      if (question.type === 'tags') return '训练项目偏好（已下线）'
      if (question.type === 'times') return '每周训练次数（已下线）'
      return '1RM 测试（已下线）'
    }
    if (question.type === 'option') {
      return question.selectionMode === 'multiple' ? '多选题' : '单选题'
    }
    return '纯文本问答'
  }

  function renderLegacyQuestion(question: Question, index: number) {
    return (
      <View key={question.id} className="question-card legacy-card">
        <View className="question-header">
          <View className="question-info">
            <Text className="question-type-badge legacy">{getQuestionTypeLabel(question)}</Text>
            <Text className="question-index">#{index + 1}</Text>
          </View>
          <View className="question-actions">
            <Button className="delete-btn" onClick={() => handleDeleteQuestion(index)}>
              删除
            </Button>
          </View>
        </View>
        <View className="legacy-tip">
          <Text className="legacy-tip-text">该题型已下线，仅可删除。新建问题请使用纯文本/单选/多选。</Text>
        </View>
      </View>
    )
  }

  function renderQuestionEditor(question: Question, index: number) {
    if (LEGACY_TYPES.includes(question.type)) {
      return renderLegacyQuestion(question, index)
    }

    const isEditing = editingIndex === index

    return (
      <View key={question.id} className="question-card">
        <View className="question-header">
          <View className="question-info">
            <Text className="question-type-badge">{getQuestionTypeLabel(question)}</Text>
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
                <Textarea
                  className="input"
                  value={question.question || ''}
                  onInput={(e) => handleQuestionChange(index, 'question', e.detail.value)}
                  placeholder="例如：你目前最大的训练目标是什么？"
                  maxlength={-1}
                  autoHeight
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
                  {Array.isArray(question.options) && (question.options as string[]).map((opt, optIdx) => (
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
                  <View
                    className="allow-other-row"
                    onClick={() => handleQuestionChange(index, 'allowOther', !question.allowOther)}
                  >
                    <Checkbox checked={Boolean(question.allowOther)} value="allowOther" />
                    <Text className="allow-other-label">增加"其他"选项，允许学员自补文字</Text>
                  </View>
                </View>
              </>
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
                    {(question.options as string[]).map((opt, idx) => (
                      <Text key={idx} className="option-tag">{idx + 1}. {opt}</Text>
                    ))}
                    {question.allowOther && (
                      <Text className="option-tag">其他（自补）</Text>
                    )}
                  </View>
                )}
              </>
            )}
          </View>
        )}
      </View>
    )
  }

  if (loading) {
    return (
      <View className="coach-questionnaire-edit-page">
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
      </View>
    )
  }

  if (showTypePicker) {
    return (
      <View className="coach-questionnaire-edit-page">
        <View className="header">
          <Button className="back-btn" onClick={() => Taro.navigateBack()}>返回</Button>
          <Text className="title">新建问卷</Text>
          <View className="header-placeholder"></View>
        </View>

        <View className="type-picker">
          <Text className="type-picker-title">请选择问卷类型</Text>
          <Text className="type-picker-hint">类型一旦确认就不能再修改了，请仔细选择。</Text>
          <Button className="type-card" onClick={() => pickEditorType('simple')}>
            <View className="type-card-inner">
              <Text className="type-card-title">列表式问卷</Text>
              <Text className="type-card-desc">按顺序提问，最常用，覆盖绝大多数教练场景。</Text>
            </View>
          </Button>
          <Button className="type-card" onClick={() => pickEditorType('flow')}>
            <View className="type-card-inner">
              <Text className="type-card-title">流程图式问卷</Text>
              <Text className="type-card-desc">支持按选项分叉，适合复杂筛查/分级流程。</Text>
            </View>
          </Button>
        </View>
      </View>
    )
  }

  return (
    <View className="coach-questionnaire-edit-page">
      <View className="header">
        <Button className="back-btn" onClick={() => Taro.navigateBack()}>返回</Button>
        <Text className="title">{templateStatus === 'active' ? '已发布问卷' : '编辑问卷'}</Text>
        <View className="header-placeholder"></View>
      </View>

      <View className="meta-section">
        <View className="form-item">
          <Text className="label">问卷名称</Text>
          <Input
            className="input"
            value={templateName}
            onInput={(e) => setTemplateName(e.detail.value)}
            placeholder="例如：新学员基础问卷"
          />
        </View>
        <View className="meta-tags">
          <Text className={`meta-tag status-${templateStatus}`}>
            {templateStatus === 'active' ? '已发布' : '编辑中'}
          </Text>
          <Text className={`meta-tag editor-${editorType}`}>
            {editorType === 'flow' ? '流程图式' : '列表式'}
          </Text>
        </View>
      </View>

      <ScrollView scrollY className="form-content">
        {questions.length === 0 ? (
          <View className="empty-wrap">
            <View className="empty-icon"><File size={48} color="#9CA3AF" /></View>
            <Text className="empty-text">还没有问题</Text>
            <Text className="empty-hint">点下面的「+ 添加问题」开始搭建你的问卷。</Text>
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
                纯文本问答
              </Button>
              <Button
                className="menu-item"
                onClick={() => handleAddQuestion('option-single')}
              >
                单选题
              </Button>
              <Button
                className="menu-item"
                onClick={() => handleAddQuestion('option-multiple')}
              >
                多选题
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
        {questionId && templateStatus !== 'active' && (
          <Button className="publish-btn" onClick={handlePublish} loading={saving}>
            发布
          </Button>
        )}
      </View>
    </View>
  )
}

export default CoachQuestionnaireEdit
