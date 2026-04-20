'use client';

import React, { useState, useEffect } from 'react';
import { ChevronRight, FolderTree } from 'lucide-react';
import { ProgressSpinner } from 'primereact/progressspinner';

interface KnowledgeNode {
  id: string;
  title: string;
  slug: string | null;
  node_type: string;
  children?: KnowledgeNode[];
}

interface NodeSelectorProps {
  value: string | null;
  onChange: (nodeId: string | null, nodePath: string[]) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

/**
 * NodeSelector - 知识库节点选择器
 * 用于选择文章发布的父节点（分类/主题）
 */
export default function NodeSelector({
  value,
  onChange,
  placeholder = '选择所属分类',
  label = '发布到',
  className = '',
}: NodeSelectorProps) {
  const [nodes, setNodes] = useState<KnowledgeNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPath, setSelectedPath] = useState<KnowledgeNode[]>([]);
  const [currentLevel, setCurrentLevel] = useState<KnowledgeNode[]>([]);

  // Retrieve only container nodes (domain, category, topic)
  const filterContainerNodes = (nodes: KnowledgeNode[]): KnowledgeNode[] => {
    return nodes
      .filter(node => ['domain', 'category', 'topic'].includes(node.node_type))
      .map(node => ({
        ...node,
        children: node.children ? filterContainerNodes(node.children) : []
      }));
  };

  // Fetch knowledge tree on mount
  useEffect(() => {
    const fetchTree = async () => {
      try {
        const res = await fetch('/api/knowledge/tree');
        const json = await res.json();
        const tree = json.tree || []; // Note: API returns { tree: ... }
        const containerTree = filterContainerNodes(tree);
        setNodes(containerTree);
        setCurrentLevel(containerTree);
      } catch (error) {
        console.error('Failed to fetch knowledge tree:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchTree();
  }, []);

  // Find selected node info
  useEffect(() => {
    if (value && nodes.length > 0) {
      // We need to find the node even if it's not in our filtered tree?
      // Actually, if the user selected an article as parent (which shouldn't happen), we might have issues.
      // But for now assume valid container ID.
      const path = findNodePath(nodes, value);
      setSelectedPath(path);
    }
  }, [value, nodes]);

  // Recursive function to find node path
  const findNodePath = (tree: KnowledgeNode[], targetId: string): KnowledgeNode[] => {
    for (const node of tree) {
      if (node.id === targetId) {
        return [node];
      }
      if (node.children) {
        const childPath = findNodePath(node.children, targetId);
        if (childPath.length > 0) {
          return [node, ...childPath];
        }
      }
    }
    return [];
  };

  const handleNodeClick = (node: KnowledgeNode) => {
    // Navigate into children if they exist
    if (node.children && node.children.length > 0) {
      setSelectedPath([...selectedPath, node]);
      setCurrentLevel(node.children);
    } else {
      // Select this node as the target
      const newPath = [...selectedPath, node];
      setSelectedPath(newPath);
      onChange(node.id, newPath.map(n => n.title));
      setIsOpen(false);
    }
  };

  const handleSelectCurrent = () => {
    // Select the last node in path (current folder)
    if (selectedPath.length > 0) {
      const lastNode = selectedPath[selectedPath.length - 1];
      onChange(lastNode.id, selectedPath.map(n => n.title));
      setIsOpen(false);
    }
  };

  const handleGoBack = () => {
    if (selectedPath.length > 0) {
      const newPath = selectedPath.slice(0, -1);
      setSelectedPath(newPath);
      
      if (newPath.length === 0) {
        setCurrentLevel(nodes);
      } else {
        const parent = newPath[newPath.length - 1];
        setCurrentLevel(parent.children || []);
      }
    }
  };

  const handleClear = () => {
    onChange(null, []);
    setSelectedPath([]);
    setCurrentLevel(nodes);
  };

  const getNodeTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      domain: '领域',
      category: '分类',
      topic: '主题',
      article: '文章',
      video: '视频',
    };
    return labels[type] || type;
  };

  const getNodeTypeColor = (type: string) => {
    const colors: Record<string, string> = {
      domain: 'bg-purple-100 text-purple-700',
      category: 'bg-blue-100 text-blue-700',
      topic: 'bg-green-100 text-green-700',
    };
    return colors[type] || 'bg-surface-100 text-surface-700';
  };

  return (
    <div className={`relative ${className}`}>
      {label && (
        <label className="block text-xs font-bold uppercase tracking-widest text-surface-400 px-1 mb-2">
          <FolderTree size={14} className="inline mr-1" />
          {label}
        </label>
      )}

      {/* Selected value display */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={loading}
        className="w-full flex items-center justify-between px-4 py-3 bg-surface-50 dark:bg-surface-800 rounded-xl border border-surface-200 dark:border-surface-700 hover:border-primary-300 transition-colors text-left"
      >
        {loading ? (
          <span className="flex items-center gap-2 text-surface-400">
            <ProgressSpinner style={{ width: '20px', height: '20px' }} strokeWidth="4" />
          </span>
        ) : selectedPath.length > 0 ? (
          <span className="flex items-center gap-1 text-sm text-surface-700 dark:text-surface-300">
            {selectedPath.map((node, idx) => (
              <React.Fragment key={node.id}>
                {idx > 0 && <ChevronRight size={14} className="text-surface-300" />}
                <span className="font-medium">{node.title}</span>
              </React.Fragment>
            ))}
          </span>
        ) : (
          <span className="text-surface-400">{placeholder}</span>
        )}
        <ChevronRight size={18} className={`text-surface-400 transition-transform ${isOpen ? 'rotate-90' : ''}`} />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-surface-800 rounded-xl shadow-xl border border-surface-200 dark:border-surface-700 z-50 overflow-hidden">
          {/* Breadcrumb navigation */}
          {selectedPath.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 bg-surface-50 dark:bg-surface-900 border-b border-surface-200 dark:border-surface-700">
              <div className="flex items-center gap-2 overflow-hidden">
                <button
                  onClick={handleGoBack}
                  className="text-xs text-primary-600 hover:underline font-medium shrink-0"
                >
                  ← 返回
                </button>
                <span className="text-xs text-surface-400">|</span>
                <span className="text-xs text-surface-500 truncate">
                  {selectedPath.map(n => n.title).join(' / ')}
                </span>
              </div>
            </div>
          )}

          {/* Wrapper for list */}
          <div className="max-h-60 overflow-y-auto">
             {/* Select Current Button (Prominent) */}
             {selectedPath.length > 0 && (
                <button
                  onClick={handleSelectCurrent}
                  className="w-full flex items-center gap-2 px-4 py-2 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors border-b border-primary-100 dark:border-primary-800/30"
                >
                  <span className="text-xs font-bold">📍 选中当前分类:</span>
                  <span className="text-sm font-bold truncate">{selectedPath[selectedPath.length - 1].title}</span>
                </button>
             )}

            {currentLevel.length === 0 ? (
              <div className="px-4 py-6 text-center text-surface-400 text-sm">
                <div>此分类下暂无子节点</div>
                {/* Fallback instruction */}
                {selectedPath.length > 0 && (
                   <div className="text-xs text-surface-300 mt-1">
                      您可以直接“选中当前分类”
                   </div>
                )}
              </div>
            ) : (
              currentLevel.map(node => (
                <button

                  key={node.id}
                  onClick={() => handleNodeClick(node)}
                  className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-50 dark:hover:bg-surface-700 transition-colors border-b border-surface-100 dark:border-surface-700 last:border-b-0"
                >
                  <div className="flex items-center gap-3">
                    <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${getNodeTypeColor(node.node_type)}`}>
                      {getNodeTypeLabel(node.node_type)}
                    </span>
                    <span className="text-sm font-medium text-surface-800 dark:text-surface-200">
                      {node.title}
                    </span>
                  </div>
                  {node.children && node.children.length > 0 && (
                    <ChevronRight size={16} className="text-surface-400" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between px-4 py-2 bg-surface-50 dark:bg-surface-900 border-t border-surface-200 dark:border-surface-700">
            {selectedPath.length > 0 && (
              <button
                onClick={handleSelectCurrent}
                className="text-xs text-primary-600 hover:underline font-bold"
              >
                选择当前分类
              </button>
            )}
            {value && (
              <button
                onClick={handleClear}
                className="text-xs text-red-500 hover:underline ml-auto"
              >
                清除选择
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
