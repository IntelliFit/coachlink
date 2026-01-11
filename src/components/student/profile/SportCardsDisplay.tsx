'use client';

import React from 'react';
import { Dumbbell, User, Bike, Footprints } from 'lucide-react';
import { SportCards, getPowerliftingTotal, getStreetliftingTotal, getWeightliftingTotal } from '@/types/sportCards';

interface SportCardsDisplayProps {
    sportCards: SportCards | null;
}

// 数据单元格组件
const DataCell = ({ label, value, unit }: { label: string; value: string | number | null; unit: string }) => (
    <div className="bg-surface-50 rounded-xl p-4 text-center border border-surface-200">
        <div className="text-xs text-surface-600 mb-1 font-medium">{label}</div>
        <div className="text-xl font-bold text-primary">{value || '-'}</div>
        <div className="text-xs text-surface-500">{unit}</div>
    </div>
);

// 高亮数据单元格
const HighlightCell = ({ label, value, unit }: { label: string; value: string | number | null; unit: string }) => (
    <div className="bg-surface-100 rounded-xl p-4 text-center border border-surface-200">
        <div className="text-xs text-surface-600 mb-1 font-medium">{label}</div>
        <div className="text-xl font-bold text-surface-900">{value || '-'}</div>
        <div className="text-xs text-surface-500">{unit}</div>
    </div>
);

// 卡片容器
const CardContainer = ({ title, icon: Icon, children, color = 'primary' }: { 
    title: string; 
    icon: React.ElementType; 
    children: React.ReactNode;
    color?: string;
}) => (
    <div className="bg-surface rounded-2xl shadow-sm overflow-hidden border border-surface-200">
        <div className="px-5 py-3 border-b border-surface-200">
            <h3 className="text-base font-bold flex items-center gap-2 text-surface-900">
                <Icon className={`w-5 h-5 text-${color}`} />
                {title}
            </h3>
        </div>
        <div className="p-5">{children}</div>
    </div>
);

export const SportCardsDisplay: React.FC<SportCardsDisplayProps> = ({ sportCards }) => {
    if (!sportCards?.activeCards || sportCards.activeCards.length === 0) {
        return null;
    }

    return (
        <div className="space-y-4">
            {/* 1. 力量举 */}
            {sportCards.activeCards.includes('powerlifting') && sportCards.powerlifting && (
                <CardContainer title="力量举" icon={Dumbbell} color="orange-500">
                    <div className="grid grid-cols-4 gap-3">
                        <DataCell label="深蹲" value={sportCards.powerlifting.squat} unit="kg" />
                        <DataCell label="卧推" value={sportCards.powerlifting.bench} unit="kg" />
                        <DataCell label="硬拉" value={sportCards.powerlifting.deadlift} unit="kg" />
                        <HighlightCell label="总和" value={getPowerliftingTotal(sportCards.powerlifting)} unit="kg" />
                    </div>
                </CardContainer>
            )}

            {/* 2. 街头力量举 */}
            {sportCards.activeCards.includes('streetlifting') && sportCards.streetlifting && (
                <CardContainer title="街头力量举" icon={Dumbbell} color="lime-500">
                    <div className="grid grid-cols-4 gap-3">
                        <DataCell label="负重引体" value={sportCards.streetlifting.weightedPullup} unit="kg" />
                        <DataCell label="负重双杠" value={sportCards.streetlifting.weightedDip} unit="kg" />
                        <DataCell label="负重双力臂" value={sportCards.streetlifting.weightedMuscleUp} unit="kg" />
                        <DataCell label="深蹲" value={sportCards.streetlifting.squat} unit="kg" />
                    </div>
                </CardContainer>
            )}

            {/* 3. 街头健身 */}
            {sportCards.activeCards.includes('calisthenics') && sportCards.calisthenics && (
                <CardContainer title="街头健身" icon={User} color="green-500">
                    <div className="grid grid-cols-3 gap-3">
                        <DataCell label="最大引体" value={sportCards.calisthenics.maxPullups} unit="次" />
                        <DataCell label="最大双杠" value={sportCards.calisthenics.maxDips} unit="次" />
                        <DataCell label="最大双力臂" value={sportCards.calisthenics.maxMuscleUps} unit="次" />
                        <DataCell label="前水平" value={sportCards.calisthenics.frontLever} unit="秒" />
                        <DataCell label="俄式挺身" value={sportCards.calisthenics.planche} unit="秒" />
                        <DataCell label="人体旗帜" value={sportCards.calisthenics.humanFlag} unit="秒" />
                    </div>
                </CardContainer>
            )}

            {/* 4. 举重 */}
            {sportCards.activeCards.includes('weightlifting') && sportCards.weightlifting && (
                <CardContainer title="举重" icon={Dumbbell} color="red-500">
                    <div className="grid grid-cols-3 gap-3">
                        <DataCell label="抓举" value={sportCards.weightlifting.snatch} unit="kg" />
                        <DataCell label="挺举" value={sportCards.weightlifting.cleanAndJerk} unit="kg" />
                        <HighlightCell label="总成绩" value={getWeightliftingTotal(sportCards.weightlifting)} unit="kg" />
                    </div>
                </CardContainer>
            )}

            {/* 5. 健美/形体 */}
            {sportCards.activeCards.includes('bodybuilding') && sportCards.bodybuilding && (
                <CardContainer title="健美/形体" icon={User} color="purple-500">
                    <div className="grid grid-cols-4 gap-3">
                        <DataCell label="体脂率" value={sportCards.bodybuilding.bodyfat} unit="%" />
                        <DataCell label="胸围" value={sportCards.bodybuilding.chest} unit="cm" />
                        <DataCell label="臂围" value={sportCards.bodybuilding.arm} unit="cm" />
                        <DataCell label="腰围" value={sportCards.bodybuilding.waist} unit="cm" />
                        <DataCell label="臀围" value={sportCards.bodybuilding.hip} unit="cm" />
                        <DataCell label="大腿围" value={sportCards.bodybuilding.thigh} unit="cm" />
                        <DataCell label="小腿围" value={sportCards.bodybuilding.calf} unit="cm" />
                    </div>
                </CardContainer>
            )}

            {/* 6. 跑步 */}
            {sportCards.activeCards.includes('running') && sportCards.running && (
                <CardContainer title="跑步" icon={Footprints} color="blue-500">
                    <div className="grid grid-cols-4 gap-3">
                        <DataCell label="5公里" value={sportCards.running.fiveK} unit="" />
                        <DataCell label="10公里" value={sportCards.running.tenK} unit="" />
                        <DataCell label="半马" value={sportCards.running.halfMarathon} unit="" />
                        <DataCell label="全马" value={sportCards.running.marathon} unit="" />
                    </div>
                </CardContainer>
            )}

            {/* 7. 骑行 */}
            {sportCards.activeCards.includes('cycling') && sportCards.cycling && (
                <CardContainer title="骑行" icon={Bike} color="cyan-500">
                    <div className="grid grid-cols-3 gap-3">
                        <DataCell label="FTP" value={sportCards.cycling.ftp} unit="W" />
                        <DataCell label="最大功率" value={sportCards.cycling.maxPower} unit="W" />
                        <DataCell label="最长单骑" value={sportCards.cycling.maxDistance} unit="km" />
                    </div>
                </CardContainer>
            )}
        </div>
    );
};