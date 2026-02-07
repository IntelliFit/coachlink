'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Video, Clock, Tag, ChevronRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';

type KnowledgeNode = {
  id: string;
  title: string;
  description: string | null;
  node_type: 'domain' | 'category' | 'topic' | 'article' | 'video';
  icon: string | null;
  content: {
    body?: string;
    video_url?: string;
    duration_minutes?: number;
    tags?: string[];
    related_tools?: string[];
    difficulty?: number;
  } | null;
  metadata: {
    author?: string;
    created_at?: string;
    updated_at?: string;
    views?: number;
  } | null;
  body_region: string[] | null;
  is_free: boolean;
  articles?: any[]; // Linked coach articles
};

export default function NodeDetailPage() {
  const params = useParams();
  const router = useRouter();
  const nodeId = params?.id as string;

  const [node, setNode] = useState<KnowledgeNode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNode = async () => {
      try {
        const res = await fetch(`/api/knowledge/nodes/${nodeId}`);
        const json = await res.json();
        if (json.node) {
          // Combine node data with articles
          setNode({ ...json.node, articles: json.articles || [] });
        }
      } catch (error) {
        console.error('Failed to fetch node:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchNode();
  }, [nodeId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 pb-32">
        <div className="sticky top-0 z-20 bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-200 dark:border-surface-700">
          <div className="flex items-center gap-4 px-4 py-3 max-w-3xl mx-auto">
            <div className="w-8 h-8 bg-surface-200 dark:bg-surface-700 rounded-lg animate-pulse" />
            <div className="h-6 w-48 bg-surface-200 dark:bg-surface-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="px-4 py-6 max-w-3xl mx-auto space-y-4">
          <div className="h-48 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />
          <div className="h-32 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!node) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-surface-500">内容不存在</p>
          <button onClick={() => router.back()} className="mt-4 text-primary-500">
            返回
          </button>
        </div>
      </div>
    );
  }

  const relatedTools = node.content?.related_tools || [];
  const matchedTools = STUDENT_TOOLBOX_LINKS.filter(tool => 
    relatedTools.includes(tool.key)
  );

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 pb-32">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-surface-50/80 dark:bg-surface-900/80 backdrop-blur-lg border-b border-surface-200 dark:border-surface-700">
        <div className="flex items-center gap-4 px-4 py-3 max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="p-2 -ml-2 text-surface-600 dark:text-surface-400 hover:bg-surface-100 dark:hover:bg-surface-800 rounded-xl transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <h1 className="text-lg font-black text-surface-900 dark:text-surface-100 truncate">
            {node.title}
          </h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        {/* Video Embed (if video node) */}
        {node.node_type === 'video' && node.content?.video_url && (
          <div className="aspect-video bg-black rounded-xl overflow-hidden">
            <iframe
              src={node.content.video_url}
              className="w-full h-full"
              allowFullScreen
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            />
          </div>
        )}

        {/* Meta Info */}
        <div className="flex flex-wrap items-center gap-3 text-sm text-surface-500">
          {node.node_type === 'video' && (
            <span className="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg">
              <Video size={14} />
              视频
            </span>
          )}
          {node.node_type === 'article' && (
            <span className="flex items-center gap-1 px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg">
              <BookOpen size={14} />
              文章
            </span>
          )}
          {node.content?.duration_minutes && (
            <span className="flex items-center gap-1">
              <Clock size={14} />
              约 {node.content.duration_minutes} 分钟
            </span>
          )}
          {node.is_free && (
            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-bold rounded-full">
              免费
            </span>
          )}
          {node.content?.difficulty && (
            <span className="text-xs">
              难度 {'⭐'.repeat(node.content.difficulty)}
            </span>
          )}
        </div>

        {/* Description */}
        {node.description && (
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4">
            <p className="text-sm text-amber-800 dark:text-amber-200">{node.description}</p>
          </div>
        )}

        {/* Related Articles (New Section) */}
        {node.articles && node.articles.length > 0 && (
          <div className="space-y-3">
             <div className="flex items-center gap-2 mb-2">
                <span className="text-xl">📚</span>
                <h3 className="text-lg font-black text-surface-900 dark:text-surface-100">相关文章</h3>
             </div>
             <div className="grid gap-3 sm:grid-cols-2">
                {node.articles.map((article: any) => (
                  <Link
                    key={article.id}
                    href={`/coach/content/${article.id}`}
                    className="group bg-white dark:bg-surface-800 p-3 rounded-[20px] border border-surface-200 dark:border-surface-700 hover:border-primary-200 dark:hover:border-primary-800 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 flex gap-4 overflow-hidden"
                  >
                     {article.thumbnail_url && (
                        <div className="w-20 h-20 shrink-0 rounded-xl overflow-hidden bg-surface-100">
                           <img src={article.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        </div>
                     )}
                     <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <h4 className="font-bold text-surface-900 dark:text-surface-100 truncate group-hover:text-primary transition-colors mb-1">
                           {article.title}
                        </h4>
                        <div className="flex items-center gap-2 text-xs text-surface-400 mb-2">
                           <Clock size={12} />
                           <span>{new Date(article.created_at).toLocaleDateString()}</span>
                        </div>
                        {article.coaches && (
                           <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-surface-100 overflow-hidden">
                                 {article.coaches.avatar_url ? (
                                    <img src={article.coaches.avatar_url} alt="" className="w-full h-full object-cover" />
                                 ) : (
                                    <div className="w-full h-full bg-primary-100 text-primary-600 flex items-center justify-center text-[10px] font-bold">
                                       {article.coaches.name[0]}
                                    </div>
                                 )}
                              </div>
                              <span className="text-xs font-medium text-surface-500">{article.coaches.name}</span>
                           </div>
                        )}
                     </div>
                  </Link>
                ))}
             </div>
          </div>
        )}

        {/* Content Body */}
        {node.content?.body && (
          <div className="bg-white dark:bg-surface-800 rounded-xl p-6 shadow-sm">
            <div 
              className="prose dark:prose-invert prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: node.content.body }}
            />
          </div>
        )}

        {/* Tags */}
        {node.content?.tags && node.content.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {node.content.tags.map((tag, idx) => (
              <span
                key={idx}
                className="flex items-center gap-1 px-2 py-1 bg-surface-100 dark:bg-surface-800 text-surface-600 dark:text-surface-400 text-xs rounded-lg"
              >
                <Tag size={12} />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Related Tools */}
        {matchedTools.length > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-surface-700 dark:text-surface-200 mb-3">
              📦 相关工具
            </h3>
            <div className="space-y-2">
              {matchedTools.map((tool) => (
                <Link
                  key={tool.key}
                  href={tool.url}
                  className="flex items-center gap-3 p-3 bg-surface-50 dark:bg-surface-700 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded-xl transition-colors group"
                >
                  <i className={`${tool.icon} text-primary-500`} />
                  <span className="flex-1 text-sm font-semibold text-surface-700 dark:text-surface-200 group-hover:text-primary-600">
                    {tool.label}
                  </span>
                  <ExternalLink size={14} className="text-surface-400 group-hover:text-primary-500" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Body Region Links */}
        {node.body_region && node.body_region.length > 0 && (
          <div className="bg-white dark:bg-surface-800 rounded-xl p-4 shadow-sm">
            <h3 className="text-sm font-bold text-surface-700 dark:text-surface-200 mb-3">
              🧍 相关部位
            </h3>
            <div className="flex flex-wrap gap-2">
              {node.body_region.map((region, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(`/dashboard/knowledge/body-map?region=${region}`)}
                  className="px-3 py-1.5 bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 text-sm font-semibold rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                >
                  {region}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Placeholder for empty content */}
        {!node.content?.body && !node.content?.video_url && (!node.articles || node.articles.length === 0) && (
          <div className="text-center py-12 bg-white dark:bg-surface-800 rounded-xl">
            <BookOpen size={48} className="mx-auto text-surface-300 mb-4" />
            <p className="text-surface-500">内容正在编写中</p>
            <p className="text-surface-400 text-sm mt-1">敬请期待...</p>
          </div>
        )}
      </div>
    </div>
  );
}
