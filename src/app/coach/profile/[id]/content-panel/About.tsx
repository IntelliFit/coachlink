'use client';

import React from 'react';
import { Award, Star, Quote, Trophy, Link2, Mail, Phone, ExternalLink, ShieldCheck, ArrowUpRight } from 'lucide-react';
import { CoachesRow } from '@/types';
import { UpdateCoachProfileDto } from '@/app/api/coach/update-coach-profile/entity';

interface CoachAboutPanelProps {
    coach: CoachesRow;
}

const CoachAboutPanel: React.FC<CoachAboutPanelProps> = ({ coach }) => {
    const profile = (coach.profile || {}) as UpdateCoachProfileDto['profile'];
    const achievements = Array.isArray(profile?.achievements) && profile.achievements.length > 0
        ? profile.achievements
        : (Array.isArray(coach.achievements) ? coach.achievements : []);
    const caseStudies = Array.isArray(profile?.caseStudies) ? profile.caseStudies : [];
    const credentials = Array.isArray(profile?.credentials) ? profile.credentials : [];
    const socialLinks = (profile?.socialLinks && typeof profile.socialLinks === 'object') ? profile.socialLinks : {};
    
    const socialPlatformLabelMap: Record<string, string> = {
        douyin: '抖音', xiaohongshu: '小红书', zhihu: '知乎', bilibili: 'B站', kuaishou: '快手', other: '其他',
    };

    return (
        <div className="flex flex-col gap-14 py-6 text-surface-900">
            {/* 教学理念 - 仅保留文字质感 */}
            <section>
                <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-6">教学理念 / Philosophy</h3>
                <div className="pl-6 border-l border-surface-200">
                    <p className="text-base font-medium leading-relaxed text-surface-700 italic">
                        "{profile?.teachingPhilosophy || '暂无教学理念'}"
                    </p>
                </div>
            </section>

            {/* 成就与资质 - 左右分栏极简列表 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <section>
                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-6">成就奖项</h3>
                    <div className="space-y-4">
                        {achievements.length > 0 ? achievements.map((achievement, index) => (
                            <div key={index} className="flex items-start gap-3 group">
                                <div className="mt-1 flex-shrink-0 text-surface-300 group-hover:text-surface-900 transition-colors">
                                    <Star size={14} />
                                </div>
                                <span className="text-sm font-bold text-surface-600 tracking-tight">{achievement}</span>
                            </div>
                        )) : <span className="text-xs text-surface-300">无记录</span>}
                    </div>
                </section>

                <section>
                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-6">资质证书</h3>
                    <div className="space-y-4">
                        {credentials.length > 0 ? credentials.map((cred, idx) => (
                            <div key={idx} className="flex items-center justify-between group">
                                <div className="flex items-center gap-3">
                                    <ShieldCheck size={14} className="text-surface-300 group-hover:text-surface-900" />
                                    <span className="text-sm font-bold text-surface-600">{cred?.name}</span>
                                </div>
                                {cred?.url && (
                                    <a href={cred.url} target="_blank" className="text-surface-300 hover:text-surface-900">
                                        <ExternalLink size={12} />
                                    </a>
                                )}
                            </div>
                        )) : <span className="text-xs text-surface-300">未上传</span>}
                    </div>
                </section>
            </div>

            {/* 代表案例 - 无背景块列表 */}
            <section>
                <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-6">代表案例</h3>
                <div className="grid grid-cols-1 gap-2">
                    {caseStudies.length > 0 ? caseStudies.map((item, idx) => (
                        <div key={idx} className="py-3 border-b border-surface-100 last:border-0 flex gap-4 items-baseline">
                            <span className="text-[10px] font-black text-surface-300 tracking-tighter w-8">0{idx + 1}</span>
                            <span className="text-sm font-bold text-surface-600">{item}</span>
                        </div>
                    )) : <span className="text-xs text-surface-300">暂无</span>}
                </div>
            </section>

            {/* 底部：联系与社交 - 纯文字排版 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-surface-100">
                <section>
                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-4">联系方式</h3>
                    <div className="space-y-2">
                        {profile?.contactEmail && <div className="text-sm font-bold flex items-center gap-2"><Mail size={12} className="text-surface-300"/>{profile.contactEmail}</div>}
                        {profile?.contactPhone && <div className="text-sm font-bold flex items-center gap-2"><Phone size={12} className="text-surface-300"/>{profile.contactPhone}</div>}
                    </div>
                </section>

                <section>
                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-4">社交平台</h3>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {Object.entries(socialLinks).map(([platform, url]) => (
                            <a key={platform} href={url as string} target="_blank" className="text-sm font-bold text-surface-400 hover:text-surface-900 flex items-center gap-1.5 transition-colors underline underline-offset-4 decoration-surface-100 hover:decoration-surface-900">
                                {socialPlatformLabelMap[platform] || platform}
                                <ArrowUpRight size={10} />
                            </a>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default CoachAboutPanel;