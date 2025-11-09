import "@/assets/globals.css";

import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ThemeProvider } from '@/context/ThemeContext';
import ClientLayout from '@/components/ClientLayout';
import Navigation from '@/components/Navigation';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
    return {
        title: 'CoachLink',
        description: 'Coach-Client Management Platform',
        keywords: '健身',
        icons: {
            icon: "/favicon.jpg",
        },
    };
}

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en">
            <body className={inter.className}>
                <ThemeProvider>
                    <ClientLayout>
                        <Navigation />
                        {children}
                    </ClientLayout>
                </ThemeProvider>
            </body>
        </html>
    );
}