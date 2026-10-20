import React from 'react'
import { WECHAT_COACH_PURCHASE_PAUSED } from '@coachlink/core'
import { View, Text, Input, Image, ScrollView } from '@tarojs/components'
import Taro, { useReachBottom } from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { coachService } from '@/services/coach/coachService'
import { studentService } from '@/services/studentService'
import { authService } from '@/services/authService'
import { LoadingSpinner } from '@/components/LoadingSpinner'
import './index.scss'
import { useTheme } from '@/hooks/useTheme'
import { PageThemeRoot } from '@/components/PageThemeRoot'
import { ClChip, ClTag } from '@/components/ui'
import { getCapsuleLayout } from '@/utils/capsuleLayout'

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
  title?: string | null
  coach_track?: string | null
}

const COACH_TRACK_SHORT_LABELS: Record<string, string> = { buddy: '搭子', growth: '进阶', professional: '专业' }

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
    const session = authService.getAuthSession({ normalize: true })
    if (!session.isAuthenticated) {
      // 游客没有专属教练可见范围，直接使用公开教练列表，避免请求需要登录态的接口。
      setVisibilityStatus(null)
      setVisibilityLoading(false)
      return
    }

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

  const capsule = getCapsuleLayout()
  const headTop = `${capsule.top + capsule.height + 12}px`

  const renderCoachCard = (coach: Coach) => {
    const rating = typeof coach.averageRating === 'number' ? coach.averageRating : (coach.rating || 0)
    const students = Number(coach.studentCount || 0)
    const headline = (coach.title || String(coach.bio || '').split('\n')[0] || '').trim()
    const level = coach.coach_track ? COACH_TRACK_SHORT_LABELS[coach.coach_track] : ''
    const social = students > 0 ? `${students} 位学员` : '新入驻'
    const showPrice = !WECHAT_COACH_PURCHASE_PAUSED && typeof coach.subscription_price_tier1 === 'number'
    return (
      <View
        key={coach.id}
        className='cl-coach'
        hoverClass='cl-coach--pressed'
        hoverStayTime={60}
        onClick={() => handleCoachClick(coach.id)}
        ariaRole='button'
        ariaLabel={`${coach.name}，${level ? `${level}教练，` : ''}${social}`}
      >
        <View className='cl-coach__avatar'>
          {coach.avatar_url ? (
            <Image src={coach.avatar_url} mode='aspectFill' className='cl-coach__avatar-img' lazyLoad />
          ) : (
            <Text className='cl-coach__avatar-text'>{coach.name.charAt(0)}</Text>
          )}
        </View>
        <View className='cl-coach__body'>
          <View className='cl-coach__name-row'>
            <Text className='cl-coach__name'>{coach.name}</Text>
            {level ? <ClTag tone={coach.coach_track === 'professional' ? 'outline' : 'neutral'}>{level}</ClTag> : null}
          </View>
          {headline ? <Text className='cl-coach__headline'>{headline}</Text> : null}
          {coach.specialties && coach.specialties.length > 0 ? (
            <View className='cl-coach__tags'>
              {coach.specialties.slice(0, 2).map((spec, index) => (
                <ClTag key={`${coach.id}-${spec}-${index}`}>{spec}</ClTag>
              ))}
            </View>
          ) : null}
          <View className='cl-coach__meta'>
            {rating > 0 ? <Text className='cl-coach__rating cl-num'>★ {rating.toFixed(1)}</Text> : null}
            <Text className='cl-coach__social'>{rating > 0 ? social : `${social} · 暂无评价`}</Text>
          </View>
        </View>
        <View className='cl-coach__side'>
          {showPrice ? (
            <>
              <Text className='cl-coach__price cl-num'>¥{coach.subscription_price_tier1} 起</Text>
              <Text className='cl-coach__price-unit'>/ 4 周</Text>
            </>
          ) : (
            <Text className='cl-coach__more'>看方案 ›</Text>
          )}
        </View>
      </View>
    )
  }

  const renderSkeleton = () => (
    <View className='cl-coaches__list'>
      {[1, 2, 3].map((i) => <View key={i} className='cl-coaches__skeleton' />)}
    </View>
  )

  if (visibilityStatus?.focusMode) {
    return (
      <PageThemeRoot>
      <View className={`cl-coaches ${effectiveTheme === 'dark' ? 'cl-theme-dark' : ''}`}>
        <View className='cl-coaches__head' style={{ paddingTop: headTop }}>
          <Text className='cl-coaches__title'>我的专属教练</Text>
          <Text className='cl-coaches__subtitle'>
            你正通过 {visibilityStatus.focusCoachName || '教练'} 的邀请在这里训练和沟通。
          </Text>
        </View>

        {isLoading || visibilityLoading ? (
          renderSkeleton()
        ) : coaches.length > 0 ? (
          <View className='cl-coaches__list'>
            {coaches.map((coach) => renderCoachCard(coach))}
          </View>
        ) : (
          <View className='cl-coaches__state'>
            <Text className='cl-coaches__state-title'>教练信息加载失败</Text>
            <Text className='cl-coaches__state-link' onClick={() => void loadCoaches('reset')}>重试</Text>
          </View>
        )}

        <BottomNav />
      </View>
      </PageThemeRoot>
    )
  }

  return (
    <PageThemeRoot>
    <View className={`cl-coaches ${effectiveTheme === 'dark' ? 'cl-theme-dark' : ''}`}>
      <View className='cl-coaches__head' style={{ paddingTop: headTop }}>
        <Text className='cl-coaches__title'>找教练</Text>
        <View className='cl-coaches__search'>
          <Text className='cl-coaches__search-icon'>⌕</Text>
          <Input
            className='cl-coaches__search-input'
            placeholder='搜索教练名字或方向'
            value={searchTerm}
            onInput={(e) => setSearchTerm(e.detail.value)}
            confirmType='search'
            onConfirm={onSearchOrFilter}
          />
          {searchTerm ? (
            <View
              className='cl-coaches__search-clear'
              ariaRole='button'
              ariaLabel='清空搜索'
              onClick={() => {
                setSearchTerm('')
                void loadCoaches('reset', { search: '', specialty: selectedSpecialty })
              }}
            >
              <Text>×</Text>
            </View>
          ) : null}
        </View>
        <ScrollView scrollX className='cl-coaches__chips' showScrollbar={false}>
          <View className='cl-coaches__chips-row'>
            {specialties.map((item) => (
              <ClChip
                key={item.value}
                selected={selectedSpecialty === item.value}
                onClick={() => {
                  if (selectedSpecialty !== item.value) handleSpecialtyChange(item.value)
                }}
              >
                {item.value === 'all' ? '全部' : item.label}
              </ClChip>
            ))}
          </View>
        </ScrollView>
      </View>

      <View className='cl-coaches__count'>
        <Text className='cl-coaches__count-text'>
          {hasMoreCoaches ? `已显示 ${coaches.length} 位教练` : `${coaches.length} 位教练`}
        </Text>
        <Text className='cl-coaches__count-hint'>点教练看风格、经验和服务</Text>
      </View>

      {(isLoading && coaches.length === 0) || visibilityLoading ? (
        renderSkeleton()
      ) : coaches.length === 0 ? (
        <View className='cl-coaches__state'>
          <Text className='cl-coaches__state-title'>没有找到相关教练</Text>
          <Text className='cl-coaches__state-desc'>换个方向或关键词试试</Text>
        </View>
      ) : (
        <View className='cl-coaches__list'>
          {coaches.map((coach) => renderCoachCard(coach))}

          {hasMoreCoaches ? (
            <View className='cl-coaches__more' onClick={handleLoadMore}>
              {isLoading ? <LoadingSpinner size={32} /> : <Text>加载更多</Text>}
            </View>
          ) : (
            <Text className='cl-coaches__end'>已显示全部教练</Text>
          )}
        </View>
      )}

      <BottomNav />
    </View>
    </PageThemeRoot>
  )
}

export default Discovery
