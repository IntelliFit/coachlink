import Link from 'next/link';
import { Calculator, Database, MapPin, ScanLine, Target, WandSparkles, Wrench, Zap, type LucideIcon } from 'lucide-react';
import { STUDENT_TOOLBOX_LINKS } from '@/config/toolbox';
import SectionHeader from './SectionHeader';

const MAX_TOOLS = 4;

const TOOL_ICONS: Record<string, LucideIcon> = {
    boji: ScanLine,
    'one-arm-pull-up': Target,
    'motion-effects': WandSparkles,
    'power-analysis': Zap,
    'strength-calculator': Calculator,
    'bar-locations': MapPin,
    'community-data': Database,
};

export default function ToolsSection() {
    const tools = STUDENT_TOOLBOX_LINKS.filter((tool) => !/^https?:\/\//.test(tool.url));
    if (tools.length === 0) return null;

    return (
        <section className="flex flex-col gap-5">
            <SectionHeader title="训练工具" moreHref="/toolbox" moreText={`全部 ${tools.length} 个`} />
            <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
                {tools.slice(0, MAX_TOOLS).map((tool) => {
                    const Icon = TOOL_ICONS[tool.key] || Wrench;
                    return (
                        <Link
                            key={tool.key}
                            href={tool.url}
                            className="flex flex-col gap-3 rounded-2xl border border-surface-200 bg-surface-0 p-5 transition-colors hover:border-surface-300"
                        >
                            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-50 text-primary-400">
                                <Icon size={22} aria-hidden={true} />
                            </span>
                            <span className="text-base font-bold text-surface-900">{tool.label}</span>
                            {tool.description && (
                                <span className="line-clamp-2 text-[13px] leading-5 text-surface-500">{tool.description}</span>
                            )}
                        </Link>
                    );
                })}
            </div>
        </section>
    );
}
