import Link from 'next/link';
import SectionHeader from './SectionHeader';
import type { PublicArticleListItem } from './types';

const MAX_ARTICLES = 3;

export default function ArticlesSection({ articles }: { articles: PublicArticleListItem[] }) {
    if (articles.length === 0) return null;

    return (
        <section className="flex flex-col gap-5">
            <SectionHeader title="健身资讯" moreHref="/articles" moreText="全部文章" />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {articles.slice(0, MAX_ARTICLES).map((article) => (
                    <Link
                        key={article.id}
                        href={`/coach/content/${article.id}`}
                        className="flex flex-col gap-2.5 rounded-2xl border border-surface-200 bg-surface-0 p-5 transition-colors hover:border-surface-300"
                    >
                        <span className="flex items-center gap-2">
                            {article.coachAvatarUrl ? (
                                <img src={article.coachAvatarUrl} alt="" className="h-6 w-6 rounded-full object-cover" />
                            ) : (
                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-surface-100 text-[10px] font-bold text-surface-600">
                                    {article.coachName?.[0]}
                                </span>
                            )}
                            <span className="truncate text-xs font-bold text-surface-600">{article.coachName}</span>
                            {article.priceCents > 0 && (
                                <span className="ml-auto rounded-md bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-500/15">付费</span>
                            )}
                        </span>
                        <span className="line-clamp-2 text-base font-bold leading-snug text-surface-900">{article.title}</span>
                        <span className="line-clamp-2 text-sm text-surface-600">{article.summary || '暂无简介'}</span>
                        <span className="mt-auto text-xs text-surface-500">
                            {article.publishedAt ? new Date(article.publishedAt).toLocaleDateString('zh-CN') : ''}
                        </span>
                    </Link>
                ))}
            </div>
        </section>
    );
}
