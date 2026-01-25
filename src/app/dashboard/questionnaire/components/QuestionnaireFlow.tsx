import React, { useMemo } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Edge,
  type Node,
  type NodeProps,
  Handle,
  MarkerType,
  Position,
} from 'reactflow';
import dagre from '@dagrejs/dagre';
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
      return q.question || '文本问题';
    default:
      return q?.type || '问题';
  }
}

function buildGraph(questions: TrainingItem[]) {
  const nodes: Node<QuestionNodeData>[] = [];
  const edges: Edge[] = [];
  let usedEnd = false;

  const idToIndex = new Map<string, number>();
  questions.forEach((q: any, idx) => q?.id && idToIndex.set(q.id, idx));

  const getImplicitSequentialId = (qid: string) => {
    const idx = idToIndex.get(qid);
    if (idx === undefined) return null;
    const next: any = questions[idx + 1];
    return next?.id || null;
  };

  // nodes
  questions.forEach((q: any) => {
    if (!q?.id) return;
    const isBranch = q.type === 'option' || q.type === 'times';
    const options =
      q.type === 'option'
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

    const addEdge = (from: string, to: string, label: string, color: string, dashed?: boolean) => {
      if (to === '__END__') usedEnd = true;
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
      });
    };

    // 分支题：只画“显式分支 / 默认 / 顺序 next”，避免被列表顺序强行串线
    if (q.type === 'option') {
      const b = q.branching || {};
      const rules = b.rules || {};
      const opts: string[] = Array.isArray(q.options) ? q.options : [];
      const explicitNext = (q as any)?.next;

      opts.forEach((opt: string, optIdx: number) => {
        const v = rules?.[optIdx];
        const label = `选项${optIdx + 1}`;
        if (v === null) addEdge(q.id, '__END__', label, '#f59e0b');
        else if (typeof v === 'string') addEdge(q.id, v, label, '#f59e0b');
      });

      if (b.defaultNext === null) addEdge(q.id, '__END__', '默认', '#60a5fa');
      else if (typeof b.defaultNext === 'string') addEdge(q.id, b.defaultNext, '默认', '#60a5fa');

      if (explicitNext === null) addEdge(q.id, '__END__', '顺序', '#94a3b8', true);
      else if (typeof explicitNext === 'string') addEdge(q.id, explicitNext, '顺序', '#94a3b8', true);
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
        if (v === null) addEdge(q.id, '__END__', label, '#f59e0b');
        else if (typeof v === 'string') addEdge(q.id, v, label, '#f59e0b');
      });

      if (b.defaultNext === null) addEdge(q.id, '__END__', '默认', '#60a5fa');
      else if (typeof b.defaultNext === 'string') addEdge(q.id, b.defaultNext, '默认', '#60a5fa');

      if (explicitNext === null) addEdge(q.id, '__END__', '顺序', '#94a3b8', true);
      else if (typeof explicitNext === 'string') addEdge(q.id, explicitNext, '顺序', '#94a3b8', true);
      return;
    }

    // tags（多选题）：当前仅支持 defaultNext（填完后整体跳转）
    if (q.type === 'tags') {
      const b = q.branching || {};
      const explicitNext = (q as any)?.next;

      if (b.defaultNext === null) {
        addEdge(q.id, '__END__', '默认', '#60a5fa');
        return;
      }
      if (typeof b.defaultNext === 'string') {
        addEdge(q.id, b.defaultNext, '默认', '#60a5fa');
        return;
      }

      // 没配置 defaultNext：走原有顺序逻辑
      if (explicitNext === null) {
        addEdge(q.id, '__END__', '结束', '#94a3b8', true);
        return;
      }
      if (typeof explicitNext === 'string') {
        addEdge(q.id, explicitNext, '顺序', '#94a3b8', true);
        return;
      }

      const seq = getImplicitSequentialId(q.id);
      if (seq) addEdge(q.id, seq, '顺序', '#94a3b8', true);
      else addEdge(q.id, '__END__', '结束', '#94a3b8', true);
      return;
    }

    // 非分支题：显式 next 优先；否则兼容旧数据用“顺序下一题”
    const explicitNext = (q as any)?.next;
    if (explicitNext === null) {
      addEdge(q.id, '__END__', '结束', '#94a3b8', true);
      return;
    }
    if (typeof explicitNext === 'string') {
      addEdge(q.id, explicitNext, '顺序', '#94a3b8', true);
      return;
    }

    const seq = getImplicitSequentialId(q.id);
    if (seq) addEdge(q.id, seq, '顺序', '#94a3b8', true);
    else addEdge(q.id, '__END__', '结束', '#94a3b8', true);
  });

  // END 节点仅在需要时出现，避免被排到右侧“漂浮”
  if (usedEnd) {
    nodes.push({
      id: '__END__',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { label: '结束问卷' } as any,
      style: {
        border: '1px dashed #cbd5e1',
        borderRadius: 12,
        padding: 10,
        background: '#fff',
        color: '#64748b',
        fontSize: 12,
      },
      sourcePosition: Position.Bottom,
      targetPosition: Position.Top,
    });
  }

  return { nodes, edges };
}

function layoutDagre(nodes: Node[], edges: Edge[]) {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  // 更像“树”：根在上、往下分叉（而不是横向线性轴）
  g.setGraph({ rankdir: 'TB', nodesep: 60, ranksep: 90 });

  const NODE_W = 320;
  const NODE_H = 180;

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));
  dagre.layout(g);

  const laidOut = nodes.map((n) => {
    const p = g.node(n.id);
    return {
      ...n,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
    };
  });

  return laidOut;
}

export default function QuestionnaireFlow(props: Props) {
  const { nodes, edges } = useMemo(() => buildGraph(props.questions), [props.questions]);

  const finalNodes = useMemo(() => {
    const withHandlers = nodes.map((n) => ({
      ...n,
      data: {
        ...n.data,
        highlight: props.highlightQuestionId === n.id,
        onJump: props.onJumpToQuestion,
        onAdd: props.onRequestAdd,
        onDelete: (qid: string, e: any) => props.onRequestDelete({ questionId: qid }, e),
      },
    }));
    return layoutDagre(withHandlers as any, edges);
  }, [nodes, edges, props.highlightQuestionId, props.onJumpToQuestion, props.onRequestAdd, props.onRequestDelete]);

  return (
    <div className="w-full h-[640px] border border-surface-200 rounded-lg overflow-hidden bg-surface-50">
      <ReactFlow nodes={finalNodes} edges={edges} nodeTypes={nodeTypes} fitView>
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
    </div>
  );
}

