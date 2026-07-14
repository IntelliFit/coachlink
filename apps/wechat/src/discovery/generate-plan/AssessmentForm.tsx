import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Textarea, Picker } from '@tarojs/components'
import { StableInput as Input } from '@/components/StableInput'
import Taro from '@tarojs/taro'
import { ArrowLeft } from '@nutui/icons-react-taro'
import { coachService } from '@/services/coach/coachService'
import { request } from '@/utils/request'
import './assessment.scss'

export interface FormField {
  name: string
  type: string
  label: string
  required: boolean
  min?: number
  max?: number
  options?: any[]
  placeholder?: string
}

interface AssessmentFormProps {
  coachId: string
  domain: string
  onBack: () => void
  onSubmit: () => void
}

function getDefaultFields(domain: string): FormField[] {
  const baseFields: FormField[] = [
    { name: 'weekly_frequency', type: 'select', label: '每周训练频率', required: true, options: [3, 4] },
    { name: 'session_duration', type: 'select', label: '每次训练时长（分钟）', required: true, options: [45, 60, 90] },
    { name: 'available_days', type: 'multiselect', label: '可训练日', required: true, options: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'] },
    { name: 'equipment', type: 'multiselect', label: '可用器械', required: true, options: ['单杠', '双杠', '弹力带', '杠铃片', '哑铃'] },
    { name: 'intensity_preference', type: 'select', label: '强度偏好', required: true, options: ['强度优先', '容量优先', '平衡发展'] },
    { name: 'injuries', type: 'textarea', label: '伤病与限制', required: false, placeholder: '请描述任何相关的伤病历史...' },
    { name: 'specific_goal', type: 'textarea', label: '具体目标', required: true, placeholder: '请详细描述您的训练目标...' }
  ]
  switch (domain) {
    case 'weighted_pullup':
      return [
        { name: 'bw_max_reps', type: 'number', label: '自重引体最大连续次数', required: true, min: 0, max: 200 },
        { name: 'est_1rm', type: 'number', label: '估算1RM负重（kg）', required: false, min: 0, max: 100 },
        { name: 'est_3rm', type: 'number', label: '估算3RM负重（kg）', required: false, min: 0, max: 100 },
        { name: 'can_scapular_initiate', type: 'boolean', label: '是否会肩胛启动', required: true },
        { name: 'can_pause_top', type: 'boolean', label: '能否在顶部暂停2秒', required: true },
        { name: 'can_pause_bottom', type: 'boolean', label: '能否在底部暂停2秒', required: true },
        { name: 'grip_preference', type: 'select', label: '握距偏好', required: true, options: ['宽握', '中握', '窄握', '无偏好'] },
        ...baseFields
      ]
    case 'weighted_dips':
      return [
        { name: 'bw_max_reps', type: 'number', label: '自重臂屈伸最大连续次数', required: true, min: 0, max: 200 },
        { name: 'est_1rm', type: 'number', label: '估算1RM负重（kg）', required: false, min: 0, max: 100 },
        { name: 'elbow_issues', type: 'boolean', label: '是否有肘部伤病史', required: true },
        { name: 'shoulder_mobility', type: 'select', label: '肩部活动度', required: true, options: ['良好', '一般', '受限'] },
        ...baseFields
      ]
    case 'combo':
      return [
        { name: 'pullup_bw_max', type: 'number', label: '自重引体最大连续次数', required: true, min: 0, max: 200 },
        { name: 'dips_bw_max', type: 'number', label: '自重臂屈伸最大连续次数', required: true, min: 0, max: 200 },
        { name: 'pullup_1rm', type: 'number', label: '引体估算1RM负重（kg）', required: false, min: 0, max: 100 },
        { name: 'dips_1rm', type: 'number', label: '臂屈伸估算1RM负重（kg）', required: false, min: 0, max: 100 },
        { name: 'priority', type: 'select', label: '优先发展', required: true, options: ['引体向上', '臂屈伸', '平衡发展'] },
        ...baseFields
      ]
    default:
      return baseFields
  }
}

function categorizeFields(formFields: FormField[]): [string, FormField[]][] {
  const categories: Record<string, FormField[]> = {
    capability: formFields.filter(f =>
      ['bw_max_reps', 'est_1rm', 'est_3rm', 'pullup_bw_max', 'dips_bw_max', 'pullup_1rm', 'dips_1rm'].includes(f.name) ||
      (f.name.startsWith('can_') || f.name.includes('_mobility') || f.name.includes('_issues'))
    ),
    technical: formFields.filter(f => f.name.startsWith('grip_') || f.name === 'priority'),
    schedule: formFields.filter(f => ['weekly_frequency', 'session_duration', 'available_days'].includes(f.name)),
    equipment: formFields.filter(f => f.name === 'equipment'),
    preference: formFields.filter(f => ['intensity_preference', 'rest_policy', 'injuries', 'specific_goal'].includes(f.name))
  }
  return Object.entries(categories).filter(([, fields]) => fields.length > 0)
}

const CATEGORY_TITLES: Record<string, string> = {
  capability: '能力评估',
  technical: '技术要点',
  schedule: '训练安排',
  equipment: '器械配置',
  preference: '个性化偏好'
}

export default function AssessmentForm({ coachId, domain, onBack, onSubmit }: AssessmentFormProps) {
  const [formFields, setFormFields] = useState<FormField[]>([])
  const [formData, setFormData] = useState<Record<string, any>>({})
  const [loading, setLoading] = useState(true)
  const [currentStep, setCurrentStep] = useState(0)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const data = await coachService.getCoachRulepacks({ coach_id: coachId, domain })
        if (!cancelled) {
          if (data?.form_schema?.fields?.length) {
            setFormFields(data.form_schema.fields)
          } else {
            setFormFields(getDefaultFields(domain))
          }
        }
      } catch (e) {
        if (!cancelled) setFormFields(getDefaultFields(domain))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [coachId, domain])

  const categories = categorizeFields(formFields)
  const currentCategory = categories[currentStep]
  const totalSteps = categories.length

  const validateStep = (fields: FormField[]) => {
    const stepErrors: Record<string, string> = {}
    fields.forEach(field => {
      const value = formData[field.name]
      if (field.required) {
        if (field.type === 'multiselect') {
          if (!value || (Array.isArray(value) && value.length === 0)) stepErrors[field.name] = `${field.label} 不能为空`
        } else if (value === undefined || value === '' || value === null) {
          stepErrors[field.name] = `${field.label} 不能为空`
        }
      }
      if (field.type === 'number' && value !== undefined && value !== '') {
        const n = Number(value)
        if (field.min != null && n < field.min) stepErrors[field.name] = `${field.label} 不能小于 ${field.min}`
        if (field.max != null && n > field.max) stepErrors[field.name] = `${field.label} 不能大于 ${field.max}`
      }
    })
    setErrors(prev => ({ ...prev, ...stepErrors }))
    return Object.keys(stepErrors).length === 0
  }

  const handleNext = () => {
    if (!currentCategory) return
    const [, fields] = currentCategory
    if (!validateStep(fields)) return
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleSubmit()
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) setCurrentStep(currentStep - 1)
  }

  const handleSubmit = async () => {
    if (!currentCategory || !validateStep(currentCategory[1])) return
    setSubmitting(true)
    try {
      const res = await request({
        url: '/api/user/submit-onboarding',
        method: 'POST',
        data: {
          coachId,
          answers: { domain, ...formData },
          baseline_video_urls: []
        },
        showErrorToast: true
      })
      if (res.success) {
        onSubmit()
      }
    } finally {
      setSubmitting(false)
    }
  }

  const update = (name: string, value: any) => {
    setFormData(prev => ({ ...prev, [name]: value }))
    setErrors(prev => ({ ...prev, [name]: '' }))
  }

  const renderField = (field: FormField) => {
    const value = formData[field.name]
    const err = errors[field.name]
    const opts = field.options || []

    switch (field.type) {
      case 'number':
        return (
          <View className="field">
            <Text className="label">{field.label}{field.required && <Text className="required"> *</Text>}</Text>
            <Input
              type="number"
              placeholder={field.placeholder}
              value={value != null ? String(value) : ''}
              onInput={e => update(field.name, e.detail.value === '' ? undefined : Number(e.detail.value))}
              className={`input ${err ? 'error' : ''}`}
            />
            {err ? <Text className="error-text">{err}</Text> : null}
          </View>
        )
      case 'select':
        return (
          <View className="field">
            <Text className="label">{field.label}{field.required && <Text className="required"> *</Text>}</Text>
            <Picker
              mode="selector"
              range={opts}
              value={opts.indexOf(value)}
              onChange={e => update(field.name, opts[e.detail.value])}
            >
              <View className={`picker-value ${err ? 'error' : ''}`}>{value != null ? String(value) : '请选择'}</View>
            </Picker>
            {err ? <Text className="error-text">{err}</Text> : null}
          </View>
        )
      case 'multiselect': {
        const arr = Array.isArray(value) ? value : []
        return (
          <View className="field">
            <Text className="label">{field.label}{field.required && <Text className="required"> *</Text>}</Text>
            <View className="multiselect-wrap">
              {opts.map((opt: string) => (
                <View
                  key={opt}
                  className={`multiselect-item ${arr.includes(opt) ? 'checked' : ''}`}
                  onClick={() => {
                    const next = arr.includes(opt) ? arr.filter(x => x !== opt) : [...arr, opt]
                    update(field.name, next)
                  }}
                >
                  <Text>{opt}</Text>
                </View>
              ))}
            </View>
            {err ? <Text className="error-text">{err}</Text> : null}
          </View>
        )
      }
      case 'boolean':
        return (
          <View className="field field-row">
            <View
              className={`bool-btn ${value ? 'on' : ''}`}
              onClick={() => update(field.name, !value)}
            >
              <Text>{value ? '是' : '否'}</Text>
            </View>
            <Text className="label">{field.label}{field.required && <Text className="required"> *</Text>}</Text>
            {err ? <Text className="error-text">{err}</Text> : null}
          </View>
        )
      case 'textarea':
        return (
          <View className="field">
            <Text className="label">{field.label}{field.required && <Text className="required"> *</Text>}</Text>
            <Textarea
              placeholder={field.placeholder}
              value={value != null ? String(value) : ''}
              onInput={e => update(field.name, e.detail.value)}
              className={`textarea ${err ? 'error' : ''}`}
            />
            {err ? <Text className="error-text">{err}</Text> : null}
          </View>
        )
      default:
        return null
    }
  }

  if (loading) {
    return (
      <View className="assessment-form">
        <View className="loading-wrap"><Text>加载表单…</Text></View>
      </View>
    )
  }

  if (!currentCategory) {
    return (
      <View className="assessment-form">
        <View className="loading-wrap"><Text>加载配置失败</Text></View>
      </View>
    )
  }

  const [, categoryFields] = currentCategory
  const categoryName = currentCategory[0]

  return (
    <View className="assessment-form">
      <View className="form-header">
        <View className="back-link" onClick={onBack}><ArrowLeft size={14} /><Text style={{ marginLeft: 4 }}>返回选择</Text></View>
        <Text className="step-text">步骤 {currentStep + 1} / {totalSteps}</Text>
      </View>
      <Text className="category-title">{CATEGORY_TITLES[categoryName] || categoryName}</Text>
      <Text className="category-desc">请根据您的实际情况填写</Text>

      <ScrollView scrollY className="form-scroll">
        {categoryFields.map(f => (
          <View key={f.name}>{renderField(f)}</View>
        ))}
      </ScrollView>

      <View className="form-actions">
        <View className={`btn secondary ${currentStep === 0 ? 'disabled' : ''}`} onClick={currentStep === 0 ? undefined : handlePrev}>
          <Text>上一步</Text>
        </View>
        <View className={`btn primary ${submitting ? 'disabled' : ''}`} onClick={submitting ? undefined : handleNext}>
          <Text>{submitting ? '提交中…' : (currentStep === totalSteps - 1 ? '生成计划' : '下一步')}</Text>
        </View>
      </View>
    </View>
  )
}
