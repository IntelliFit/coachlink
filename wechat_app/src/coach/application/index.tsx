import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Textarea, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import { authService } from '@/services/authService'
import BottomNav from '@/components/BottomNav'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'

interface Credential {
  name: string
  url?: string
}

interface SocialLink {
  name: string
  url?: string
}

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
    socialLinks: [] as SocialLink[]
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
          }) : []
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

  async function handleSubmit() {
    if (!formData.name.trim()) {
      Taro.showToast({ title: '请输入姓名', icon: 'none' })
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
          achievements: formData.achievements.length > 0 ? formData.achievements : null,
          caseStudies: formData.caseStudies.length > 0 ? formData.caseStudies : null,
          credentials: formData.credentials.length > 0 ? formData.credentials : null,
          socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null
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
          achievements: formData.achievements.length > 0 ? formData.achievements : null,
          caseStudies: formData.caseStudies.length > 0 ? formData.caseStudies : null,
          credentials: formData.credentials.length > 0 ? formData.credentials : null,
          socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null
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
          <Text className="section-title">主要成就</Text>
          {formData.achievements.map((a, i) => (
            <View key={i} className="list-item">
              <Text>{a}</Text>
              <Text className="list-item-remove" onClick={() => removeAchievement(i)}>删除</Text>
            </View>
          ))}
          <View className="list-input-row">
            <Input
              className="list-input"
              value={currentAchievement}
              onInput={(e) => setCurrentAchievement(e.detail.value)}
              placeholder="输入成就"
              onConfirm={addAchievement}
            />
            <Button className="list-add-btn" onClick={addAchievement}>添加</Button>
          </View>
        </View>

        <View className="form-section">
          <Text className="section-title">案例研究</Text>
          {formData.caseStudies.map((c, i) => (
            <View key={i} className="list-item">
              <Text>{c}</Text>
              <Text className="list-item-remove" onClick={() => removeCaseStudy(i)}>删除</Text>
            </View>
          ))}
          <View className="list-input-row">
            <Input
              className="list-input"
              value={currentCaseStudy}
              onInput={(e) => setCurrentCaseStudy(e.detail.value)}
              placeholder="输入案例"
              onConfirm={addCaseStudy}
            />
            <Button className="list-add-btn" onClick={addCaseStudy}>添加</Button>
          </View>
        </View>

        <View className="form-section">
          <Text className="section-title">资质证书</Text>
          {formData.credentials.map((c, i) => (
            <View key={i} className="credential-item">
              <Text className="credential-name">{c.name}</Text>
              {c.url && <Text className="credential-url">{c.url}</Text>}
              <Text className="credential-remove" onClick={() => removeCredential(i)}>删除</Text>
            </View>
          ))}
          {!editingCredential ? (
            <Button className="add-btn" onClick={() => setEditingCredential({ name: '', url: '' })}>
              添加证书
            </Button>
          ) : (
            <View className="credential-form">
              <Input
                className="input"
                value={editingCredential.name}
                onInput={(e) => setEditingCredential(prev => prev ? { ...prev, name: e.detail.value } : null)}
                placeholder="证书名称"
              />
              <Input
                className="input"
                style={{ marginTop: 8 }}
                value={editingCredential.url || ''}
                onInput={(e) => setEditingCredential(prev => prev ? { ...prev, url: e.detail.value } : null)}
                placeholder="证书链接（可选）"
              />
              <View className="credential-form-actions">
                <Button className="cancel-btn" onClick={() => setEditingCredential(null)}>取消</Button>
                <Button className="save-btn" onClick={addCredential}>保存</Button>
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
