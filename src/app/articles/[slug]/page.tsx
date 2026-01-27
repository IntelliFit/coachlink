import { notFound } from 'next/navigation';
import { Card } from 'primereact/card';
import MarkdownIt from 'markdown-it';
import BackButton from '../../../components/BackButton';
import { getDocContent } from '@/utils/content';
import { ARTICLES } from '../articlesData';
import ArticlePaywall from '../ArticlePaywall';

const md = new MarkdownIt({
  html: true,
  linkify: true,
  typographer: true,
});

export default async function ArticleDetailPage({ params }: { params: { slug: string } }) {
  const meta = ARTICLES.find((a) => a.slug === params.slug);
  if (!meta) notFound();

  const content = await getDocContent(meta.filename);
  if (!content) notFound();

  const htmlContent = md.render(content);

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

            <ArticlePaywall />
          </div>
        </Card>
      </div>
    </div>
  );
}

