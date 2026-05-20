import { useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { authService } from '@/services/authService'
import './BottomNav.scss'

interface NavItem {
  key: string
  label: string
  iconClass: string
  path: string
}

const studentNavItems: NavItem[] = [
  {
    key: 'training',
    label: '训练',
    iconClass: 'icon-dumbbell',
    path: '/training/today-training'
  },
  {
    key: 'coach',
    label: '教练',
    iconClass: 'icon-discovery',
    path: '/discovery/index'
  },
  {
    key: 'knowledge',
    label: '知识',
    iconClass: 'icon-knowledge',
    path: '/content/knowledge'
  },
  {
    key: 'toolbox',
    label: '工具箱',
    iconClass: 'icon-toolbox',
    path: '/me/toolbox/index'
  },
  {
    key: 'profile',
    label: '我的',
    iconClass: 'icon-user',
    path: '/me/profile/index'
  }
]

const coachNavItems: NavItem[] = [
  {
    key: 'overview',
    label: '总览',
    iconClass: 'icon-dashboard',
    path: '/coach/overview'
  },
  {
    key: 'videos',
    label: '视频',
    iconClass: 'icon-video',
    path: '/coach/videos'
  },
  {
    key: 'students',
    label: '学员',
    iconClass: 'icon-friends-o',
    path: '/coach/students'
  },
  {
    key: 'plan-lib',
    label: '计划',
    iconClass: 'icon-a-Trainingplan',
    path: '/coach/plan-lib'
  },
  {
    key: 'profile',
    label: '我的',
    iconClass: 'icon-account-settings-variant',
    path: '/coach/my-profile'
  }
]

function BottomNav() {
  const [currentPath, setCurrentPath] = useState('')
  const [isCoachView, setIsCoachView] = useState(() => {
    const session = authService.getAuthSession({ normalize: true })
    return !!(session.isAuthenticated && session.isCoach && session.primaryRole === 'coach')
  })
  const navLockRef = useRef(false)

  const normalizePath = (route: string) => {
    if (!route) return ''
    const path = route.startsWith('/') ? route : `/${route}`
    return path.replace(/\/+$/, '')
  }

  const matchesPrefix = (pathname: string, prefixes: string[]) => {
    return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  }

  const syncCurrentPath = () => {
    const pages = Taro.getCurrentPages()
    if (pages.length === 0) return
    const route = (pages[pages.length - 1] as any).route
    setCurrentPath(normalizePath(route || ''))
  }

  const syncRole = () => {
    const session = authService.getAuthSession({ normalize: true })
    setIsCoachView(!!(session.isAuthenticated && session.isCoach && session.primaryRole === 'coach'))
  }

  useEffect(() => {
    syncCurrentPath()
    syncRole()
  }, [])

  useEffect(() => {
    const timer = setInterval(() => {
      syncCurrentPath()
      syncRole()
    }, 300)
    return () => clearInterval(timer)
  }, [])

  const tryNavigate = async (url: string) => {
    const navOptions = { url, animationType: 'none' as any }

    try {
      await Taro.navigateTo(navOptions)
      return true
    } catch {}

    try {
      await Taro.redirectTo(navOptions)
      return true
    } catch {}

    try {
      await Taro.reLaunch(navOptions)
      return true
    } catch (error) {
      Taro.showToast({
        title: (error as any)?.errMsg || '页面跳转失败',
        icon: 'none'
      })
      return false
    }
  }

  const handleNavClick = async (item: NavItem) => {
    const targetPath = normalizePath(item.path)
    const current = normalizePath(currentPath)

    if (current === targetPath || navLockRef.current) return

    if (!isCoachView && item.key === 'profile') {
      const session = authService.getAuthSession({ normalize: true })
      if (!session.isAuthenticated) {
        navLockRef.current = true
        const success = await tryNavigate('/auth/login')
        if (success) {
          setTimeout(() => {
            syncCurrentPath()
            navLockRef.current = false
          }, 120)
          return
        }
        navLockRef.current = false
        return
      }
    }

    navLockRef.current = true
    const success = await tryNavigate(item.path)
    if (success) {
      setTimeout(() => {
        syncCurrentPath()
        navLockRef.current = false
      }, 120)
      return
    }

    navLockRef.current = false
  }

  const isStudentTabActive = (item: NavItem, pathname: string) => {
    switch (item.key) {
      case 'training':
        return pathname === '/pages/index/index' || matchesPrefix(pathname, ['/training'])
      case 'coach':
        return matchesPrefix(pathname, ['/discovery'])
      case 'knowledge':
        return matchesPrefix(pathname, ['/content'])
      case 'toolbox':
        return matchesPrefix(pathname, ['/me/toolbox', '/streetlifting'])
      case 'profile':
        return matchesPrefix(pathname, ['/me']) && !matchesPrefix(pathname, ['/me/toolbox'])
      default:
        return pathname === normalizePath(item.path)
    }
  }

  const isCoachTabActive = (item: NavItem, pathname: string) => {
    switch (item.key) {
      case 'overview':
        return matchesPrefix(pathname, ['/coach/overview'])
      case 'videos':
        return matchesPrefix(pathname, ['/coach/videos'])
      case 'students':
        return matchesPrefix(pathname, ['/coach/students'])
      case 'plan-lib':
        return matchesPrefix(pathname, ['/coach/plan-lib'])
      case 'profile':
        return matchesPrefix(pathname, ['/coach/my-profile', '/coach/profile', '/coach/application'])
      default:
        return pathname === normalizePath(item.path)
    }
  }

  const navItems = isCoachView ? coachNavItems : studentNavItems
  const currentNorm = normalizePath(currentPath)

  return (
    <View className='bottom-nav'>
      {navItems.map((item) => {
        const isActive = isCoachView
          ? isCoachTabActive(item, currentNorm)
          : isStudentTabActive(item, currentNorm)

        return (
          <View
            key={item.key}
            className={`nav-item ${isActive ? 'nav-active' : ''}`}
            onClick={() => void handleNavClick(item)}
          >
            <View className='nav-icon-badge-wrap'>
              <Text
                className={`nav-icon iconfont ${item.iconClass} ${isActive ? 'nav-icon-active' : ''}`}
              />
            </View>
            <Text className='nav-label'>{item.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

export default BottomNav
