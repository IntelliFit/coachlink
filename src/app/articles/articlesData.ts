export type ArticleMeta = {
  slug: string;
  title: string;
  summary: string;
  filename: string; // under public/docs/
  publishedAt: string; // YYYY-MM-DD
};

export const ARTICLES: ArticleMeta[] = [
  {
    slug: 'ai-plan-structuring',
    title: 'AI 在训练计划结构化中的应用：从自然语言到可执行计划',
    summary: '用工程化方式把“训练计划描述”变成可执行、可追踪的结构化计划。',
    filename: 'articles/ai-plan-structuring.md',
    publishedAt: '2026-01-27',
  },
  {
    slug: 'data-driven-training',
    title: '数据驱动训练：用训练记录与 PR 趋势做阶段复盘',
    summary: '如何用训练数据（组、重量、RPE、PR）做更可靠的阶段复盘与调整。',
    filename: 'articles/data-driven-training.md',
    publishedAt: '2026-01-27',
  },
  {
    slug: 'video-structured-feedback',
    title: '视频 + 结构化记录：让远程指导更高效的技术实践',
    summary: '把视频与“当时的训练上下文”绑定，减少无效沟通，提升反馈质量。',
    filename: 'articles/video-structured-feedback.md',
    publishedAt: '2026-01-27',
  },
];

