import Link from 'next/link';
import { Card } from 'primereact/card';
import { ARTICLES } from './articlesData';

export default function ArticlesPage() {
  return (
    <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <div className="text-xs font-black uppercase tracking-widest text-surface-500">技术文章</div>
          <h1 className="mt-2 text-3xl md:text-4xl font-black text-surface-900 tracking-tight">
            训练科技与产品实践
          </h1>
          <p className="mt-3 text-surface-500 text-sm font-medium">
            这里发布训练相关的技术实践与产品机制说明（非时事新闻）。
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4">
          {ARTICLES.map((a) => (
            <Link key={a.slug} href={`/articles/${a.slug}`} className="block">
              <Card className="shadow-sm rounded-2xl border border-surface-100 hover:shadow-md transition-shadow">
                <div className="p-1">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="text-lg font-black text-surface-900 tracking-tight line-clamp-1">
                        {a.title}
                      </div>
                      <div className="mt-2 text-sm text-surface-500 font-medium line-clamp-2">
                        {a.summary}
                      </div>
                    </div>
                    <div className="shrink-0 text-xs font-black text-surface-400">
                      {a.publishedAt}
                    </div>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

