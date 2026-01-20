'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Video, Clock, ChevronRight, Play, Trophy, Medal, Award } from 'lucide-react';
import { Avatar } from 'primereact/avatar';
import { Dialog } from 'primereact/dialog';

interface RankingsTableItemProps {
    entry: any;
    index: number;
    rankColor: string;
    rankByField: string;
    coreValue: string | number;
    uniqueLinks: [string, string][]; 
    metaData: { name: string; userInput: string | null }[];
}

export const RankingsTableItem: React.FC<RankingsTableItemProps> = ({
    entry,
    index,
    rankColor,
    rankByField,
    coreValue,
    uniqueLinks,
    metaData
}) => {
    const [isActionsOpen, setIsActionsOpen] = useState(false);
    const [previewVideoUrl, setPreviewVideoUrl] = useState<string | null>(null);

    // --- 核心：极致丝滑的非线性惯性动画配置 ---
    const inertialSpring = {
        type: "spring",
        stiffness: 300,   // 劲度系数：数值越高回弹越快
        damping: 20,      // 阻尼：数值越低震荡感越强，20-25 是模拟物理惯性的黄金值
        mass: 0.8,        // 质量：让动画看起来有重量感
        velocity: 2,      // 初始速度：模拟被“推开”的瞬间爆发力
    } as const;

    const hasVideo = uniqueLinks.length > 0;
    const actionWidth = hasVideo ? Math.min(uniqueLinks.length * 80, 160) : 100;

    // 前三名差异化图标逻辑
    const getRankIcon = (rankIndex: number) => {
        switch(rankIndex) {
            case 0: return <Trophy size={14} className="mt-1 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]" />;
            case 1: return <Medal size={14} className="mt-1 text-slate-400" />;
            case 2: return <Award size={14} className="mt-1 text-orange-700" />;
            default: return null;
        }
    };

    // 处理视频链接点击
    const handleVideoClick = (e: React.MouseEvent<HTMLAnchorElement>, url: string) => {
        e.stopPropagation();
        e.preventDefault();
        
        // 检查是否是 mp4 文件
        if (url.toLowerCase().endsWith('.mp4')) {
            // 如果是 mp4，打开预览对话框
            setPreviewVideoUrl(url);
        } else {
            // 如果不是 mp4，保持原有行为（新窗口打开）
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    };

    return (
        <div className="relative overflow-hidden rounded-[24px] mb-3 select-none dark:bg-slate-900">
            
            {/* 底层操作区 (视频按钮) */}
            <div className="absolute inset-y-0 right-0 flex items-center px-6 gap-3">
                <AnimatePresence>
                    {isActionsOpen && (
                        <motion.div 
                            initial={{ opacity: 0, x: 50, scale: 0.5 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 20, scale: 0.8 }}
                            transition={{ ...inertialSpring, delay: 0.1 }}
                            className="flex gap-3"
                        >
                            {hasVideo ? (
                                uniqueLinks.map(([url, label], i) => (
                                    <a
                                        key={i}
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => handleVideoClick(e, url)}
                                        className="flex flex-col items-center justify-center bg-[#F28631] h-14 w-16 rounded-2xl text-white shadow-[0_8px_20px_rgba(242,134,49,0.3)] active:scale-90 transition-transform"
                                    >
                                        <Play size={20} fill="currentColor" />
                                        <span className="text-[10px] font-black mt-1 tracking-tighter italic">查看{label}</span>
                                    </a>
                                ))
                            ) : (
                                <span className="text-slate-600 font-black italic text-xs tracking-widest">暂无凭证</span>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* 表层卡片主体 */}
            <motion.div
                onClick={() => setIsActionsOpen(!isActionsOpen)}
                animate={{ x: isActionsOpen ? -actionWidth : 0 }}
                transition={inertialSpring}
                className={`
                    relative z-10 cursor-pointer bg-white dark:bg-surface-100 
                    border border-gray-100 dark:border-gray-800 rounded-[24px] 
                    p-4 md:px-7 md:py-4 shadow-sm
                    ${isActionsOpen ? 'shadow-2xl brightness-95' : ''}
                `}
            >
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 md:gap-8 flex-1 min-w-0">
                        {/* 排名与差异化图标 */}
                        <div className="flex flex-col items-center justify-center min-w-[2.5rem]">
                            <span className={`text-4xl md:text-5xl font-black italic tracking-tighter leading-none ${rankColor}`}>
                                {(index + 1).toString().padStart(2, '0')}
                            </span>
                            {getRankIcon(index)}
                        </div>

                        {/* 头像与用户信息 */}
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="relative shrink-0">
                                <Avatar
                                    image={entry.userProfile?.avatar || undefined}
                                    label={!entry.userProfile?.avatar ? (entry.userProfile?.name || 'U').charAt(0) : undefined}
                                    shape="circle"
                                    className="w-11 h-11 md:w-16 md:h-16 border-2 border-white dark:border-gray-800 shadow-md bg-orange-50 text-orange-600 font-black"
                                />
                                {hasVideo && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center shadow-sm">
                                        <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="min-w-0">
                                <h3 className="text-base md:text-2xl font-black text-slate-800 dark:text-white tracking-tight uppercase italic leading-tight truncate">
                                    {entry.userProfile?.name || (entry.extra_data as any)?.douyin_nickname || '匿名挑战者'}
                                </h3>
                                <div className="mt-1 flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                    <Clock size={10} strokeWidth={3} />
                                    {new Date(entry.created_at).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })} 提交
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 核心成绩展示 */}
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end leading-none">
                            <span className="text-[10px] font-black uppercase tracking-widest text-[#F28631] italic">
                                {rankByField || '最终成绩'}
                            </span>
                            <div className="text-4xl md:text-6xl font-black text-slate-900 dark:text-white tracking-tighter italic leading-none mt-1">
                                {coreValue}
                            </div>
                        </div>
                        <motion.div
                            animate={{ rotate: isActionsOpen ? 180 : 0, x: isActionsOpen ? 5 : 0 }}
                            className="text-slate-200 hidden sm:block"
                        >
                            <ChevronRight size={24} strokeWidth={3} />
                        </motion.div>
                    </div>
                </div>

                {/* 底部业务属性线 */}
                <div className="mt-4 pt-3 border-t border-slate-50 dark:border-gray-800/50 flex items-center justify-between">
                    <div className="flex flex-wrap gap-x-4">
                        {metaData.map((item, i) => (
                            <div key={i} className="flex items-baseline gap-1.5">
                                <span className="text-[9px] font-black text-slate-300 dark:text-gray-600 uppercase">
                                    {item.name}
                                </span>
                                <span className="text-[12px] font-bold text-slate-500 dark:text-gray-400 italic">
                                    {item.userInput || '--'}
                                </span>
                            </div>
                        ))}
                    </div>
                    
                    {hasVideo && !isActionsOpen && (
                        <div className="flex items-center gap-1.5 bg-orange-50 px-2 py-0.5 rounded-full">
                            <Video size={10} className="text-orange-500" fill="currentColor" />
                            <span className="text-[9px] font-black text-orange-500 uppercase italic tracking-tighter">
                                点击查看视频
                            </span>
                        </div>
                    )}
                </div>
            </motion.div>

            {/* 视频预览对话框 */}
            <Dialog
                visible={!!previewVideoUrl}
                onHide={() => setPreviewVideoUrl(null)}
                header="视频预览"
                style={{ width: '90vw', maxWidth: '800px' }}
                pt={{
                    root: { className: 'rounded-[24px] overflow-hidden border-none shadow-2xl' },
                    header: { className: 'p-4 pb-0' },
                    content: { className: 'p-4' }
                }}
                modal
                dismissableMask
            >
                {previewVideoUrl && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <video
                            src={previewVideoUrl}
                            controls
                            className="w-full h-full"
                            autoPlay
                        >
                            您的浏览器不支持视频播放
                        </video>
                    </div>
                )}
            </Dialog>
        </div>
    );
};