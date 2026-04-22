'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { BookOpen, ChevronRight, FileText, Video, Layers, User, ArrowLeft } from 'lucide-react';

// Aero design system constants - 与知识库首页一致
const AERO_CONTAINER = "max-w-2xl mx-auto px-4";
const AERO_CARD = "rounded-3xl border border-surface-100 dark:border-surface-800 bg-surface-0 dark:bg-surface-900 shadow-[0_1px_0_rgba(15,23,42,0.02)] hover:shadow-[0_18px_50px_rgba(15,23,42,0.08)] transition-[box-shadow,transform]";
const AERO_TITLE = "text-xl font-bold tracking-tight text-surface-900 dark:text-surface-0";
const AERO_SUBTITLE = "text-sm text-surface-600 dark:text-surface-400 mt-1";

type KnowledgeNode = {
  id: string;
  title: string;
  description: string | null;
  node_type: 'domain' | 'category' | 'topic' | 'article' | 'video' | 'coach_article';
  icon: string | null;
  children?: KnowledgeNode[];
  thumbnail_url?: string;
  coach?: { id: string; name: string; avatar_url?: string };
  is_coach_content?: boolean;
  required_tier?: number;
};

const NODE_TYPE_ICONS: Record<string, React.ReactNode> = {
  domain: <Layers size={18} />,
  category: <BookOpen size={18} />,
  topic: <FileText size={18} />,
  article: <FileText size={18} />,
  video: <Video size={18} />,
  coach_article: <User size={18} />,
};

const NODE_TYPE_LABELS: Record<string, string> = {
  domain: '领域',
  category: '分类',
  topic: '主题',
  article: '文章',
  video: '视频',
  coach_article: '教练文章',
};

export default function PillarDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pillarId = params?.id as string;

  const [pillar, setPillar] = useState<KnowledgeNode | null>(null);
  const [children, setChildren] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPillarData = async () => {
      try {
        // Fetch node details
        const nodeRes = await fetch(`/api/knowledge/nodes/${pillarId}`);
        console.log('Node API status:', nodeRes.status);
        
        if (!nodeRes.ok) {
          console.error('Node API error:', await nodeRes.text());
        } else {
          const nodeJson = await nodeRes.json();
          console.log('Node data:', nodeJson);
          if (nodeJson.node) {
            setPillar(nodeJson.node);
          }
        }

        // Fetch children
        const childrenRes = await fetch(`/api/knowledge/nodes?parent_id=${pillarId}`);
        console.log('Children API status:', childrenRes.status);
        
        if (!childrenRes.ok) {
          console.error('Children API error:', await childrenRes.text());
        } else {
          const childrenJson = await childrenRes.json();
          console.log('Children data:', childrenJson);
          const nodes = childrenJson.nodes || [];
          const articles = childrenJson.articles || [];
          setChildren([...nodes, ...articles]);
        }
      } catch (error) {
        console.error('Failed to fetch pillar data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchPillarData();
  }, [pillarId]);

  const handleNodeClick = (node: KnowledgeNode) => {
    if (node.is_coach_content || node.node_type === 'coach_article') {
      router.push(`/coach/content/${node.id}`);
    } else if (node.node_type === 'article' || node.node_type === 'video') {
      router.push(`/dashboard/knowledge/nodes/${node.id}`);
    } else {
      router.push(`/dashboard/knowledge/pillars/${node.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen">
        {/* 背景装饰 */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 dark:from-primary-900/20 to-transparent" />
        
        <div className="relative z-10">
          <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
            <div className="h-20 bg-surface-100 dark:bg-surface-800 rounded-3xl animate-pulse mb-6" />
            <div className="space-y-3">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-20 bg-surface-100 dark:bg-surface-800 rounded-3xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!pillar) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <BookOpen className="w-12 h-12 mx-auto text-surface-400 mb-4" />
          <p className="text-surface-500">内容不存在</p>
          <button onClick={() => router.back()} className="mt-4 text-primary-600 font-medium">
            返回
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-24">
      {/* 背景装饰 - 与知识库首页一致 */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-primary-100/30 dark:from-primary-900/20 to-transparent" />

      <div className="relative z-10">
        {/* Header */}
        <div className={`${AERO_CONTAINER} pt-6 pb-4`}>
          <button
            onClick={() => router.back()}
            className="flex items-center gap-1 text-surface-500 hover:text-surface-700 mb-4 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm font-medium">返回</span>
          </button>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-2xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              {NODE_TYPE_ICONS[pillar.node_type] || <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />}
            </div>
            <div>
              <h1 className={AERO_TITLE}>{pillar.title}</h1>
              <p className={AERO_SUBTITLE}>{pillar.description || NODE_TYPE_LABELS[pillar.node_type]}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className={AERO_CONTAINER}>
          {children.length === 0 ? (
            <div className={`${AERO_CARD} py-12 text-center`}>
              <BookOpen className="w-12 h-12 mx-auto text-surface-300 mb-4" />
              <p className="text-surface-500">暂无内容</p>
              <p className="text-surface-400 text-sm mt-1">内容正在建设中...</p>
            </div>
          ) : (
            <div className="space-y-2">
              {children.map((node) => (
                <button
                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className={`${AERO_CARD} w-full flex items-center gap-4 p-3.5 text-left active:scale-[0.98]`}
                >
                  {node.is_coach_content && node.thumbnail_url ? (
                    <div className="shrink-0 w-16 h-16 rounded-2xl overflow-hidden bg-surface-100">
                      <img src={node.thumbnail_url} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform duration-300" />
                    </div>
                  ) : (
                    <div className={`shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center ${
                      node.node_type === 'article' || node.node_type === 'video'
                        ? 'bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400'
                        : node.node_type === 'coach_article'
                        ? 'bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400'
                        : 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400'
                    }`}>
                      {node.icon ? (
                        <span className="text-xl">{node.icon}</span>
                      ) : (
                        NODE_TYPE_ICONS[node.node_type] || <BookOpen size={20} />
                      )}
                    </div>
                  )}
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-surface-900 dark:text-surface-100 truncate">
                        {node.title}
                      </h3>
                      <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded-full ${
                        node.is_coach_content 
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                          : 'bg-surface-100 dark:bg-surface-800 text-surface-500'
                      }`}>
                        {NODE_TYPE_LABELS[node.node_type] || '内容'}
                      </span>
                      {node.required_tier && node.required_tier > 0 && (
                        <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded-full">
                          付费
                        </span>
                      )}
                    </div>
                    {node.description && (
                      <p className="text-xs text-surface-500 mt-1 line-clamp-1">
                        {node.description}
                      </p>
                    )}
                    {node.is_coach_content && node.coach && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <div className="w-4 h-4 rounded-full bg-surface-100 overflow-hidden">
                          {node.coach.avatar_url ? (
                            <img src={node.coach.avatar_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-primary-100 text-primary-600 flex items-center justify-center text-[8px] font-bold">
                              {node.coach.name?.[0]}
                            </div>
                          )}
                        </div>
                        <span className="text-[10px] text-surface-400">{node.coach.name}</span>
                      </div>
                    )}
                  </div>
                  
                  <ChevronRight size={18} className="shrink-0 text-surface-300" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
