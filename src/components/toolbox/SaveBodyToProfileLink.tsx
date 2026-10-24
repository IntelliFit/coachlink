"use client";

import { useEffect, useState } from "react";
import type { ProfileBodyMetricsPatch } from "@coachlink/core/src/bodyMetrics";

interface Props {
  /** What saving would change; nothing renders when null. */
  patch: ProfileBodyMetricsPatch | null;
  /** The profile has no value yet, so the link offers to fill it instead of "update". */
  profileEmpty: boolean;
  onSave: (patch: ProfileBodyMetricsPatch) => Promise<void>;
  className?: string;
}

/** Inline "write what I typed back to my profile" link for tools that prefill body metrics. */
export default function SaveBodyToProfileLink({ patch, profileEmpty, onSave, className = "" }: Props) {
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (patch && status === "saved") setStatus("idle");
    // Only react to a new difference appearing after a save.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patch]);

  if (!patch && status !== "saved") return null;
  if (status === "saved") {
    return <span className={`text-xs font-semibold text-emerald-600 ${className}`}>已更新个人资料</span>;
  }

  const save = async () => {
    if (!patch) return;
    setStatus("saving");
    try {
      await onSave(patch);
      setStatus("saved");
    } catch (error: any) {
      setMessage(error?.message || "保存失败，请稍后重试");
      setStatus("error");
    }
  };

  return (
    <span className={`text-xs ${className}`}>
      <button
        type="button"
        disabled={status === "saving"}
        onClick={() => void save()}
        className="font-bold text-[#CF6D4E] hover:underline disabled:opacity-50"
      >
        {status === "saving" ? "保存中…" : profileEmpty ? "保存到个人资料，下次自动填好" : "同时更新个人资料"}
      </button>
      {status === "error" && <span className="ml-2 text-rose-600">{message}</span>}
    </span>
  );
}
