'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Filter, Search } from 'lucide-react';
import BodyMapCanvas, { BodyRegion, BODY_REGION_LABELS, type BodyMapSelectionDetail } from '@/components/knowledge/BodyMap/BodyMapCanvas';
import BodyMapModeSwitch from '@/components/knowledge/BodyMap/BodyMapModeSwitch';
import { buildGeneratedBodyMapContent } from '@/lib/bodyMapGeneratedContent';

type BodyMapMode = 'screening' | 'training';

type KnowledgeNode = {
  id: string;
  title: string;
  description: string | null;
  body_region: string[];
  difficulty: number;
  is_free: boolean;
};

type SelectedAnatomy = BodyMapSelectionDetail & { region: BodyRegion };

export default function BodyMapPage() {
  const router = useRouter();
  const [mode, setMode] = useState<BodyMapMode>('screening');
  const [selectedRegion, setSelectedRegion] = useState<BodyRegion | null>(null);
  const [selectedAnatomy, setSelectedAnatomy] = useState<SelectedAnatomy | null>(null);
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(false);

  // Fetch nodes when region is selected
  useEffect(() => {
    if (!selectedRegion) {
      setNodes([]);
      return;
    }

    const fetchNodes = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/knowledge/nodes?body_region=${selectedRegion}`);
        const json = await res.json();
        setNodes(json.nodes || []);
      } catch (error) {
        console.error('Failed to fetch nodes:', error);
        setNodes([]);
      } finally {
        setLoading(false);
      }
    };

    fetchNodes();
  }, [selectedRegion]);

  const handleRegionClick = (region: BodyRegion, detail?: BodyMapSelectionDetail) => {
    const isSameAnatomy =
      region === selectedRegion &&
      detail?.anatomyKey &&
      detail.anatomyKey === selectedAnatomy?.anatomyKey;

    if (isSameAnatomy) {
      setSelectedRegion(null);
      setSelectedAnatomy(null);
      return;
    }
    setSelectedRegion(region);
    setSelectedAnatomy(detail ? { ...detail, region } : null);
  };

  const fallbackNodes = selectedRegion && selectedAnatomy
    ? buildGeneratedBodyMapContent({
        mode,
        anatomyKey: selectedAnatomy.anatomyKey,
        anatomyLabel: selectedAnatomy.anatomyLabel,
        regionLabel: BODY_REGION_LABELS[selectedRegion],
      })
    : [];

  const displayNodes = nodes.length > 0 ? nodes : fallbackNodes;
  const hasGeneratedNodes = nodes.length === 0 && fallbackNodes.length > 0;

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
          <h1 className="text-lg font-black text-surface-900 dark:text-surface-100">
            人体地图
          </h1>
        </div>
      </div>

      <div className="px-4 py-6 max-w-3xl mx-auto space-y-6">
        {/* Mode Switch */}
        <BodyMapModeSwitch mode={mode} onChange={setMode} />

        {/* Body Map */}
        <div className="bg-white dark:bg-surface-800 rounded-2xl p-6 shadow-sm">
          <BodyMapCanvas
            mode={mode}
            selectedRegion={selectedRegion}
            onRegionClick={handleRegionClick}
          />
        </div>

        {/* Results */}
        {selectedRegion && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-surface-700 dark:text-surface-200">
                {selectedAnatomy?.anatomyLabel || BODY_REGION_LABELS[selectedRegion]} 相关内容
              </h2>
              <span className="text-xs text-surface-500">
                {loading ? '加载中...' : `${displayNodes.length} 个结果`}
              </span>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-20 bg-surface-100 dark:bg-surface-800 rounded-xl animate-pulse" />
                ))}
              </div>
            ) : displayNodes.length === 0 ? (
              <div className="text-center py-8 text-surface-400">
                <Filter size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">该部位暂无相关内容</p>
                <p className="text-xs mt-1">内容正在建设中...</p>
              </div>
            ) : (
              <div className="space-y-3">
                {hasGeneratedNodes && (
                  <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-700/60 dark:bg-amber-900/20 dark:text-amber-200">
                    当前展示的是自动生成的占位内容，后续可替换为正式知识库条目。
                  </div>
                )}
                {displayNodes.map((node) => (
                  <button
                    key={node.id}
                    onClick={() => {
                      if (String(node.id).startsWith('generated:')) return;
                      router.push(`/dashboard/knowledge/nodes/${node.id}`);
                    }}
                    className="w-full flex items-center gap-4 p-4 bg-white dark:bg-surface-800 rounded-xl shadow-sm hover:shadow-md transition-all text-left"
                  >
                    <div className="flex-1">
                      <h3 className="font-bold text-surface-900 dark:text-surface-100">
                        {node.title}
                      </h3>
                      {node.description && (
                        <p className="text-xs text-surface-500 mt-1 line-clamp-2">
                          {node.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-2">
                        {node.is_free && (
                          <span className="px-2 py-0.5 text-[10px] font-bold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full">
                            免费
                          </span>
                        )}
                        <span className="text-[10px] text-surface-400">
                          难度 {'⭐'.repeat(node.difficulty)}
                        </span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Hint when no region selected */}
        {!selectedRegion && (
          <div className="text-center py-8 text-surface-400">
            <p className="text-sm">👆 点击人体图上的部位</p>
            <p className="text-xs mt-1">
              {mode === 'screening' ? '查看该部位的筛查与缓解方案' : '查看该部位的训练动作'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
