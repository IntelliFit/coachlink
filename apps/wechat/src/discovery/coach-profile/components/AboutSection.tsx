import React from 'react'
import { View, Text } from '@tarojs/components'
import { Star, Mail, Phone, ArrowUp } from '@nutui/icons-react-taro'
import Taro from '@tarojs/taro'
import type { CoachRow, CoachProfileDetail } from '../types'
import './AboutSection.scss'
import { MATERIAL_CATEGORY_OPTIONS, groupCoachApplicationMaterials } from '@/utils/coachApplicationMaterials'

const SOCIAL_LABELS: Record<string, string> = {
  douyin: '抖音',
  xiaohongshu: '小红书',
  zhihu: '知乎',
  bilibili: 'B站',
  kuaishou: '快手',
  other: '其他'
}

export default function AboutSection({ coach }: { coach: CoachRow }) {
  const profile = (coach.profile || {}) as CoachProfileDetail
  const achievements = Array.isArray(profile?.achievements) && profile.achievements.length > 0
    ? profile.achievements!
    : Array.isArray(coach.achievements)
      ? coach.achievements
      : []
  const credentials = Array.isArray(profile?.credentials) ? profile.credentials : []
  const caseStudies = Array.isArray(profile?.caseStudies) ? profile.caseStudies : []
  const groupedMaterials = groupCoachApplicationMaterials(profile?.applicationMaterials)
  const hasRichMaterials = groupedMaterials.all.length > 0
  const socialLinks = profile?.socialLinks && typeof profile.socialLinks === 'object' ? profile.socialLinks : {}
  const hasContact = !!(profile?.contactEmail || profile?.contactPhone)
  const hasSocial = Object.keys(socialLinks).length > 0
  const labelForCategory = (category: string) => MATERIAL_CATEGORY_OPTIONS.find(item => item.value === category)?.label || '材料'

  const openMedia = (media: any) => {
    if (media.type === 'image') {
      Taro.previewImage({ urls: [media.url], current: media.url })
      return
    }
    Taro.navigateTo({ url: `/common/common/video-player?url=${encodeURIComponent(media.url)}` })
  }

  const copyLink = (url: string) => {
    Taro.setClipboardData({
      data: url,
      success: () => Taro.showToast({ title: '链接已复制', icon: 'success' })
    })
  }

  const copyContact = (value: string, successMessage: string) => {
    const text = value.trim()
    if (!text) {
      Taro.showToast({ title: '暂未提供联系方式', icon: 'none' })
      return
    }
    Taro.setClipboardData({
      data: text,
      success: () => Taro.showToast({ title: successMessage, icon: 'none' }),
      fail: () => Taro.showToast({ title: '复制失败，请稍后重试', icon: 'none' })
    })
  }

  const callPhone = (phone: string) => {
    const phoneNumber = phone.trim()
    if (!phoneNumber) {
      Taro.showToast({ title: '暂未提供联系电话', icon: 'none' })
      return
    }
    Taro.makePhoneCall({
      phoneNumber,
      fail: (error) => {
        if (!String(error?.errMsg || '').includes('cancel')) {
          copyContact(phoneNumber, '号码已复制')
        }
      }
    })
  }

  const renderMaterialCard = (item: any) => (
    <View key={item.id} className='rich-material-card'>
      <View className='rich-material-head'>
        <Text className='rich-material-category'>{labelForCategory(item.category)}</Text>
      </View>
      <Text className='rich-material-title'>{item.title}</Text>
      {item.summary ? <Text className='rich-material-summary'>{item.summary}</Text> : null}
      {item.detail ? <Text className='rich-material-detail'>{item.detail}</Text> : null}
      {item.media?.length ? (
        <View className='rich-material-media-list'>
          {item.media.map((media: any) => (
            <Text key={media.id} className='rich-material-media' onClick={() => openMedia(media)}>
              {media.type === 'video' ? '视频' : '图片'} {media.fileName || '查看'}
            </Text>
          ))}
        </View>
      ) : null}
      {item.links?.length ? (
        <View className='rich-material-link-list'>
          {item.links.map((link: any) => (
            <Text key={link.id} className='rich-material-link' onClick={() => copyLink(link.url)}>
              {link.label || '复制链接'}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  )

  const achievementNodes = hasRichMaterials
    ? groupedMaterials.achievement.map(renderMaterialCard)
    : achievements.map((a, i) => (
        <View key={i} className='list-row'>
          <View className='num'><Star size={12} /></View>
          <Text className='text'>{a}</Text>
        </View>
      ))
  const credentialNodes = hasRichMaterials
    ? groupedMaterials.credential.map(renderMaterialCard)
    : credentials.filter((c) => c?.name).map((c, i) => (
        <View key={i} className='list-row'>
          <Text className='num'>·</Text>
          <Text className='text'>{c?.name || ''}</Text>
        </View>
      ))
  const caseNodes = hasRichMaterials
    ? groupedMaterials.case.map(renderMaterialCard)
    : caseStudies.map((item, i) => (
        <View key={i} className='list-row'>
          <Text className='num cl-num'>{i + 1}</Text>
          <Text className='text'>{item}</Text>
        </View>
      ))
  const mediaNodes = hasRichMaterials ? groupedMaterials.media.map(renderMaterialCard) : []
  const philosophy = String(profile?.teachingPhilosophy || '').trim()

  // Empty sections are hidden instead of showing "无记录 / 未上传 / 暂无".
  const block = (key: string, title: string, children: React.ReactNode) => (
    <View key={key} className='about-block'>
      <Text className='about-block__title'>{title}</Text>
      <View className='about-block__body'>{children}</View>
    </View>
  )

  const blocks = [
    caseNodes.length > 0 && block('cases', '带教成果', <View className='list'>{caseNodes}</View>),
    philosophy && block('philosophy', '怎么带', <Text className='philosophy-text'>{philosophy}</Text>),
    achievementNodes.length > 0 && block('achievements', '成就奖项', <View className='list'>{achievementNodes}</View>),
    credentialNodes.length > 0 && block('credentials', '资质证书', <View className='list'>{credentialNodes}</View>),
    mediaNodes.length > 0 && block('media', '媒体墙', <View className='list'>{mediaNodes}</View>),
    hasContact && block('contact', '联系方式', (
      <View className='contact-list'>
        {profile?.contactEmail && (
          <View className='contact-item' onClick={() => copyContact(profile.contactEmail!, '邮箱已复制')}>
            <View className='icon'><Mail size={16} /></View>
            <Text selectable>{profile.contactEmail}</Text>
          </View>
        )}
        {profile?.contactPhone && (
          <View className='contact-item' onClick={() => callPhone(profile.contactPhone!)}>
            <View className='icon'><Phone size={16} /></View>
            <Text selectable>{profile.contactPhone}</Text>
          </View>
        )}
      </View>
    )),
    hasSocial && block('social', '社交平台', (
      <View className='social-list'>
        {Object.entries(socialLinks).map(([platform, url]) => (
          <View
            key={platform}
            className='social-item'
            onClick={() => copyContact(url, `${SOCIAL_LABELS[platform] || platform}链接已复制`)}
          >
            <Text>{SOCIAL_LABELS[platform] || platform}</Text>
            <View className='arrow'><ArrowUp size={12} /></View>
          </View>
        ))}
      </View>
    ))
  ].filter(Boolean)

  return (
    <View className='about-card'>
      {blocks.length > 0 ? blocks : (
        <Text className='about-empty'>教练还没有补充成果、理念和资质，可以先看看专栏和评价。</Text>
      )}
    </View>
  )
}
