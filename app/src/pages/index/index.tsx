import React, { useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import BottomNav from '@/components/BottomNav'
import { authService } from '@/services/authService'
import { studentOnboardingService } from '@/services/studentOnboardingService'
import './index.scss'

function Index() {
  // 检查用户登录状态和身份，自动跳转到对应页面
  useEffect(() => {
    const checkUserAndRedirect = async () => {
      try {
        const session = authService.getAuthSession({ normalize: true })
        if (!session.isAuthenticated) {
          // 未登录，显示首页
          return
        }

        const targetUrl = await studentOnboardingService.resolvePostLoginUrl({
          loggedInUser: session.user,
          fallbackUrl: session.isCoach && session.primaryRole === 'coach'
            ? '/coach/overview'
            : '/training/today-training'
        })

        if (typeof targetUrl === 'string' && targetUrl.startsWith('/')) {
          Taro.reLaunch({ url: targetUrl })
        } else {
          console.error('[index] invalid post-login url:', targetUrl)
        }
      } catch (e) {
        console.error('[index] 检查用户身份失败:', e)
      }
    }

    void checkUserAndRedirect()
  }, [])
    // 8大核心亮点数据
    const features = [
        {
            title: '靠谱教练，放心选择',
            desc: '资质认证，评价透明。平台担保交易，拒绝跑路风险。',
            icon: '🛡️',
            color: 'bg-green-500'
        },
        {
            title: '今日训练，即开即练',
            desc: '告别翻聊天记录。打开即练，视频一键上传，打卡分享。',
            icon: '⚡',
            color: 'bg-yellow-500'
        },
        {
            title: '智能负荷，自动计算',
            desc: '根据1RM数据自动计算每组精准重量，随你变强自动调整。',
            icon: '🧠',
            color: 'bg-blue-500'
        },
        {
            title: '成长档案，进步可见',
            desc: '自动捕捉每一次 PR（个人纪录），生成专属进步时间轴。',
            icon: '📈',
            color: 'bg-purple-500'
        },
        {
            title: '灵活计划，丰俭由人',
            desc: '支持教练定制，也支持自建计划或 AI 智能导入。',
            icon: '📋',
            color: 'bg-cyan-500'
        },
        {
            title: '视频沟通，秒懂背景',
            desc: '视频自动附带"组数/重量"标签，拒绝无效沟通。',
            icon: '🎥',
            color: 'bg-red-500'
        },
        {
            title: '竞技排行，赢取奖金',
            desc: '多维度排行榜，挑战全国高手，赢取荣誉与奖金。',
            icon: '🏆',
            color: 'bg-orange-500'
        },
        {
            title: '权威知识，拒绝伪科',
            desc: '教练专属内容 + 平台严选资料，构建科学训练体系。',
            icon: '📚',
            color: 'bg-indigo-500'
        }
    ]

    // 复制一份用于无缝滚动
    const featureMarquee = [...features, ...features]

    const handleStartTraining = async () => {
        // 已登录则直接进入目标页，未登录则跳转登录页
        const session = authService.getAuthSession({ normalize: true })
        if (session.isAuthenticated) {
            const targetUrl = await studentOnboardingService.resolvePostLoginUrl({
                loggedInUser: session.user,
                fallbackUrl: session.isCoach && session.primaryRole === 'coach'
                    ? '/coach/overview'
                    : '/training/today-training'
            })
            if (typeof targetUrl === 'string' && targetUrl.startsWith('/')) {
              Taro.reLaunch({ url: targetUrl })
            } else {
              console.error('[index] invalid post-login url:', targetUrl)
            }
        } else {
            Taro.navigateTo({ url: authService.buildLoginUrl('/training/today-training') })
        }
    }

    const handleBecomeCoach = () => {
        Taro.navigateTo({ url: '/auth/onboarding' })
    }

    const handleRegister = () => {
        Taro.navigateTo({ url: '/auth/register' })
    }

    return (
        <View className='home-page'>
            {/* 顶部栏 - 放在系统导航栏下方 */}
            <View className='top-bar'>
                <View className='top-bar-content'>
                    <View className='logo-section'>
                        <View className='logo-box'>
                            <Text className='logo-icon'>🔗</Text>
                        </View>
                        <View className='logo-text'>
                            <Text className='logo-title'>教链</Text>
                            <Text className='logo-subtitle'>STUDENT</Text>
                        </View>
                    </View>
                    <View className='login-btn' onClick={handleStartTraining}>
                        <Text className='login-icon'>→</Text>
                        <Text className='login-text'>登录</Text>
                    </View>
                </View>
            </View>

            {/* 背景光晕 */}
            <View className='background-glow'>
                <View className='glow-circle glow-1' />
                <View className='glow-circle glow-2' />
                <View className='glow-circle glow-3' />
            </View>

            {/* Hero 主体 */}
            <View className='hero-section'>
                {/* 顶部小标 */}
                <View className='hero-badge'>
                    <View className='pulse-dot'>
                        <View className='pulse-ring' />
                        <View className='pulse-core' />
                    </View>
                    <Text className='badge-text'>连接运动梦想 · 成就专业价值</Text>
                </View>

                {/* 主标题 */}
                <View className='hero-title'>
                    <Text className='title-gradient'>CoachLink 教链</Text>
                    <Text className='title-subtitle'>教练与学员的智能连接平台</Text>
                </View>

                {/* 副标题 */}
                <View className='hero-description'>
                    <Text className='desc-text'>不仅仅是训练工具，更是您的专属运动管家。</Text>
                    <Text className='desc-text'>
                        我们将专业的 <Text className='desc-highlight'>教练指导</Text> 与 <Text className='desc-highlight'>智能化数据分析</Text> 完美融合。
                    </Text>
                </View>

                {/* 核心卖点一行（自动滚动） */}
                <View className='features-marquee'>
                    <View className='marquee-container'>
                        <View className='marquee-track'>
                            {featureMarquee.map((feature, idx) => (
                                <View key={idx} className='marquee-item'>
                                    <View className={`item-icon ${feature.color}`}>
                                        <Text>{feature.icon}</Text>
                                    </View>
                                    <Text className='item-title'>{feature.title}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </View>

                {/* CTA 按钮 */}
                <View className='cta-buttons'>
                    <View className='primary-btn' onClick={handleStartTraining}>
                        <Text className='btn-text'>立即开始训练</Text>
                        <Text className='btn-arrow'>→</Text>
                    </View>
                    <View className='secondary-btn' onClick={handleBecomeCoach}>
                        <Text className='btn-text'>入驻成为教练</Text>
                    </View>
                </View>
            </View>

            {/* 核心亮点详细介绍 */}
            <View className='features-section'>
                <View className='section-header'>
                    <Text className='section-title'>重新定义你的训练体验</Text>
                    <Text className='section-subtitle'>每一个细节，都为了更高效、更科学、更强大的你</Text>
                </View>

                <View className='features-grid'>
                    {features.map((feature, idx) => (
                        <View key={idx} className='feature-card'>
                            <View className={`card-icon ${feature.color}`}>
                                <Text className='icon-emoji'>{feature.icon}</Text>
                            </View>
                            <Text className='card-title'>{feature.title}</Text>
                            <Text className='card-desc'>{feature.desc}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* 未来工具箱预告 */}
            <View className='future-section'>
                <View className='future-container'>
                    {/* 装饰性背景 */}
                    <View className='future-bg-glow future-glow-1' />
                    <View className='future-bg-glow future-glow-2' />

                    <View className='future-content'>
                        {/* 顶部标签 */}
                        <View className='future-badge'>
                            <Text className='future-badge-icon'>✨</Text>
                            <Text className='future-badge-text'>COMING SOON</Text>
                        </View>

                        {/* 标题 */}
                        <View className='future-title'>
                            <Text className='future-title-main'>更多黑科技工具 </Text>
                            <Text className='future-title-highlight'>即将上线</Text>
                        </View>

                        {/* 副标题 */}
                        <View className='future-subtitle'>
                            <Text className='future-subtitle-text'>饮食计算器、AI 动作矫正、热量扫描...</Text>
                            <Text className='future-subtitle-text'>我们要做的，不止于计划。</Text>
                        </View>

                        {/* 标签云 */}
                        <View className='future-tags'>
                            {['饮食计算', 'AI 动作矫正', '热量扫描'].map((item, i) => (
                                <View key={i} className='future-tag'>
                                    <Text className='tag-text'>{item}</Text>
                                </View>
                            ))}
                        </View>

                        {/* 权益引导区 */}
                        <View className='early-bird-card'>
                            <View className='early-bird-header'>
                                <Text className='lock-icon'>🔒</Text>
                                <Text className='early-bird-title'>早鸟福利 (Early Bird)</Text>
                            </View>
                            <View className='early-bird-desc'>
                                <Text className='early-desc-text'>
                                    首批注册用户将获得 <Text className='early-highlight'>永久优先使用权</Text>
                                </Text>
                                <Text className='early-desc-text'>后续开放功能可能需付费订阅</Text>
                            </View>
                            <View className='early-bird-btn' onClick={handleRegister}>
                                <Text className='early-btn-text'>立即注册锁定权益</Text>
                            </View>
                        </View>

                        {/* 公共页脚链接 */}
                        <View className='footer-links'>
                            <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/about/index' })}>关于</Text>
                            <Text className='footer-dot'>·</Text>
                            <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/disclaimer/index' })}>免责声明</Text>
                            <Text className='footer-dot'>·</Text>
                            <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/terms/index' })}>服务条款</Text>
                            <Text className='footer-dot'>·</Text>
                            <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/contact/index' })}>联系</Text>
                            <Text className='footer-dot'>·</Text>
                            <Text className='footer-link' onClick={() => Taro.navigateTo({ url: '/me/docs/index' })}>文档</Text>
                        </View>
                    </View>
                </View>
            </View>

            {/* 底部导航栏 */}
            <BottomNav />
        </View>
    )
}

export default Index
