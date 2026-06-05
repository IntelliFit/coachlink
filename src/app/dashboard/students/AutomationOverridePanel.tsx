"use client";

import { useEffect, useState } from "react";
import { Bot, Loader2, Save } from "lucide-react";

type NullablePolicy = {
  initialPlanMode: string | null;
  feedbackAdjustmentMode: string | null;
  nextPhaseMode: string | null;
  riskGuardMode: string | null;
};

const initialPlanOptions = [
  { value: "", label: "继承全局" },
  { value: "auto_publish", label: "自动发放" },
  { value: "draft", label: "生成草稿" },
  { value: "off", label: "关闭" },
];

const feedbackOptions = [
  { value: "", label: "继承全局" },
  { value: "draft_notify", label: "草稿并通知" },
  { value: "auto_apply_low_risk", label: "低风险自动应用" },
  { value: "auto_apply_safe", label: "安全反馈自动应用" },
  { value: "off", label: "关闭" },
];

const nextPhaseOptions = [
  { value: "", label: "继承全局" },
  { value: "draft_notify", label: "草稿并通知" },
  { value: "auto_publish_if_credits", label: "额度足够自动发布" },
  { value: "off", label: "关闭" },
];

const riskOptions = [
  { value: "", label: "继承全局" },
  { value: "strict", label: "严格" },
  { value: "normal", label: "普通" },
];

function fromOverride(row: any): NullablePolicy {
  return {
    initialPlanMode: row?.initial_plan_mode ?? null,
    feedbackAdjustmentMode: row?.feedback_adjustment_mode ?? null,
    nextPhaseMode: row?.next_phase_mode ?? null,
    riskGuardMode: row?.risk_guard_mode ?? null,
  };
}

function toNullable(value: string | null) {
  return value && value.trim() ? value : null;
}

function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string | null;
  options: { value: string; label: string }[];
  onChange: (value: string | null) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-bold text-surface-500">{label}</span>
      <select
        value={value || ""}
        onChange={(event) => onChange(event.target.value || null)}
        className="h-9 rounded-lg border border-surface-200 bg-white px-2 text-xs font-bold text-surface-800 outline-none focus:border-[#CF6D4E] focus:ring-2 focus:ring-[#CF6D4E]/15"
      >
        {options.map((option) => (
          <option key={option.value || "inherit"} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function AutomationOverridePanel({ subscriptionId }: { subscriptionId: string }) {
  const [override, setOverride] = useState<NullablePolicy>({
    initialPlanMode: null,
    feedbackAdjustmentMode: null,
    nextPhaseMode: null,
    riskGuardMode: null,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!subscriptionId) return;
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setMessage(null);
      try {
        const response = await fetch(
          `/api/coach/student-automation-override?subscriptionId=${encodeURIComponent(subscriptionId)}`,
          { cache: "no-store" },
        );
        const json = await response.json();
        if (!cancelled && json?.success) {
          setOverride(fromOverride(json.data?.override));
        }
      } catch (error) {
        if (!cancelled) setMessage("加载自动化覆盖失败");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [subscriptionId]);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/coach/student-automation-override", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subscriptionId,
          initialPlanMode: toNullable(override.initialPlanMode),
          feedbackAdjustmentMode: toNullable(override.feedbackAdjustmentMode),
          nextPhaseMode: toNullable(override.nextPhaseMode),
          riskGuardMode: toNullable(override.riskGuardMode),
        }),
      });
      const json = await response.json();
      if (!json?.success) throw new Error(json?.message || "保存失败");
      setOverride(fromOverride(json.data?.override));
      setMessage("已保存");
    } catch (error: any) {
      setMessage(error?.message || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-surface-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#CF6D4E]/10 text-[#CF6D4E]">
            <Bot size={18} />
          </div>
          <div>
            <p className="text-sm font-black text-surface-900">单学员自动化覆盖</p>
            <p className="text-[11px] font-semibold text-surface-400">空值继承教练全局设置</p>
          </div>
        </div>
        {loading && <Loader2 size={16} className="animate-spin text-surface-300" />}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SelectField
          label="首个计划"
          value={override.initialPlanMode}
          options={initialPlanOptions}
          onChange={(value) => setOverride((prev) => ({ ...prev, initialPlanMode: value }))}
        />
        <SelectField
          label="反馈调整"
          value={override.feedbackAdjustmentMode}
          options={feedbackOptions}
          onChange={(value) => setOverride((prev) => ({ ...prev, feedbackAdjustmentMode: value }))}
        />
        <SelectField
          label="下一阶段"
          value={override.nextPhaseMode}
          options={nextPhaseOptions}
          onChange={(value) => setOverride((prev) => ({ ...prev, nextPhaseMode: value }))}
        />
        <SelectField
          label="风险保护"
          value={override.riskGuardMode}
          options={riskOptions}
          onChange={(value) => setOverride((prev) => ({ ...prev, riskGuardMode: value }))}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-[11px] font-semibold text-surface-400">
          疼痛、伤病等高风险反馈不会自动应用。
        </span>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg bg-[#CF6D4E] px-3 text-xs font-black text-white transition hover:bg-[#B95D42] disabled:opacity-60"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
          保存
        </button>
      </div>
      {message && <p className="mt-2 text-xs font-bold text-surface-500">{message}</p>}
    </div>
  );
}
