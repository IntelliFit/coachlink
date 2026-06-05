'use client';

import React, { useState } from 'react';
import { Award, Star, Trophy, Mail, Phone, ExternalLink, ShieldCheck, ArrowUpRight, MapPin, ChevronDown, ChevronUp } from 'lucide-react';
import { CoachesRow } from '@/types';
import { UpdateCoachProfileDto } from '@/app/api/coach/update-coach-profile/entity';
import TianDiTuMapViewer from '@/components/TianDiTuMapViewer';
import {
    COACH_APPLICATION_MATERIAL_CATEGORIES,
    groupCoachApplicationMaterials,
    type CoachApplicationMaterial,
} from '@/lib/coachApplicationMaterials';

interface CoachAboutPanelProps {
    coach: CoachesRow;
}

const CoachAboutPanel: React.FC<CoachAboutPanelProps> = ({ coach }) => {
    const [showMap, setShowMap] = useState(false);
    const profile = (coach.profile || {}) as UpdateCoachProfileDto['profile'];
    const achievements = Array.isArray(profile?.achievements) && profile.achievements.length > 0
        ? profile.achievements
        : (Array.isArray(coach.achievements) ? coach.achievements : []);
    const caseStudies = Array.isArray(profile?.caseStudies) ? profile.caseStudies : [];
    const credentials = Array.isArray(profile?.credentials) ? profile.credentials : [];
    const socialLinks = (profile?.socialLinks && typeof profile.socialLinks === 'object') ? profile.socialLinks : {};
    const groupedMaterials = groupCoachApplicationMaterials((profile as any)?.applicationMaterials);
    const hasRichMaterials = groupedMaterials.all.length > 0;
    const materialLabelMap = Object.fromEntries(COACH_APPLICATION_MATERIAL_CATEGORIES.map((item) => [item.value, item.label]));
    
    const socialPlatformLabelMap: Record<string, string> = {
        douyin: '抖音', xiaohongshu: '小红书', zhihu: '知乎', bilibili: 'B站', kuaishou: '快手', other: '其他',
    };

    const hasLocation = coach.province || coach.city || coach.county || coach.address;
    const locationParts = [coach.province, coach.city, coach.county].filter(Boolean);
    const locationLine = locationParts.length ? locationParts.join(' ') : '';

    const renderMaterialCard = (item: CoachApplicationMaterial) => (
        <div key={item.id} className="rounded-xl border border-surface-200 bg-surface-0 p-4 shadow-sm">
            <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="rounded-lg bg-primary-50 px-2 py-1 text-[10px] font-black text-primary-700">
                    {materialLabelMap[item.category] || '材料'}
                </span>
                {!item.isPublic && (
                    <span className="rounded-lg bg-yellow-50 px-2 py-1 text-[10px] font-black text-yellow-700">
                        仅审核可见
                    </span>
                )}
            </div>
            <h4 className="text-sm font-black text-surface-900">{item.title}</h4>
            {item.summary && <p className="mt-1 text-sm font-semibold text-surface-600">{item.summary}</p>}
            {item.detail && <p className="mt-2 text-sm leading-relaxed text-surface-600 whitespace-pre-line">{item.detail}</p>}
            {item.media.length > 0 && (
                <div className="mt-4 grid grid-cols-2 gap-3">
                    {item.media.map((media) => (
                        <a
                            key={media.id}
                            href={media.url}
                            target="_blank"
                            rel="noreferrer"
                            className="group relative block aspect-video overflow-hidden rounded-lg border border-surface-100 bg-surface-100"
                        >
                            {media.type === 'image' ? (
                                <img src={media.url} alt={media.fileName || item.title} className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                            ) : (
                                <video src={media.url} className="h-full w-full object-cover" muted preload="metadata" />
                            )}
                            <span className="absolute left-2 top-2 rounded-md bg-surface-900/80 px-2 py-1 text-[10px] font-black text-white">
                                {media.type === 'video' ? '视频' : '图片'}
                            </span>
                        </a>
                    ))}
                </div>
            )}
            {item.links.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {item.links.map((link) => (
                        <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-black text-surface-600 hover:border-primary-200 hover:text-primary-600"
                        >
                            {link.label || '查看链接'}
                            <ArrowUpRight size={10} />
                        </a>
                    ))}
                </div>
            )}
        </div>
    );

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

            {/* 成就与资质 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <section>
                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-6">成就奖项</h3>
                    <div className={hasRichMaterials ? "space-y-3" : "space-y-4"}>
                        {hasRichMaterials
                            ? (groupedMaterials.achievement.length > 0 ? groupedMaterials.achievement.map(renderMaterialCard) : <span className="text-xs text-surface-300">无记录</span>)
                            : achievements.length > 0 ? achievements.map((achievement, index) => (
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
                    <div className={hasRichMaterials ? "space-y-3" : "space-y-4"}>
                        {hasRichMaterials
                            ? (groupedMaterials.credential.length > 0 ? groupedMaterials.credential.map(renderMaterialCard) : <span className="text-xs text-surface-300">未上传</span>)
                            : credentials.length > 0 ? credentials.map((cred, idx) => (
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
                <div className={hasRichMaterials ? "grid grid-cols-1 md:grid-cols-2 gap-3" : "grid grid-cols-1 gap-2"}>
                    {hasRichMaterials
                        ? (groupedMaterials.case.length > 0 ? groupedMaterials.case.map(renderMaterialCard) : <span className="text-xs text-surface-300">暂无</span>)
                        : caseStudies.length > 0 ? caseStudies.map((item, idx) => (
                        <div key={idx} className="py-3 border-b border-surface-100 last:border-0 flex gap-4 items-baseline">
                            <span className="text-[10px] font-black text-surface-300 tracking-tighter w-8">0{idx + 1}</span>
                            <span className="text-sm font-bold text-surface-600">{item}</span>
                        </div>
                    )) : <span className="text-xs text-surface-300">暂无</span>}
                </div>
            </section>

            {hasRichMaterials && groupedMaterials.media.length > 0 && (
                <section>
                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-6">媒体墙</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {groupedMaterials.media.map(renderMaterialCard)}
                    </div>
                </section>
            )}

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

            {/* 地理位置：联系方式下方 */}
            {hasLocation && (
                <section className="pt-8 border-t border-surface-100">
                    <h3 className="text-[11px] font-black text-surface-400 uppercase tracking-[0.2em] mb-4">我的位置</h3>
                    <div className="flex items-start gap-3">
                        <MapPin size={14} className="text-surface-300 mt-0.5 flex-shrink-0" />
                        <div className="space-y-1">
                            {locationLine && <div className="text-sm font-bold text-surface-700">{locationLine}</div>}
                            {coach.address && <div className="text-sm text-surface-600">{coach.address}</div>}
                            {coach.latitude != null && coach.longitude != null && (
                                <div className="mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setShowMap((v) => !v)}
                                        className="inline-flex items-center gap-1.5 text-xs text-surface-400 hover:text-primary-600 transition-colors touch-manipulation"
                                    >
                                        {showMap ? '收起地图' : '在地图中查看'}
                                        {showMap ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                    </button>
                                    {showMap && (
                                        <div className="mt-3 w-full max-w-2xl min-w-[320px]">
                                            <TianDiTuMapViewer
                                                latitude={coach.latitude}
                                                longitude={coach.longitude}
                                                height="min(40vh, 280px)"
                                                className="sm:min-h-[240px] md:min-h-[280px]"
                                            />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
};

export default CoachAboutPanel;
