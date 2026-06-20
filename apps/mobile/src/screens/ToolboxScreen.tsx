import { SectionCard } from '../components/SectionCard'
import { Page } from '../components/Page'

export function ToolboxScreen() {
  return (
    <Page title="工具箱" subtitle="街健指数、功率分析和训练辅助工具。">
      <SectionCard title="街健指数计算器" description="计算器历史与趣味排名待接入。" />
      <SectionCard title="功率视频分析" description="视频上传和分析结果待接入。" />
    </Page>
  )
}
