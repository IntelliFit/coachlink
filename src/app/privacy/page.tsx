import type { Metadata } from 'next'
import { Card } from 'primereact/card'
import { notFound } from 'next/navigation'
import MarkdownIt from 'markdown-it'
import BackButton from '../../components/BackButton'
import { getDocContent } from '@/utils/content'

export const metadata: Metadata = {
  title: '隐私政策 | CoachLink',
  description: 'CoachLink 隐私政策、个人信息处理规则与账号数据删除说明。',
}

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
})

export default async function PrivacyPage() {
  const content = await getDocContent('privacy.md')
  if (!content) notFound()

  const htmlContent = md.render(content)

  return (
    <div className="min-h-screen px-4 py-12 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8"><BackButton /></div>
        <Card className="rounded-2xl border-none shadow-lg">
          <div className="p-6 md:p-10">
            <div className="prose max-w-none text-surface-700" dangerouslySetInnerHTML={{ __html: htmlContent }} />
          </div>
        </Card>
      </div>
    </div>
  )
}
