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
  const achievements = Array.isArray(profile?.achievements)?.length
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

  return (
    <View className='about-card'>
      <View className='block philosophy-block'>
        <Text className='section-label'>教学理念 / PHILOSOPHY</Text>
        <View className='section-body'>
          <Text className='philosophy-text'>
            {profile?.teachingPhilosophy || '暂无教学理念'}
          </Text>
        </View>
      </View>

      <View className='block'>
        <Text className='section-label'>成就奖项</Text>
        <View className='section-body'>
          {hasRichMaterials ? (
            <View className='rich-material-list'>
              {groupedMaterials.achievement.length > 0 ? groupedMaterials.achievement.map(renderMaterialCard) : <Text className='placeholder'>无记录</Text>}
            </View>
          ) : achievements.length > 0 ? (
            <View className='list'>
              {achievements.map((a, i) => (
                <View key={i} className='list-row'>
                  <View className='num'><Star size={12} /></View>
                  <Text className='text'>{a}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className='placeholder'>无记录</Text>
          )}
        </View>
      </View>

      <View className='block'>
        <Text className='section-label'>资质证书</Text>
        <View className='section-body'>
          {hasRichMaterials ? (
            <View className='rich-material-list'>
              {groupedMaterials.credential.length > 0 ? groupedMaterials.credential.map(renderMaterialCard) : <Text className='placeholder'>未上传</Text>}
            </View>
          ) : credentials.length > 0 ? (
            <View className='list cred-list'>
              {credentials.map((c, i) => (
                <View key={i} className='list-row'>
                  <Text className='num'>·</Text>
                  <Text className='text'>{c?.name || ''}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className='placeholder'>未上传</Text>
          )}
        </View>
      </View>

      <View className='block'>
        <Text className='section-label'>代表案例</Text>
        <View className='section-body'>
          {hasRichMaterials ? (
            <View className='rich-material-list'>
              {groupedMaterials.case.length > 0 ? groupedMaterials.case.map(renderMaterialCard) : <Text className='placeholder'>暂无</Text>}
            </View>
          ) : caseStudies.length > 0 ? (
            <View className='list'>
              {caseStudies.map((item, i) => (
                <View key={i} className='list-row'>
                  <Text className='num'>0{i + 1}</Text>
                  <Text className='text'>{item}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className='placeholder'>暂无</Text>
          )}
        </View>
      </View>

      {hasRichMaterials && groupedMaterials.media.length > 0 && (
        <View className='block'>
          <Text className='section-label'>媒体墙</Text>
          <View className='section-body rich-material-list'>
            {groupedMaterials.media.map(renderMaterialCard)}
          </View>
        </View>
      )}

      <View className='block'>
        <Text className='section-label'>联系方式</Text>
        <View className='section-body'>
          {hasContact ? (
            <View className='contact-list'>
              {profile?.contactEmail && (
                <View className='contact-item'>
                  <View className='icon'><Mail size={16} /></View>
                  <Text selectable>{profile.contactEmail}</Text>
                </View>
              )}
              {profile?.contactPhone && (
                <View className='contact-item'>
                  <View className='icon'><Phone size={16} /></View>
                  <Text selectable>{profile.contactPhone}</Text>
                </View>
              )}
            </View>
          ) : (
            <Text className='placeholder'>暂无</Text>
          )}
        </View>
      </View>

      <View className='block'>
        <Text className='section-label'>社交平台</Text>
        <View className='section-body'>
          {hasSocial ? (
            <View className='social-list'>
              {Object.entries(socialLinks).map(([platform]) => (
                <View key={platform} className='social-item'>
                  <Text>{SOCIAL_LABELS[platform] || platform}</Text>
                  <View className='arrow'><ArrowUp size={12} /></View>
                </View>
              ))}
            </View>
          ) : (
            <Text className='placeholder'>暂无</Text>
          )}
        </View>
      </View>
    </View>
  )
}
