import React, { useCallback, useEffect, useMemo, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Panel,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  MarkerType,
  Position,
  applyNodeChanges,
  useEdgesState,
  useNodesState,
  type NodeChange,
} from 'reactflow';
import { Button } from 'primereact/button';
import { classNames } from 'primereact/utils';
import type { TrainingItem } from '@/types/questionnaires';

type AddCtx =
  | { kind: 'sequential'; fromQuestionId: string }
  | { kind: 'default'; fromQuestionId: string }
  | { kind: 'option'; fromQuestionId: string; ruleKey: number }
  | { kind: 'times'; fromQuestionId: string; ruleKey: number };

type DeleteCtx = { questionId: string };

type Props = {
  questions: TrainingItem[];
  highlightQuestionId: string | null;
  onJumpToQuestion: (qid: string) => void;
  onRequestAdd: (ctx: AddCtx, e: any) => void;
  onRequestDelete: (ctx: DeleteCtx, e: any) => void;
};

type QuestionNodeData = {
  qid: string;
  label: string;
  type: string;
  isBranch: boolean;
  options?: { key: number; text: string; kind: 'option' }[];
  times?: { key: number; text: string; kind: 'times' }[];
  /**
   * 布局用的尺寸估算（避免“选项很多时节点真实高度>固定高度”导致重叠）
   */
  layout?: { w: number; h: number };
  highlight: boolean;
  onJump: (qid: string) => void;
  onAdd: (ctx: AddCtx, e: any) => void;
  onDelete: (qid: string, e: any) => void;
};

const QuestionNode = ({ data }: NodeProps<QuestionNodeData>) => {
  return (
    <div
      className={classNames(
        'rounded-lg border bg-white shadow-sm min-w-[260px] max-w-[360px]',
        data.highlight ? 'ring-2 ring-primary-300 border-primary-200' : 'border-surface-200'
      )}
    >
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
      <div className="px-3 py-2 border-b border-surface-100 flex items-start justify-between gap-2">
        <div
          className="cursor-pointer"
          onClick={() => data.onJump(data.qid)}
          title="点击跳转到列表中编辑"
        >
          <div className="text-sm font-bold text-surface-800">{data.label}</div>
          <div className="text-[11px] text-surface-500">({data.type})</div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            icon="pi pi-pencil"
            className="p-button-text p-1"
            onClick={(e) => {
              e.stopPropagation?.();
              data.onJump(data.qid);
            }}
            tooltip="编辑"
            tooltipOptions={{ position: 'top' }}
          />
          <Button
            icon="pi pi-trash"
            className="p-button-text p-button-danger p-1"
            onClick={(e) => {
              e.stopPropagation?.();
              data.onDelete(data.qid, e);
            }}
            tooltip="删除"
            tooltipOptions={{ position: 'top' }}
          />
        </div>
      </div>

      <div className="px-3 py-2">
        {/* 顺序下一题 */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] text-surface-600">顺序下一题</div>
          <Button
            label="+ 新增"
            size="small"
            outlined
            onClick={(e) => {
              e.stopPropagation?.();
              data.onAdd({ kind: 'sequential', fromQuestionId: data.qid }, e);
            }}
          />
        </div>

        {/* 分支 */}
        {data.options && data.options.length > 0 && (
          <div className="mt-2">
            <div className="text-[12px] font-bold text-surface-600 mb-1">按选项分支</div>
            <div className="space-y-1">
              {data.options.map((o) => (
                <div key={o.key} className="flex items-center justify-between gap-2">
                  <div className="text-[12px] text-surface-700 truncate">
                    选项 {o.key + 1}：{o.text || '（未命名）'}
                  </div>
                  <Button
                    label="+ 新增"
                    size="small"
                    outlined
                    onClick={(e) => {
                      e.stopPropagation?.();
                      data.onAdd({ kind: 'option', fromQuestionId: data.qid, ruleKey: o.key }, e);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {data.times && data.times.length > 0 && (
          <div className="mt-2">
            <div className="text-[12px] font-bold text-surface-600 mb-1">按次数分支</div>
            <div className="grid grid-cols-2 gap-1">
              {data.times.map((t) => (
                <div key={t.key} className="flex items-center justify-between gap-2">
                  <div className="text-[12px] text-surface-700 truncate">{t.text}</div>
                  <Button
                    label="+"
                    size="small"
                    outlined
                    onClick={(e) => {
                      e.stopPropagation?.();
                      data.onAdd({ kind: 'times', fromQuestionId: data.qid, ruleKey: t.key }, e);
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const nodeTypes = { questionNode: QuestionNode };

type LayoutKind = 'sequential' | 'option' | 'times' | 'default' | 'end';
type EdgeMeta = { kind: LayoutKind; order: number };

function labelOfQuestion(q: any) {
  switch (q.type) {
    case 'tags':
      return '训练项目偏好';
    case 'times':
      return q.question || '每周训练次数';
    case 'rm':
      return '用户极限（1RM）';
    case 'option':
      return q.question || '选项问题';
    case 'text':
      return q.question || '大段文本问答';
    default:
      return q?.type || '问题';
  }
}

function buildGraph(questions: TrainingItem[]) {
  const nodes: Node<QuestionNodeData>[] = [];
  const edges: Edge<EdgeMeta>[] = [];

  const idToIndex = new Map<string, number>();
  questions.forEach((q: any, idx) => q?.id && idToIndex.set(q.id, idx));

  const getImplicitSequentialId = (qid: string) => {
    const idx = idToIndex.get(qid);
    if (idx === undefined) return null;
    const next: any = questions[idx + 1];
    return next?.id || null;
  };

  // 记录“分支子树”（从分支边出发，通过显式 next/分支边可达的所有节点）
  // 目的：分支子树内不再使用“数组顺序”兜底，避免并列分支被误连顺序边
  const branchTargets = new Set<string>();
  const explicitAdj = new Map<string, string[]>();
  const addAdj = (from: string, to: string | null | undefined) => {
    if (!from || !to || typeof to !== 'string') return;
    if (!explicitAdj.has(from)) explicitAdj.set(from, []);
    explicitAdj.get(from)!.push(to);
  };

  for (const q of questions as any[]) {
    if (!q?.id) continue;
    const b = q.branching || {};
    if (typeof b.defaultNext === 'string') {
      branchTargets.add(b.defaultNext);
      addAdj(q.id, b.defaultNext);
    }
    const rules = b.rules || {};
    Object.values(rules).forEach((v: any) => {
      if (typeof v === 'string') {
        branchTargets.add(v);
        addAdj(q.id, v);
      }
    });
    const explicitNext = q.next;
    if (typeof explicitNext === 'string') {
      addAdj(q.id, explicitNext);
    }
  }

  const branchSubtree = new Set<string>();
  const queue = Array.from(branchTargets);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if (branchSubtree.has(cur)) continue;
    branchSubtree.add(cur);
    const nexts = explicitAdj.get(cur) || [];
    nexts.forEach((n) => {
      if (!branchSubtree.has(n)) queue.push(n);
    });
  }

  // 估算节点高度：让自动布局考虑“选项数量”，避免节点重叠
  const estimateNodeSize = (q: any): { w: number; h: number } => {
    const w = 320;
    const headerH = 44;
    const paddingH = 16;
    const sequentialRowH = 34;
    const sectionTitleH = 22;
    const optionRowH = 28; // 一行“选项X + 新增”
    const timesRowH = 28; // 一格“X次 + +”
    const base = headerH + paddingH + sequentialRowH + 12;

    if (q?.type === '__END__') return { w: 220, h: 80 };

    if (q?.type === 'option') {
      const count = Array.isArray(q.options) ? q.options.length : 0;
      const h = base + (count > 0 ? sectionTitleH + count * optionRowH : 0);
      return { w, h: Math.max(140, Math.min(720, h + 8)) };
    }

    if (q?.type === 'times') {
      const opts: number[] = Array.isArray(q.options) ? q.options : [1, 2, 3, 4, 5, 6, 7];
      const rows = Math.ceil(opts.length / 2); // grid-cols-2
      const h = base + sectionTitleH + rows * timesRowH;
      return { w, h: Math.max(150, Math.min(540, h + 10)) };
    }

    // tags/text/rm 等：不展示分支列表，但仍有“顺序下一题”
    return { w, h: 150 };
  };

  // nodes
  questions.forEach((q: any) => {
    if (!q?.id) return;
    const isMultiOption =
      q.type === 'option' && (q.selectionMode === 'multiple' || Boolean(q.allowOther));
    const isBranch = (q.type === 'option' && !isMultiOption) || q.type === 'times';
    const options =
      q.type === 'option' && !isMultiOption
        ? (q.options || []).map((text: string, key: number) => ({ key, text, kind: 'option' as const }))
        : undefined;
    const times =
      q.type === 'times'
        ? (Array.isArray(q.options) ? q.options : [1, 2, 3, 4, 5, 6, 7]).map((n: number) => ({
            key: n,
            text: `${n} 次`,
            kind: 'times' as const,
          }))
        : undefined;

    const layout = estimateNodeSize(q);
    nodes.push({
      id: q.id,
      type: 'questionNode',
      position: { x: 0, y: 0 },
      data: {
        qid: q.id,
        label: labelOfQuestion(q),
        type: q.type,
        isBranch,
        options,
        times,
        layout,
        highlight: false,
        onJump: () => {},
        onAdd: () => {},
        onDelete: () => {},
      },
      // 竖向树形：从上到下
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
  });

  // 逻辑边：更像“树/流程”，不是“列表顺序”
  questions.forEach((q: any) => {
    if (!q?.id) return;

    const addEdge = (
      from: string,
      to: string,
      label: string,
      color: string,
      dashed: boolean | undefined,
      meta: EdgeMeta,
    ) => {
      // 不再渲染“结束问卷”节点：叶子节点自然表示结束
      if (to === '__END__') return;
      edges.push({
        id: `${from}-${label}-${to}`,
        source: from,
        target: to,
        type: 'smoothstep',
        label,
        markerEnd: { type: MarkerType.ArrowClosed },
        animated: !dashed,
        style: dashed
          ? { stroke: color, strokeDasharray: '6 6' }
          : { stroke: color },
        labelStyle: { fill: color, fontSize: 11, fontWeight: 600 },
        data: meta,
      });
    };

    // 分支题：只画"显式分支 / 默认 / 顺序 next"，避免被列表顺序强行串线
    if (q.type === 'option') {
      const b = q.branching || {};
      const rules = b.rules || {};
      const opts: string[] = Array.isArray(q.options) ? q.options : [];
      const explicitNext = (q as any)?.next;
      const isMultiOption = q.selectionMode === 'multiple' || Boolean(q.allowOther);

      if (!isMultiOption) {
        opts.forEach((opt: string, optIdx: number) => {
          const v = rules?.[optIdx];
          const label = `选项${optIdx + 1}`;
          if (v === null) addEdge(q.id, '__END__', label, '#f59e0b', false, { kind: 'option', order: optIdx });
          else if (typeof v === 'string') addEdge(q.id, v, label, '#f59e0b', false, { kind: 'option', order: optIdx });
        });
      }

      if (b.defaultNext === null) addEdge(q.id, '__END__', '默认', '#60a5fa', false, { kind: 'default', order: 9999 });
      else if (typeof b.defaultNext === 'string') addEdge(q.id, b.defaultNext, '默认', '#60a5fa', false, { kind: 'default', order: 9999 });

      // 顺序边：仅在显式 next 存在时绘制（避免靠列表顺序误连分支节点）
      if (typeof explicitNext === 'string') {
        addEdge(q.id, explicitNext, '顺序', '#94a3b8', true, { kind: 'sequential', order: 0 });
      }
      return;
    }

    if (q.type === 'times') {
      const b = q.branching || {};
      const rules = b.rules || {};
      const opts: number[] = Array.isArray(q.options) ? q.options : [1, 2, 3, 4, 5, 6, 7];
      const explicitNext = (q as any)?.next;

      opts.forEach((num: number) => {
        const v = rules?.[num];
        const label = `${num}次`;
        if (v === null) addEdge(q.id, '__END__', label, '#f59e0b', false, { kind: 'times', order: num });
        else if (typeof v === 'string') addEdge(q.id, v, label, '#f59e0b', false, { kind: 'times', order: num });
      });

      if (b.defaultNext === null) addEdge(q.id, '__END__', '默认', '#60a5fa', false, { kind: 'default', order: 9999 });
      else if (typeof b.defaultNext === 'string') addEdge(q.id, b.defaultNext, '默认', '#60a5fa', false, { kind: 'default', order: 9999 });

      // 顺序边：仅在显式 next 存在时绘制（避免靠列表顺序误连分支节点）
      if (typeof explicitNext === 'string') {
        addEdge(q.id, explicitNext, '顺序', '#94a3b8', true, { kind: 'sequential', order: 0 });
      }
      return;
    }

    // tags（多选题）：当前仅支持 defaultNext（填完后整体跳转）
    if (q.type === 'tags') {
      const b = q.branching || {};
      const explicitNext = (q as any)?.next;

      if (b.defaultNext === null) {
        addEdge(q.id, '__END__', '默认', '#60a5fa', false, { kind: 'default', order: 9999 });
        return;
      }
      if (typeof b.defaultNext === 'string') {
        addEdge(q.id, b.defaultNext, '默认', '#60a5fa', false, { kind: 'default', order: 9999 });
        return;
      }

      // 没配置 defaultNext：走原有顺序逻辑
      if (typeof explicitNext === 'string') {
        addEdge(q.id, explicitNext, '顺序', '#94a3b8', true, { kind: 'sequential', order: 0 });
        return;
      }

      const seq = getImplicitSequentialId(q.id);
      // 仅在“主干链路”上做列表顺序兜底：避免分支子树被数组顺序串线
      if (seq && !branchSubtree.has(q.id) && !branchSubtree.has(seq)) {
        addEdge(q.id, seq, '顺序', '#94a3b8', true, { kind: 'sequential', order: 0 });
      }
      return;
    }

    // 非分支题：显式 next 优先；否则兼容旧数据用“顺序下一题”
    const explicitNext = (q as any)?.next;
    if (typeof explicitNext === 'string') {
      addEdge(q.id, explicitNext, '顺序', '#94a3b8', true, { kind: 'sequential', order: 0 });
      return;
    }

    const seq = getImplicitSequentialId(q.id);
    // 仅在“主干链路”上做列表顺序兜底：避免分支子树被数组顺序串线
    if (seq && !branchSubtree.has(q.id) && !branchSubtree.has(seq)) {
      addEdge(q.id, seq, '顺序', '#94a3b8', true, { kind: 'sequential', order: 0 });
    }
  });

  return { nodes, edges };
}

function layoutStable(
  nodes: Node<QuestionNodeData>[],
  edges: Edge<EdgeMeta>[],
  rootId: string | null,
): Node<QuestionNodeData>[] {
  const byId = new Map<string, Node<QuestionNodeData>>();
  nodes.forEach((n) => byId.set(n.id, n));

  // children edges (exclude END so it doesn't distort spacing too much; END node can be laid out but not treated as branch child)
  const childrenEdges = new Map<string, Edge<EdgeMeta>[]>();
  for (const e of edges) {
    if (!childrenEdges.has(e.source)) childrenEdges.set(e.source, []);
    childrenEdges.get(e.source)!.push(e);
  }

  const sortEdges = (arr: Edge<EdgeMeta>[]) => {
    // sequential first, then option/times by order, default/end last
    const kindRank: Record<LayoutKind, number> = {
      sequential: 0,
      option: 1,
      times: 1,
      default: 2,
      end: 3,
    };
    return [...arr].sort((a, b) => {
      const ka = a.data?.kind ?? 'end';
      const kb = b.data?.kind ?? 'end';
      const ra = kindRank[ka];
      const rb = kindRank[kb];
      if (ra !== rb) return ra - rb;
      const oa = a.data?.order ?? 0;
      const ob = b.data?.order ?? 0;
      if (oa !== ob) return oa - ob;
      return String(a.id).localeCompare(String(b.id));
    });
  };

  const H_SPACING = 380;
  const V_GAP = 90;

  const visiting = new Set<string>();
  const computedWidth = new Map<string, number>();

  const nodeH = (id: string) => byId.get(id)?.data?.layout?.h ?? 180;

  const getChildren = (id: string) => sortEdges(childrenEdges.get(id) || []);

  const getSequentialChild = (id: string) => {
    const edges = getChildren(id);
    const seq = edges.find((e) => e.data?.kind === 'sequential') || null;
    return seq?.target || null;
  };

  const getBranchChildren = (id: string) => {
    const edges = getChildren(id);
    return edges
      .filter((e) => e.data?.kind === 'option' || e.data?.kind === 'times' || e.data?.kind === 'default')
      .map((e) => e.target);
  };

  const widthOf = (id: string): number => {
    if (computedWidth.has(id)) return computedWidth.get(id)!;
    if (visiting.has(id)) return 1; // cycle guard
    visiting.add(id);

    const seq = getSequentialChild(id);
    const branches = getBranchChildren(id);

    const seqW = seq && seq !== '__END__' ? widthOf(seq) : 0;
    const branchW = branches
      .filter((c) => c && c !== '__END__')
      .reduce((acc, c) => acc + widthOf(c), 0);

    const w = Math.max(1, seqW, branchW);
    computedWidth.set(id, w);
    visiting.delete(id);
    return w;
  };

  const positions = new Map<string, { x: number; y: number }>();
  const placed = new Set<string>();

  const place = (id: string, x: number, y: number) => {
    if (!byId.has(id)) return;
    if (placed.has(id)) return; // shared node: keep first placement (deterministic from traversal)
    placed.add(id);
    positions.set(id, { x, y });

    const seq = getSequentialChild(id);
    const branches = getBranchChildren(id);

    const parentH = nodeH(id);

    const branchIds = branches.filter((c) => c && c !== '__END__' && byId.has(c));
    const hasBranches = branchIds.length > 0;

    // 1) 顺序下一题：永远在正下方（如果同时还有分支，则先放顺序，再把分支放到再下一层）
    let yAfterSeq = y;
    if (seq && seq !== '__END__' && byId.has(seq)) {
      const ySeq = y + parentH / 2 + nodeH(seq) / 2 + V_GAP;
      place(seq, x, ySeq);
      yAfterSeq = ySeq; // used when placing branches under seq
    }

    // 2) 分支：按 order 从左到右排一行
    if (hasBranches) {
      const totalUnits = branchIds.reduce((acc, c) => acc + widthOf(c), 0);
      const maxChildH = Math.max(...branchIds.map((c) => nodeH(c)));
      const baseY = (seq && seq !== '__END__' && byId.has(seq))
        ? (yAfterSeq + nodeH(seq) / 2 + maxChildH / 2 + V_GAP)
        : (y + parentH / 2 + maxChildH / 2 + V_GAP);

      const startX = x - ((totalUnits - 1) * H_SPACING) / 2;
      let cursor = 0;
      for (const childId of branchIds) {
        const wUnits = widthOf(childId);
        const childX = startX + (cursor + (wUnits - 1) / 2) * H_SPACING;
        place(childId, childX, baseY);
        cursor += wUnits;
      }
    }
  };

  const root = rootId && byId.has(rootId) ? rootId : (nodes[0]?.id ?? null);
  if (root) {
    // 从 root 居中开始
    place(root, 0, 0);
  }

  // 剩余未连通节点：按 id 排序放到下方，避免丢失
  const unplaced = nodes
    .filter((n) => !positions.has(n.id))
    .map((n) => n.id)
    .sort();
  if (unplaced.length > 0) {
    let y = 0;
    const maxPlacedY = Math.max(0, ...Array.from(positions.values()).map((p) => p.y));
    y = maxPlacedY + 260;
    unplaced.forEach((id, idx) => {
      positions.set(id, { x: idx * (H_SPACING * 0.9), y });
    });
  }

  return nodes.map((n) => {
    const p = positions.get(n.id) || { x: 0, y: 0 };
    return { ...n, position: p };
  });
}

export default function QuestionnaireFlow(props: Props) {
  const { nodes: baseNodes, edges: baseEdges } = useMemo(() => buildGraph(props.questions), [props.questions]);

  // 手动布局覆盖：拖动节点后会记录在这里，避免每次微小改动都触发全局“跳位”
  const [manualPositions, setManualPositions] = useState<Record<string, { x: number; y: number }>>({});

  const computedNodes = useMemo(() => {
    const withHandlers = baseNodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        highlight: props.highlightQuestionId === n.id,
        onJump: props.onJumpToQuestion,
        onAdd: props.onRequestAdd,
        onDelete: (qid: string, e: any) => props.onRequestDelete({ questionId: qid }, e),
      },
    }));
    const rootId = (props.questions?.[0] as any)?.id || null;
    const laidOut = layoutStable(withHandlers as any, baseEdges as any, rootId);
    return laidOut.map((n) => {
      const mp = manualPositions[n.id];
      return mp ? { ...n, position: mp } : n;
    });
  }, [
    baseNodes,
    baseEdges,
    manualPositions,
    props.highlightQuestionId,
    props.onJumpToQuestion,
    props.onRequestAdd,
    props.onRequestDelete,
    props.questions,
  ]);

  const [nodes, setNodes] = useNodesState(computedNodes);
  const [edges, setEdges] = useEdgesState(baseEdges as any);

  // questions/edges 变化时刷新（保留 manualPositions）
  useEffect(() => {
    setNodes(computedNodes);
    setEdges(baseEdges as any);
  }, [computedNodes, baseEdges, setEdges, setNodes]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((nds) => {
      const next = applyNodeChanges(changes, nds);
      // 记录拖动后的坐标
      for (const c of changes) {
        if (c.type === 'position' && (c as any).position) {
          const id = c.id;
          const node = next.find((n) => n.id === id);
          if (node) {
            setManualPositions((prev) => ({ ...prev, [id]: { ...node.position } }));
          }
        }
      }
      return next;
    });
  }, [setNodes]);

  return (
    <div className="w-full h-[640px] border border-surface-200 rounded-lg overflow-hidden bg-surface-50">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView onNodesChange={onNodesChange}>
        <Panel position="top-right">
          <div className="flex gap-2">
            <Button
              label="重新自动布局"
              icon="pi pi-refresh"
              size="small"
              outlined
              onClick={() => setManualPositions({})}
              tooltip="清除手动拖动位置，按规则重新排版"
              tooltipOptions={{ position: 'left' }}
            />
          </div>
        </Panel>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}
