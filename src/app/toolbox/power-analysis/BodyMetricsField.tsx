"use client";

import type { BodyMetrics, ProfileBodyMetricsPatch } from "@coachlink/core/src/bodyMetrics";
import type { PowerAnalysisSubject } from "@coachlink/core/src/powerAnalysisModes";

const INPUT_CLASS =
  "h-11 w-full rounded-xl border border-surface-200 bg-surface-0 px-3 text-sm outline-none focus:border-[#CF6D4E]";

const SUBJECT_OPTIONS: Array<{ value: PowerAnalysisSubject; label: string }> = [
  { value: "self", label: "测自己" },
  { value: "other", label: "测别人" },
];

interface Props {
  subject: PowerAnalysisSubject;
  onSubjectChange: (subject: PowerAnalysisSubject) => void;
  heightCm: string;
  weightKg: string;
  onHeightChange: (value: string) => void;
  onWeightChange: (value: string) => void;
  /** Profile has both values and the user has not opened the inputs. */
  collapsed: boolean;
  onEdit: () => void;
  profile: BodyMetrics;
  signedIn: boolean;
  /** What saving would change in the profile; null hides the save link. */
  profilePatch: ProfileBodyMetricsPatch | null;
  savingProfile: boolean;
  onSaveToProfile: () => void;
  locked: boolean;
}

function formatNumber(value: number | null) {
  return value === null ? "-" : String(value);
}

export default function BodyMetricsField({
  subject,
  onSubjectChange,
  heightCm,
  weightKg,
  onHeightChange,
  onWeightChange,
  collapsed,
  onEdit,
  profile,
  signedIn,
  profilePatch,
  savingProfile,
  onSaveToProfile,
  locked,
}: Props) {
  const isSelf = subject === "self";
  const profileEmpty = profile.heightCm === null && profile.weightKg === null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-bold text-surface-800">身高体重</div>
        <div className="flex gap-1 rounded-lg bg-surface-100 p-1" role="radiogroup" aria-label="视频里是谁">
          {SUBJECT_OPTIONS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="radio"
              aria-checked={subject === item.value}
              disabled={locked}
              onClick={() => !locked && subject !== item.value && onSubjectChange(item.value)}
              className={[
                "rounded-md px-3 py-1 text-xs font-bold transition-colors",
                subject === item.value
                  ? "bg-surface-0 text-surface-900 shadow-sm"
                  : "text-surface-500 hover:text-surface-800",
              ].join(" ")}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {isSelf && collapsed ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-surface-200 bg-surface-50 px-3 py-3">
          <div>
            <div className="text-sm font-black text-surface-900">
              身高 {formatNumber(profile.heightCm)} cm · 体重 {formatNumber(profile.weightKg)} kg
            </div>
            <div className="mt-0.5 text-xs text-surface-500">来自你的个人资料</div>
          </div>
          <button
            type="button"
            disabled={locked}
            onClick={onEdit}
            className="shrink-0 rounded-lg border border-surface-200 bg-surface-0 px-3 py-1.5 text-xs font-bold text-surface-700 hover:border-[#CF6D4E] disabled:opacity-50"
          >
            修改
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-surface-600">身高 cm</span>
              <input
                value={heightCm}
                onChange={(e) => onHeightChange(e.target.value)}
                disabled={locked}
                inputMode="decimal"
                placeholder="例如 175"
                className={INPUT_CLASS}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-bold text-surface-600">体重 kg</span>
              <input
                value={weightKg}
                onChange={(e) => onWeightChange(e.target.value)}
                disabled={locked}
                inputMode="decimal"
                placeholder="例如 70"
                className={INPUT_CLASS}
              />
            </label>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-surface-500">
            <span>
              {isSelf
                ? profileEmpty
                  ? "你的个人资料里还没有身高体重。"
                  : "这里的改动只用于这次分析。"
                : "测别人时不会写进你的资料，成绩也不计入你的功率榜。"}
            </span>
            {isSelf && signedIn && profilePatch && (
              <button
                type="button"
                disabled={locked || savingProfile}
                onClick={onSaveToProfile}
                className="font-bold text-[#CF6D4E] hover:underline disabled:opacity-50"
              >
                {savingProfile ? "保存中…" : profileEmpty ? "保存到个人资料，下次自动填好" : "同时更新个人资料"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
