import { useState, useEffect, useRef } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { authService } from '@/services/authService'
import './BottomNav.scss'
import homeIcon from '@/assets/icons/tabbar/home.svg'
import homeSelectedIcon from '@/assets/icons/tabbar/home-selected.svg'
import searchIcon from '@/assets/icons/tabbar/search.svg'
import searchSelectedIcon from '@/assets/icons/tabbar/search-selected.svg'
import myIcon from '@/assets/icons/tabbar/my.svg'
import mySelectedIcon from '@/assets/icons/tabbar/my-selected.svg'
import rankIcon from '@/assets/icons/tabbar/rank.svg'
import rankSelectedIcon from '@/assets/icons/tabbar/rank-selected.svg'
import profileDocIcon from '@/assets/icons/tabbar/profile-doc.svg'
import profileDocSelectedIcon from '@/assets/icons/tabbar/profile-doc-selected.svg'

interface NavItem {
    key: string
    label: string
    icon: string
    iconPath?: string
    activeIconPath?: string
    path: string
}

/** 学员端底部导航 */
const studentNavItems: NavItem[] = [
    {
        key: 'training',
        label: '今日训练',
        icon: '▶️',
        iconPath: homeIcon,
        activeIconPath: homeSelectedIcon,
        path: '/training/today-training'
    },
    {
        key: 'discovery',
        label: '发现',
        icon: '🔍',
        iconPath: searchIcon,
        activeIconPath: searchSelectedIcon,
        path: '/discovery/index'
    },
    {
        key: 'toolbox',
        label: '工具箱',
        icon: '📊',
        iconPath: rankIcon,
        activeIconPath: rankSelectedIcon,
        path: '/me/toolbox/index'
    },
    {
        key: 'profile-detail',
        label: '我的档案',
        icon: '📋',
        iconPath: profileDocIcon,
        activeIconPath: profileDocSelectedIcon,
        path: '/me/profile/detail/index'
    },
    {
        key: 'profile',
        label: '个人中心',
        icon: '👤',
        iconPath: myIcon,
        activeIconPath: mySelectedIcon,
        path: '/me/profile/index'
    }
]

/** 教练端底部导航 */
const coachNavItems: NavItem[] = [
    { key: 'overview', label: '概览', icon: '📊', path: '/coach/overview' },
    { key: 'videos', label: '点评', icon: '🎬', path: '/coach/videos' },
    { key: 'students', label: '学员', icon: '👥', path: '/coach/students' },
    { key: 'plan-lib', label: '计划库', icon: '📋', path: '/coach/plan-lib' },
    { key: 'profile', label: '我', icon: '👤', iconPath: myIcon, activeIconPath: mySelectedIcon, path: '/coach/my-profile' }
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
        try {
            await Taro.reLaunch({ url })
            return true
        } catch (relaunchErr) {
            console.error('[BottomNav] reLaunch 失败:', relaunchErr)
        }

        try {
            await Taro.redirectTo({ url })
            return true
        } catch (redirectErr) {
            console.error('[BottomNav] redirectTo 失败:', redirectErr)
        }

        try {
            await Taro.navigateTo({ url })
            return true
        } catch (navigateErr) {
            console.error('[BottomNav] navigateTo 失败:', navigateErr)
            Taro.showToast({ title: (navigateErr as any)?.errMsg || '跳转失败', icon: 'none' })
            return false
        }
    }

    const handleNavClick = async (item: NavItem) => {
        const targetPath = normalizePath(item.path)
        const current = normalizePath(currentPath)

        if (current === targetPath || navLockRef.current) return

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
                        {item.iconPath ? (
                            <Image
                                className='nav-icon-img'
                                src={isActive ? (item.activeIconPath || item.iconPath) : item.iconPath}
                            />
                        ) : (
                            <Text className='nav-icon'>{item.icon}</Text>
                        )}
                        <Text className='nav-label'>{item.label}</Text>
                    </View>
                )
            })}
        </View>
    )
}

export default BottomNav
