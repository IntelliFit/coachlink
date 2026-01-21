import "@/assets/globals.css";

import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/context/ThemeContext';
import ClientLayout from '@/components/ClientLayout';
import Navigation from '@/components/Navigation';
import { type APIOptions as PrimeReactOptions, PrimeReactProvider } from 'primereact/api';
import { ProfileSetupModalProvider } from "@/context/ProfileSetupModalContext";

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
    const siteUrl = process.env.NEXTAUTH_URL || 'https://coachlink.fit';
    const title = 'CoachLink 教链｜教练与学员的训练管理平台';
    const description =
        'CoachLink 教链，连接教练与学员：训练计划制定/AI 快速生成、今日训练一键开练、视频上传点评、PR 进步时间轴、自动负荷计算与数据分析。';
    const keywords = [
        'CoachLink',
        '教链',
        '健身教练',
        '私教',
        '训练计划',
        '今日训练',
        '力量训练',
        '街健',
        '训练打卡',
        '视频点评',
        'PR',
        '1RM',
        '负荷计算',
        'AI 训练计划',
        '训练数据分析',
        '教练学员管理',
    ];

    return {
        metadataBase: new URL(siteUrl),
        title,
        description,
        keywords,
        applicationName: 'CoachLink 教链',
        authors: [{ name: 'CoachLink' }],
        creator: 'CoachLink',
        publisher: 'CoachLink',
        robots: { index: true, follow: true },
        alternates: {
            canonical: '/',
        },
        openGraph: {
            type: 'website',
            locale: 'zh_CN',
            url: siteUrl,
            siteName: 'CoachLink 教链',
            title,
            description,
            images: [
                {
                    url: '/images/favicon.jpg',
                    width: 1200,
                    height: 630,
                    alt: 'CoachLink 教链',
                },
            ],
        },
        twitter: {
            card: 'summary_large_image',
            title,
            description,
            images: ['/images/favicon.jpg'],
        },
        manifest: '/site.webmanifest',
        appleWebApp: {
            capable: true,
            statusBarStyle: 'black-translucent',
            title: 'CoachLink 教链',
        },
        icons: {
            icon: [
                { url: '/favicon.svg', type: 'image/svg+xml' },
                { url: '/favicon.jpg', type: 'image/jpeg' },
            ],
            shortcut: [{ url: '/favicon.jpg', type: 'image/jpeg' }],
            apple: [{ url: '/favicon.jpg', type: 'image/jpeg' }],
        },
        other: {
            'mobile-web-app-capable': 'yes',
        },
    };
}

// 统一移动端视口，避免 DevTools “响应式/设备模式”表现不一致，也更接近真机
export const viewport: Viewport = {
    width: 'device-width',
    initialScale: 1,
    viewportFit: 'cover',
};

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {

    const primereactConfig: Partial<PrimeReactOptions> = {
        ripple: true,
        locale: 'en',
    };

    const siteUrl = process.env.NEXTAUTH_URL || 'https://coachlink.fit';
    const structuredData = {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        url: siteUrl,
        name: 'CoachLink 教链',
        alternateName: 'CoachLink 教链｜教练与学员的训练管理平台',
        description:
            '连接教练与学员的训练管理平台：计划制定/AI 生成、今日训练、视频上传点评、PR 进步时间轴与自动负荷计算。',
    };

    return (
        <html lang="zh-CN">
            <head>
                <script
                    type="application/ld+json"
                    id="structured-data"
                    // eslint-disable-next-line react/no-danger
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
                />
            </head>
            <body className={inter.className}>
                <ThemeProvider>
                    <ClientLayout>
                        <PrimeReactProvider value={primereactConfig}>
                            <ProfileSetupModalProvider>
                                <Navigation />
                            </ProfileSetupModalProvider>

                            {children}
                        </PrimeReactProvider>
                    </ClientLayout>
                </ThemeProvider>
            </body>
        </html>
    );
}