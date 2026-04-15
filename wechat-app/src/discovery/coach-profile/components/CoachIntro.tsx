import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { CoachRow, GetAggregatedInfoResponseDto, QueryCoachSubscription } from '../types'
import './CoachIntro.scss'

interface CoachIntroProps {
  coach: CoachRow
  aggregatedInfo: GetAggregatedInfoResponseDto | null
  userSubscription: QueryCoachSubscription | null
}

export default function CoachIntro({
  coach,
  aggregatedInfo,
  userSubscription
}: CoachIntroProps) {
  const specialties = aggregatedInfo?.specialties?.length ? aggregatedInfo.specialties : (coach.specialties || [])
  const profile = (coach.profile || {}) as Record<string, any>
  const caseStudies = Array.isArray(profile?.caseStudies) ? profile.caseStudies : []
  const caseCount = caseStudies.length

  return (
    <View className='intro-wrap'>
      <View className='intro-header'>
        <View className='avatar-wrap' style={{ position: 'relative' }}>
          <View className='avatar-box'>
            {coach.avatar_url ? (
              <Image src={coach.avatar_url} mode='aspectFill' className='avatar-img' />
            ) : (
              <View className='avatar-placeholder'>
                <Text className='avatar-text'>{coach.name?.charAt(0) || 'C'}</Text>
              </View>
            )}
          </View>
          {coach.is_featured && (
            <View className='featured-badge'>👑</View>
          )}
        </View>
        <View className='intro-meta'>
          <Text className='coach-name'>{coach.name}</Text>
          {coach.title ? (
            <Text className='coach-title-tag'>{coach.title}</Text>
          ) : null}
          {userSubscription?.status === 'active' && (
            <View className='subscription-status subscription-status-active'>
              <View style={{ width: 8, height: 8, borderRadius: 4, background: '#059669' }} />
              <Text>服务进行中</Text>
            </View>
          )}
          {userSubscription?.status === 'waiting' && (
            <View className='subscription-status subscription-status-waiting'>
              <Text>等待确认</Text>
            </View>
          )}
        </View>
      </View>

      <View className='stats-row'>
        <View className='stat-item'>
          <Text className='stat-value'>{aggregatedInfo?.contentCount ?? 0}</Text>
          <Text className='stat-label'>教学内容</Text>
        </View>
        <View className='stat-item'>
          <Text className='stat-value'>{aggregatedInfo?.studentCount ?? 0}</Text>
          <Text className='stat-label'>活跃学员</Text>
        </View>
        <View className='stat-item'>
          <Text className='stat-value stat-value-rating'>{aggregatedInfo?.averageRating?.toFixed(1) ?? '0.0'}</Text>
          <Text className='stat-label'>综合评分</Text>
        </View>
      </View>

      {specialties.length > 0 && (
        <>
          <Text className='section-title'>擅长领域</Text>
          <View className='tags-row'>
            {specialties.map((s, i) => (
              <View key={i} className='tag-item'>
                <Text>{s}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <Text className='section-title'>教练简介</Text>
      <Text className='bio-text'>{coach.bio || '这位教练很神秘，还没有填写简介。'}</Text>

      <View className='exp-row'>
        <View className='exp-item'>
          <Text className='exp-label'>从业经验</Text>
          <Text className='exp-value'>{coach.years_experience ?? 0} 年专业沉淀</Text>
        </View>
        <View className='exp-item'>
          <Text className='exp-label'>成功案例</Text>
          <Text className='exp-value'>{caseCount} 个学员蜕变</Text>
        </View>
      </View>
    </View>
  )
}
