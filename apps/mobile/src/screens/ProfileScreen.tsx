import { AppButton } from '../components/AppButton'
import { SectionCard } from '../components/SectionCard'
import { Page } from '../components/Page'
import { useAuth } from '../providers/AuthProvider'

export function ProfileScreen() {
  const { logout } = useAuth()
  return (
    <Page title="我的" subtitle="账号、训练资料和应用设置。">
      <SectionCard title="训练档案" description="个人资料、专项目标和训练数据待接入。" />
      <SectionCard title="账号设置">
        <AppButton label="退出登录" variant="secondary" onPress={logout} />
      </SectionCard>
    </Page>
  )
}
