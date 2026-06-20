import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView, Input, Textarea, Button, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { coachService } from '@/services/coach/coachService'
import BottomNav from '@/components/BottomNav'
import './index.scss'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import { useTheme } from '@/hooks/useTheme'

function CoachProfile() {
  const { effectiveTheme } = useTheme()
  const coachId = Taro.getCurrentInstance().router?.params?.id
  const editParam = Taro.getCurrentInstance().router?.params?.edit
  const shouldEnterEditMode = editParam === '1' || editParam === 'true'
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [isEditMode, setIsEditMode] = useState(shouldEnterEditMode)
  const [coach, setCoach] = useState<any>(null)
  const [aggregatedInfo, setAggregatedInfo] = useState<any>(null)
  const [user, setUser] = useState<any>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  
  const [formData, setFormData] = useState({
    name: '',
    title: '',
    bio: '',
    yearsExperience: 0,
    specialties: [] as string[],
    teachingPhilosophy: '',
    achievements: [] as string[],
    caseStudies: [] as string[],
    credentials: [] as Array<{ name: string; url?: string }>,
    contactEmail: '',
    contactPhone: '',
    socialLinks: [] as Array<{ name: string; url: string }>
  })
  const [currentSpecialty, setCurrentSpecialty] = useState('')
  const [currentAchievement, setCurrentAchievement] = useState('')
  const [currentCaseStudy, setCurrentCaseStudy] = useState('')
  const [editingCredential, setEditingCredential] = useState<{ name: string; url?: string } | null>(null)
  const [editingSocialLink, setEditingSocialLink] = useState<{ name: string; url: string } | null>(null)

  useEffect(() => {
    const token = Taro.getStorageSync('token')
    if (!token) {
      Taro.redirectTo({
        url: '/auth/login?returnTo=' + encodeURIComponent(`/coach/profile/[id]?id=${coachId}`)
      })
      return
    }
    const currentUser = Taro.getStorageSync('user')
    setUser(currentUser)
    loadCoach()
  }, [coachId])

  useEffect(() => {
    if (isOwnProfile && shouldEnterEditMode) {
      setIsEditMode(true)
    }
  }, [isOwnProfile, shouldEnterEditMode])

  async function loadCoach() {
    try {
      setLoading(true)
      const res = await coachService.getCoach({ id: coachId })
      if (res?.coach) {
        setCoach(res.coach)
        const currentUser = Taro.getStorageSync('user')
        const isOwn = currentUser?.id === res.coach.user_id
        setIsOwnProfile(isOwn)
        
        // 加载聚合信息
        const aggRes = await coachService.getAggregatedInfo({ coachId: res.coach.id })
        if (aggRes) {
          setAggregatedInfo(aggRes)
        }

        // 如果是自己的主页，初始化表单数据
        if (isOwn) {
          const profile = res.coach.profile || {}
          setFormData({
            name: res.coach.name || '',
            title: res.coach.title || '',
            bio: res.coach.bio || '',
            yearsExperience: res.coach.years_experience || 0,
            specialties: res.coach.specialties || [],
            teachingPhilosophy: profile.teachingPhilosophy || '',
            achievements: profile.achievements || [],
            caseStudies: profile.caseStudies || [],
            credentials: profile.credentials || [],
            contactEmail: profile.contactEmail || '',
            contactPhone: profile.contactPhone || '',
            socialLinks: profile.socialLinks ? Object.entries(profile.socialLinks).map(([key, value]) => {
              const platformMap: Record<string, string> = {
                'douyin': '抖音',
                'xiaohongshu': '小红书',
                'zhihu': '知乎',
                'bilibili': 'B站',
                'kuaishou': '快手',
                'other': '其他网站'
              }
              return { name: platformMap[key] || key, url: value as string }
            }) : []
          })
        }
      }
    } catch (e) {
      console.error('[coach/profile] load:', e)
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

  async function handleSave() {
    if (!coach) return

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

      const profile = {
        teachingPhilosophy: formData.teachingPhilosophy || null,
        achievements: formData.achievements.length > 0 ? formData.achievements : null,
        caseStudies: formData.caseStudies.length > 0 ? formData.caseStudies : null,
        credentials: formData.credentials.length > 0 ? formData.credentials : null,
        contactEmail: formData.contactEmail || null,
        contactPhone: formData.contactPhone || null,
        socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null
      }

      // 调用更新接口
      const res = await coachService.updateCoachProfile({
        id: coach.id,
        name: formData.name,
        title: formData.title || null,
        specialties: formData.specialties.length > 0 ? formData.specialties : null,
        yearsExperience: formData.yearsExperience || null,
        bio: formData.bio || null,
        profile
      })

      if (res?.success) {
        Taro.showToast({ title: '保存成功', icon: 'success' })
        setIsEditMode(false)
        await loadCoach()
      } else {
        Taro.showToast({ title: res?.message || '保存失败', icon: 'none' })
      }
    } catch (e: any) {
      console.error('[coach/profile] save:', e)
      Taro.showToast({ title: e.message || '保存失败', icon: 'none' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View className={`coach-profile-page theme-${effectiveTheme}`}>
        <View className="loading-wrap"><LoadingSpinner size={48} /></View>
        <BottomNav />
      </View>
    )
  }

  if (!coach) {
    return (
      <View className={`coach-profile-page theme-${effectiveTheme}`}>
        <View className="error-wrap">教练信息不存在</View>
        <BottomNav />
      </View>
    )
  }

  const displayCoach = aggregatedInfo?.coach || coach
  const specialties = displayCoach.specialties || []
  const profile = displayCoach.profile || {}
  const stats = aggregatedInfo ? {
    contentCount: aggregatedInfo.contentCount || 0,
    reviewCount: aggregatedInfo.reviewCount || 0,
    studentCount: aggregatedInfo.studentCount || 0,
    averageRating: aggregatedInfo.averageRating || 0
  } : null

  return (
    <View className={`coach-profile-page theme-${effectiveTheme}`}>
      <ScrollView scrollY className="profile-scroll" style={{ paddingBottom: isOwnProfile && isEditMode ? '100px' : '70px' }}>
        {/* 头部信息 */}
        <View className="profile-header">
          {displayCoach.avatar_url ? (
            <Image className="avatar" src={displayCoach.avatar_url} mode="aspectFill" />
          ) : (
            <View className="avatar-placeholder">
              <Text>{displayCoach.name?.substring(0, 1) || '?'}</Text>
            </View>
          )}
          <View className="header-info">
            <Text className="coach-name">{displayCoach.name}</Text>
            {displayCoach.title && <Text className="coach-title">{displayCoach.title}</Text>}
            {stats && (
              <View className="stats-row">
                <View className="stat-item">
                  <Text className="stat-value">{stats.studentCount}</Text>
                  <Text className="stat-label">学员</Text>
                </View>
                <View className="stat-item">
                  <Text className="stat-value">{stats.contentCount}</Text>
                  <Text className="stat-label">内容</Text>
                </View>
                <View className="stat-item">
                  <Text className="stat-value">{stats.averageRating.toFixed(1)}</Text>
                  <Text className="stat-label">评分</Text>
                </View>
              </View>
            )}
          </View>
          {isOwnProfile && (
            <Button
              className="edit-btn"
              onClick={() => setIsEditMode(!isEditMode)}
            >
              {isEditMode ? '取消编辑' : '编辑'}
            </Button>
          )}
        </View>

        {/* 专业领域 */}
        {((isEditMode && formData.specialties.length > 0) || (!isEditMode && specialties.length > 0)) && (
          <View className="section">
            <Text className="section-title">专业领域</Text>
            <View className="tag-list">
              {(isEditMode ? formData.specialties : specialties).map((s: string, i: number) => (
                <View key={i} className="tag-item">
                  <Text>{s}</Text>
                  {isEditMode && (
                    <Text className="tag-remove" onClick={() => removeSpecialty(i)}>×</Text>
                  )}
                </View>
              ))}
            </View>
            {isEditMode && (
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
            )}
          </View>
        )}

        {/* 简介 */}
        <View className="section">
          <Text className="section-title">简介</Text>
          {isEditMode ? (
            <Textarea
              className="textarea"
              value={formData.bio}
              onInput={(e) => setFormData(prev => ({ ...prev, bio: e.detail.value }))}
              placeholder="请输入简介"
              maxlength={500}
            />
          ) : (
            <Text className="section-content">{displayCoach.bio || '暂无简介'}</Text>
          )}
        </View>

        {/* 教学理念 */}
        {((isEditMode && formData.teachingPhilosophy) || (!isEditMode && profile.teachingPhilosophy)) && (
          <View className="section">
            <Text className="section-title">教学理念</Text>
            {isEditMode ? (
              <Textarea
                className="textarea"
                value={formData.teachingPhilosophy}
                onInput={(e) => setFormData(prev => ({ ...prev, teachingPhilosophy: e.detail.value }))}
                placeholder="请输入教学理念"
                maxlength={1000}
              />
            ) : (
              <Text className="section-content">{profile.teachingPhilosophy}</Text>
            )}
          </View>
        )}

        {isOwnProfile && isEditMode && (
          <View className="section">
            <Text className="section-title">证明材料</Text>
            <Text className="section-content">成就、案例、证书、图片和视频材料请在教练申请资料中统一维护，保存后会同步展示到教练主页。</Text>
            <Button
              className="add-btn"
              onClick={() => Taro.navigateTo({ url: '/coach/application' })}
            >
              管理证明材料
            </Button>
          </View>
        )}

        {/* 主要成就 */}
        {((isEditMode && formData.achievements.length > 0) || (!isEditMode && profile.achievements && profile.achievements.length > 0)) && (
          <View className="section">
            <Text className="section-title">主要成就</Text>
            {(isEditMode ? formData.achievements : profile.achievements || []).map((a: string, i: number) => (
              <View key={i} className="list-item">
                <Text>{a}</Text>
                {isEditMode && (
                  <Text className="list-item-remove" onClick={() => removeAchievement(i)}>删除</Text>
                )}
              </View>
            ))}
            {isEditMode && (
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
            )}
          </View>
        )}

        {/* 案例研究 */}
        {((isEditMode && formData.caseStudies.length > 0) || (!isEditMode && profile.caseStudies && profile.caseStudies.length > 0)) && (
          <View className="section">
            <Text className="section-title">案例研究</Text>
            {(isEditMode ? formData.caseStudies : profile.caseStudies || []).map((c: string, i: number) => (
              <View key={i} className="list-item">
                <Text>{c}</Text>
                {isEditMode && (
                  <Text className="list-item-remove" onClick={() => removeCaseStudy(i)}>删除</Text>
                )}
              </View>
            ))}
            {isEditMode && (
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
            )}
          </View>
        )}

        {/* 资质证书 */}
        {((isEditMode && formData.credentials.length > 0) || (!isEditMode && profile.credentials && profile.credentials.length > 0)) && (
          <View className="section">
            <Text className="section-title">资质证书</Text>
            {(isEditMode ? formData.credentials : profile.credentials || []).map((c: any, i: number) => (
              <View key={i} className="credential-item">
                <Text className="credential-name">{c.name}</Text>
                {c.url && <Text className="credential-url">{c.url}</Text>}
                {isEditMode && (
                  <Text className="credential-remove" onClick={() => removeCredential(i)}>删除</Text>
                )}
              </View>
            ))}
            {isEditMode && !editingCredential && (
              <Button className="add-btn" onClick={() => setEditingCredential({ name: '', url: '' })}>
                添加证书
              </Button>
            )}
            {isEditMode && editingCredential && (
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
        )}

        {/* 联系方式 */}
        {((isEditMode && (formData.contactEmail || formData.contactPhone)) || (!isEditMode && (profile.contactEmail || profile.contactPhone))) && (
          <View className="section">
            <Text className="section-title">联系方式</Text>
            {isEditMode ? (
              <>
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
              </>
            ) : (
              <>
                {profile.contactEmail && <Text className="section-content">邮箱：{profile.contactEmail}</Text>}
                {profile.contactPhone && <Text className="section-content">手机：{profile.contactPhone}</Text>}
              </>
            )}
          </View>
        )}

        {/* 社交媒体 */}
        {((isEditMode && formData.socialLinks.length > 0) || (!isEditMode && profile.socialLinks && Object.keys(profile.socialLinks).length > 0)) && (
          <View className="section">
            <Text className="section-title">社交媒体</Text>
            {isEditMode ? (
              formData.socialLinks.map((link, i) => (
                <View key={i} className="social-item">
                  <Text className="social-name">{link.name}</Text>
                  <Text className="social-url">{link.url}</Text>
                  <Text className="social-remove" onClick={() => removeSocialLink(i)}>删除</Text>
                </View>
              ))
            ) : (
              Object.entries(profile.socialLinks || {}).map(([key, value], i) => {
                const platformMap: Record<string, string> = {
                  'douyin': '抖音',
                  'xiaohongshu': '小红书',
                  'zhihu': '知乎',
                  'bilibili': 'B站',
                  'kuaishou': '快手',
                  'other': '其他网站'
                }
                const name = platformMap[key] || key
                return (
                  <View key={i} className="social-item">
                    <Text className="social-name">{name}</Text>
                    <Text className="social-url">{value as string}</Text>
                  </View>
                )
              })
            )}
            {isEditMode && !editingSocialLink && (
              <Button className="add-btn" onClick={() => setEditingSocialLink({ name: '抖音', url: '' })}>
                添加社交媒体
              </Button>
            )}
            {isEditMode && editingSocialLink && (
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
        )}

        {/* 保存按钮 */}
        {isOwnProfile && isEditMode && (
          <View className="submit-section">
            <Button className="submit-btn" onClick={handleSave} loading={saving}>
              保存修改
            </Button>
          </View>
        )}
      </ScrollView>
      <BottomNav />
    </View>
  )
}

export default CoachProfile
