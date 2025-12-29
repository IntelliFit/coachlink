// TermsOfServicePage.tsx
import { Card } from 'primereact/card';
import { notFound } from 'next/navigation';
import MarkdownIt from 'markdown-it';
import BackButton from '../../components/BackButton';
import { getDocContent } from '@/utils/content';

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

export default async function TermsOfServicePage() {
    const content = await getDocContent('terms.md');

    if (!content) {
        notFound();
    }

    const htmlContent = md.render(content);

    return (
        <div className="min-h-screen bg-surface-50 py-12 px-4 sm:px-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    {/* 使用客户端组件处理返回逻辑 */}
                    <BackButton />
                </div>

                <Card className="shadow-lg rounded-2xl border-none">
                    <div className="p-6 md:p-10">
                        <div 
                            className="prose max-w-none text-surface-700"
                            dangerouslySetInnerHTML={{ __html: htmlContent }} 
                        />
                    </div>
                </Card>
            </div>
        </div>
    );
}