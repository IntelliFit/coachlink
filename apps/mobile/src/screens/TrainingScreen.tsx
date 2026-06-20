import { SectionCard } from '../components/SectionCard'
import { Page } from '../components/Page'

export function TrainingScreen() {
  return (
    <Page title="训练" subtitle="今日计划、执行记录和临时训练会在这里汇总。">
      <SectionCard title="今日训练" description="暂无进行中的训练安排。" />
      <SectionCard title="训练执行" description="完成小程序对应流程迁移后，将接入组次记录、进度和本地缓存。" />
    </Page>
  )
}
