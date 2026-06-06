import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import { authService } from '@/services/authService'
import BottomNav from '@/components/BottomNav'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import {
  createEmptyCoachMaterial,
  deriveLegacyFieldsFromMaterials,
  MATERIAL_CATEGORY_OPTIONS,
  normalizeCoachApplicationMaterials,
  type CoachApplicationMaterial,
  type CoachApplicationMaterialCategory
} from '@/utils/coachApplicationMaterials'

interface Credential {
  name: string
  url?: string
}

interface SocialLink {
  name: string
  url?: string
}

const coachTrackOptions = [
  { value: 'buddy', label: '训练搭子', desc: '适合带新手熟悉器械、环境和基础动作' },
  { value: 'growth', label: '进阶教练', desc: '适合已有训练经验的学员做计划调整和动作修正' },
  { value: 'professional', label: '专业教练', desc: '适合周期化训练、专项表现和高客单服务' }
]

const serviceModeOptions = [
  { value: 'online', label: '线上指导' },
  { value: 'offline', label: '线下带练' },
  { value: 'hybrid', label: '线上+线下' }
]

const targetStudentLevelOptions = [
  { value: 'beginner', label: '小白入门' },
  { value: 'intermediate', label: '进阶提升' },
  { value: 'advanced', label: '高阶表现' }
]

function CoachApplication() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
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
    applicationMaterials: [] as CoachApplicationMaterial[],
    socialLinks: [] as SocialLink[],
    coachTrack: '',
    serviceModes: [] as string[],
    targetStudentLevels: [] as string[],
    supportFocus: '',
    province: '',
    city: '',
    county: '',
    address: ''
  })
  const [reviewInfo, setReviewInfo] = useState<{
    status?: string
    reviewNotes?: string
    reviewedAt?: string
  } | null>(null)
  const [currentSpecialty, setCurrentSpecialty] = useState('')
  const [currentAchievement, setCurrentAchievement] = useState('')
  const [currentCaseStudy, setCurrentCaseStudy] = useState('')
  const [editingCredential, setEditingCredential] = useState<Credential | null>(null)
  const [editingSocialLink, setEditingSocialLink] = useState<SocialLink | null>(null)
  const [editingMaterialIndex, setEditingMaterialIndex] = useState<number | null>(null)
  const [materialDraft, setMaterialDraft] = useState<CoachApplicationMaterial | null>(null)
  const [materialLinkDraft, setMaterialLinkDraft] = useState({ label: '', url: '' })
  const [uploadingMaterial, setUploadingMaterial] = useState(false)
  const [role, setRole] = useState<'coach' | 'gym'>('coach')

  useEffect(() => {
    const params = Taro.getCurrentInstance().router?.params || {}
    const r = (params.role as string) === 'gym' ? 'gym' : 'coach'
    setRole(r)
    Taro.setNavigationBarTitle({ title: r === 'gym' ? '健身房合作申请' : '教练申请' })
  }, [])

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      const params = Taro.getCurrentInstance().router?.params || {}
      const q = (params.role as string) === 'gym' ? '?role=gym' : ''
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent('/coach/application' + q)
      })
      return
    }
    loadApplication()
  }, [])

  async function loadApplication() {
    try {
      setLoading(true)
      const user = Taro.getStorageSync('user')
      const res = await coachService.getCoachApplication()
      
      if (res?.application) {
        const app = res.application
        setFormData({
          name: app.name || '',
          title: app.title || '',
          bio: app.bio || '',
          yearsExperience: app.years_experience || 0,
          teachingPhilosophy: app.teaching_philosophy || '',
          contactEmail: app.contact_email || '',
          contactPhone: app.contact_phone || '',
          specialties: app.specialties || [],
          achievements: app.achievements || [],
          caseStudies: app.case_studies || [],
          credentials: app.credentials ? app.credentials.map((cred: any) => ({
            name: cred.name || '',
            url: cred.url || ''
          })) : [],
          applicationMaterials: normalizeCoachApplicationMaterials((app as any).application_materials, {
            achievements: app.achievements || [],
            caseStudies: app.case_studies || [],
            credentials: app.credentials || []
          }),
          socialLinks: app.social_links ? Object.entries(app.social_links).map(([key, value]) => {
            const platformMap: Record<string, string> = {
              'douyin': '抖音',
              'xiaohongshu': '小红书',
              'zhihu': '知乎',
              'bilibili': 'B站',
              'kuaishou': '快手',
              'other': '其他网站'
            }
            const name = platformMap[key] || key
            return { name, url: value as string }
          }) : [],
          coachTrack: app.coach_track || '',
          serviceModes: Array.isArray(app.service_modes) ? app.service_modes : [],
          targetStudentLevels: Array.isArray(app.target_student_levels) ? app.target_student_levels : [],
          supportFocus: app.support_focus || '',
          province: app.province || '',
          city: app.city || '',
          county: app.county || '',
          address: app.address || ''
        })
        setReviewInfo({
          status: app.status,
          reviewNotes: app.review_notes,
          reviewedAt: app.reviewed_at
        })
      } else if (user) {
        // 预填用户信息
        setFormData(prev => ({
          ...prev,
          name: user.nickname || user.name || '',
          contactPhone: user.phone || ''
        }))
      }
    } catch (e) {
      console.error('[coach/application] load:', e)
      Taro.showToast({ title: '加载失败', icon: 'none' })
    } finally {
      setLoading(false)
    }
  }

  function addSpecialty() {
    if (currentSpecialty.trim()) {
      setFormData(prev => ({
        ...prev,
        specialties: [...prev.specialties, currentSpecialty.trim()]
      }))
      setCurrentSpecialty('')
    }
  }

  function removeSpecialty(index: number) {
    setFormData(prev => {
      const newSpecialties = [...prev.specialties]
      newSpecialties.splice(index, 1)
      return { ...prev, specialties: newSpecialties }
    })
  }

  function addAchievement() {
    if (currentAchievement.trim()) {
      setFormData(prev => ({
        ...prev,
        achievements: [...prev.achievements, currentAchievement.trim()]
      }))
      setCurrentAchievement('')
    }
  }

  function removeAchievement(index: number) {
    setFormData(prev => {
      const newAchievements = [...prev.achievements]
      newAchievements.splice(index, 1)
      return { ...prev, achievements: newAchievements }
    })
  }

  function addCaseStudy() {
    if (currentCaseStudy.trim()) {
      setFormData(prev => ({
        ...prev,
        caseStudies: [...prev.caseStudies, currentCaseStudy.trim()]
      }))
      setCurrentCaseStudy('')
    }
  }

  function removeCaseStudy(index: number) {
    setFormData(prev => {
      const newCaseStudies = [...prev.caseStudies]
      newCaseStudies.splice(index, 1)
      return { ...prev, caseStudies: newCaseStudies }
    })
  }

  function addCredential() {
    if (editingCredential && editingCredential.name.trim()) {
      setFormData(prev => ({
        ...prev,
        credentials: [...prev.credentials, { ...editingCredential }]
      }))
      setEditingCredential(null)
    }
  }

  function removeCredential(index: number) {
    setFormData(prev => {
      const newCredentials = [...prev.credentials]
      newCredentials.splice(index, 1)
      return { ...prev, credentials: newCredentials }
    })
  }

  function addSocialLink() {
    if (editingSocialLink && editingSocialLink.name && editingSocialLink.url) {
      setFormData(prev => ({
        ...prev,
        socialLinks: [...prev.socialLinks, { ...editingSocialLink }]
      }))
      setEditingSocialLink(null)
    }
  }

  function removeSocialLink(index: number) {
    setFormData(prev => {
      const newSocialLinks = [...prev.socialLinks]
      newSocialLinks.splice(index, 1)
      return { ...prev, socialLinks: newSocialLinks }
    })
  }

  function toggleArrayField(field: 'serviceModes' | 'targetStudentLevels', value: string) {
    setFormData(prev => {
      const current = prev[field]
      return {
        ...prev,
        [field]: current.includes(value)
          ? current.filter(item => item !== value)
          : [...current, value]
      }
    })
  }

  function openNewMaterial(category: CoachApplicationMaterialCategory = 'achievement') {
    setEditingMaterialIndex(null)
    setMaterialDraft(createEmptyCoachMaterial(category))
    setMaterialLinkDraft({ label: '', url: '' })
  }

  function openEditMaterial(index: number) {
    setEditingMaterialIndex(index)
    setMaterialDraft({ ...formData.applicationMaterials[index] })
    setMaterialLinkDraft({ label: '', url: '' })
  }

  function cancelMaterialEdit() {
    setEditingMaterialIndex(null)
    setMaterialDraft(null)
    setMaterialLinkDraft({ label: '', url: '' })
  }

  function saveMaterialDraft() {
    if (!materialDraft?.title.trim()) {
      Taro.showToast({ title: '请输入材料标题', icon: 'none' })
      return
    }
    const nextMaterial = {
      ...materialDraft,
      title: materialDraft.title.trim(),
      summary: materialDraft.summary?.trim() || null,
      detail: materialDraft.detail?.trim() || null
    }
    setFormData(prev => ({
      ...prev,
      applicationMaterials: editingMaterialIndex === null
        ? [...prev.applicationMaterials, nextMaterial]
        : prev.applicationMaterials.map((item, idx) => idx === editingMaterialIndex ? nextMaterial : item)
    }))
    cancelMaterialEdit()
  }

  function removeMaterial(index: number) {
    setFormData(prev => ({
      ...prev,
      applicationMaterials: prev.applicationMaterials.filter((_, idx) => idx !== index)
    }))
  }

  function addMaterialLink() {
    if (!materialDraft || !materialLinkDraft.url.trim()) return
    setMaterialDraft(prev => prev ? ({
      ...prev,
      links: [
        ...prev.links,
        {
          id: `link_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          label: materialLinkDraft.label.trim() || '相关链接',
          url: materialLinkDraft.url.trim()
        }
      ]
    }) : prev)
    setMaterialLinkDraft({ label: '', url: '' })
  }

  function removeMaterialLink(id: string) {
    setMaterialDraft(prev => prev ? ({ ...prev, links: prev.links.filter(item => item.id !== id) }) : prev)
  }

  function removeMaterialMedia(id: string) {
    setMaterialDraft(prev => prev ? ({ ...prev, media: prev.media.filter(item => item.id !== id) }) : prev)
  }

  async function chooseAndUploadMaterialMedia() {
    if (!materialDraft || uploadingMaterial) return
    try {
      setUploadingMaterial(true)
      const res = await Taro.chooseMedia({
        count: 1,
        mediaType: ['image', 'video'],
        sourceType: ['album', 'camera']
      } as any)
      const filePath = (res as any)?.tempFiles?.[0]?.tempFilePath
      if (!filePath) return
      const uploaded = await coachService.uploadApplicationMediaMiniApp(filePath)
      if (!uploaded) throw new Error('上传失败')
      setMaterialDraft(prev => prev ? ({
        ...prev,
        media: [
          ...prev.media,
          {
            id: `media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            type: uploaded.type,
            url: uploaded.url,
            thumbnailUrl: uploaded.thumbnailUrl || null,
            storageBucket: uploaded.storageBucket,
            storagePath: uploaded.storagePath,
            fileName: uploaded.fileName,
            fileSizeBytes: uploaded.fileSizeBytes,
            contentType: uploaded.contentType
          }
        ]
      }) : prev)
      Taro.showToast({ title: '上传成功', icon: 'success' })
    } catch (e: any) {
      console.error('[coach/application] upload material:', e)
      Taro.showToast({ title: e?.message || '上传失败', icon: 'none' })
    } finally {
      setUploadingMaterial(false)
    }
  }

  function openMaterialMedia(media: CoachApplicationMaterial['media'][number]) {
    if (media.type === 'image') {
      Taro.previewImage({ urls: [media.url], current: media.url })
      return
    }
    Taro.navigateTo({ url: `/common/common/video-player?url=${encodeURIComponent(media.url)}` })
  }

  function copyExternalLink(url: string) {
    Taro.setClipboardData({
      data: url,
      success: () => Taro.showToast({ title: '链接已复制', icon: 'success' })
    })
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
    if (![formData.province, formData.city, formData.county].some(Boolean)) {
      Taro.showToast({ title: '请填写常住城市', icon: 'none' })
      return
    }

    try {
      setSaving(true)

      // 构造社交媒体链接对象
      const socialLinksObj: Record<string, string> = {}
      formData.socialLinks.forEach(link => {
        if (link.url) {
          const keyMap: Record<string, string> = {
            '抖音': 'douyin',
            '小红书': 'xiaohongshu',
            '知乎': 'zhihu',
            'B站': 'bilibili',
            '快手': 'kuaishou',
            '其他网站': 'other'
          }
          const key = keyMap[link.name]
          if (key) {
            socialLinksObj[key] = link.url
          }
        }
      })
      const normalizedMaterials = normalizeCoachApplicationMaterials(formData.applicationMaterials, {
        achievements: formData.achievements,
        caseStudies: formData.caseStudies,
        credentials: formData.credentials
      })
      const legacyFields = deriveLegacyFieldsFromMaterials(normalizedMaterials, {
        achievements: formData.achievements,
        caseStudies: formData.caseStudies,
        credentials: formData.credentials
      })

      const existingApp = await coachService.getCoachApplication()

      if (existingApp?.application) {
        // 更新现有申请
        await coachService.updateCoachApplication({
          id: existingApp.application.id,
          name: formData.name,
          title: formData.title || null,
          bio: formData.bio || null,
          yearsExperience: formData.yearsExperience || null,
          teachingPhilosophy: formData.teachingPhilosophy || null,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          specialties: formData.specialties.length > 0 ? formData.specialties : null,
          achievements: legacyFields.achievements.length > 0 ? legacyFields.achievements : null,
          caseStudies: legacyFields.caseStudies.length > 0 ? legacyFields.caseStudies : null,
          credentials: legacyFields.credentials.length > 0 ? legacyFields.credentials as any : null,
          applicationMaterials: normalizedMaterials,
          socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null,
          coachTrack: formData.coachTrack,
          serviceModes: formData.serviceModes,
          targetStudentLevels: formData.targetStudentLevels,
          supportFocus: formData.supportFocus || null,
          province: formData.province || null,
          city: formData.city || null,
          county: formData.county || null,
          address: formData.address || null
        })
        Taro.showToast({ title: '申请已更新', icon: 'success' })
      } else {
        // 创建新申请
        await coachService.createCoachApplication({
          name: formData.name,
          title: formData.title || null,
          bio: formData.bio || null,
          yearsExperience: formData.yearsExperience || null,
          teachingPhilosophy: formData.teachingPhilosophy || null,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          specialties: formData.specialties.length > 0 ? formData.specialties : null,
          achievements: legacyFields.achievements.length > 0 ? legacyFields.achievements : null,
          caseStudies: legacyFields.caseStudies.length > 0 ? legacyFields.caseStudies : null,
          credentials: legacyFields.credentials.length > 0 ? legacyFields.credentials as any : null,
          applicationMaterials: normalizedMaterials,
          socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null,
          coachTrack: formData.coachTrack,
          serviceModes: formData.serviceModes,
          targetStudentLevels: formData.targetStudentLevels,
          supportFocus: formData.supportFocus || null,
          province: formData.province || null,
          city: formData.city || null,
          county: formData.county || null,
          address: formData.address || null
        })
        Taro.showToast({ title: '申请已提交', icon: 'success' })
      }

      // 重新加载数据
      await loadApplication()
    } catch (e: any) {
      console.error('[coach/application] submit:', e)
      Taro.showToast({ title: e.message || '提交失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className="coach-application-page">
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  const statusMap: Record<string, { text: string; color: string }> = {
    pending: { text: '待审核', color: '#f59e0b' },
    approved: { text: '已通过', color: '#10b981' },
    rejected: { text: '已拒绝', color: '#ef4444' }
  }

  return (
    <View className="coach-application-page">
      <ScrollView scrollY className="application-scroll" style={{ paddingBottom: '100px' }}>
        {reviewInfo?.status && (
          <View className="review-status-card">
            <Text className="status-label">审核状态</Text>
            <Text className="status-value" style={{ color: statusMap[reviewInfo.status]?.color || '#6b7280' }}>
              {statusMap[reviewInfo.status]?.text || reviewInfo.status}
            </Text>
            {reviewInfo.reviewNotes && (
              <View className="review-notes">
                <Text className="notes-label">审核意见：</Text>
                <Text className="notes-text">{reviewInfo.reviewNotes}</Text>
              </View>
            )}
          </View>
        )}

        <View className="form-section">
          <Text className="section-title">教练层级与服务定位</Text>

          <View className="option-grid">
            {coachTrackOptions.map(option => (
              <View
                key={option.value}
                className={`option-card ${formData.coachTrack === option.value ? 'active' : ''}`}
                onClick={() => setFormData(prev => ({ ...prev, coachTrack: option.value }))}
              >
                <Text className="option-title">{option.label}</Text>
                <Text className="option-desc">{option.desc}</Text>
              </View>
            ))}
          </View>

          <View className="form-item">
            <Text className="label">服务方式</Text>
            <View className="choice-chip-list">
              {serviceModeOptions.map(option => (
                <Text
                  key={option.value}
                  className={`choice-chip ${formData.serviceModes.includes(option.value) ? 'active' : ''}`}
                  onClick={() => toggleArrayField('serviceModes', option.value)}
                >
                  {option.label}
                </Text>
              ))}
            </View>
          </View>

          <View className="form-item">
            <Text className="label">适合学员阶段</Text>
            <View className="choice-chip-list">
              {targetStudentLevelOptions.map(option => (
                <Text
                  key={option.value}
                  className={`choice-chip ${formData.targetStudentLevels.includes(option.value) ? 'active' : ''}`}
                  onClick={() => toggleArrayField('targetStudentLevels', option.value)}
                >
                  {option.label}
                </Text>
              ))}
            </View>
          </View>

          <View className="form-item">
            <Text className="label">阶段问题聚焦</Text>
            <Textarea
              className="textarea"
              value={formData.supportFocus}
              onInput={(e) => setFormData(prev => ({ ...prev, supportFocus: e.detail.value }))}
              placeholder="例如：新手动作入门、减脂平台期、力量专项突破"
              maxlength={300}
            />
          </View>

          <View className="form-item">
            <Text className="label">常住城市 *</Text>
            <View className="city-grid">
              <Input
                className="input"
                value={formData.province}
                onInput={(e) => setFormData(prev => ({ ...prev, province: e.detail.value }))}
                placeholder="省"
              />
              <Input
                className="input"
                value={formData.city}
                onInput={(e) => setFormData(prev => ({ ...prev, city: e.detail.value }))}
                placeholder="市"
              />
              <Input
                className="input"
                value={formData.county}
                onInput={(e) => setFormData(prev => ({ ...prev, county: e.detail.value }))}
                placeholder="区/县"
              />
            </View>
            <Input
              className="input address-input"
              value={formData.address}
              onInput={(e) => setFormData(prev => ({ ...prev, address: e.detail.value }))}
              placeholder="详细地址（选填）"
            />
          </View>
        </View>

        <View className="form-section">
          <Text className="section-title">基本信息</Text>
          
          <View className="form-item">
            <Text className="label">姓名 *</Text>
            <Input
              className="input"
              value={formData.name}
              onInput={(e) => setFormData(prev => ({ ...prev, name: e.detail.value }))}
              placeholder="请输入您的姓名"
            />
          </View>

          <View className="form-item">
            <Text className="label">职称</Text>
            <Input
              className="input"
              value={formData.title}
              onInput={(e) => setFormData(prev => ({ ...prev, title: e.detail.value }))}
              placeholder="例如：高级健身教练"
            />
          </View>

          <View className="form-item">
            <Text className="label">简介</Text>
            <Textarea
              className="textarea"
              value={formData.bio}
              onInput={(e) => setFormData(prev => ({ ...prev, bio: e.detail.value }))}
              placeholder="请简要介绍您的专业背景"
              maxlength={500}
            />
          </View>

          <View className="form-item">
            <Text className="label">从业年限</Text>
            <Input
              className="input"
              type="number"
              value={String(formData.yearsExperience)}
              onInput={(e) => setFormData(prev => ({ ...prev, yearsExperience: parseInt(e.detail.value) || 0 }))}
              placeholder="请输入从业年限"
            />
          </View>

          <View className="form-item">
            <Text className="label">联系方式</Text>
            <Input
              className="input"
              value={formData.contactEmail}
              onInput={(e) => setFormData(prev => ({ ...prev, contactEmail: e.detail.value }))}
              placeholder="邮箱"
            />
            <Input
              className="input"
              style={{ marginTop: 8 }}
              value={formData.contactPhone}
              onInput={(e) => setFormData(prev => ({ ...prev, contactPhone: e.detail.value }))}
              placeholder="手机号"
            />
          </View>
        </View>

        <View className="form-section">
          <Text className="section-title">专业领域</Text>
          <View className="tag-list">
            {formData.specialties.map((s, i) => (
              <View key={i} className="tag-item">
                <Text>{s}</Text>
                <Text className="tag-remove" onClick={() => removeSpecialty(i)}>×</Text>
              </View>
            ))}
          </View>
          <View className="tag-input-row">
            <Input
              className="tag-input"
              value={currentSpecialty}
              onInput={(e) => setCurrentSpecialty(e.detail.value)}
              placeholder="输入专业领域"
              onConfirm={addSpecialty}
            />
            <Button className="tag-add-btn" onClick={addSpecialty}>添加</Button>
          </View>
        </View>

        <View className="form-section">
          <Text className="section-title">教学理念</Text>
          <Textarea
            className="textarea"
            value={formData.teachingPhilosophy}
            onInput={(e) => setFormData(prev => ({ ...prev, teachingPhilosophy: e.detail.value }))}
            placeholder="请描述您的教学理念和方法"
            maxlength={1000}
          />
        </View>

        <View className="form-section">
          <View className="section-head">
            <View>
              <Text className="section-title">证明材料</Text>
              <Text className="section-desc">成就、案例、证书、图片和视频都可以放在这里。关闭公开后仅审核可见。</Text>
            </View>
          </View>

          <View className="material-type-row">
            {MATERIAL_CATEGORY_OPTIONS.map(option => (
              <Text
                key={option.value}
                className="material-type-chip"
                onClick={() => openNewMaterial(option.value)}
              >
                + {option.label}
              </Text>
            ))}
          </View>

          {formData.applicationMaterials.length === 0 ? (
            <View className="material-empty">
              <Text>还没有添加材料，建议至少补充 1 个代表案例和 1 个证书或视频。</Text>
            </View>
          ) : (
            <View className="material-list">
              {formData.applicationMaterials.map((item, index) => (
                <View key={item.id || index} className="material-card">
                  <View className="material-card-top">
                    <Text className="material-category">
                      {MATERIAL_CATEGORY_OPTIONS.find(opt => opt.value === item.category)?.label || '材料'}
                    </Text>
                    <Text className={`material-public ${item.isPublic ? 'public' : 'private'}`}>
                      {item.isPublic ? '主页公开' : '仅审核'}
                    </Text>
                  </View>
                  <Text className="material-title">{item.title}</Text>
                  {item.summary ? <Text className="material-summary">{item.summary}</Text> : null}
                  <View className="material-meta-row">
                    <Text>{item.media.length} 个媒体</Text>
                    <Text>{item.links.length} 个链接</Text>
                  </View>
                  <View className="material-actions">
                    <Text onClick={() => openEditMaterial(index)}>编辑</Text>
                    <Text onClick={() => removeMaterial(index)}>删除</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {materialDraft && (
            <View className="material-editor">
              <View className="material-editor-types">
                {MATERIAL_CATEGORY_OPTIONS.map(option => (
                  <Text
                    key={option.value}
                    className={`material-editor-type ${materialDraft.category === option.value ? 'active' : ''}`}
                    onClick={() => setMaterialDraft(prev => prev ? { ...prev, category: option.value } : prev)}
                  >
                    {option.label}
                  </Text>
                ))}
              </View>
              <Input
                className="input"
                value={materialDraft.title}
                onInput={(e) => setMaterialDraft(prev => prev ? { ...prev, title: e.detail.value } : prev)}
                placeholder="材料标题"
              />
              <Input
                className="input material-input-gap"
                value={materialDraft.summary || ''}
                onInput={(e) => setMaterialDraft(prev => prev ? { ...prev, summary: e.detail.value } : prev)}
                placeholder="一句话摘要"
              />
              <Textarea
                className="textarea material-input-gap"
                value={materialDraft.detail || ''}
                onInput={(e) => setMaterialDraft(prev => prev ? { ...prev, detail: e.detail.value } : prev)}
                placeholder="详细说明"
                maxlength={1000}
              />
              <View className="material-public-toggle" onClick={() => setMaterialDraft(prev => prev ? { ...prev, isPublic: !prev.isPublic } : prev)}>
                <Text>公开展示到教练主页</Text>
                <Text className={`toggle-pill ${materialDraft.isPublic ? 'on' : ''}`}>
                  {materialDraft.isPublic ? '开启' : '关闭'}
                </Text>
              </View>

              <View className="material-sub-block">
                <View className="material-sub-head">
                  <Text>图片 / 视频</Text>
                  <Text className="sub-action" onClick={chooseAndUploadMaterialMedia}>
                    {uploadingMaterial ? '上传中...' : '上传'}
                  </Text>
                </View>
                {materialDraft.media.map(media => (
                  <View key={media.id} className="material-media-row">
                    <Text onClick={() => openMaterialMedia(media)}>{media.type === 'video' ? '视频' : '图片'} {media.fileName || '素材'}</Text>
                    <Text onClick={() => removeMaterialMedia(media.id)}>删除</Text>
                  </View>
                ))}
              </View>

              <View className="material-sub-block">
                <Text className="material-sub-title">外部链接</Text>
                {materialDraft.links.map(link => (
                  <View key={link.id} className="material-link-row">
                    <Text onClick={() => copyExternalLink(link.url)}>{link.label || '相关链接'}</Text>
                    <Text onClick={() => removeMaterialLink(link.id)}>删除</Text>
                  </View>
                ))}
                <Input
                  className="input"
                  value={materialLinkDraft.label}
                  onInput={(e) => setMaterialLinkDraft(prev => ({ ...prev, label: e.detail.value }))}
                  placeholder="链接名称"
                />
                <Input
                  className="input material-input-gap"
                  value={materialLinkDraft.url}
                  onInput={(e) => setMaterialLinkDraft(prev => ({ ...prev, url: e.detail.value }))}
                  placeholder="https://..."
                />
                <Button className="add-btn material-input-gap" onClick={addMaterialLink}>添加链接</Button>
              </View>

              <View className="material-editor-actions">
                <Button className="cancel-btn" onClick={cancelMaterialEdit}>取消</Button>
                <Button className="save-btn" onClick={saveMaterialDraft}>保存材料</Button>
              </View>
            </View>
          )}
        </View>

        <View className="form-section">
          <Text className="section-title">社交媒体</Text>
          {formData.socialLinks.map((s, i) => (
            <View key={i} className="social-item">
              <Text className="social-name">{s.name}</Text>
              <Text className="social-url">{s.url}</Text>
              <Text className="social-remove" onClick={() => removeSocialLink(i)}>删除</Text>
            </View>
          ))}
          {!editingSocialLink ? (
            <Button className="add-btn" onClick={() => setEditingSocialLink({ name: '抖音', url: '' })}>
              添加社交媒体
            </Button>
          ) : (
            <View className="social-form">
              <View className="picker-row">
                <Text className="picker-label">平台：</Text>
                <View className="platform-options">
                  {['抖音', '小红书', '知乎', 'B站', '快手', '其他网站'].map(p => (
                    <Text
                      key={p}
                      className={`platform-option ${editingSocialLink.name === p ? 'active' : ''}`}
                      onClick={() => setEditingSocialLink(prev => prev ? { ...prev, name: p } : null)}
                    >
                      {p}
                    </Text>
                  ))}
                </View>
              </View>
              <Input
                className="input"
                style={{ marginTop: 8 }}
                value={editingSocialLink.url || ''}
                onInput={(e) => setEditingSocialLink(prev => prev ? { ...prev, url: e.detail.value } : null)}
                placeholder="链接地址"
              />
              <View className="social-form-actions">
                <Button className="cancel-btn" onClick={() => setEditingSocialLink(null)}>取消</Button>
                <Button className="save-btn" onClick={addSocialLink}>保存</Button>
              </View>
            </View>
          )}
        </View>

        <View className="submit-section">
          <Button className="submit-btn" onClick={handleSubmit} loading={saving}>
            {reviewInfo?.status === 'pending' ? '更新申请' : '提交申请'}
          </Button>
        </View>
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachApplication
