import React from 'react'
import { View, Text, Input, Image } from '@tarojs/components'
import { Star, Search, Eye } from '@nutui/icons-react-taro'
import Taro, { useReachBottom } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import { studentService } from '@/services/studentService'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { PageThemeRoot } from '@/components/PageThemeRoot'

interface Coach {
  id: string
  name: string
  avatar_url?: string
  bio?: string
  rating?: number
  averageRating?: number
  specialties?: string[]
  studentCount?: number
  years_experience?: number
  subscription_price_tier1?: number
  is_featured?: boolean
}

interface VisibilityStatus {
  focusMode: boolean
  focusCoachId: string | null
  focusCoachName: string | null
  referrerCoachId: string | null
  referrerCoachName: string | null
}

function isTestCoach(coach?: Partial<Coach> | null): boolean {
  const name = String(coach?.name || '').trim().toLowerCase()
  return name.startsWith('e2e coach') || /\be2e coach\b/.test(name)
}

function Discovery() {
  const { effectiveTheme } = useTheme()
  const [coaches, setCoaches] = React.useState<Coach[]>([])
  const [specialties, setSpecialties] = React.useState<{ label: string; value: string }[]>([
    { label: '全部方向', value: 'all' }
  ])
  const [searchTerm, setSearchTerm] = React.useState('')
  const [isLoading, setIsLoading] = React.useState(false)
  const [selectedSpecialty, setSelectedSpecialty] = React.useState<string>('all')
  const coachesPerPage = 10
  const [nextCoachPage, setNextCoachPage] = React.useState(1)
  const [coachBuffer, setCoachBuffer] = React.useState<Coach[]>([])
  const [rawHasMoreCoaches, setRawHasMoreCoaches] = React.useState(false)
  const [visibilityStatus, setVisibilityStatus] = React.useState<VisibilityStatus | null>(null)
  const [visibilityLoading, setVisibilityLoading] = React.useState(true)
  const hasMoreCoaches = rawHasMoreCoaches || coachBuffer.length > 0

  React.useEffect(() => {
    const fetchVisibilityStatus = async () => {
      try {
        const status = await studentService.getVisibilityStatus()
        if (status) {
          setVisibilityStatus(status)
        }
      } catch (error) {
        console.error('[discovery] get visibility:', error)
      } finally {
        setVisibilityLoading(false)
      }
    }

    void fetchVisibilityStatus()
  }, [])

  const loadSpecialties = async () => {
    try {
      const specialtiesData = await coachService.getAllSpecialties()
      if (specialtiesData) {
        const formattedSpecialties = specialtiesData.map((specialty) => ({
          label: specialty.name,
          value: specialty.name
        }))
        setSpecialties([{ label: '全部方向', value: 'all' }, ...formattedSpecialties])
      }
    } catch (error) {
      console.error('[discovery] load specialties:', error)
      Taro.showToast({
        title: '加载筛选失败',
        icon: 'none'
      })
    }
  }

  const loadCoaches = async (
    mode: 'reset' | 'append' = 'reset',
    filters?: { search?: string; specialty?: string }
  ) => {
    setIsLoading(true)
    try {
      if (visibilityStatus?.focusMode && visibilityStatus?.focusCoachId) {
        const res = await coachService.getCoach({ id: visibilityStatus.focusCoachId })
        const focusedCoach = res?.coach as Coach | undefined
        if (focusedCoach && !isTestCoach(focusedCoach)) {
          setCoaches([focusedCoach])
        } else {
          setCoaches([])
        }
        setCoachBuffer([])
        setNextCoachPage(1)
        setRawHasMoreCoaches(false)
      } else {
        let visiblePool = mode === 'append' ? [...coachBuffer] : []
        let rawPage = mode === 'append' ? nextCoachPage : 1
        let rawHasMore = mode === 'append' ? rawHasMoreCoaches : true

        while (visiblePool.length < coachesPerPage && rawHasMore) {
          const specialtyValue = filters?.specialty ?? selectedSpecialty
          const res = await coachService.getAllCoaches({
            page: rawPage,
            limit: coachesPerPage,
            search: (filters?.search ?? searchTerm) || '',
            specialty: specialtyValue === 'all' ? 'all' : specialtyValue
          })

          if (!res) {
            rawHasMore = false
            break
          }

          const rawList = Array.isArray(res.coaches) ? (res.coaches as Coach[]) : []
          visiblePool = visiblePool.concat(rawList.filter((coach) => !isTestCoach(coach)))

          const total = Math.max(Number(res.count || 0), 0)
          rawHasMore = rawList.length === coachesPerPage && rawPage * coachesPerPage < total
          rawPage += 1

          if (rawList.length === 0) {
            rawHasMore = false
            break
          }
        }

        const nextBatch = visiblePool.slice(0, coachesPerPage)
        const remainingBuffer = visiblePool.slice(coachesPerPage)

        if (mode === 'reset') {
          setCoaches(nextBatch)
        } else if (nextBatch.length > 0) {
          setCoaches((prev) => [...prev, ...nextBatch])
        }

        setCoachBuffer(remainingBuffer)
        setNextCoachPage(rawPage)
        setRawHasMoreCoaches(rawHasMore)
      }
    } catch (error) {
      console.error('[discovery] load coaches:', error)
      Taro.showToast({
        title: '加载教练失败',
        icon: 'none'
      })
      if (mode === 'reset') {
        setCoaches([])
        setCoachBuffer([])
        setNextCoachPage(1)
        setRawHasMoreCoaches(false)
      }
    } finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    if (visibilityLoading) return
    void loadSpecialties()
    void loadCoaches('reset')
  }, [visibilityLoading, visibilityStatus])

  const onSearchOrFilter = () => {
    if (!visibilityStatus?.focusMode) {
      void loadCoaches('reset', { search: searchTerm, specialty: selectedSpecialty })
    }
  }

  const handleCoachClick = (coachId: string) => {
    Taro.navigateTo({ url: `/discovery/coach-profile?id=${coachId}` })
  }

  const handleSpecialtyChange = (value: string) => {
    setSelectedSpecialty(value)
    if (!visibilityStatus?.focusMode) {
      void loadCoaches('reset', { search: searchTerm, specialty: value })
    }
  }

  const handleLoadMore = () => {
    if (visibilityStatus?.focusMode) return
    if (hasMoreCoaches && !isLoading) {
      void loadCoaches('append')
    }
  }

  useReachBottom(handleLoadMore)

  const renderCoachCard = (coach: Coach) => (
    <View
      key={coach.id}
      className='coach-card'
      onClick={() => handleCoachClick(coach.id)}
    >
      <View className='card-content'>
        <View className='avatar-section'>
          <View className='avatar-container'>
            {coach.avatar_url ? (
              <Image
                src={coach.avatar_url}
                mode='aspectFill'
                className='avatar-image'
              />
            ) : (
              <View className='avatar-placeholder'>
                <Text className='avatar-text'>{coach.name.charAt(0)}</Text>
              </View>
            )}
          </View>
          {coach.is_featured && (
            <View className='featured-badge'>
              <View className='crown-icon'><Star size={12} /></View>
            </View>
          )}
        </View>

        <View className='content-section'>
          <View className='header-row'>
            <View className='name-section'>
              <View className='name-row'>
                <Text className='coach-name'>{coach.name}</Text>
                <View className='rating-badge'>
                  <Star size={10} />
                  <Text className='rating-text'>
                    {typeof coach.averageRating === 'number'
                      ? coach.averageRating.toFixed(1)
                      : (coach.rating?.toFixed(1) || '0.0')}
                  </Text>
                </View>
              </View>
              {coach.specialties && coach.specialties.length > 0 && (
                <View className='tags-row'>
                  {coach.specialties.slice(0, 2).map((spec, index) => (
                    <View key={`${coach.id}-${spec}-${index}`} className='tag-item'>
                      <Text className='tag-text'>{spec}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {typeof coach.subscription_price_tier1 === 'number' && (
              <View className='price-section'>
                <Text className='price-label'>起价</Text>
                <Text className='price-value'>¥{coach.subscription_price_tier1}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </View>
  )

  const renderSkeleton = () => (
    <View className='skeleton-list'>
      {[1, 2, 3].map((i) => (
        <View key={i} className='skeleton-card'>
          <View className='skeleton-avatar' />
          <View className='skeleton-content'>
            <View className='skeleton-line skeleton-title' />
            <View className='skeleton-line skeleton-subtitle' />
            <View className='skeleton-line skeleton-tags' />
          </View>
        </View>
      ))}
    </View>
  )

  if (visibilityStatus?.focusMode) {
    return (
      <View className={`discovery-page theme-${effectiveTheme}`}>
        <View className='page-header'>
          <View className='header-content'>
            <View className='title-section'>
              <Text className='page-title'>我的专属教练</Text>
              <Text className='page-subtitle'>
                你正通过 {visibilityStatus.focusCoachName || '教练'} 的邀请在这里训练和沟通。
              </Text>
            </View>
          </View>
        </View>

        {isLoading || visibilityLoading ? (
          renderSkeleton()
        ) : coaches.length > 0 ? (
          <View className='coaches-list compact-page-block'>
            {coaches.map((coach) => renderCoachCard(coach))}
          </View>
        ) : (
          <View className='empty-state compact-page-block'>
            <View className='empty-icon'><Eye size={40} /></View>
            <Text className='empty-text'>教练信息加载失败</Text>
          </View>
        )}

        <BottomNav />
      </View>
    )
  }

  return (
    <PageThemeRoot>
    <View className={`discovery-page theme-${effectiveTheme}`}>
      <View className='page-header'>
        <View className='header-content'>
          <View className='title-section'>
            <Text className='page-title'>教练</Text>
            <Text className='page-subtitle'>这里只做找教练，方向合适了再继续往下聊。</Text>
          </View>
        </View>

        <View className='search-section'>
          <View className='search-container'>
            <View className='search-leading-icon'>
              <Search size={18} color='#7d8596' />
            </View>
            <Input
              className='search-input'
              placeholder='搜索教练名字或专项方向'
              value={searchTerm}
              onInput={(e) => setSearchTerm(e.detail.value)}
              confirmType='search'
              onConfirm={onSearchOrFilter}
            />
            <View className='search-actions'>
              <View className='search-button' onClick={onSearchOrFilter}>
                <Text className='search-button-text'>搜索</Text>
              </View>
            </View>
          </View>
        </View>
      </View>

      <View className='coach-section'>
        <View className='section-head'>
          <View>
            <Text className='section-title'>推荐教练</Text>
            <Text className='section-caption'>按方向筛，点进详情看风格、经验和服务。</Text>
          </View>
          <View
            className='section-more'
            onClick={() => {
              Taro.showActionSheet({
                itemList: specialties.map((item) => item.label),
                success: (res) => {
                  if (res.tapIndex === 0) {
                    handleSpecialtyChange('all')
                  } else {
                    handleSpecialtyChange(specialties[res.tapIndex].value)
                  }
                }
              })
            }}
          >
            <Text>{selectedSpecialty === 'all' ? '筛选方向' : '切换筛选'}</Text>
          </View>
        </View>

        <View className='stats-info'>
          <Text className='stats-text'>
            {hasMoreCoaches ? `已先展示 ${coaches.length} 位教练` : `当前共展示 ${coaches.length} 位教练`}
          </Text>
        </View>

        {(isLoading && coaches.length === 0) || visibilityLoading ? (
          renderSkeleton()
        ) : coaches.length === 0 ? (
          <View className='empty-state'>
            <View className='empty-icon'><Eye size={40} /></View>
            <Text className='empty-text'>没有找到相关教练</Text>
          </View>
        ) : (
          <View className='coaches-list'>
            {coaches.map((coach) => renderCoachCard(coach))}

            {hasMoreCoaches && !visibilityStatus?.focusMode && (
              <View className='load-more' onClick={handleLoadMore}>
                {isLoading ? (
                  <LoadingSpinner size={32} />
                ) : (
                  <Text className='load-more-text'>加载更多</Text>
                )}
              </View>
            )}

            {!visibilityStatus?.focusMode && coaches.length > 0 && !hasMoreCoaches && (
              <View className='list-end-divider'>
                <View className='list-end-line' />
                <Text className='list-end-text'>当前教练已全部展示</Text>
                <View className='list-end-line' />
              </View>
            )}
          </View>
        )}
      </View>

      <BottomNav />
    </View>
    </PageThemeRoot>
  )
}

export default Discovery
