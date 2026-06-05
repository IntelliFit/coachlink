"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Bot,
  CheckCircle2,
  Clock3,
  FileEdit,
  Loader2,
  RefreshCw,
  Save,
  XCircle,
} from "lucide-react";

type Policy = {
  initialPlanMode: "off" | "draft" | "auto_publish";
  feedbackAdjustmentMode: "off" | "draft_notify" | "auto_apply_low_risk" | "auto_apply_safe";
  nextPhaseMode: "off" | "draft_notify" | "auto_publish_if_credits";
  riskGuardMode: "strict" | "normal";
};

type AutomationJob = {
  id: string;
  type: string;
  status: string;
  trigger_source?: string | null;
  idempotency_key?: string | null;
  error_message?: string | null;
  input_snapshot?: any;
  output_snapshot?: any;
  created_at?: string | null;
  updated_at?: string | null;
};

type AdjustmentDraft = {
  id: string;
  risk_level: "low" | "medium" | "high";
  summary?: string | null;
  proposed_patch?: any;
  status: string;
  requires_coach_review: boolean;
  created_at?: string | null;
};

const DEFAULT_POLICY: Policy = {
  initialPlanMode: "auto_publish",
  feedbackAdjustmentMode: "draft_notify",
  nextPhaseMode: "draft_notify",
  riskGuardMode: "strict",
};

const initialPlanOptions = [
  { value: "auto_publish", label: "自动发放" },
  { value: "draft", label: "生成草稿" },
  { value: "off", label: "关闭" },
];

const feedbackOptions = [
  { value: "draft_notify", label: "草稿并通知" },
  { value: "auto_apply_low_risk", label: "低风险自动应用" },
  { value: "auto_apply_safe", label: "安全反馈自动应用" },
  { value: "off", label: "关闭" },
];

const nextPhaseOptions = [
  { value: "draft_notify", label: "草稿并通知" },
  { value: "auto_publish_if_credits", label: "额度足够自动发布" },
  { value: "off", label: "关闭" },
];

const riskOptions = [
  { value: "strict", label: "严格" },
  { value: "normal", label: "普通" },
];

const statusMeta: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: "待执行", className: "bg-surface-100 text-surface-600", icon: Clock3 },
  running: { label: "执行中", className: "bg-blue-50 text-blue-600", icon: Loader2 },
  succeeded: { label: "已完成", className: "bg-emerald-50 text-emerald-600", icon: CheckCircle2 },
  failed: { label: "失败", className: "bg-rose-50 text-rose-600", icon: XCircle },
  needs_coach_review: { label: "待确认", className: "bg-amber-50 text-amber-700", icon: FileEdit },
  skipped: { label: "已跳过", className: "bg-surface-100 text-surface-500", icon: Clock3 },
};

function formatTime(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function FieldSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-bold text-surface-700">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-11 rounded-lg border border-surface-200 bg-white px-3 text-sm font-semibold text-surface-900 outline-none transition focus:border-[#CF6D4E] focus:ring-2 focus:ring-[#CF6D4E]/15"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta = statusMeta[status] || statusMeta.pending;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-bold ${meta.className}`}>
      <Icon size={13} className={status === "running" ? "animate-spin" : ""} />
      {meta.label}
    </span>
  );
}

function canApplyDraft(draft: AdjustmentDraft) {
  return Array.isArray(draft.proposed_patch?.updatedTrainingDays);
}

export default function CoachAutomationPage() {
  const [policy, setPolicy] = useState<Policy>(DEFAULT_POLICY);
  const [policySource, setPolicySource] = useState("default");
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [drafts, setDrafts] = useState<AdjustmentDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const pendingDrafts = useMemo(
    () => drafts.filter((draft) => draft.status === "draft"),
    [drafts],
  );

  const loadData = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [policyRes, jobsRes] = await Promise.all([
        fetch("/api/coach/automation-policy", { cache: "no-store" }),
        fetch("/api/coach/automation-jobs?limit=40", { cache: "no-store" }),
      ]);
      const policyJson = await policyRes.json();
      const jobsJson = await jobsRes.json();

      if (policyJson?.success && policyJson.data?.policy) {
        setPolicy({ ...DEFAULT_POLICY, ...policyJson.data.policy });
        setPolicySource(policyJson.data.source || "default");
      }
      if (jobsJson?.success) {
        setJobs(jobsJson.data?.jobs || []);
        setDrafts(jobsJson.data?.drafts || []);
      }
    } catch (error) {
      console.error("[automation] load failed:", error);
      setMessage("加载自动化设置失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const savePolicy = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/coach/automation-policy", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policy),
      });
      const json = await response.json();
      if (!json?.success) throw new Error(json?.message || "保存失败");
      setPolicy({ ...DEFAULT_POLICY, ...json.data.policy });
      setPolicySource("coach");
      setMessage("自动化设置已保存");
    } catch (error: any) {
      setMessage(error?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const applyDraft = async (draftId: string) => {
    setApplyingId(draftId);
    setMessage(null);
    try {
      const response = await fetch(`/api/coach/plan-adjustment-drafts/${draftId}/apply`, {
        method: "POST",
      });
      const json = await response.json();
      if (!json?.success) throw new Error(json?.message || "应用失败");
      setMessage("调整草稿已应用");
      await loadData();
    } catch (error: any) {
      setMessage(error?.message || "应用失败");
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <main className="min-h-screen bg-surface-50 px-4 py-6 pb-24 md:px-8 md:py-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="mb-2 inline-flex items-center gap-2 rounded-md bg-[#CF6D4E]/10 px-2 py-1 text-xs font-bold text-[#CF6D4E]">
              <Bot size={14} />
              Coach automation
            </div>
            <h1 className="text-2xl font-black tracking-tight text-surface-950 md:text-3xl">
              自动化设置
            </h1>
            <p className="mt-1 text-sm text-surface-500">
              全局策略会被单个学员覆盖设置替换；高风险反馈始终需要教练确认。
            </p>
          </div>

          <button
            type="button"
            onClick={loadData}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-surface-200 bg-white px-4 text-sm font-bold text-surface-700 transition hover:border-[#CF6D4E] hover:text-[#CF6D4E]"
          >
            <RefreshCw size={16} />
            刷新
          </button>
        </div>

        {message && (
          <div className="rounded-lg border border-surface-200 bg-white px-4 py-3 text-sm font-semibold text-surface-700">
            {message}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-[420px_1fr]">
          <section className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-black text-surface-950">教练全局策略</h2>
                <p className="mt-1 text-xs font-semibold text-surface-400">
                  当前来源：{policySource === "coach" ? "教练自定义" : "系统默认"}
                </p>
              </div>
              {loading && <Loader2 className="h-5 w-5 animate-spin text-surface-300" />}
            </div>

            <div className="grid gap-4">
              <FieldSelect
                label="首个计划"
                value={policy.initialPlanMode}
                options={initialPlanOptions}
                onChange={(value) => setPolicy((prev) => ({ ...prev, initialPlanMode: value as Policy["initialPlanMode"] }))}
              />
              <FieldSelect
                label="反馈调整"
                value={policy.feedbackAdjustmentMode}
                options={feedbackOptions}
                onChange={(value) =>
                  setPolicy((prev) => ({ ...prev, feedbackAdjustmentMode: value as Policy["feedbackAdjustmentMode"] }))
                }
              />
              <FieldSelect
                label="下一阶段"
                value={policy.nextPhaseMode}
                options={nextPhaseOptions}
                onChange={(value) => setPolicy((prev) => ({ ...prev, nextPhaseMode: value as Policy["nextPhaseMode"] }))}
              />
              <FieldSelect
                label="风险保护"
                value={policy.riskGuardMode}
                options={riskOptions}
                onChange={(value) => setPolicy((prev) => ({ ...prev, riskGuardMode: value as Policy["riskGuardMode"] }))}
              />
            </div>

            <button
              type="button"
              onClick={savePolicy}
              disabled={saving}
              className="mt-6 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#CF6D4E] px-4 text-sm font-black text-white transition hover:bg-[#B95D42] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              保存全局策略
            </button>
          </section>

          <section className="grid gap-5">
            <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-surface-950">待确认草稿</h2>
                  <p className="mt-1 text-xs font-semibold text-surface-400">
                    {pendingDrafts.length} 个待处理
                  </p>
                </div>
                <AlertTriangle size={20} className="text-amber-500" />
              </div>

              {pendingDrafts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-surface-200 px-4 py-8 text-center text-sm font-semibold text-surface-400">
                  暂无待确认调整
                </div>
              ) : (
                <div className="grid gap-3">
                  {pendingDrafts.map((draft) => (
                    <div key={draft.id} className="rounded-lg border border-surface-200 p-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div className="min-w-0">
                          <div className="mb-2 flex items-center gap-2">
                            <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                              {draft.risk_level === "high" ? "高风险" : draft.risk_level === "medium" ? "中风险" : "低风险"}
                            </span>
                            {draft.requires_coach_review && (
                              <span className="rounded-md bg-rose-50 px-2 py-1 text-xs font-bold text-rose-600">
                                需确认
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold leading-6 text-surface-800">
                            {draft.summary || "AI 已生成训练调整草稿"}
                          </p>
                          <p className="mt-2 text-xs text-surface-400">{formatTime(draft.created_at)}</p>
                        </div>

                        {canApplyDraft(draft) ? (
                        <button
                          type="button"
                          onClick={() => applyDraft(draft.id)}
                          disabled={applyingId === draft.id}
                          className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#CF6D4E] px-4 text-sm font-black text-white transition hover:bg-[#B95D42] disabled:opacity-60"
                        >
                          {applyingId === draft.id ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          应用
                        </button>
                        ) : (
                          <span className="inline-flex h-10 shrink-0 items-center justify-center rounded-lg border border-surface-200 bg-white px-4 text-sm font-black text-surface-500">
                            仅建议
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-lg border border-surface-200 bg-white p-5 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-surface-950">自动化历史</h2>
                  <p className="mt-1 text-xs font-semibold text-surface-400">
                    最近 {jobs.length} 条任务
                  </p>
                </div>
              </div>

              <div className="overflow-hidden rounded-lg border border-surface-200">
                {jobs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm font-semibold text-surface-400">
                    暂无自动化任务
                  </div>
                ) : (
                  <div className="divide-y divide-surface-100">
                    {jobs.map((job) => (
                      <div key={job.id} className="grid gap-3 px-4 py-3 md:grid-cols-[150px_140px_1fr_110px] md:items-center">
                        <div className="text-sm font-black text-surface-900">
                          {job.type === "initial_plan"
                            ? "首个计划"
                            : job.type === "feedback_adjustment"
                              ? "反馈调整"
                              : job.type === "next_phase"
                                ? "下一阶段"
                                : job.type === "renewal_check"
                                  ? "续费检查"
                                  : job.type}
                        </div>
                        <StatusBadge status={job.status} />
                        <div className="min-w-0 text-xs font-semibold text-surface-500">
                          <div className="truncate">{job.error_message || job.output_snapshot?.reason || job.trigger_source || "-"}</div>
                          {job.idempotency_key && (
                            <div className="mt-1 truncate text-surface-300">{job.idempotency_key}</div>
                          )}
                        </div>
                        <div className="text-xs font-bold text-surface-400 md:text-right">
                          {formatTime(job.updated_at || job.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
