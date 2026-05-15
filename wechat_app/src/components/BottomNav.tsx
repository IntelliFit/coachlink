import { useState, useEffect, useRef, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { authService } from '@/services/authService'
import { chatService, CHAT_UNREAD_BADGE_REFRESH_EVENT } from '@/services/chatService'
import './BottomNav.scss'

interface NavItem {
    key: string
    label: string
    iconClass: string
    path: string
}

/** 学员端底部导航：先收敛成路径系统，不把工具和消息作为一级入口抢注意力 */
const studentNavItems: NavItem[] = [
    {
        key: 'training',
        label: '今日',
        iconClass: 'icon-dumbbell',
        path: '/training/today-training'
    },
    {
        key: 'path',
        label: '路径',
        iconClass: 'icon-a-Trainingplan',
        path: '/content/path/index'
    },
    {
        key: 'coach',
        label: '教练',
        iconClass: 'icon-coachline_line',
        path: '/discovery/index'
    },
    {
        key: 'profile',
        label: '我的',
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
    const [isCoachView, setIsCoachView] = useState(() => {
        const session = authService.getAuthSession({ normalize: true })
        return !!(session.isAuthenticated && session.isCoach && session.primaryRole === 'coach')
    })
    const [studentMessageUnreadTotal, setStudentMessageUnreadTotal] = useState(0)
    const navLockRef = useRef(false)

    const refreshStudentUnreadBadge = useCallback(async () => {
        const session = authService.getAuthSession({ normalize: true })
        const isCoachTab =
            session.isAuthenticated && session.isCoach && session.primaryRole === 'coach'
        if (!session.isAuthenticated || isCoachTab) {
            setStudentMessageUnreadTotal(0)
            return
        }
        try {
            const data = await chatService.listChatrooms({ page: 1, limit: 50 })
            const rooms = data?.chatRooms ?? []
            const sum = rooms.reduce((acc, r) => acc + (Number(r.unreadCount) || 0), 0)
            setStudentMessageUnreadTotal(sum)
        } catch (e) {
            console.warn('[BottomNav] refresh unread badge failed', e)
        }
    }, [])

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

    useEffect(() => {
        void refreshStudentUnreadBadge()
    }, [refreshStudentUnreadBadge, isCoachView])

    useEffect(() => {
        const tick = () => {
            void refreshStudentUnreadBadge()
        }
        const id = setInterval(tick, 25000)
        return () => clearInterval(id)
    }, [refreshStudentUnreadBadge])

    useEffect(() => {
        const handler = () => {
            void refreshStudentUnreadBadge()
        }
        Taro.eventCenter.on(CHAT_UNREAD_BADGE_REFRESH_EVENT, handler)
        return () => {
            Taro.eventCenter.off(CHAT_UNREAD_BADGE_REFRESH_EVENT, handler)
        }
    }, [refreshStudentUnreadBadge])

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
                const targetNorm = normalizePath(item.path)
                const isActive =
                    currentNorm === targetNorm ||
                    (item.key === 'training' &&
                        (currentNorm === '/pages/index/index' ||
                            currentNorm.startsWith('/training/today-training') ||
                            currentNorm.startsWith('/training/training-execution') ||
                            currentNorm.startsWith('/training/impromptu-training') ||
                            currentNorm.startsWith('/training/plan/current'))) ||
                    (item.key === 'path' &&
                        (currentNorm.startsWith('/content/path') ||
                            currentNorm.startsWith('/content/articles') ||
                            currentNorm.startsWith('/content/content-detail') ||
                            currentNorm.startsWith('/content/knowledge') ||
                            currentNorm.startsWith('/content/public') ||
                            currentNorm.startsWith('/training/actions') ||
                            currentNorm.startsWith('/training/action-detail'))) ||
                    (item.key === 'coach' && currentNorm.startsWith('/discovery')) ||
                    (item.key === 'profile' && currentNorm.startsWith('/me'))

                const showMsgBadge =
                    item.key === 'profile' && !isCoachView && studentMessageUnreadTotal > 0

                return (
                    <View
                        key={item.key}
                        className={`nav-item ${isActive ? 'nav-active' : ''}`}
                        onClick={() => handleNavClick(item)}
                    >
                        <View className='nav-icon-badge-wrap'>
                            <Text
                                className={`nav-icon iconfont ${item.iconClass} ${isActive ? 'nav-icon-active' : ''}`}
                            />
                            {showMsgBadge ? (
                                <View className='nav-msg-badge'>
                                    <Text className='nav-msg-badge-text'>
                                        {studentMessageUnreadTotal > 99 ? '99+' : studentMessageUnreadTotal}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <Text className='nav-label'>{item.label}</Text>
                    </View>
                )
            })}
        </View>
    )
}

export default BottomNav
