'use client';

import { Button } from 'primereact/button';
import Link from 'next/link';

export default function NotFound() {
    return (
        <div className="h-[90vh] flex items-center justify-center p-4">
            <div className="rounded-xl p-8 max-w-md w-full text-center">
                <div className="w-24 h-24 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                </div>
                
                <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
                <p className="text-xl text-surface-500 mb-8">抱歉，您访问的页面不存在。</p>
                
                <Link href="/" className="no-underline">
                    <Button 
                        label="返回首页" 
                        className="w-full py-3"
                    />
                </Link>
            </div>
        </div>
    );
}