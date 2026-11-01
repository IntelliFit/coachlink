"use client";

import {
  repRomDetail,
  repRomGradeLabel,
  type PowerAnalysisRepRom,
} from "@coachlink/core/src/powerAnalysisRepRom";

const GRADE_CHIP = {
  full: "border-emerald-200 dark:border-[#2E4A3B] bg-emerald-50 dark:bg-[#1F3329] text-emerald-700 dark:text-[#5DBB8E]",
  partial: "border-amber-200 dark:border-[#5A4626] bg-amber-50 dark:bg-[#3A2E1A] text-amber-700 dark:text-[#E8B866]",
};

interface RepRomRowProps {
  rom: PowerAnalysisRepRom;
  mode: unknown;
  colSpan: number;
}

/** A second row under each pull-up or muscle-up rep: full or partial, and why. */
export default function RepRomRow({ rom, mode, colSpan }: RepRomRowProps) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-3 pb-2 text-xs text-surface-500">
        <span className={`mr-2 inline-block rounded-full border px-2 py-0.5 font-semibold ${GRADE_CHIP[rom.grade]}`}>
          {repRomGradeLabel(rom)}
        </span>
        {repRomDetail(rom, mode)}
        {rom.reasonZh && <span className="ml-1 text-surface-700">（{rom.reasonZh}）</span>}
      </td>
    </tr>
  );
}
