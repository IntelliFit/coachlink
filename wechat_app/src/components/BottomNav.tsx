import { useState, useEffect, useRef } from 'react'
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

/** 学员端底部导航 */
const studentNavItems: NavItem[] = [
    {
        key: 'home',
        label: '首页',
        iconClass: 'icon-home',
        path: '/pages/index/index'
    },
    {
        key: 'training',
        label: '训练',
        iconClass: 'icon-dumbbell',
        path: '/training/today-training'
    },
    {
        key: 'discovery',
        label: '发现',
        iconClass: 'icon-discovery',
        path: '/discovery/index'
    },
    {
        key: 'toolbox',
        label: '工具箱',
        iconClass: 'icon-toolbox',
        path: '/me/toolbox/index'
    },
    {
        key: 'profile',
        label: '个人',
        iconClass: 'icon-user',
        path: '/me/profile/index'
    }
]

/** 教练端底部导航 */
const coachNavItems: NavItem[] = [
    { key: 'overview', label: '概览', iconClass: 'icon-dashboard', path: '/coach/overview' },
    { key: 'videos', label: '点评', iconClass: 'icon-video', path: '/coach/videos' },
    { key: 'students', label: '学员', iconClass: 'icon-friends-o', path: '/coach/students' },
    { key: 'plan-lib', label: '计划库', iconClass: 'icon-a-Trainingplan', path: '/coach/plan-lib' },
    { key: 'profile', label: '我', iconClass: 'icon-account-settings-variant', path: '/coach/my-profile' }
]

function BottomNav() {
    const [currentPath, setCurrentPath] = useState('')
    const [isCoachView, setIsCoachView] = useState(false)
    const navLockRef = useRef(false)

    useEffect(() => {
        const session = authService.getAuthSession({ normalize: true })
        setIsCoachView(!!(session.isAuthenticated && session.isCoach && session.primaryRole === 'coach'))
    }, [])

    const normalizePath = (route: string) => {
        if (!route) return ''
        const p = route.startsWith('/') ? route : '/' + route
        return p.replace(/\/+$/, '')
    }

    const syncCurrentPath = () => {
        const pages = Taro.getCurrentPages()
        if (pages.length > 0) {
            const route = (pages[pages.length - 1] as any).route
            setCurrentPath(normalizePath(route || ''))
        }
    }

    useEffect(() => {
        syncCurrentPath()
    }, [])

    useEffect(() => {
        const syncRole = () => {
            const session = authService.getAuthSession({ normalize: true })
            setIsCoachView(!!(session.isAuthenticated && session.isCoach && session.primaryRole === 'coach'))
        }
        syncCurrentPath()
        syncRole()
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
        } catch (navigateErr) {
            console.error('[BottomNav] navigateTo 失败:', navigateErr)
        }

        try {
            await Taro.redirectTo(navOptions)
            return true
        } catch (redirectErr) {
            console.error('[BottomNav] redirectTo 失败:', redirectErr)
        }

        try {
            await Taro.reLaunch(navOptions)
            return true
        } catch (relaunchErr) {
            console.error('[BottomNav] reLaunch 失败:', relaunchErr)
            Taro.showToast({ title: (relaunchErr as any)?.errMsg || '跳转失败', icon: 'none' })
            return false
        }
    }

    const handleNavClick = async (item: NavItem) => {
        const targetPath = normalizePath(item.path)
        const current = normalizePath(currentPath)

        if (current === targetPath || navLockRef.current) return

        // 个人中心需要登录，未登录时跳转到登录页
        if (item.key === 'profile') {
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

    const navItems = isCoachView ? coachNavItems : studentNavItems
    const currentNorm = normalizePath(currentPath)

    return (
        <View className='bottom-nav'>
            {navItems.map((item) => {
                const isActive = currentNorm === normalizePath(item.path)

                return (
                    <View
                        key={item.key}
                        className={`nav-item ${isActive ? 'nav-active' : ''}`}
                        onClick={() => handleNavClick(item)}
                    >
                        <Text
                            className={`nav-icon iconfont ${item.iconClass} ${isActive ? 'nav-icon-active' : ''}`}
                        />
                        <Text className='nav-label'>{item.label}</Text>
                    </View>
                )
            })}
        </View>
    )
}

export default BottomNav
