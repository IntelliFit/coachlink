import { SectionCard } from '../components/SectionCard'
import { Page } from '../components/Page'

export function KnowledgeScreen() {
  return (
    <Page title="知识" subtitle="训练知识库、人体地图和专题计划。">
      <SectionCard title="人体地图" description="选择部位后的指南内容待接入。" />
      <SectionCard title="训练专题" description="知识库专题和训练计划内容待接入。" />
    </Page>
  )
}
