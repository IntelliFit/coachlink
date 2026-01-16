'use client';

import React from 'react';
import { Dumbbell, User, Bike, Footprints } from 'lucide-react';
import { SportCards } from '@/types/sportCards';
import { getPowerliftingTotal, getStreetliftingTotal, getWeightliftingTotal } from '@/lib/sportsCollections';

interface SportCardsDisplayProps {
    sportCards: SportCards | null;
}

const MetricPill = ({ label, value, unit, highlight }: { label: string; value: string | number | null; unit?: string; highlight?: boolean }) => (
    <span
        className={[
            'inline-flex items-baseline gap-1 rounded-xl border px-2.5 py-1.5',
            highlight ? 'bg-surface-100 border-surface-200' : 'bg-surface-50 border-surface-200'
        ].join(' ')}
    >
        <span className="text-[11px] font-bold text-surface-600">{label}</span>
        <span className={highlight ? 'text-sm font-black text-surface-900' : 'text-sm font-black text-primary'}>
            {value ?? '-'}
        </span>
        {unit ? <span className="text-[11px] text-surface-500">{unit}</span> : null}
    </span>
);

const RowLine = ({ title, icon: Icon, iconClass, children }: {
    title: string; 
    icon: React.ElementType; 
    iconClass: string;
    children: React.ReactNode;
}) => (
    <div className="bg-surface rounded-2xl shadow-sm border border-surface-200 px-3 py-2">
        <div className="flex items-start gap-2">
            <div className="flex items-center gap-2 shrink-0 pt-0.5">
                <Icon className={`w-4 h-4 ${iconClass}`} />
                <span className="text-sm font-black text-surface-900">{title}</span>
            </div>
            <div className="flex-1 min-w-0 overflow-x-auto">
                <div className="flex gap-2 whitespace-nowrap pb-0.5">
                    {children}
                </div>
            </div>
        </div>
    </div>
);

export const SportCardsDisplay: React.FC<SportCardsDisplayProps> = ({ sportCards }) => {
    if (!sportCards?.activeCards || sportCards.activeCards.length === 0) {
        return null;
    }

    return (
        <div className="space-y-2">
            {/* 1. 力量举 */}
            {sportCards.activeCards.includes('powerlifting') && sportCards.powerlifting && (
                <RowLine title="力量举" icon={Dumbbell} iconClass="text-orange-500">
                    <MetricPill label="深蹲" value={sportCards.powerlifting.squat} unit="kg" />
                    <MetricPill label="卧推" value={sportCards.powerlifting.bench} unit="kg" />
                    <MetricPill label="硬拉" value={sportCards.powerlifting.deadlift} unit="kg" />
                    <MetricPill label="总和" value={getPowerliftingTotal(sportCards.powerlifting)} unit="kg" highlight />
                </RowLine>
            )}

            {/* 2. 街头力量举 */}
            {sportCards.activeCards.includes('streetlifting') && sportCards.streetlifting && (
                <RowLine title="街头力量举" icon={Dumbbell} iconClass="text-lime-600">
                    <MetricPill label="引体" value={sportCards.streetlifting.weightedPullup} unit="kg" />
                    <MetricPill label="双杠" value={sportCards.streetlifting.weightedDip} unit="kg" />
                    <MetricPill label="双力臂" value={sportCards.streetlifting.weightedMuscleUp} unit="kg" />
                    <MetricPill label="深蹲" value={sportCards.streetlifting.squat} unit="kg" />
                    <MetricPill label="总和" value={getStreetliftingTotal(sportCards.streetlifting)} unit="kg" highlight />
                </RowLine>
            )}

            {/* 3. 街头健身 */}
            {sportCards.activeCards.includes('calisthenics') && sportCards.calisthenics && (
                <RowLine title="街头健身" icon={User} iconClass="text-green-600">
                    <MetricPill label="引体" value={sportCards.calisthenics.maxPullups} unit="次" />
                    <MetricPill label="双杠" value={sportCards.calisthenics.maxDips} unit="次" />
                    <MetricPill label="双力臂" value={sportCards.calisthenics.maxMuscleUps} unit="次" />
                    <MetricPill label="前水平" value={sportCards.calisthenics.frontLever} unit="秒" />
                    <MetricPill label="俄式" value={sportCards.calisthenics.planche} unit="秒" />
                    <MetricPill label="旗帜" value={sportCards.calisthenics.humanFlag} unit="秒" />
                </RowLine>
            )}

            {/* 4. 举重 */}
            {sportCards.activeCards.includes('weightlifting') && sportCards.weightlifting && (
                <RowLine title="举重" icon={Dumbbell} iconClass="text-red-600">
                    <MetricPill label="抓举" value={sportCards.weightlifting.snatch} unit="kg" />
                    <MetricPill label="挺举" value={sportCards.weightlifting.cleanAndJerk} unit="kg" />
                    <MetricPill label="总和" value={getWeightliftingTotal(sportCards.weightlifting)} unit="kg" highlight />
                </RowLine>
            )}

            {/* 5. 健美/形体 */}
            {sportCards.activeCards.includes('bodybuilding') && sportCards.bodybuilding && (
                <RowLine title="健美/形体" icon={User} iconClass="text-purple-600">
                    <MetricPill label="体脂" value={sportCards.bodybuilding.bodyfat} unit="%" />
                    <MetricPill label="胸" value={sportCards.bodybuilding.chest} unit="cm" />
                    <MetricPill label="臂" value={sportCards.bodybuilding.arm} unit="cm" />
                    <MetricPill label="腰" value={sportCards.bodybuilding.waist} unit="cm" />
                    <MetricPill label="臀" value={sportCards.bodybuilding.hip} unit="cm" />
                    <MetricPill label="大腿" value={sportCards.bodybuilding.thigh} unit="cm" />
                    <MetricPill label="小腿" value={sportCards.bodybuilding.calf} unit="cm" />
                </RowLine>
            )}

            {/* 6. 跑步 */}
            {sportCards.activeCards.includes('running') && sportCards.running && (
                <RowLine title="跑步" icon={Footprints} iconClass="text-blue-600">
                    <MetricPill label="5km" value={sportCards.running.fiveK} />
                    <MetricPill label="10km" value={sportCards.running.tenK} />
                    <MetricPill label="半马" value={sportCards.running.halfMarathon} />
                    <MetricPill label="全马" value={sportCards.running.marathon} />
                </RowLine>
            )}

            {/* 7. 骑行 */}
            {sportCards.activeCards.includes('cycling') && sportCards.cycling && (
                <RowLine title="骑行" icon={Bike} iconClass="text-cyan-600">
                    <MetricPill label="FTP" value={sportCards.cycling.ftp} unit="W" />
                    <MetricPill label="最大功率" value={sportCards.cycling.maxPower} unit="W" />
                    <MetricPill label="最长" value={sportCards.cycling.maxDistance} unit="km" />
                </RowLine>
            )}
        </div>
    );
};