import { NextResponse } from 'next/server';

function getSiteUrl(): string {
  const raw =
    process.env.NEXTAUTH_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined) ||
    'https://coachlink.fit';

  return raw.replace(/\/+$/, '');
}

// 与 kirigaya.cn 可被 Google 抓取的 sitemap 格式完全一致：完整 xmlns + loc + changefreq
const STATIC_PATHS = [
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
  '/toolbox/one-arm-pull-up',
  '/toolbox/boji',
  '/generate-plan',
  '/generate-plan/waiting',
  '/docs/agreement',
  '/docs/disclaimer',
  '/privacy',
  '/account-deletion',
  '/coach/discovery',
  '/streetlifting-index',
  '/streetlifting-index/calculator',
  '/streetlifting-index/data',
  '/streetlifting-index/locations',
  '/streetlifting-index/methodology',
  '/streetlifting-index/stories',
  '/streetlifting-index/submit',
];

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const siteUrl = getSiteUrl();

  const urlEntries = STATIC_PATHS.map(
    (path) =>
      `  <url>\n    <loc>${escapeXml(`${siteUrl}${path}`)}</loc>\n    <changefreq>daily</changefreq>\n  </url>`,
  ).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:news="http://www.google.com/schemas/sitemap-news/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">
${urlEntries}
</urlset>`;

  return new NextResponse(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
