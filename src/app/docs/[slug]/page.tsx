import fs from 'fs';
import path from 'path';
import MarkdownIt from 'markdown-it';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

const md = new MarkdownIt({
    html: true,
    linkify: true,
    typographer: true,
});

const DOCS_MAP: Record<string, string> = {
    agreement: '用户协议.md',
    disclaimer: '免责声明.md',
};

async function getDocContent(slug: string) {
    const filename = DOCS_MAP[slug];
    if (!filename) return null;

    const filePath = path.join(process.cwd(), 'docs', filename);
    
    try {
        const content = await fs.promises.readFile(filePath, 'utf-8');
        return content;
    } catch (error) {
        console.error(`Error reading doc ${slug}:`, error);
        return null;
    }
}

export default async function DocPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const content = await getDocContent(slug);

    if (!content) {
        notFound();
    }

    const htmlContent = md.render(content);

    return (
        <main className="min-h-screen py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto bg-white dark:bg-gray-800 rounded-xl shadow-sm p-8 md:p-12">
                <article className="prose prose-lg dark:prose-invert max-w-none">
                    <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
                </article>
            </div>
        </main>
    );
}

// Optional: Generate static params if you want SSG, but force-dynamic is set above so it will SSR.
export async function generateStaticParams() {
    return Object.keys(DOCS_MAP).map((slug) => ({
        slug,
    }));
}
