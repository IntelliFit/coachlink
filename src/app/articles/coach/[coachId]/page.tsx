import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight, Lock } from 'lucide-react';
import { serviceRoleSupabase } from '@/lib/supabaseClient';

export const dynamic = 'force-dynamic';

type CoachColumnItem = {
    id: string;
    column_id: string | null;
    column_sort_order: number | null;
    title: string;
    content: string | null;
    required_tier: number | null;
    price_cents: number | null;
    created_at: string | null;
    views_count: number | null;
    likes_count: number | null;
};

type CoachContentColumn = {
    id: string;
    name: string;
    description: string | null;
    cover_url: string | null;
    slug: string | null;
    sort_order: number;
};

function stripHtml(input: string | null | undefined) {
    return (input || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

export default async function CoachColumnPage({
    params,
}: {
    params: Promise<{ coachId: string }>;
}) {
    const { coachId } = await params;

    const { data: coach, error: coachError } = await serviceRoleSupabase
        .from('coaches')
        .select('id,name,title,avatar_url,status')
        .eq('id', coachId)
        .eq('status', 'approved')
        .single();

    if (coachError || !coach) {
        notFound();
    }

    const [{ data: columns, error: columnsError }, { data: items, error: itemsError }] = await Promise.all([
        serviceRoleSupabase
            .from('coach_content_columns')
            .select('id,name,description,cover_url,slug,sort_order')
            .eq('coach_id', coachId)
            .eq('is_visible', true)
            .order('sort_order', { ascending: true })
            .order('created_at', { ascending: false }),
        serviceRoleSupabase
        .from('coach_contents')
            .select('id,column_id,column_sort_order,title,content,required_tier,price_cents,created_at,views_count,likes_count')
        .eq('coach_id', coachId)
        .eq('content_type', 'text')
            .order('column_sort_order', { ascending: true, nullsFirst: false })
            .order('created_at', { ascending: false }),
    ]);

    if (columnsError) {
        console.error('[articles/coach/[coachId]] load columns error:', columnsError);
    }
    if (itemsError) {
        console.error('[articles/coach/[coachId]] load column error:', itemsError);
    }

    const contents = (items || []) as CoachColumnItem[];
    const visibleColumns = (columns || []) as CoachContentColumn[];
    const visibleColumnIds = new Set(visibleColumns.map((column) => column.id));
    const looseArticles = contents.filter((content) => !content.column_id);
    const groupedColumns = visibleColumns
        .map((column) => ({
            column,
            articles: contents.filter((content) => content.column_id === column.id),
        }))
        .filter((group) => group.articles.length > 0);
    const hiddenColumnArticleCount = contents.filter(
        (content) => content.column_id && !visibleColumnIds.has(content.column_id),
    ).length;

    return (
        <div className="min-h-screen bg-surface-50 py-10 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <Link
                            href="/articles"
                            className="inline-flex items-center gap-2 text-sm font-bold text-surface-500 hover:text-primary-600 transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            返回文章广场
                        </Link>
                        <div className="mt-4 text-xs font-black uppercase tracking-[0.24em] text-surface-400">
                            Coach Column
                        </div>
                        <h1 className="mt-2 text-3xl md:text-4xl font-black tracking-tight text-surface-900">
                            {coach.name || '教练'}专栏
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm md:text-base text-surface-500">
                            按教练集中查看图文文章，而不是混在全站资讯流里。适合沉淀训练方法、案例拆解和长期内容输出。
                        </p>
                        {coach.title ? (
                            <p className="mt-2 text-sm font-medium text-surface-600">{coach.title}</p>
                        ) : null}
                        <div className="mt-3 text-xs font-black text-surface-400">
                            {visibleColumns.length} 个专栏 · {looseArticles.length} 篇闲散文章
                            {hiddenColumnArticleCount > 0 ? ` · ${hiddenColumnArticleCount} 篇隐藏专栏文章` : ''}
                        </div>
                    </div>

                    <Link
                        href={`/coach/profile/${coachId}?tab=2`}
                        className="inline-flex items-center gap-2 rounded-2xl border border-surface-200 bg-surface px-4 py-3 text-sm font-bold text-surface-700 hover:border-primary-200 hover:text-primary-600 transition-colors"
                    >
                        回到教练主页
                        <ArrowRight className="w-4 h-4" />
                    </Link>
                </div>

                {contents.length === 0 ? (
                    <div className="rounded-3xl border border-surface-100 bg-surface px-6 py-16 text-center">
                        <div className="text-xl font-black text-surface-900">这个专栏还没发文章</div>
                        <p className="mt-3 text-sm text-surface-500">
                            后续教练在内容管理里发布图文后，这里会自动沉淀成专栏。
                        </p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {groupedColumns.map(({ column, articles }) => (
                            <section
                                key={column.id}
                                className="rounded-[32px] border border-surface-100 bg-surface p-5 md:p-7 shadow-sm"
                            >
                                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-[0.22em] text-primary-500">
                                            Named Column
                                        </div>
                                        <h2 className="mt-2 text-2xl font-black tracking-tight text-surface-900">
                                            {column.name}
                                        </h2>
                                        {column.description ? (
                                            <p className="mt-2 max-w-2xl text-sm text-surface-500">
                                                {column.description}
                                            </p>
                                        ) : null}
                                    </div>
                                    <div className="text-xs font-black text-surface-400">
                                        {articles.length} 篇
                                    </div>
                                </div>
                                <ArticleList articles={articles} />
                            </section>
                        ))}

                        {looseArticles.length > 0 ? (
                            <section className="rounded-[32px] border border-dashed border-surface-200 bg-surface/70 p-5 md:p-7">
                                <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                                    <div>
                                        <div className="text-xs font-black uppercase tracking-[0.22em] text-surface-400">
                                            Loose Articles
                                        </div>
                                        <h2 className="mt-2 text-2xl font-black tracking-tight text-surface-900">
                                            闲散文章
                                        </h2>
                                        <p className="mt-2 max-w-2xl text-sm text-surface-500">
                                            这些文章没有归入某个命名专栏，但仍属于这位教练的公开内容。
                                        </p>
                                    </div>
                                    <div className="text-xs font-black text-surface-400">
                                        {looseArticles.length} 篇
                                    </div>
                                </div>
                                <ArticleList articles={looseArticles} />
                            </section>
                        ) : null}
                    </div>
                )}
            </div>
        </div>
    );
}

function ArticleList({ articles }: { articles: CoachColumnItem[] }) {
    return (
        <div className="grid grid-cols-1 gap-4">
            {articles.map((content) => {
                const summary = stripHtml(content.content).slice(0, 160);

                return (
                    <Link
                        key={content.id}
                        href={`/coach/content/${content.id}`}
                        className="group block rounded-3xl border border-surface-100 bg-white p-6 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-lg"
                    >
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="rounded-full bg-surface-100 px-3 py-1 text-[11px] font-black text-surface-600">
                                {content.required_tier && content.required_tier > 0
                                    ? `订阅等级 ${content.required_tier}+`
                                    : '公开文章'}
                            </span>
                            {content.price_cents && content.price_cents > 0 ? (
                                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-[11px] font-black text-amber-700">
                                    <Lock className="h-3 w-3" />
                                    ¥{(content.price_cents / 100).toFixed(2)}
                                </span>
                            ) : null}
                            <span className="ml-auto text-xs font-bold text-surface-400">
                                {content.created_at
                                    ? new Date(content.created_at).toLocaleDateString('zh-CN')
                                    : ''}
                            </span>
                        </div>

                        <h3 className="mt-4 text-xl font-black tracking-tight text-surface-900 group-hover:text-primary-700 transition-colors">
                            {content.title || '未命名文章'}
                        </h3>

                        <p className="mt-3 line-clamp-3 text-sm leading-7 text-surface-500">
                            {summary || '暂无摘要'}
                        </p>

                        <div className="mt-6 flex items-center gap-6 text-xs font-bold text-surface-400">
                            <span>阅读 {Number(content.views_count || 0).toLocaleString()}</span>
                            <span>点赞 {Number(content.likes_count || 0).toLocaleString()}</span>
                            <span className="ml-auto inline-flex items-center gap-2 text-primary-600">
                                进入文章
                                <ArrowRight className="w-4 h-4" />
                            </span>
                        </div>
                    </Link>
                );
            })}
        </div>
    );
}
