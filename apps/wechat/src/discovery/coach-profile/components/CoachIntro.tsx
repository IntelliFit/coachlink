import React, { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { ClButton, ClTag } from '@/components/ui'
import type { CoachRow, GetAggregatedInfoResponseDto, QueryCoachSubscription } from '../types'
import './CoachIntro.scss'

const COACH_TRACK_SHORT_LABELS: Record<string, string> = { buddy: '搭子', growth: '进阶', professional: '专业' }
const BIO_COLLAPSED_LENGTH = 80

interface CoachIntroProps {
  coach: CoachRow
  aggregatedInfo: GetAggregatedInfoResponseDto | null
  userSubscription: QueryCoachSubscription | null
  reviewCount?: number
  onOpenQuestionnaire?: () => void
}

/** Coach header: identity, four key numbers and the bio (collapsed when long). */
export default function CoachIntro({
  coach,
  aggregatedInfo,
  userSubscription,
  reviewCount = 0,
  onOpenQuestionnaire
}: CoachIntroProps) {
  const [bioOpen, setBioOpen] = useState(false)
  const canOpenQuestionnaire = onOpenQuestionnaire && ['waiting', 'active'].includes(userSubscription?.status || '')
  const specialties = aggregatedInfo?.specialties?.length ? aggregatedInfo.specialties : (coach.specialties || [])
  const profile = (coach.profile || {}) as Record<string, any>
  const caseCount = Array.isArray(profile?.caseStudies) ? profile.caseStudies.length : 0
  const yearsExperience = coach.years_experience ?? 0
  const rating = aggregatedInfo?.averageRating ?? 0
  const track = (coach as { coach_track?: string | null }).coach_track || ''
  const level = COACH_TRACK_SHORT_LABELS[track] || ''
  const bio = String(coach.bio || '').trim()
  const bioLong = bio.length > BIO_COLLAPSED_LENGTH

  const stats = [
    { key: 'students', value: String(aggregatedInfo?.studentCount ?? 0), label: '在带学员' },
    { key: 'rating', value: rating > 0 ? rating.toFixed(1) : '—', label: reviewCount > 0 ? `${reviewCount} 条评价` : '暂无评价' },
    { key: 'years', value: yearsExperience > 0 ? `${yearsExperience} 年` : '—', label: '执教' },
    { key: 'cases', value: String(caseCount), label: '成果案例' }
  ]

  return (
    <View className='ci'>
      <View className='ci__head'>
        <View className='ci__avatar'>
          {coach.avatar_url ? (
            <Image src={coach.avatar_url} mode='aspectFill' className='ci__avatar-img' />
          ) : (
            <Text className='ci__avatar-text'>{coach.name?.charAt(0) || 'C'}</Text>
          )}
        </View>
        <View className='ci__identity'>
          <View className='ci__name-row'>
            <Text className='ci__name'>{coach.name}</Text>
            {level ? <ClTag tone={track === 'professional' ? 'outline' : 'neutral'}>{level}</ClTag> : null}
            {userSubscription?.status === 'active' ? <ClTag tone='done'>服务中</ClTag> : null}
            {userSubscription?.status === 'waiting' ? <ClTag tone='warn'>等待确认</ClTag> : null}
          </View>
          {coach.title ? <Text className='ci__title'>{coach.title}</Text> : null}
          {specialties.length > 0 ? <Text className='ci__specialties'>{specialties.slice(0, 4).join(' · ')}</Text> : null}
        </View>
      </View>

      <View className='ci__stats'>
        {stats.map((item) => (
          <View key={item.key} className='ci__stat'>
            <Text className='ci__stat-value cl-num'>{item.value}</Text>
            <Text className='ci__stat-label'>{item.label}</Text>
          </View>
        ))}
      </View>

      {canOpenQuestionnaire ? (
        <ClButton variant='secondary' size='md' block onClick={() => onOpenQuestionnaire?.()}>查看我填的问卷</ClButton>
      ) : null}

      <View className='ci__bio'>
        <Text className={`ci__bio-text ${bioLong && !bioOpen ? 'ci__bio-text--clamped' : ''}`}>
          {bio || '这位教练很神秘，还没有填写简介。'}
        </Text>
        {bioLong ? (
          <Text className='ci__bio-toggle' onClick={() => setBioOpen((open) => !open)}>{bioOpen ? '收起' : '展开'}</Text>
        ) : null}
      </View>
    </View>
  )
}
