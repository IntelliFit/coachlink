'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, LucideIcon } from 'lucide-react';

interface KnowledgeHeaderProps {
  title: string;
  subtitle?: string;
  showBackButton?: boolean;
  icon?: LucideIcon;
  children?: React.ReactNode;
  gradient?: boolean;
}

export default function KnowledgeHeader({
  title,
  subtitle,
  showBackButton = true,
  icon: Icon,
  children,
  gradient = true,
}: KnowledgeHeaderProps) {
  const router = useRouter();

  if (gradient) {
    return (
      <div className="bg-gradient-to-br from-primary-600 via-primary-500 to-amber-500 text-white">
        <div className="max-w-3xl mx-auto px-4 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-2">
            {showBackButton && (
              <button
                onClick={() => router.back()}
                className="p-2 -ml-2 text-white/80 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            {Icon && (
              <div className="p-1.5 bg-white/20 backdrop-blur rounded-xl">
                <Icon size={20} />
              </div>
            )}
            <h1 className="text-xl font-black">{title}</h1>
          </div>
          {subtitle && (
            <p className="text-white/80 text-xs ml-0.5">{subtitle}</p>
          )}
          {children && <div className="mt-3">{children}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-20 bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-200 dark:border-surface-700">
      <div className="flex items-center gap-4 px-4 py-3 max-w-3xl mx-auto">
        {showBackButton && (
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex-1">
          <h1 className="text-lg font-black text-surface-900 dark:text-surface-100">{title}</h1>
          {subtitle && (
            <p className="text-xs text-surface-500">{subtitle}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}
