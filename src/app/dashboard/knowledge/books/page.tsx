'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Lock, LockOpen } from 'lucide-react';
import KnowledgeHeader from '@/components/knowledge/KnowledgeHeader';
import { useToastContext } from '@/context/ToastContext';
import knowledgeService from '@/app/service/knowledgeService';
import { KnowledgeBookRow } from '@/types';
import { groupKnowledgeBooks } from '@/lib/knowledgeBooks';

const BooksPage = () => {
  const [books, setBooks] = useState<KnowledgeBookRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const { showToast } = useToastContext();

  useEffect(() => {
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      setLoading(true);
      const result = await knowledgeService.listKnowledgeBooks({
        is_published: true,
      });
      
      if (result) {
        setBooks(result.books);
      } else {
        setBooks([]);
      }
    } catch (err) {
      setError("获取书籍列表失败");
      showToast({
        severity: "error",
        summary: "错误",
        detail: "获取书籍列表失败，请稍后重试",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBookClick = (bookId: string, hasAccess: boolean) => {
    if (hasAccess) {
      router.push(`/dashboard/knowledge/books/${bookId}`);
    } else {
      router.push("/dashboard/knowledge/subscribe");
    }
  };

  const collections = groupKnowledgeBooks(books);

  return (
    <div className="min-h-screen pb-32">
      <KnowledgeHeader
        title="书籍笔记"
        subtitle="深入学习的系统化知识整理"
        icon={BookOpen}
        showBackButton={true}
      />

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {error && (
          <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 border border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 rounded-xl">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {loading
            ? Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm">
                  <div className="h-40 bg-surface-200 dark:bg-surface-700 rounded-xl mb-3 animate-pulse" />
                  <div className="h-5 w-3/4 bg-surface-200 dark:bg-surface-700 rounded mb-2 animate-pulse" />
                  <div className="h-4 w-full bg-surface-200 dark:bg-surface-700 rounded mb-1 animate-pulse" />
                  <div className="h-4 w-2/3 bg-surface-200 dark:bg-surface-700 rounded animate-pulse" />
                </div>
              ))
            : collections.map((collection) => (
                <button
                  key={collection.slug}
                  onClick={() =>
                    handleBookClick(
                      collection.representativeBook.id,
                      collection.isFree
                    )
                  }
                  className="group text-left bg-white dark:bg-surface-800 rounded-2xl p-4 shadow-sm hover:shadow-md transition-all duration-200"
                >
                  <div className="relative mb-3">
                    {collection.representativeBook.cover_image ? (
                      <div className="aspect-[4/3] rounded-xl overflow-hidden bg-surface-100">
                        <img
                          src={collection.representativeBook.cover_image}
                          alt={collection.displayTitle}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                    ) : (
                      <div className="aspect-[4/3] rounded-xl bg-surface-100 dark:bg-surface-700 flex items-center justify-center">
                        <BookOpen size={48} className="text-surface-400" />
                      </div>
                    )}
                    <div className="absolute top-2 right-2">
                      {collection.isFree ? (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300">
                          <LockOpen size={12} />
                          免费
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 px-2 py-1 text-xs font-bold rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
                          <Lock size={12} />
                          付费
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-base font-bold text-surface-900 dark:text-surface-100 line-clamp-1 group-hover:text-primary-600 transition-colors">
                      {collection.displayTitle}
                    </h3>
                    {collection.chapterCount > 0 && (
                      <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[11px] font-semibold">
                        {collection.chapterCount} 篇章节
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-surface-400 dark:text-surface-500 mb-1">
                    {collection.chapterCount > 0
                      ? `先看总览，再看 ${collection.chapterCount} 篇分篇解读`
                      : '单篇书籍解读'}
                  </p>
                  <p className="text-sm text-surface-500 dark:text-surface-400 line-clamp-2">
                    {collection.summary || "暂无简介"}
                  </p>
                </button>
              ))}
        </div>

        {collections.length === 0 && !loading && (
          <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-2xl">
            <BookOpen size={48} className="mx-auto text-surface-300 mb-4" />
            <h3 className="text-lg font-bold text-surface-600 dark:text-surface-300">
              暂无书籍
            </h3>
            <p className="text-surface-500 dark:text-surface-400 mt-1 text-sm">
              知识库暂无可用书籍，请稍后再来查看
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default BooksPage;
