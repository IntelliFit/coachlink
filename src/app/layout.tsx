import "@/assets/globals.css";

import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'reactflow/dist/style.css';

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/context/ThemeContext';
import ClientLayout from '@/components/ClientLayout';
import Navigation from '@/components/Navigation';
import { type APIOptions as PrimeReactOptions, PrimeReactProvider } from 'primereact/api';
import { ProfileSetupModalProvider } from "@/context/ProfileSetupModalContext";

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: '教链 CoachLink',
        description: 'Coach-Client Management Platform',
        keywords: '健身',
        icons: {
            icon: "/favicon.jpg",
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

    return (
        <html lang="en">
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