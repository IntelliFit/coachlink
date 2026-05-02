import React, { useEffect, useMemo, useState } from 'react'
import { Button, Input, ScrollView, Text, Textarea, View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { authService } from '@/services/authService'
import { coachService } from '@/services/coach/coachService'
import {
  COACH_TRACK_OPTIONS,
  CoachApplicationStatus,
  getCoachApplicationStatusMeta,
  getCoachTrackLabel,
  getServiceModeLabel,
  getTargetStudentLevelLabel,
  normalizeCoachApplicationStatus,
  SERVICE_MODE_OPTIONS,
  TARGET_STUDENT_LEVEL_OPTIONS,
} from '@/utils/coachApplicationParity'
import './index.scss'

interface Credential {
  name: string
  url?: string
}

interface SocialLink {
  name: string
  url?: string
}

interface ReviewInfoState {
  status?: string
  reviewNotes?: string | null
  reviewedAt?: string | null
}

const SOCIAL_PLATFORM_OPTIONS = ['抖音', '小红书', '知乎', 'B站', '快手', '其他网站']

const SOCIAL_PLATFORM_KEY_MAP: Record<string, string> = {
  抖音: 'douyin',
  小红书: 'xiaohongshu',
  知乎: 'zhihu',
  B站: 'bilibili',
  快手: 'kuaishou',
  其他网站: 'other',
}

function CoachApplication() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [applicationId, setApplicationId] = useState<string>('')
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
    yearsExperience: 0,
    teachingPhilosophy: '',
    contactEmail: '',
    contactPhone: '',
    specialties: [] as string[],
    achievements: [] as string[],
    caseStudies: [] as string[],
    credentials: [] as Credential[],
    socialLinks: [] as SocialLink[],
    coachTrack: '',
    serviceModes: [] as string[],
    targetStudentLevels: [] as string[],
    supportFocus: '',
    province: '',
    city: '',
    county: '',
    address: '',
    latitude: null as number | null,
    longitude: null as number | null,
  })
  const [reviewInfo, setReviewInfo] = useState<ReviewInfoState | null>(null)
  const [currentSpecialty, setCurrentSpecialty] = useState('')
  const [currentAchievement, setCurrentAchievement] = useState('')
  const [currentCaseStudy, setCurrentCaseStudy] = useState('')
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [editingSocialLink, setEditingSocialLink] = useState<SocialLink | null>(null)

  const normalizedStatus = normalizeCoachApplicationStatus(
    reviewInfo?.status,
    !!authService.getCurrentUser()?.is_coach,
  )
  const statusMeta = getCoachApplicationStatusMeta(normalizedStatus, reviewInfo?.reviewNotes)

  useEffect(() => {
    Taro.setNavigationBarTitle({ title: '教练申请' })
  }, [])

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/coach/application')
      })
      return
    }
    void loadApplication()
  }, [])

  const selectedTrack = useMemo(
    () => COACH_TRACK_OPTIONS.find((item) => item.value === formData.coachTrack),
    [formData.coachTrack],
  )

  function syncCurrentUserStatus(status: CoachApplicationStatus) {
    authService.mergeCurrentUser({
      coach_status: status === 'coach' ? 'approved' : status,
      is_coach: status === 'coach' || status === 'approved',
    })
  }

  async function loadApplication() {
    try {
      setLoading(true)
      const currentUser = authService.getCurrentUser()
      const res = await coachService.getCoachApplication()

      if (res?.application) {
        const app = res.application
        const socialLinks = app.social_links
          ? Object.entries(app.social_links).map(([key, value]) => {
              const platformName = Object.entries(SOCIAL_PLATFORM_KEY_MAP).find(([, mapped]) => mapped === key)?.[0] || key
              return { name: platformName, url: String(value || '') }
            })
          : []

        setApplicationId(String(app.id || ''))
        setFormData({
          name: app.name || '',
          title: app.title || '',
          bio: app.bio || '',
          yearsExperience: Number(app.years_experience || 0),
          teachingPhilosophy: app.teaching_philosophy || '',
          contactEmail: app.contact_email || '',
          contactPhone: app.contact_phone || '',
          specialties: Array.isArray(app.specialties) ? app.specialties.filter(Boolean) : [],
          achievements: Array.isArray(app.achievements) ? app.achievements.filter(Boolean) : [],
          caseStudies: Array.isArray(app.case_studies) ? app.case_studies.filter(Boolean) : [],
          credentials: Array.isArray(app.credentials) ? app.credentials.map((item: any) => ({
            name: item?.name || '',
            url: item?.url || ''
          })) : [],
          socialLinks,
          coachTrack: app.coach_track || '',
          serviceModes: Array.isArray(app.service_modes) ? app.service_modes.filter(Boolean) : [],
          targetStudentLevels: Array.isArray(app.target_student_levels) ? app.target_student_levels.filter(Boolean) : [],
          supportFocus: app.support_focus || '',
          province: app.province || '',
          city: app.city || '',
          county: app.county || '',
          address: app.address || '',
          latitude: typeof app.latitude === 'number' ? app.latitude : null,
          longitude: typeof app.longitude === 'number' ? app.longitude : null,
        })
        setReviewInfo({
          status: app.status,
          reviewNotes: app.review_notes || null,
          reviewedAt: app.reviewed_at || null,
        })
        syncCurrentUserStatus(normalizeCoachApplicationStatus(app.status, !!currentUser?.is_coach))
        return
      }

      setApplicationId('')
      setReviewInfo(null)
      if (currentUser) {
        setFormData((prev) => ({
          ...prev,
          name: currentUser.nickname || currentUser.name || prev.name,
          contactPhone: currentUser.phone || prev.contactPhone,
        }))
      }
    } catch (error) {
      console.error('[coach/application] load:', error)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function updateFormValue<K extends keyof typeof formData>(key: K, value: (typeof formData)[K]) {
    setFormData((prev) => ({ ...prev, [key]: value }))
  }

  function toggleArrayValue(key: 'serviceModes' | 'targetStudentLevels', value: string) {
    setFormData((prev) => {
      const nextValues = prev[key].includes(value)
        ? prev[key].filter((item) => item !== value)
        : [...prev[key], value]
      return { ...prev, [key]: nextValues }
    })
  }

  function addListValue(key: 'specialties' | 'achievements' | 'caseStudies', rawValue: string, reset: () => void) {
    const value = rawValue.trim()
    if (!value) return
    setFormData((prev) => {
      if (prev[key].includes(value)) return prev
      return { ...prev, [key]: [...prev[key], value] }
    })
    reset()
  }

  function removeListValue(key: 'specialties' | 'achievements' | 'caseStudies', index: number) {
    setFormData((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function addCredential() {
    if (!editingCredential?.name.trim()) return
    setFormData((prev) => ({
      ...prev,
      credentials: [...prev.credentials, { name: editingCredential.name.trim(), url: editingCredential.url?.trim() || '' }]
    }))
    setEditingCredential(null)
  }

  function removeCredential(index: number) {
    setFormData((prev) => ({
      ...prev,
      credentials: prev.credentials.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function addSocialLink() {
    if (!editingSocialLink?.name || !editingSocialLink?.url?.trim()) return
    setFormData((prev) => ({
      ...prev,
      socialLinks: [...prev.socialLinks, { name: editingSocialLink.name, url: editingSocialLink.url.trim() }]
    }))
    setEditingSocialLink(null)
  }

  function removeSocialLink(index: number) {
    setFormData((prev) => ({
      ...prev,
      socialLinks: prev.socialLinks.filter((_, itemIndex) => itemIndex !== index),
    }))
  }

  function getSubmitLabel() {
    switch (normalizedStatus) {
      case 'pending':
      case 'reviewing':
        return '更新申请资料'
      case 'needs_info':
        return '补充后重新提交'
      case 'rejected':
        return '重新提交申请'
      case 'approved':
      case 'coach':
        return '更新申请资料'
      default:
        return '提交申请'
    }
  }

  async function handleSubmit() {
    if (!formData.name.trim()) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
      return
    }

    if (!formData.coachTrack) {
      Taro.showToast({ title: '请选择教练层级', icon: 'none' })
      return
    }

    if (![formData.province, formData.city, formData.county].some((item) => item.trim())) {
      Taro.showToast({ title: '请至少填写省、市、区中的一项', icon: 'none' })
      return
    }

    try {
      setSaving(true)

      const socialLinks: Record<string, string> = {}
      formData.socialLinks.forEach((item) => {
        const key = SOCIAL_PLATFORM_KEY_MAP[item.name]
        if (key && item.url) {
          socialLinks[key] = item.url
        }
      })

      const payload = {
        name: formData.name.trim(),
        title: formData.title.trim() || null,
        bio: formData.bio.trim() || null,
        yearsExperience: formData.yearsExperience || null,
        teachingPhilosophy: formData.teachingPhilosophy.trim() || null,
        contactEmail: formData.contactEmail.trim() || null,
        contactPhone: formData.contactPhone.trim() || null,
        specialties: formData.specialties.length ? formData.specialties : null,
        achievements: formData.achievements.length ? formData.achievements : null,
        caseStudies: formData.caseStudies.length ? formData.caseStudies : null,
        credentials: formData.credentials.length ? formData.credentials : null,
        socialLinks: Object.keys(socialLinks).length ? socialLinks : null,
        coachTrack: formData.coachTrack,
        serviceModes: formData.serviceModes,
        targetStudentLevels: formData.targetStudentLevels,
        supportFocus: formData.supportFocus.trim() || null,
        province: formData.province.trim() || null,
        city: formData.city.trim() || null,
        county: formData.county.trim() || null,
        address: formData.address.trim() || null,
        latitude: formData.latitude,
        longitude: formData.longitude,
      }

      if (applicationId) {
        await coachService.updateCoachApplication({
          id: applicationId,
          ...payload,
        })
      } else {
        await coachService.createCoachApplication(payload)
      }

      syncCurrentUserStatus('pending')
      Taro.showToast({ title: applicationId ? '申请已更新' : '申请已提交', icon: 'success' })
      await loadApplication()
    } catch (error: any) {
      console.error('[coach/application] submit:', error)
      Taro.showToast({ title: error?.message || '提交失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className='coach-application-page'>
        <View className='loading-wrap'><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  return (
    <View className='coach-application-page'>
      <ScrollView scrollY className='application-scroll'>
        <View className='hero-card'>
          <Text className='hero-eyebrow'>Web Source Of Truth</Text>
          <Text className='hero-title'>申请成为教练</Text>
          <Text className='hero-desc'>
            当前入驻流程已经升级为分层申请。请先确认你最适合的教练层级，再补充资料，审核通过后即可开始提供对应阶段的服务。
          </Text>
        </View>

        <View className={`review-status-card tone-${statusMeta.tone}`}>
          <View className='review-status-head'>
            <View>
              <Text className='status-label'>当前审核状态</Text>
              <Text className='status-title'>{statusMeta.label}</Text>
            </View>
            <View className={`status-pill tone-${statusMeta.tone}`}>
              <Text className='status-pill-text'>{statusMeta.label}</Text>
            </View>
          </View>
          <Text className='status-hint'>{statusMeta.hint}</Text>
          {reviewInfo?.reviewedAt ? (
            <Text className='status-time'>最近审核时间：{String(reviewInfo.reviewedAt).replace('T', ' ').slice(0, 16)}</Text>
          ) : null}
          {reviewInfo?.reviewNotes ? (
            <View className='review-notes'>
              <Text className='notes-label'>审核意见</Text>
              <Text className='notes-text'>{reviewInfo.reviewNotes}</Text>
            </View>
          ) : null}
        </View>

        <View className='form-section'>
          <Text className='section-title'>先选择你的教练层级</Text>
          <Text className='section-desc'>网站已经按供给分层，这里也要保持同一套教练定位语义。</Text>
          <View className='track-grid'>
            {COACH_TRACK_OPTIONS.map((item) => {
              const active = formData.coachTrack === item.value
              return (
                <View
                  key={item.value}
                  className={`track-card ${active ? 'active' : ''}`}
                  onClick={() => updateFormValue('coachTrack', item.value)}
                >
                  <Text className='track-card-title'>{item.label}</Text>
                  <Text className='track-card-desc'>{item.description}</Text>
                </View>
              )
            })}
          </View>
          {selectedTrack ? (
            <Text className='selected-summary'>当前选择：{selectedTrack.description}</Text>
          ) : null}

          <View className='choice-section'>
            <Text className='choice-label'>服务方式</Text>
            <Text className='choice-summary'>可多选：如果你同时提供线上、线下服务，可以两个都选。</Text>
            <View className='chip-wrap'>
              {SERVICE_MODE_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`choice-chip ${formData.serviceModes.includes(item.value) ? 'active' : ''}`}
                  onClick={() => toggleArrayValue('serviceModes', item.value)}
                >
                  <Text className='choice-chip-text'>{item.label}</Text>
                </View>
              ))}
            </View>
            {formData.serviceModes.length > 0 ? (
              <Text className='choice-summary'>已选择：{formData.serviceModes.map((item) => getServiceModeLabel(item)).join('、')}</Text>
            ) : null}
          </View>

          <View className='choice-section'>
            <Text className='choice-label'>适合服务的学员阶段</Text>
            <View className='chip-wrap'>
              {TARGET_STUDENT_LEVEL_OPTIONS.map((item) => (
                <View
                  key={item.value}
                  className={`choice-chip secondary ${formData.targetStudentLevels.includes(item.value) ? 'active' : ''}`}
                  onClick={() => toggleArrayValue('targetStudentLevels', item.value)}
                >
                  <Text className='choice-chip-text'>{item.label}</Text>
                </View>
              ))}
            </View>
            {formData.targetStudentLevels.length > 0 ? (
              <Text className='choice-summary'>已选择：{formData.targetStudentLevels.map((item) => getTargetStudentLevelLabel(item)).join('、')}</Text>
            ) : null}
          </View>

          <View className='form-item'>
            <Text className='label'>你最擅长解决的问题</Text>
            <Textarea
              className='textarea'
              value={formData.supportFocus}
              maxlength={300}
              onInput={(event) => updateFormValue('supportFocus', event.detail.value)}
              placeholder='例如：帮助从未系统训练过的学员跨过入门期，或帮助已有基础的学员稳定提升动作和计划执行。'
            />
          </View>
        </View>

        <View className='form-section'>
          <Text className='section-title'>基础信息</Text>

          <View className='form-item'>
            <Text className='label'>姓名 *</Text>
            <Input
              className='input'
              value={formData.name}
              onInput={(event) => updateFormValue('name', event.detail.value)}
              placeholder='请输入你的姓名'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>称号 / 头衔</Text>
            <Input
              className='input'
              value={formData.title}
              onInput={(event) => updateFormValue('title', event.detail.value)}
              placeholder={selectedTrack ? `例如：${getCoachTrackLabel(formData.coachTrack)}陪练` : '例如：力量训练教练'}
            />
          </View>

          <View className='form-item'>
            <Text className='label'>专业领域</Text>
            <View className='tag-list'>
              {formData.specialties.map((item, index) => (
                <View key={`${item}-${index}`} className='tag-item'>
                  <Text>{item}</Text>
                  <Text className='tag-remove' onClick={() => removeListValue('specialties', index)}>×</Text>
                </View>
              ))}
            </View>
            <View className='inline-input-row'>
              <Input
                className='inline-input'
                value={currentSpecialty}
                onInput={(event) => setCurrentSpecialty(event.detail.value)}
                onConfirm={() => addListValue('specialties', currentSpecialty, () => setCurrentSpecialty(''))}
                placeholder='输入专业领域'
              />
              <View className='inline-action' onClick={() => addListValue('specialties', currentSpecialty, () => setCurrentSpecialty(''))}>
                <Text className='inline-action-text'>添加</Text>
              </View>
            </View>
          </View>

          <View className='form-item'>
            <Text className='label'>教学年限（年）</Text>
            <Input
              className='input'
              type='number'
              value={String(formData.yearsExperience || '')}
              onInput={(event) => updateFormValue('yearsExperience', parseInt(event.detail.value, 10) || 0)}
              placeholder='例如：3'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>联系邮箱</Text>
            <Input
              className='input'
              value={formData.contactEmail}
              onInput={(event) => updateFormValue('contactEmail', event.detail.value)}
              placeholder='example@email.com'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>联系电话</Text>
            <Input
              className='input'
              value={formData.contactPhone}
              onInput={(event) => updateFormValue('contactPhone', event.detail.value)}
              placeholder='请输入联系电话'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>个人简介</Text>
            <Textarea
              className='textarea'
              value={formData.bio}
              maxlength={500}
              onInput={(event) => updateFormValue('bio', event.detail.value)}
              placeholder='简要介绍你的训练背景、服务风格和擅长方向'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>教学理念</Text>
            <Textarea
              className='textarea'
              value={formData.teachingPhilosophy}
              maxlength={800}
              onInput={(event) => updateFormValue('teachingPhilosophy', event.detail.value)}
              placeholder='描述你的教学方法、节奏和你希望给学员带来的价值'
            />
          </View>
        </View>

        <View className='form-section'>
          <Text className='section-title'>成果与案例</Text>

          <View className='form-item'>
            <Text className='label'>主要成就</Text>
            {formData.achievements.map((item, index) => (
              <View key={`${item}-${index}`} className='list-item'>
                <Text>{item}</Text>
                <Text className='list-item-remove' onClick={() => removeListValue('achievements', index)}>删除</Text>
              </View>
            ))}
            <View className='inline-input-row'>
              <Input
                className='inline-input'
                value={currentAchievement}
                onInput={(event) => setCurrentAchievement(event.detail.value)}
                onConfirm={() => addListValue('achievements', currentAchievement, () => setCurrentAchievement(''))}
                placeholder='输入主要成就'
              />
              <View className='inline-action' onClick={() => addListValue('achievements', currentAchievement, () => setCurrentAchievement(''))}>
                <Text className='inline-action-text'>添加</Text>
              </View>
            </View>
          </View>

          <View className='form-item'>
            <Text className='label'>代表案例</Text>
            {formData.caseStudies.map((item, index) => (
              <View key={`${item}-${index}`} className='list-item'>
                <Text>{item}</Text>
                <Text className='list-item-remove' onClick={() => removeListValue('caseStudies', index)}>删除</Text>
              </View>
            ))}
            <View className='inline-input-row'>
              <Input
                className='inline-input'
                value={currentCaseStudy}
                onInput={(event) => setCurrentCaseStudy(event.detail.value)}
                onConfirm={() => addListValue('caseStudies', currentCaseStudy, () => setCurrentCaseStudy(''))}
                placeholder='输入代表案例'
              />
              <View className='inline-action' onClick={() => addListValue('caseStudies', currentCaseStudy, () => setCurrentCaseStudy(''))}>
                <Text className='inline-action-text'>添加</Text>
              </View>
            </View>
          </View>
        </View>

        <View className='form-section'>
          <Text className='section-title'>资质与社媒</Text>

          <View className='form-item'>
            <Text className='label'>资质证书</Text>
            {formData.credentials.map((item, index) => (
              <View key={`${item.name}-${index}`} className='detail-card'>
                <Text className='detail-title'>{item.name}</Text>
                {item.url ? <Text className='detail-desc'>{item.url}</Text> : null}
                <Text className='detail-remove' onClick={() => removeCredential(index)}>删除</Text>
              </View>
            ))}
            {!editingCredential ? (
              <View className='ghost-action' onClick={() => setEditingCredential({ name: '', url: '' })}>
                <Text className='ghost-action-text'>添加证书</Text>
              </View>
            ) : (
              <View className='stack-form'>
                <Input
                  className='input'
                  value={editingCredential.name}
                  onInput={(event) => setEditingCredential((prev) => prev ? { ...prev, name: event.detail.value } : null)}
                  placeholder='证书名称'
                />
                <Input
                  className='input'
                  value={editingCredential.url || ''}
                  onInput={(event) => setEditingCredential((prev) => prev ? { ...prev, url: event.detail.value } : null)}
                  placeholder='证书链接（可选）'
                />
                <View className='stack-actions'>
                  <View className='secondary-action' onClick={() => setEditingCredential(null)}>
                    <Text className='secondary-action-text'>取消</Text>
                  </View>
                  <View className='primary-action' onClick={addCredential}>
                    <Text className='primary-action-text'>保存</Text>
                  </View>
                </View>
              </View>
            )}
          </View>

          <View className='form-item'>
            <Text className='label'>社交媒体</Text>
            {formData.socialLinks.map((item, index) => (
              <View key={`${item.name}-${index}`} className='detail-card'>
                <Text className='detail-title'>{item.name}</Text>
                <Text className='detail-desc'>{item.url}</Text>
                <Text className='detail-remove' onClick={() => removeSocialLink(index)}>删除</Text>
              </View>
            ))}
            {!editingSocialLink ? (
              <View className='ghost-action' onClick={() => setEditingSocialLink({ name: '抖音', url: '' })}>
                <Text className='ghost-action-text'>添加社媒</Text>
              </View>
            ) : (
              <View className='stack-form'>
                <Text className='choice-label'>平台</Text>
                <View className='chip-wrap compact'>
                  {SOCIAL_PLATFORM_OPTIONS.map((item) => (
                    <View
                      key={item}
                      className={`choice-chip compact ${editingSocialLink.name === item ? 'active' : ''}`}
                      onClick={() => setEditingSocialLink((prev) => prev ? { ...prev, name: item } : null)}
                    >
                      <Text className='choice-chip-text'>{item}</Text>
                    </View>
                  ))}
                </View>
                <Input
                  className='input'
                  value={editingSocialLink.url || ''}
                  onInput={(event) => setEditingSocialLink((prev) => prev ? { ...prev, url: event.detail.value } : null)}
                  placeholder='输入链接地址'
                />
                <View className='stack-actions'>
                  <View className='secondary-action' onClick={() => setEditingSocialLink(null)}>
                    <Text className='secondary-action-text'>取消</Text>
                  </View>
                  <View className='primary-action' onClick={addSocialLink}>
                    <Text className='primary-action-text'>保存</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        <View className='form-section'>
          <Text className='section-title'>位置信息</Text>
          <Text className='section-desc'>Web 端会记录教练的常驻城市和详细地址，小程序这里也使用同一套字段。</Text>

          <View className='form-item'>
            <Text className='label'>省份 *</Text>
            <Input
              className='input'
              value={formData.province}
              onInput={(event) => updateFormValue('province', event.detail.value)}
              placeholder='例如：广东省'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>城市 *</Text>
            <Input
              className='input'
              value={formData.city}
              onInput={(event) => updateFormValue('city', event.detail.value)}
              placeholder='例如：深圳市'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>区县 *</Text>
            <Input
              className='input'
              value={formData.county}
              onInput={(event) => updateFormValue('county', event.detail.value)}
              placeholder='例如：南山区'
            />
          </View>

          <View className='form-item'>
            <Text className='label'>详细地址</Text>
            <Textarea
              className='textarea short'
              value={formData.address}
              maxlength={200}
              onInput={(event) => updateFormValue('address', event.detail.value)}
              placeholder='例如：某某健身房 / 训练工作室 / 常驻场馆'
            />
          </View>
        </View>

        <View className='submit-section'>
          <Button className='submit-btn' onClick={handleSubmit} loading={saving}>
            {getSubmitLabel()}
          </Button>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachApplication
