import Link from "next/link";
import { Card } from "primereact/card";
import { headers } from "next/headers";

export const dynamic = "force-dynamic";

type PublicArticleListItem = {
    id: string;
    coachId: string;
    coachName: string;
    coachAvatarUrl: string | null;
    title: string;
    summary: string;
    contentType: string;
    requiredTier: number;
    publishedAt: string | null;
};

async function loadItems(): Promise<PublicArticleListItem[]> {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3000";
    const proto = h.get("x-forwarded-proto") || "http";
    const base = `${proto}://${host}`;

    const res = await fetch(`${base}/api/public/articles/list?limit=30&offset=0`, {
        cache: "no-store",
    });
    const json = await res.json();
    return (json?.data?.items || []) as PublicArticleListItem[];
}

export default async function ArticlesPage() {
    const items = await loadItems();

    return (
        <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
            <div className="max-w-5xl mx-auto">
                <div className="mb-8">
                    <div className="text-xs font-black uppercase tracking-widest text-surface-500">
                        技术文章
                    </div>
                    <h1 className="mt-2 text-3xl md:text-4xl font-black text-surface-900 tracking-tight">
                        教练内容 · 公开资讯
                    </h1>
                    <p className="mt-3 text-surface-500 text-sm font-medium">
                        这里汇总教练发布的训练相关技术实践与记录（非时事新闻）。
                    </p>
                    <div className="mt-2 text-xs font-black text-surface-400">
                        共 {items.length} 篇
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                    {items.map((a) => (
                        <Link key={a.id} href={`/articles/${a.id}`} className="block">
                            <Card className="shadow-sm rounded-2xl border border-surface-100 hover:shadow-md transition-shadow">
                                <div className="p-2">
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="min-w-0">
                                            <div className="text-xs font-black text-surface-400">
                                                {a.coachName}
                                                {a.requiredTier > 0 ? (
                                                    <span className="ml-2 text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">
                                                        需解锁
                                                    </span>
                                                ) : (
                                                    <span className="ml-2 text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                                                        公开
                                                    </span>
                                                )}
                                            </div>
                                            <div className="mt-2 text-lg font-black text-surface-900 tracking-tight line-clamp-1">
                                                {a.title}
                                            </div>
                                            <div className="mt-2 text-sm text-surface-500 font-medium line-clamp-2">
                                                {a.summary}
                                            </div>
                                        </div>
                                        <div className="shrink-0 text-xs font-black text-surface-400">
                                            {a.publishedAt
                                                ? new Date(a.publishedAt).toLocaleDateString("zh-CN")
                                                : ""}
                                        </div>
                                    </div>
                                </div>
                            </Card>
                        </Link>
                    ))}

                    {items.length === 0 ? (
                        <div className="text-center py-20 text-surface-500">
                            暂无文章。请教练在「内容管理」发布后，这里会自动展示。
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

