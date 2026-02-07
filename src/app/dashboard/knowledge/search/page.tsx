'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Search, BookOpen, FileText, Video, Loader2 } from 'lucide-react';

type SearchResult = {
  id: string;
  title: string;
  description: string | null;
  node_type: string;
  slug: string;
  body_region: string[] | null;
};

function SearchResultsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams?.get('q') || '';

  const [searchQuery, setSearchQuery] = useState(query);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setSearched(true);
    try {
      const res = await fetch(`/api/knowledge/search?q=${encodeURIComponent(q.trim())}`);
      const json = await res.json();
      setResults(json.results || []);
    } catch (error) {
      console.error('Search failed:', error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (query) {
      doSearch(query);
    }
  }, [query, doSearch]);

  const handleSearch = () => {
    if (searchQuery.trim()) {
      router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(searchQuery.trim())}`);
      doSearch(searchQuery);
    }
  };

  const handleResultClick = (result: SearchResult) => {
    if (result.node_type === 'article' || result.node_type === 'video') {
      router.push(`/dashboard/knowledge/nodes/${result.id}`);
    } else {
      router.push(`/dashboard/knowledge/pillars/${result.id}`);
    }
  };

  const getNodeIcon = (type: string) => {
    switch (type) {
      case 'article': return <FileText size={18} />;
      case 'video': return <Video size={18} />;
      default: return <BookOpen size={18} />;
    }
  };

  const getNodeTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      domain: '领域',
      category: '分类',
      topic: '主题',
      article: '文章',
      video: '视频',
    };
    return labels[type] || type;
  };

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-3 px-4 py-3 max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="搜索知识点..."
              className="w-full pl-9 pr-4 py-2 bg-surface-100 dark:bg-surface-800 text-surface-900 dark:text-surface-100 placeholder-surface-400 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <button
            onClick={handleSearch}
            className="shrink-0 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white text-sm font-bold rounded-xl transition-colors"
          >
            搜索
          </button>
        </div>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto">
        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={24} className="animate-spin text-primary-500" />
            <span className="ml-2 text-surface-500">搜索中...</span>
          </div>
        )}

        {/* Results */}
        {!loading && searched && (
          <div className="space-y-4">
            <p className="text-sm text-surface-500">
              {results.length > 0 ? `找到 ${results.length} 个相关结果` : `没有找到与 "${query}" 相关的内容`}
            </p>

            {results.length === 0 && (
              <div className="text-center py-12">
                <BookOpen size={48} className="mx-auto text-surface-300 mb-4" />
                <p className="text-surface-600 dark:text-surface-400">
                  试试其他关键词
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-2">
                  {['深蹲', '肩颈', '拉伸', '评估'].map((term) => (
                    <button
                      key={term}
                      onClick={() => {
                        setSearchQuery(term);
                        router.push(`/dashboard/knowledge/search?q=${encodeURIComponent(term)}`);
                        doSearch(term);
                      }}
                      className="px-3 py-1.5 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 text-sm rounded-lg hover:bg-primary-50 hover:text-primary-600 transition-colors"
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {results.map((result) => (
              <button
                key={result.id}
                onClick={() => handleResultClick(result)}
                className="w-full flex items-start gap-4 p-4 bg-white dark:bg-surface-800 rounded-xl shadow-sm hover:shadow-md transition-all text-left group"
              >
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center ${
                  result.node_type === 'article' || result.node_type === 'video'
                    ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
                }`}>
                  {getNodeIcon(result.node_type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 transition-colors truncate">
                      {result.title}
                    </h3>
                    <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-surface-100 dark:bg-surface-700 text-surface-500 rounded">
                      {getNodeTypeBadge(result.node_type)}
                    </span>
                  </div>
                  {result.description && (
                    <p className="text-xs text-surface-500 mt-1 line-clamp-2">
                      {result.description}
                    </p>
                  )}
                  {result.body_region && result.body_region.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {result.body_region.slice(0, 3).map((region, idx) => (
                        <span
                          key={idx}
                          className="px-1.5 py-0.5 text-[10px] bg-rose-50 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400 rounded"
                        >
                          {region}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Initial state */}
        {!loading && !searched && (
          <div className="text-center py-12">
            <Search size={48} className="mx-auto text-surface-300 mb-4" />
            <p className="text-surface-500">输入关键词开始搜索</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary-500" />
      </div>
    }>
      <SearchResultsContent />
    </Suspense>
  );
}
