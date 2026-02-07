'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronRight, FileText, Video, Layers, User } from 'lucide-react';

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

// Icon mapping for node types
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
        // Fetch the pillar node itself
        const nodeRes = await fetch(`/api/knowledge/nodes/${pillarId}`);
        const nodeJson = await nodeRes.json();
        if (nodeJson.node) {
          setPillar(nodeJson.node);
        }

        // Fetch children of this pillar (now includes both nodes and articles)
        const childrenRes = await fetch(`/api/knowledge/nodes?parent_id=${pillarId}`);
        const childrenJson = await childrenRes.json();
        
        // Merge knowledge_nodes and coach_contents (articles)
        const nodes = childrenJson.nodes || [];
        const articles = childrenJson.articles || [];
        setChildren([...nodes, ...articles]);
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
      // Coach article -> go to coach content detail page
      router.push(`/coach/content/${node.id}`);
    } else if (node.node_type === 'article' || node.node_type === 'video') {
      router.push(`/dashboard/knowledge/nodes/${node.id}`);
    } else {
      router.push(`/dashboard/knowledge/pillars/${node.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface-50 dark:bg-surface-900 pb-32">
        {/* Header skeleton */}
        <div className="bg-gradient-to-br from-primary-600 to-primary-500 px-4 pt-12 pb-8">
          <div className="max-w-3xl mx-auto">
            <div className="h-8 w-32 bg-white/20 rounded-lg mb-4 animate-pulse" />
            <div className="h-6 w-48 bg-white/20 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="px-4 py-6 max-w-3xl mx-auto space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!pillar) {
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

  return (
    <div className="min-h-screen bg-surface-50 dark:bg-surface-900 pb-32">
      {/* Header */}
      <div className="bg-gradient-to-br from-primary-600 to-primary-500 text-white px-4 pt-12 pb-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/80 hover:text-white mb-4 -ml-1"
          >
            <ArrowLeft size={18} />
            <span className="text-sm">返回</span>
          </button>
          
          <div className="flex items-center gap-3">
            <div className="p-3 bg-white/20 backdrop-blur rounded-xl">
              {NODE_TYPE_ICONS[pillar.node_type] || <BookOpen size={24} />}
            </div>
            <div>
              <span className="text-xs text-white/60">{NODE_TYPE_LABELS[pillar.node_type]}</span>
              <h1 className="text-2xl font-black">{pillar.title}</h1>
            </div>
          </div>
          
          {pillar.description && (
            <p className="mt-4 text-white/80 text-sm">{pillar.description}</p>
          )}
        </div>
      </div>

      {/* Children List */}
      <div className="px-4 py-6 max-w-3xl mx-auto">
        {children.length === 0 ? (
          <div className="text-center py-12">
            <BookOpen size={48} className="mx-auto text-surface-300 mb-4" />
            <p className="text-surface-500">暂无内容</p>
            <p className="text-surface-400 text-sm mt-1">内容正在建设中...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map((node) => (
              <button
                key={node.id}
                onClick={() => handleNodeClick(node)}
                className="w-full flex items-center gap-4 p-4 bg-white dark:bg-surface-800 rounded-xl shadow-sm hover:shadow-md transition-all text-left group"
              >
                {/* Thumbnail or Icon */}
                {node.is_coach_content && node.thumbnail_url ? (
                  <div className="shrink-0 w-16 h-16 rounded-xl overflow-hidden bg-surface-100">
                    <img src={node.thumbnail_url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                ) : (
                  <div className={`shrink-0 w-11 h-11 rounded-xl flex items-center justify-center ${
                    node.node_type === 'article' || node.node_type === 'video'
                      ? 'bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                      : node.node_type === 'coach_article'
                      ? 'bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                      : 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400'
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
                    <h3 className="font-bold text-surface-900 dark:text-surface-100 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors truncate">
                      {node.title}
                    </h3>
                    <span className={`shrink-0 px-1.5 py-0.5 text-[10px] font-bold rounded ${
                      node.is_coach_content 
                        ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400' 
                        : 'bg-surface-100 dark:bg-surface-700 text-surface-500'
                    }`}>
                      {NODE_TYPE_LABELS[node.node_type] || '内容'}
                    </span>
                    {node.required_tier && node.required_tier > 0 && (
                      <span className="shrink-0 px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 rounded">
                        付费
                      </span>
                    )}
                  </div>
                  {node.description && (
                    <p className="text-xs text-surface-500 mt-1 line-clamp-1">
                      {node.description}
                    </p>
                  )}
                  {/* Coach info for coach articles */}
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
                
                <ChevronRight size={18} className="shrink-0 text-surface-300 group-hover:text-primary-500 transition-colors" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
