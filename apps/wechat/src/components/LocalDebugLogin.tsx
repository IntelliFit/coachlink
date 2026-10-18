import { useState } from 'react'
import { View, Text, Input, Button } from '@tarojs/components'
import Taro, { useDidShow } from '@tarojs/taro'
import { canUseLocalDebugLogin, localDebugApiUrl, getLocalDebugSession, loginLocalDebugUser, exitLocalDebugLogin } from '@/services/localDebugService'
import './LocalDebugLogin.scss'

export function LocalDebugBanner() {
  const [session, setSession] = useState(getLocalDebugSession)
  useDidShow(() => setSession(getLocalDebugSession()))
  if (!session) return null
  return <View className='local-debug-banner'>
    <Text className='local-debug-title'>本地模拟 · {session.name}</Text>
    <Text className='local-debug-detail'>{session.userId}</Text>
    <Text className='local-debug-detail'>{session.apiBaseUrl} · 数据源 {session.databaseFingerprint}</Text>
    <Text className='local-debug-detail'>真实数据：填写/完成会保存。有效至 {new Date(session.expiresAt).toLocaleTimeString()}</Text>
    <Button className='local-debug-secondary' onClick={() => { void exitLocalDebugLogin().catch(() => Taro.showToast({ title: '恢复账号失败，请重试', icon: 'none' })) }}>退出模拟，恢复原账号</Button>
  </View>
}

export function LocalDebugLoginPanel() {
  const [userId, setUserId] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  if (!canUseLocalDebugLogin()) return null
  const login = async () => {
    if (busy) return
    setError('')
    if (!userId.trim() || !code.trim()) { setError('请填写用户 ID 和本次启动配对码'); return }
    setBusy(true)
    try {
      const consent = await Taro.showModal({ title: '查看真实账号', content: '登录本身只读取账号，不修改昵称或绑定微信。进入后填写、完成训练会保存到当前数据库；请勿把真实学员当测试账号。', confirmText: '进入检查' })
      if (!consent.confirm) return
      await loginLocalDebugUser(userId, code)
      setCode('')
      await Taro.reLaunch({ url: '/pages/index/index' })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '无法连接本地调试后端')
    } finally { setBusy(false) }
  }
  return <View className='local-debug-panel'>
    <Text className='local-debug-title'>本地开发 · 用户 ID 模拟登录</Text>
    <Text className='local-debug-detail'>仅开发者工具 · {localDebugApiUrl()}</Text>
    <Text className='local-debug-detail'>先运行 npm run dev:debug-login，填入终端配对码。</Text>
    <Text className='local-debug-label'>用户 ID</Text>
    <Input className='local-debug-input local-debug-user-id' value={userId} maxlength={36} placeholder='输入完整用户 UUID' onInput={e => setUserId(e.detail.value)} />
    <Text className='local-debug-label'>本次启动配对码</Text>
    <Input className='local-debug-input local-debug-code' password value={code} maxlength={64} placeholder='仅使用本地终端中的配对码' onInput={e => setCode(e.detail.value)} />
    {error ? <Text className='local-debug-error'>{error}</Text> : null}
    <Button className='local-debug-primary' loading={busy} disabled={busy} onClick={login}>按用户 ID 进入检查</Button>
    <LocalDebugBanner />
  </View>
}
