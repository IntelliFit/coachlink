import { CoachActionRow } from '@/types';
import { Button } from 'primereact/button';
import React from 'react';

interface ActionCardProps {
    action: CoachActionRow;
    onEditAction: (action: CoachActionRow) => void;
    onDeleteAction: (action: CoachActionRow) => void;
}

const formatActionTime = (createdAt: string, updatedAt: string) => {
    const cTime = new Date(createdAt);
    const uTime = new Date(updatedAt);

    // 格式化函数：26.01.07 15:21
    const format = (date: Date) => {
        const y = date.getFullYear().toString().slice(-2);
        const m = (date.getMonth() + 1).toString().padStart(2, '0');
        const d = date.getDate().toString().padStart(2, '0');
        const hh = date.getHours().toString().padStart(2, '0');
        const mm = date.getMinutes().toString().padStart(2, '0');
        return `${y}.${m}.${d} ${hh}:${mm}`;
    };

    const formattedCreate = format(cTime);
    const formattedUpdate = format(uTime);

    // 如果创建和修改时间一致（分钟级），显示创建，否则显示修改
    // 注意：这里比较的是格式化后的字符串，确保视觉一致性即为逻辑一致性
    if (formattedCreate === formattedUpdate) {
        return { label: '创建于', time: formattedCreate, isUpdate: false };
    }
    return { label: '修改于', time: formattedUpdate, isUpdate: true };
};

const ActionCard: React.FC<ActionCardProps> = ({
    action,
    onEditAction,
    onDeleteAction,
}) => {

    const typeConfig: Record<string, any> = {
        DIET: { label: '饮食', icon: 'pi-apple', color: 'bg-green-50 text-green-600' },
        CARDIO: { label: '有氧', icon: 'pi-bolt', color: 'bg-blue-50 text-blue-600' },
        HABIT: { label: '习惯', icon: 'pi-heart', color: 'bg-purple-50 text-purple-600' },
        STRENGTH: { label: '力量', icon: 'pi-sliders-h', color: 'bg-orange-50 text-orange-600' }
    };
    const config = typeConfig[action.type || 'STRENGTH'] || typeConfig.STRENGTH;
    const timeInfo = formatActionTime(action.created_at, action.updated_at);

    return (
        <div className="group relative flex items-center gap-5 p-4 mb-3 bg-surface dark:bg-surface-900 border border-surface-100 dark:border-surface-800 rounded-[20px] transition-all duration-300 hover:shadow-[0_12px_30px_-10px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 hover:border-primary-200">

            {/* 左侧图标区 */}
            <div className={`flex items-center justify-center min-w-[56px] h-[56px] rounded-[16px] ${config.color} border border-surface dark:border-surface-800 shadow-sm relative`}>
                <i className={`pi ${config.icon} text-xl`}></i>
            </div>

            {/* 内容区 */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-bold text-surface-900 dark:text-surface-0 tracking-tight truncate">
                            {action.name}
                        </h3>
                        {action.canonical_action_id && <i className="pi pi-verified text-primary-500 text-[10px]" />}
                    </div>

                    {/* 动态时间标签：根据状态切换图标与文案 */}
                    <div className="hidden sm:flex items-center gap-2 opacity-40 group-hover:opacity-70 transition-opacity duration-300">
                        <span className="text-[10px] tracking-tight whitespace-nowrap">
                            {timeInfo.label}
                        </span>
                        <span className="text-[11px] tracking-tighter">
                            {timeInfo.time}
                        </span>
                    </div>
                </div>

                <p className="text-[13px] text-surface-500 line-clamp-1 mb-2">
                    {action.detail || '暂无动作细节说明'}
                </p>

                {/* 底部标签组 */}
                <div className="flex flex-wrap gap-1.5 items-center">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wider ${config.color}`}>
                        {config.label}
                    </span>

                    {/* 分割线逻辑：如果既没有部位也没有演示，就不显余部分 */}
                    {(action.positions?.length > 0 || action.url) && (
                        <div className="w-[1px] h-2 bg-surface-200 mx-1" />
                    )}

                    {action.positions?.slice(0, 2).map((pos, i) => (
                        <span key={i} className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-surface-100 text-surface-600">
                            {pos}
                        </span>
                    ))}

                    {/* 演示视频的小标识 */}
                    {action.url && (
                        <span className="text-[10px] font-medium text-blue-500 flex items-center">
                            <span className="w-1 h-1 bg-blue-500 rounded-full mr-1 animate-pulse" />
                            有演示
                        </span>
                    )}
                </div>
            </div>

            {/* 操作区 (逻辑保持不变) */}
            <div className="flex items-center gap-1 opacity-0 translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300 pointer-events-none group-hover:pointer-events-auto">
                <Button icon="pi pi-pencil" text rounded className="w-9 h-9 text-surface-500 hover:bg-surface-100" onClick={() => onEditAction(action)} />
                <Button icon="pi pi-trash" text rounded severity="danger" className="w-9 h-9 hover:bg-red-50" onClick={() => onDeleteAction(action)} />
            </div>
        </div>
    );
}

export default ActionCard;