import type { ReactNode } from "react";

type CardAction = {
  label: string;
  onClick: () => void;
  icon?: ReactNode;
};

type EarlierJobCardProps = {
  title: string;
  detail: string;
  /** 0-100。不在生成中时不传，不显示进度条。 */
  progress?: number;
  primary?: CardAction;
  secondary?: CardAction;
};

/** 刷新或回到页面时，上次那个视频的进度、下载入口和结果提示都显示在这里。 */
export function EarlierJobCard({ title, detail, progress, primary, secondary }: EarlierJobCardProps) {
  return (
    <section
      aria-live="polite"
      className="mb-6 rounded-[28px] border border-[#E3D9D0] dark:border-[#37312B] bg-white dark:bg-[#211E1B] p-5 shadow-sm"
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1 basis-64">
          <h2 className="text-lg font-black">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-[#A0978B]">{detail}</p>
        </div>
        {(primary || secondary) && (
          <div className="flex flex-wrap items-center gap-3">
            {primary && (
              <button
                type="button"
                onClick={primary.onClick}
                className="inline-flex items-center gap-2 rounded-full bg-[#B4553A] px-5 py-3 text-sm font-black text-white"
              >
                {primary.icon}
                {primary.label}
              </button>
            )}
            {secondary && (
              <button
                type="button"
                onClick={secondary.onClick}
                className="rounded-full border border-slate-200 dark:border-[#37312B] bg-white dark:bg-[#211E1B] px-5 py-3 text-sm font-black text-slate-700 dark:text-[#CBC3B8]"
              >
                {secondary.label}
              </button>
            )}
          </div>
        )}
      </div>
      {progress !== undefined && (
        <div
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label="生成进度"
          className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-[#2A2622]"
        >
          <div
            className="h-full rounded-full bg-[#CF6D4E] transition-[width]"
            style={{ width: `${Math.round(progress)}%` }}
          />
        </div>
      )}
    </section>
  );
}
