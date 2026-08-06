'use client';

import React, { useCallback, useMemo, useEffect } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
  Handle,
  Position,
  MarkerType,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
import 'reactflow/dist/style.css';
import { useRouter } from 'next/navigation';

export type KnowledgeMindMapNode = {
  id: string;
  title: string;
  description?: string | null;
  node_type?: string;
  children?: KnowledgeMindMapNode[];
};

type KnowledgeMindMapProps = {
  data: KnowledgeMindMapNode[];
  onNodeClick?: (node: KnowledgeMindMapNode) => void;
  readOnly?: boolean;
  height?: number;
};

// Custom node component with proper handles
const KnowledgeNodeComponent = ({ data }: { data: { label: string; nodeType: string; description?: string; isRoot?: boolean; hasChildren?: boolean } }) => {
  const getBgColor = () => {
    switch (data.nodeType) {
      case 'domain': return 'bg-gradient-to-br from-primary-500 to-primary-600 text-white';
      case 'category': return 'bg-gradient-to-br from-blue-400 to-blue-500 text-white';
      case 'topic': return 'bg-gradient-to-br from-emerald-400 to-emerald-500 text-white';
      case 'article': return 'bg-white dark:bg-surface-700 border-2 border-amber-400 text-surface-800 dark:text-surface-100';
      case 'video': return 'bg-white dark:bg-surface-700 border-2 border-rose-400 text-surface-800 dark:text-surface-100';
      case 'coach_article': return 'bg-white dark:bg-surface-700 border-2 border-green-400 text-surface-800 dark:text-surface-100';
      default: return 'bg-surface-100 dark:bg-surface-700 text-surface-800 dark:text-surface-100';
    }
  };

  return (
    <div className={`relative px-4 py-3 rounded-xl shadow-lg cursor-pointer hover:scale-105 transition-transform ${getBgColor()}`}>
      {/* Left handle (target) - only if not root */}
      {!data.isRoot && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3 !bg-surface-400 !border-2 !border-white"
        />
      )}
      
      <div className="font-bold text-sm whitespace-nowrap max-w-56 truncate">{data.label}</div>
      {data.description && (
        <div className="text-xs opacity-80 mt-1 max-w-56 truncate">{data.description}</div>
      )}
      
      {/* Right handle (source) - only if has children */}
      {data.hasChildren && (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3 !bg-surface-400 !border-2 !border-white"
        />
      )}
    </div>
  );
};

const nodeTypes = {
  knowledge: KnowledgeNodeComponent,
};

// Use dagre for automatic layout
const getLayoutedElements = (nodes: Node[], edges: Edge[], direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph();
  dagreGraph.setDefaultEdgeLabel(() => ({}));

  // Increased spacing for "less squeezed" look
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ 
    rankdir: direction,
    ranksep: 180, // Horizontal distance between layers
    nodesep: 60   // Vertical distance between nodes
  });

  nodes.forEach((node) => {
    // Approximate node dimensions including padding/shadow
    dagreGraph.setNode(node.id, { width: 250, height: 80 });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const layoutedNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    
    // Dagre returns center point, reactflow needs top-left
    return {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      // We are shifting the dagre node position (center-based) to the top left
      position: {
        x: nodeWithPosition.x - 250 / 2,
        y: nodeWithPosition.y - 80 / 2,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
};

// Flatten tree structure to nodes and edges first
function flattenTree(data: KnowledgeMindMapNode[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  function processNode(item: KnowledgeMindMapNode, parentId: string | null) {
    const nodeId = item.id;
    const hasChildren = item.children && item.children.length > 0;
    
    nodes.push({
      id: nodeId,
      type: 'knowledge',
      position: { x: 0, y: 0 }, // Initial position, will be set by dagre
      data: {
        label: item.title,
        nodeType: item.node_type || 'domain',
        description: item.description,
        originalData: item,
        isRoot: !parentId,
        hasChildren,
      },
      // Hidden by default, unhidden by layout
      hidden: false, 
    });

    if (parentId) {
      edges.push({
        id: `e-${parentId}-${nodeId}`,
        source: parentId,
        target: nodeId,
        type: 'smoothstep', // 'smoothstep' for better orthogonal lines
        style: { stroke: '#94a3b8', strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#94a3b8' },
      });
    }

    if (item.children) {
      item.children.forEach(child => processNode(child, nodeId));
    }
  }

  data.forEach(root => processNode(root, null));
  return { nodes, edges };
}

export default function KnowledgeMindMap({
  data,
  onNodeClick,
  readOnly = false,
  height = 600,
}: KnowledgeMindMapProps) {
  const router = useRouter();
  
  // 1. Flatten tree
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    return flattenTree(data);
  }, [data]);

  // 2. Apply Dagre layout
  const { nodes: layoutedNodes, edges: layoutedEdges } = useMemo(() => {
    return getLayoutedElements(initialNodes, initialEdges);
  }, [initialNodes, initialEdges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(layoutedNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(layoutedEdges);

  // Update layout when data changes
  useEffect(() => {
    const { nodes: flatNodes, edges: flatEdges } = flattenTree(data);
    const { nodes: laidOutNodes, edges: laidOutEdges } = getLayoutedElements(flatNodes, flatEdges);
    setNodes(laidOutNodes);
    setEdges(laidOutEdges);
  }, [data, setNodes, setEdges]);

  const handleNodeClick = useCallback((event: React.MouseEvent, node: Node) => {
    if (readOnly) return;
    const originalData = node.data.originalData as KnowledgeMindMapNode;
    if (onNodeClick) {
      onNodeClick(originalData);
    } else {
      const nodeType = node.data.nodeType;
      if (nodeType === 'coach_article') {
        // Coach articles go to coach content detail page
        router.push(`/coach/content/${originalData.id}`);
      } else if (nodeType === 'article' || nodeType === 'video') {
        router.push(`/dashboard/knowledge/nodes/${originalData.id}`);
      } else {
        router.push(`/dashboard/knowledge/pillars/${originalData.id}`);
      }
    }
  }, [onNodeClick, readOnly, router]);

  if (data.length === 0) {
    return (
      <div className="h-96 flex items-center justify-center text-surface-400">
        <p>暂无数据</p>
      </div>
    );
  }

  return (
    <div
      className="bg-surface-50 dark:bg-surface-900 rounded-2xl overflow-hidden border border-surface-200 dark:border-surface-700 relative"
      style={{ height }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2, minZoom: 0.5, maxZoom: 1.2 }}
        minZoom={0.2}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="#e5e7eb" gap={24} size={1} />
        <Controls
          className="!bg-white dark:!bg-surface-800 !border-surface-200 dark:!border-surface-700 !shadow-lg !rounded-xl overflow-hidden"
          showInteractive={false}
        />
      </ReactFlow>
      
      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-surface-800/90 backdrop-blur rounded-xl p-3 text-xs space-y-2 shadow-lg z-10 border border-surface-100 dark:border-surface-700">
        <div className="font-bold text-surface-600 dark:text-surface-300 mb-1">节点说明</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-primary-500 to-primary-600 shadow-sm" />
          <span className="text-surface-600 dark:text-surface-300">知识领域</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-blue-400 to-blue-500 shadow-sm" />
          <span className="text-surface-600 dark:text-surface-300">分类</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-gradient-to-br from-emerald-400 to-emerald-500 shadow-sm" />
          <span className="text-surface-600 dark:text-surface-300">主题</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-2 border-amber-400 bg-white shadow-sm" />
          <span className="text-surface-600 dark:text-surface-300">文章/视频</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded border-2 border-green-400 bg-white shadow-sm" />
          <span className="text-surface-600 dark:text-surface-300">教练文章</span>
        </div>
      </div>
      
      {/* Tips */}
      <div className="absolute top-4 right-4 bg-white/90 dark:bg-surface-800/90 backdrop-blur rounded-xl px-3 py-2 text-xs text-surface-500 shadow-sm border border-surface-100 dark:border-surface-700 z-10 flex items-center gap-2">
        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
          <span>{readOnly ? "可拖拽、缩放查看" : "可拖拽画布与节点"}</span>
      </div>
    </div>
  );
}
