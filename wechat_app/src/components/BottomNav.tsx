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

/** 学员端底部导航（首页与「今日训练」合并为「训练」；消息在工具箱右侧） */
const studentNavItems: NavItem[] = [
    {
        key: 'training',
        label: '训练',
        iconClass: 'icon-dumbbell',
        path: '/pages/index/index'
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
        key: 'messages',
        label: '消息',
        iconClass: 'icon-messages',
        path: '/me/messages/index'
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

        // 个人中心优先进入可浏览页；消息仍需要登录
        if (item.key === 'profile') {
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
            return
        }

        if (item.key === 'messages') {
            const session = authService.getAuthSession({ normalize: true })
            if (!session.isAuthenticated) {
                navLockRef.current = true
                const success = await tryNavigate(authService.buildLoginUrl('/me/messages/index'))
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
                        (currentNorm === 'pages/index/index' || currentNorm === 'training/today-training'))

                const showMsgBadge =
                    item.key === 'messages' && !isCoachView && studentMessageUnreadTotal > 0

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
