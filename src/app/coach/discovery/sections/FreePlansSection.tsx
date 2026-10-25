import Link from 'next/link';
import { Skeleton } from 'primereact/skeleton';
import type { PublicTrainingPlanListItem } from '@/app/service/knowledgeService';
import SectionHeader from './SectionHeader';

const LEVEL_LABELS: Record<string, string> = {
    beginner: '入门',
    intermediate: '进阶',
    advanced: '高阶',
};

interface FreePlansSectionProps {
    plans: PublicTrainingPlanListItem[];
    total: number | null;
    loading: boolean;
}

export default function FreePlansSection({ plans, total, loading }: FreePlansSectionProps) {
    if (!loading && plans.length === 0) return null;

    return (
        <section id="plans" className="flex scroll-mt-24 flex-col gap-5">
            <SectionHeader
                title="免费训练计划"
                count={total ? `${total} 套` : undefined}
                moreHref="/dashboard/knowledge/training-plans"
                moreText="计划库"
            />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-4">
                {loading
                    ? [1, 2, 3].map((i) => <Skeleton key={i} height="160px" className="rounded-2xl" />)
                    : plans.map((plan) => (
                        <Link
                            key={plan.id}
                            href={`/dashboard/knowledge/training-plans/${encodeURIComponent(plan.slug || plan.id)}`}
                            className="flex flex-col gap-2.5 rounded-2xl border border-surface-200 bg-surface-0 p-5 transition-colors hover:border-surface-300"
                        >
                            <span className="flex gap-1.5">
                                <span className="rounded-md bg-primary-50 px-2 py-0.5 text-xs font-bold text-primary-700">{plan.specialtyLabel || '训练计划'}</span>
                                <span className="rounded-md bg-surface-100 px-2 py-0.5 text-xs font-bold text-surface-600">{LEVEL_LABELS[plan.level] || plan.level}</span>
                            </span>
                            <span className="text-lg font-bold text-surface-900">{plan.name}</span>
                            <span className="line-clamp-2 text-sm leading-[22px] text-surface-600">{plan.description}</span>
                            <span className="mt-auto text-sm text-surface-500">{plan.weeks} 周 · {plan.daysPerWeek} 天/周</span>
                        </Link>
                    ))}
            </div>
        </section>
    );
}
