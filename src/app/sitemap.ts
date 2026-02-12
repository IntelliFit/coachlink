import type { MetadataRoute } from 'next';

function getSiteUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    'https://coachlink.fit';

  return raw.replace(/\/+$/, '');
}

export default function sitemap(): MetadataRoute.Sitemap {
  const siteUrl = getSiteUrl();

  // 仅收录公开、无需登录即可访问的页面；登录态/后台页面不进入 sitemap
  // 格式参考可被 Google 抓取的 sitemap 标准（urlset + loc + changefreq）
  const staticPaths = [
    '/',
    '/market',
    '/about',
    '/articles',
    '/onboarding',
    '/contact',
    '/terms',
    '/disclaimer',
    '/login',
    '/register',
    '/ranking',
    '/training',
    '/toolbox',
    '/generate-plan',
    '/generate-plan/waiting',
    '/docs/agreement',
    '/docs/disclaimer',
    '/privacy',
    '/coach/discovery',
    '/streetlifting-index',
    '/streetlifting-index/calculator',
    '/streetlifting-index/data',
    '/streetlifting-index/locations',
    '/streetlifting-index/methodology',
    '/streetlifting-index/stories',
    '/streetlifting-index/submit',
  ];

  return staticPaths.map((pathname) => ({
    url: `${siteUrl}${pathname}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: pathname === '/' ? 1 : 0.8,
  }));
}

