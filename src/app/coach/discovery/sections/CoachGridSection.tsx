import Link from 'next/link';
import { Star } from 'lucide-react';
import { Skeleton } from 'primereact/skeleton';
import { COACH_TRACK_OPTIONS, getCoachTrackShortLabel } from '@/lib/coachApplicationOptions';
import SectionHeader from './SectionHeader';
import type { DiscoveryCoach } from './types';

const MAX_COACHES = 8;
const MOBILE_COACHES = 4;

interface CoachGridSectionProps {
    coaches: DiscoveryCoach[];
    loading: boolean;
    selectedTrack: string;
    onSelectTrack: (track: string) => void;
    minPriceByCoach: Record<string, number>;
}

const chipClass = (active: boolean) =>
    `h-9 rounded-full px-4 text-sm transition-colors ${
        active ? 'bg-surface-900 font-bold text-surface-0' : 'bg-surface-100 text-surface-700 hover:bg-surface-200'
    }`;

function CoachCard({ coach, minPrice, guideId, desktopOnly }: { coach: DiscoveryCoach; minPrice?: number; guideId?: string; desktopOnly?: boolean }) {
    const level = getCoachTrackShortLabel(coach.coach_track);
    const rating = typeof coach.averageRating === 'number' && coach.averageRating > 0 ? coach.averageRating.toFixed(1) : null;
    const students = coach.studentCount || 0;

    return (
        <Link
            id={guideId}
            href={`/coach/profile/${coach.id}?from=discovery`}
            className={`${desktopOnly ? 'hidden md:flex' : 'flex'} flex-col gap-3.5 rounded-2xl border border-surface-200 bg-surface-0 p-5 transition-colors hover:border-surface-300`}
        >
            <span className="flex items-center gap-3">
                {coach.avatar_url ? (
                    <img src={coach.avatar_url} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
                ) : (
                    <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-surface-800 text-xl font-bold text-surface-0">
                        {coach.name.charAt(0)}
                    </span>
                )}
                <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex items-center gap-1.5">
                        <span className="truncate text-[17px] font-bold text-surface-900">{coach.name}</span>
                        <span className={`shrink-0 rounded-md px-1.5 text-[11px] font-bold ${level === '专业' ? 'border border-surface-900 text-surface-900' : 'bg-surface-100 text-surface-600'}`}>
                            {level}
                        </span>
                    </span>
                    <span className="truncate text-[13px] text-surface-600">{coach.bio || '暂无简介'}</span>
                </span>
            </span>
            <span className="flex min-h-6 flex-wrap gap-1.5">
                {(coach.specialties || []).slice(0, 2).map((spec) => (
                    <span key={spec} className="rounded-md bg-surface-100 px-2 py-0.5 text-xs text-surface-600">{spec}</span>
                ))}
            </span>
            <span className="mt-auto flex items-center justify-between border-t border-surface-100 pt-3">
                <span className="flex items-center gap-1 text-[13px] text-surface-600">
                    {rating ? (
                        <>
                            <Star size={12} className="fill-amber-500 text-amber-500" aria-hidden="true" />
                            {rating} · {students} 位学员
                        </>
                    ) : students > 0 ? `暂无评价 · ${students} 位学员` : '新入驻'}
                </span>
                {typeof minPrice === 'number' ? (
                    <span className="text-lg font-black text-surface-900">¥{minPrice}<span className="text-xs font-normal text-surface-500"> 起</span></span>
                ) : (
                    <span className="text-sm font-bold text-primary">看方案 ›</span>
                )}
            </span>
        </Link>
    );
}

export default function CoachGridSection({ coaches, loading, selectedTrack, onSelectTrack, minPriceByCoach }: CoachGridSectionProps) {
    return (
        <section id="coaches" className="flex scroll-mt-24 flex-col gap-5">
            <SectionHeader title="推荐教练" moreHref="/search" moreText="全部教练">
                <div id="guide-discovery-filter" className="flex flex-wrap gap-2" role="group" aria-label="教练层级">
                    <button type="button" aria-pressed={selectedTrack === 'all'} onClick={() => onSelectTrack('all')} className={chipClass(selectedTrack === 'all')}>
                        全部教练
                    </button>
                    {COACH_TRACK_OPTIONS.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            aria-pressed={selectedTrack === option.value}
                            onClick={() => onSelectTrack(option.value)}
                            className={chipClass(selectedTrack === option.value)}
                        >
                            {option.label}
                        </button>
                    ))}
                </div>
            </SectionHeader>

            {loading ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                    {[1, 2, 3, 4].map((i) => <Skeleton key={i} height="168px" className="rounded-2xl" />)}
                </div>
            ) : coaches.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-surface-300 py-12 text-center text-sm text-surface-500">
                    这个层级暂时没有教练，换个层级看看
                </div>
            ) : (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4">
                    {coaches.slice(0, MAX_COACHES).map((coach, idx) => (
                        <CoachCard
                            key={coach.id}
                            coach={coach}
                            minPrice={minPriceByCoach[coach.id]}
                            guideId={idx === 0 ? 'guide-discovery-first-coach' : undefined}
                            desktopOnly={idx >= MOBILE_COACHES}
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
