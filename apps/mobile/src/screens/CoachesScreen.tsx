import { SectionCard } from '../components/SectionCard'
import { Page } from '../components/Page'

export function CoachesScreen() {
  return (
    <Page title="教练" subtitle="发现教练、订阅服务和私教沟通。">
      <SectionCard title="推荐教练" description="教练发现列表待接入。" />
      <SectionCard title="我的服务" description="当前没有进行中的教练服务。" />
    </Page>
  )
}
