import { notFound } from 'next/navigation';
import { Card } from 'primereact/card';
import MarkdownIt from 'markdown-it';
import BackButton from '../../../components/BackButton';
import { getDocContent } from '@/utils/content';
import { ARTICLES } from '../articlesData';
import ArticlePaywall from '../ArticlePaywall';
import { serviceRoleSupabase } from '@/lib/supabaseClient';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

function getPreviewMarkdown(markdown: string) {
  const delimiter = '\n---\n';
  const trimmed = (markdown || '').trim();
  if (!trimmed) return '';

  // 1) 优先用分隔符控制预览长度（作者可自行在 md 里插入 ---）
  if (trimmed.includes(delimiter)) {
    return trimmed.split(delimiter)[0]?.trim() || '';
  }

  // 2) 否则按比例截取（约 35%），并避免截断代码块
  const lines = trimmed.split('\n');
  const targetLines = Math.max(14, Math.floor(lines.length * 0.35));
  let previewLines = lines.slice(0, targetLines);

  // 避免代码块未闭合（``` 数量为奇数时，回退到最后一个成对闭合之前）
  const fenceCount = (arr: string[]) =>
    arr.reduce((acc, l) => (l.trim().startsWith('```') ? acc + 1 : acc), 0);
  while (previewLines.length > 0 && fenceCount(previewLines) % 2 === 1) {
    previewLines = previewLines.slice(0, -1);
  }

  return previewLines.join('\n').trim();
}

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const slug = params.slug || '';
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

  // 优先：使用“教练内容管理（coach_contents）”作为公开文章来源
  if (isUuid) {
    const { data, error } = await serviceRoleSupabase
      .from('coach_contents')
      .select(
        `
        id,
        coach_id,
        title,
        content,
        content_type,
        required_tier,
        created_at,
        coach:coaches(id,name,avatar_url,status)
      `,
      )
      .eq('id', slug)
      .maybeSingle();

    if (error || !data) notFound();
    if ((data as any)?.coach?.status !== 'approved') notFound();

    const requiredTier = Number((data as any).required_tier ?? 0);
    const raw = String((data as any).content || '');
    const isPreview = requiredTier > 0;

    return (
      <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="mb-8">
            <BackButton />
          </div>

          <Card className="shadow-lg rounded-2xl border-none">
            <div className="p-6 md:p-10">
              <div className="flex items-center justify-between gap-4 text-xs font-black uppercase tracking-widest text-surface-400">
                <span>
                  {(data as any).created_at
                    ? new Date((data as any).created_at).toLocaleDateString('zh-CN')
                    : ''}
                </span>
                <span className="truncate max-w-[60%]">
                  {(data as any)?.coach?.name || '教练'}
                </span>
              </div>

              <h1 className="mt-3 text-2xl md:text-3xl font-black text-surface-900 tracking-tight">
                {(data as any).title || '未命名'}
              </h1>

              <div className="prose max-w-none text-surface-700 mt-6 whitespace-pre-line">
                {isPreview ? raw.slice(0, 900) + (raw.length > 900 ? '…' : '') : raw}
              </div>

              {isPreview ? (
                <div className="mt-6 text-xs text-surface-500">
                  以上为预览内容。解锁后可阅读全文。
                </div>
              ) : null}

              <ArticlePaywall knowledgeHref={`/coach/content/${(data as any).id}`} />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 兼容：旧的 markdown 静态文章（用于审核示例/历史链接）
  const meta = ARTICLES.find((a) => a.slug === slug);
  if (!meta) notFound();

  const content = await getDocContent(meta.filename);
  if (!content) notFound();

  const previewMd = getPreviewMarkdown(content);
  const htmlContent = md.render(previewMd);

  return (
    <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <BackButton />
        </div>

        <Card className="shadow-lg rounded-2xl border-none">
          <div className="p-6 md:p-10">
            <div className="text-xs font-black uppercase tracking-widest text-surface-400">{meta.publishedAt}</div>
            <h1 className="mt-3 text-2xl md:text-3xl font-black text-surface-900 tracking-tight">
              {meta.title}
            </h1>

            <div
              className="prose max-w-none text-surface-700 mt-6"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />

            <div className="mt-6 text-xs text-surface-500">
              以上为预览内容。登录后可查看更多。
            </div>

            <ArticlePaywall knowledgeHref={`/dashboard/knowledge/articles`} />
          </div>
        </Card>
      </div>
    </div>
  );
}

