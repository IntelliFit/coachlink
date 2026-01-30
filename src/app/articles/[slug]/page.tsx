import { notFound, redirect } from 'next/navigation';
import { Card } from 'primereact/card';
import MarkdownIt from 'markdown-it';
import BackButton from '../../../components/BackButton';
import { getDocContent } from '@/utils/content';
import { ARTICLES } from '../articlesData';
import { serviceRoleSupabase } from '@/lib/supabaseClient';
import { getServerSession } from '@/app/api/auth/[...nextauth]/auth';
import ArticlePurchaseSection from '../ArticlePurchaseSection';

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

function stripHtml(input: string) {
  return (input || '').replace(/<[^>]*>/g, '').trim();
}

function previewText(input: string, maxChars = 900) {
  const txt = stripHtml(input);
  if (txt.length <= maxChars) return txt;
  return txt.slice(0, maxChars).trimEnd() + '…';
}

export default async function ArticleDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const slugValue = slug || '';
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugValue);

  const session = await getServerSession();
  const userId = session?.user?.id;
  if (!userId) {
    // middleware should already redirect, but keep a server-side safety net
    redirect(`/login?redirect=${encodeURIComponent(`/articles/${slugValue}`)}`);
  }

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
        price_cents,
        created_at,
        coach:coaches(id,name,avatar_url,status)
      `,
      )
      .eq('id', slugValue)
      .maybeSingle();

    const coachStatus = (data as any)?.coach?.status || null;
    if (error || !data) {
      return (
        <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <BackButton />
            </div>
            <Card className="shadow-lg rounded-2xl border-none">
              <div className="p-6 md:p-10">
                <div className="text-xs font-black uppercase tracking-widest text-surface-400">文章不可用</div>
                <h1 className="mt-3 text-2xl md:text-3xl font-black text-surface-900 tracking-tight">
                  该文章不存在或已下线
                </h1>
                <div className="mt-4 text-sm text-surface-600">
                  文章 ID：<span className="font-black">{slugValue}</span>
                </div>
                <div className="mt-2 text-xs text-surface-500">
                  如果你刚刚发布内容但这里打不开，通常是发布到不同环境或内容未成功保存导致。
                </div>
              </div>
            </Card>
          </div>
        </div>
      );
    }
    if (coachStatus !== 'approved') {
      return (
        <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
          <div className="max-w-4xl mx-auto">
            <div className="mb-8">
              <BackButton />
            </div>
            <Card className="shadow-lg rounded-2xl border-none">
              <div className="p-6 md:p-10">
                <div className="text-xs font-black uppercase tracking-widest text-surface-400">文章暂不可见</div>
                <h1 className="mt-3 text-2xl md:text-3xl font-black text-surface-900 tracking-tight">
                  该文章当前不可公开访问
                </h1>
                <div className="mt-4 text-sm text-surface-600">
                  可能原因：教练未通过审核、教练状态异常或内容被下线。
                </div>
              </div>
            </Card>
          </div>
        </div>
      );
    }

    const raw = String((data as any).content || '');
    const requiredTier = Number((data as any).required_tier ?? 0);
    const priceCents = Number((data as any).price_cents ?? 0);
    const isPaid = priceCents > 0;

    let purchased = false;
    if (isPaid) {
      const { data: purchase } = await serviceRoleSupabase
        .from('content_purchases' as any)
        .select('id,status')
        .eq('content_id', slugValue)
        .eq('user_id', userId)
        .eq('status', 'paid')
        .maybeSingle();
      purchased = !!purchase;
    }

    let subscriptionUnlocked = false;
    try {
      const coachId = String((data as any).coach_id || '');
      if (coachId) {
        const { data: sub } = await serviceRoleSupabase
          .from('coach_subscriptions')
          .select('id,tier,status')
          .eq('coach_id', coachId)
          .eq('student_id', userId)
          .eq('status', 'active')
          .gte('tier', requiredTier)
          .maybeSingle();
        subscriptionUnlocked = !!sub;
      }
    } catch {
      // ignore
    }

    const canView = !isPaid || purchased || subscriptionUnlocked;
    const isPreview = !canView;
    const display = isPreview ? previewText(raw) : stripHtml(raw);
    const priceYuan = (priceCents / 100).toFixed(2);

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
                {display}
              </div>

              {isPreview ? (
                <div className="mt-6 text-xs text-surface-500">
                  以上为预览内容。可单篇购买解锁，也可订阅该教练后免费阅读。
                </div>
              ) : null}

              {isPaid && !canView ? (
                <ArticlePurchaseSection
                  contentId={(data as any).id}
                  title={(data as any).title || '未命名'}
                  priceCents={priceCents}
                  coachId={(data as any).coach_id}
                  coachName={(data as any)?.coach?.name || '教练'}
                  requiredTier={requiredTier}
                />
              ) : null}

              {isPaid && canView ? (
                <div className="mt-10 text-xs text-surface-400">
                  已解锁（{subscriptionUnlocked ? '订阅解锁' : `¥${priceYuan}`}）。
                </div>
              ) : null}
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // 兼容：旧的 markdown 静态文章（用于审核示例/历史链接）
  const meta = ARTICLES.find((a) => a.slug === slugValue);
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
              以上为预览内容。该页面为历史链接兼容展示。
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

