import { AlertCircle } from 'lucide-react';
import type { BojiMetricCard } from '@coachlink/core/src/bojiDetector';

const STATUS_BADGE: Record<BojiMetricCard['status'], { label: string; className: string } | null> = {
  ok: null,
  low_confidence: { label: '仅供参考', className: 'bg-amber-50 text-amber-700' },
  unavailable: { label: '测不了', className: 'bg-slate-100 text-slate-500' },
};

export default function MetricCard({ card }: { card: BojiMetricCard }) {
  const badge = STATUS_BADGE[card.status];
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-black text-slate-950">{card.title}</div>
          <div className="mt-1 text-xs leading-5 text-slate-500">{card.explain}</div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-black tracking-tight text-[#CF6D4E]">{card.score ?? '—'}</div>
          {badge && (
            <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold ${badge.className}`}>
              {badge.label}
            </span>
          )}
        </div>
      </div>
      <div className="mt-4 text-base font-bold text-slate-900">{card.headline}</div>
      {card.details.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-slate-600">
          {card.details.map((detail) => (
            <li key={detail}>{detail}</li>
          ))}
        </ul>
      )}
      {card.reasons.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-slate-100 pt-3">
          {card.reasons.map((reason) => (
            <li key={reason} className="flex gap-1.5 text-xs leading-5 text-slate-600">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
              {reason}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
