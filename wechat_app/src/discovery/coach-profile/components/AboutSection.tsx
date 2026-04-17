import React from 'react'
import { View, Text } from '@tarojs/components'
import { Star, Mail, Phone, ArrowUp } from '@nutui/icons-react-taro'
import type { CoachRow, CoachProfileDetail } from '../types'
import './AboutSection.scss'

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
  const socialLinks = profile?.socialLinks && typeof profile.socialLinks === 'object' ? profile.socialLinks : {}
  const hasContact = !!(profile?.contactEmail || profile?.contactPhone)
  const hasSocial = Object.keys(socialLinks).length > 0

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
          {achievements.length > 0 ? (
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
          {credentials.length > 0 ? (
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
          {caseStudies.length > 0 ? (
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
