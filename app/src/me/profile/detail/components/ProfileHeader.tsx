import React from 'react'
import { View, Text, Image } from '@tarojs/components'
import { Button } from '@nutui/nutui-react-taro'
import { Icon } from '@/components/Icon'
import { Crown, Users, Edit, Mars, Venus, Activity, MoreVertical } from 'lucide-react'
import Taro from '@tarojs/taro'
import './ProfileHeader.scss'

interface ProfileHeaderProps {
  data: any
  onUpdate?: () => void
  onEditClick?: () => void
}

// 辅助函数：转换健身水平显示
const getFitnessLevelDisplay = (level: string | null) => {
  if (!level) return null
  const map: Record<string, string> = {
    'beginner': '初学者',
    'intermediate': '中级',
    'advanced': '高级'
  }
  return map[level] || level
}

const ProfileHeader: React.FC<ProfileHeaderProps> = ({ data, onUpdate, onEditClick }) => {
  const { user, profile, subscriptionLevel, stats } = data

  const getLevelLabel = (level: string) => {
    switch (level) {
      case 'premium': return '至尊会员'
      case 'advanced': return '高级会员'
      default: return '基础会员'
    }
  }

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'premium': return 'gradient-premium'
      case 'advanced': return 'gradient-advanced'
      default: return 'gradient-basic'
    }
  }

  // 构建带图标的标签数据结构
  const infoTags: Array<{ icon?: any; label: string; className?: string }> = []
  
  // 性别图标处理
  if (profile?.gender === 'male') {
    infoTags.push({ icon: Mars, label: '男', className: 'tag-male' })
  } else if (profile?.gender === 'female') {
    infoTags.push({ icon: Venus, label: '女', className: 'tag-female' })
  }
  
  if (profile?.fitness_goal) {
    infoTags.push({ label: profile.fitness_goal })
  }
  
  const fitnessLevel = getFitnessLevelDisplay(profile?.fitness_level)
  if (fitnessLevel) {
    infoTags.push({ icon: Activity, label: fitnessLevel })
  }

  return (
    <View className="profile-header-merged">
      <View className="header-content">
        {/* 顶部：头像和基本信息区 */}
        <View className="header-top">
          {/* 左侧：头像 */}
          <View className={`avatar-wrapper ${getLevelColor(subscriptionLevel)}`}>
            <View className="avatar-inner">
              {profile?.avatar_url ? (
                <Image 
                  className="avatar-image" 
                  src={profile.avatar_url} 
                  mode="aspectFill" 
                />
              ) : (
                <View className="avatar-placeholder">
                  <Text className={`avatar-text ${getLevelColor(subscriptionLevel)}`}>
                    {(profile?.nickname || user.phone || 'U').charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
          </View>

          {/* 中间：用户名和详细信息 */}
          <View className="user-info">
            <View className="name-row">
              <Text className="user-name">
                {profile?.nickname || `用户 ${user.phone?.slice(-4)}`}
              </Text>
              {subscriptionLevel === 'premium' && (
                <View className="crown-badge">
                  <Icon component={Crown} size={12} color="#F49227" />
                </View>
              )}
            </View>

            <View className="id-row">
              <Text className="user-id">ID: {user.id?.toString().slice(-8) || '-'}</Text>
            </View>

            <View className="badges-row">
              <View className="badge badge-role">
                <Icon component={Users} size={10} />
                <Text className="badge-text">学员</Text>
              </View>
              <View className={`badge badge-membership ${getLevelColor(subscriptionLevel)}`}>
                <Icon component={Crown} size={10} />
                <Text className="badge-text">{getLevelLabel(subscriptionLevel)}</Text>
              </View>
            </View>
          </View>

          {/* 右侧：编辑按钮 */}
          {onEditClick && (
            <View className="edit-button-wrapper">
              <Button
                size="small"
                fill="none"
                className="edit-button"
                onClick={onEditClick}
              >
                <Icon component={Edit} size={18} color="#64748B" />
              </Button>
            </View>
          )}
        </View>

        {/* 简介 */}
        {profile?.lifestyle && (
          <Text className="lifestyle-text">{profile.lifestyle}</Text>
        )}

        {/* 优化后的标签区 */}
        {infoTags.length > 0 && (
          <View className="info-tags-row">
            {infoTags.map((tag, index) => (
              <View key={index} className={`info-tag ${tag.className || ''}`}>
                {tag.icon && <Icon component={tag.icon} size={12} className="tag-icon" />}
                <Text className="tag-label">{tag.label}</Text>
              </View>
            ))}
          </View>
        )}

        {/* 统计数据区 - 左对齐，右侧三点菜单 */}
        <View className="stats-row">
          {/* 左侧：统计数据 */}
          <View className="stats-left">
            {[
              { label: '订阅', value: stats?.subscriptionCount ?? 0 },
              { label: '进行中', value: stats?.activePlanCount ?? 0 },
              { label: '已完成', value: stats?.completedWorkouts ?? 0 }
            ].map((stat, i) => (
              <View key={i} className="stat-item">
                <Text className="stat-value">{stat.value}</Text>
                <Text className="stat-label">{stat.label}</Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  )
}

export default ProfileHeader
