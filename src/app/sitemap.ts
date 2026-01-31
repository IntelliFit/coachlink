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
  const now = new Date();

  // 仅收录公开、无需枚举动态参数的页面；登录态/后台页面不进入 sitemap
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
  ];

  return staticPaths.map((pathname) => ({
    url: `${siteUrl}${pathname}`,
    lastModified: now,
    changeFrequency: pathname === '/' ? 'daily' : 'weekly',
    priority: pathname === '/' ? 1 : 0.6,
  }));
}

