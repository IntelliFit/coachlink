import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { ConfigProvider } from '@nutui/nutui-react-taro'
import zhCN from '@nutui/nutui-react-taro/dist/locales/zh-CN'
import { authService } from '@/services/authService'
import {
  clearBeginnerLocalCaches,
  clearMiniProgramAuth,
  enableNewUserAuditMode,
  enterAuditStudentOnboarding,
} from '@/utils/newUserAudit'
import './index.scss'

const IS_DEV = process.env.NODE_ENV === 'development'

const scenarios = [
  '游客第一次打开首页：是否知道这是训练服务，而不是普通内容页。',
  '游客想找教练：能否从首页自然进入发现页和教练主页。',
  '游客被要求登录：是否知道为什么登录，以及能否返回继续逛。',
  '新用户注册/快捷登录：协议、授权、验证码、拒绝授权提示是否像人话。',
  '首次资料完善：问题是否好懂，是否会吓退小白。',
  '首次找教练到订阅：价格、问卷、支付前确认、支付后下一步是否清楚。',
  '首次进入今日训练：没计划、等待教练、有计划三种状态是否能看懂。',
]

const checklist = [
  '每一屏都能回答：我在哪、能做什么、下一步是什么。',
  '按钮文案避免内部词，比如 execution、instance、订阅状态码。',
  '没登录、没计划、没数据、拒绝授权时都有明确出口。',
  '关键入口不能只靠横滑、长按或隐藏按钮。',
  '付费前要清楚：买什么、多少钱、多久、谁来处理。',
  '错误提示要告诉用户如何恢复，而不是只说失败。',
]

function go(url: string, relaunch = false) {
  if (relaunch) {
    Taro.reLaunch({ url })
    return
  }
  Taro.navigateTo({ url }).catch(() => Taro.reLaunch({ url }))
}

export default function NewUserAudit() {
  const session = authService.getAuthSession({ normalize: true })
  const userName = session.user?.nickname || session.user?.name || session.userId || '未登录'

  const startGuestAudit = () => {
    clearMiniProgramAuth()
    clearBeginnerLocalCaches()
    enableNewUserAuditMode()
    Taro.showToast({ title: '已切到游客视角', icon: 'success' })
    setTimeout(() => go('/pages/index/index', true), 300)
  }

  const resetLocalCaches = () => {
    clearBeginnerLocalCaches()
    enableNewUserAuditMode()
    Taro.showToast({ title: '已清理本地体验缓存', icon: 'success' })
  }

  const openOnboardingAudit = () => {
    enterAuditStudentOnboarding('/pages/index/index')
  }

  if (!IS_DEV) {
    return (
      <View className='audit-page audit-page--blocked'>
        <Text className='blocked-title'>仅开发环境可用</Text>
        <Text className='blocked-desc'>新用户体验检查台不会在正式环境开放。</Text>
      </View>
    )
  }

  return (
    <ConfigProvider locale={zhCN}>
      <View className='audit-page'>
        <ScrollView scrollY className='audit-scroll'>
          <View className='audit-hero'>
            <Text className='audit-eyebrow'>微信小程序 · 开发专用</Text>
            <Text className='audit-title'>新用户体验检查模式</Text>
            <Text className='audit-subtitle'>
              用老账号也能反复检查小白路径：游客、登录、注册、首次资料完善、找教练和今日训练。默认不删除真实账号和业务数据。
            </Text>
            <View className='audit-user-card'>
              <Text className='audit-user-label'>当前身份</Text>
              <Text className='audit-user-name'>{userName}</Text>
            </View>
          </View>

          <View className='action-grid'>
            <View className='action-card' onClick={startGuestAudit}>
              <Text className='action-kicker'>游客视角</Text>
              <Text className='action-title'>从游客重新开始</Text>
              <Text className='action-desc'>退出本机登录并回到首页，检查未登录用户是否能先逛明白。</Text>
            </View>
            <View className='action-card' onClick={() => go('/auth/register')}>
              <Text className='action-kicker'>注册链路</Text>
              <Text className='action-title'>打开注册页</Text>
              <Text className='action-desc'>检查手机号/邮箱、验证码、协议、邀请码和返回登录体验。</Text>
            </View>
            <View className='action-card' onClick={() => go('/auth/login')}>
              <Text className='action-kicker'>登录链路</Text>
              <Text className='action-title'>打开登录页</Text>
              <Text className='action-desc'>检查快捷登录、密码登录、验证码登录和拒绝授权提示。</Text>
            </View>
            <View className='action-card action-card--primary' onClick={openOnboardingAudit}>
              <Text className='action-kicker action-kicker--primary'>首次引导</Text>
              <Text className='action-title action-title--primary'>体验资料完善</Text>
              <Text className='action-desc action-desc--primary'>纯本地 audit 模式，不提交真实资料，适合反复看小白是否看得懂。</Text>
            </View>
            <View className='action-card' onClick={resetLocalCaches}>
              <Text className='action-kicker'>本地状态</Text>
              <Text className='action-title'>清本地体验缓存</Text>
              <Text className='action-desc'>清今日训练首页缓存和训练执行快照，让弱网/首次打开体验更接近新设备。</Text>
            </View>
            <View className='action-card' onClick={() => go('/discovery/index')}>
              <Text className='action-kicker'>找教练</Text>
              <Text className='action-title'>进入发现页</Text>
              <Text className='action-desc'>从小白角度检查搜索、筛选、教练卡片和订阅入口。</Text>
            </View>
          </View>

          <View className='audit-section'>
            <Text className='section-title'>小白核心路径</Text>
            {scenarios.map((item) => (
              <View className='scenario-row' key={item}>
                <View className='scenario-dot' />
                <Text className='scenario-text'>{item}</Text>
              </View>
            ))}
          </View>

          <View className='audit-section'>
            <Text className='section-title'>检查时看什么</Text>
            {checklist.map((item) => (
              <View className='check-row' key={item}>
                <Text className='check-mark'>✓</Text>
                <Text className='check-text'>{item}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>
    </ConfigProvider>
  )
}
