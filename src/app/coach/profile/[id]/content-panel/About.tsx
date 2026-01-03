'use client';

import React from 'react';
import { Award, Star } from 'lucide-react';
import { CoachesRow } from '@/types';
import { UpdateCoachProfileDto } from '@/app/api/coach/update-coach-profile/entity';

interface CoachAboutPanelProps {
    coach: CoachesRow;
}

const CoachAboutPanel: React.FC<CoachAboutPanelProps> = ({
    coach
}) => {
    const profile = (coach.profile || {}) as UpdateCoachProfileDto['profile'];
    const achievements = Array.isArray(profile?.achievements) && profile.achievements.length > 0
        ? profile.achievements
        : (Array.isArray(coach.achievements) ? coach.achievements : []);
    const caseStudies = Array.isArray(profile?.caseStudies) ? profile.caseStudies : [];
    const credentials = Array.isArray(profile?.credentials) ? profile.credentials : [];
    const socialLinks = (profile?.socialLinks && typeof profile.socialLinks === 'object')
        ? profile.socialLinks
        : {};
    const contactEmail = profile?.contactEmail || null;
    const contactPhone = profile?.contactPhone || null;

    const socialPlatformLabelMap: Record<string, string> = {
        douyin: '抖音',
        xiaohongshu: '小红书',
        zhihu: '知乎',
        bilibili: 'B站',
        kuaishou: '快手',
        other: '其他网站',
    };

    return (
        <div className="space-y-6 min-h-[400px]">
            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">教学理念</h3>
                <p className="text-surface-600 leading-relaxed">
                    {profile?.teachingPhilosophy || '暂无教学理念'}
                </p>
            </div>

            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">成就奖项</h3>
                {achievements && achievements.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {achievements.map((achievement, index) => (
                            <div key={index} className="flex items-center space-x-3 p-4 bg-primary-50 border border-primary-300 dark:bg-primary-800 dark:border-primary-700 rounded-lg">
                                <Star className="w-6 h-6 text-primary-600" />
                                <span className="text-surface-700">{achievement}</span>
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-surface-500">暂无成就信息</p>
                )}
            </div>

            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">代表案例</h3>
                {caseStudies.length > 0 ? (
                    <ul className="space-y-3">
                        {caseStudies.map((item, idx) => (
                            <li key={idx} className="p-4 rounded-lg bg-surface-100 border border-surface-200 text-surface-700">
                                {item}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-surface-500">暂无案例分享</p>
                )}
            </div>

            <div>
                <h3 className="text-xl font-bold text-surface-900 mb-4">资质证书</h3>
                {credentials.length > 0 ? (
                    <div className="space-y-3">
                        {credentials.map((cred, idx) => (
                            <div key={idx} className="p-4 rounded-lg border border-surface-200 bg-surface-0 flex items-center justify-between gap-3">
                                <div className="flex items-center gap-3">
                                    <Award className="w-5 h-5 text-primary-600" />
                                    <span className="text-surface-800">{cred?.name || '未命名证书'}</span>
                                </div>
                                {cred?.url && (
                                    <a
                                        href={cred.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-primary-600 text-sm hover:underline"
                                    >
                                        查看
                                    </a>
                                )}
                            </div>
                        ))}
                    </div>
                ) : (
                    <p className="text-surface-500">暂无资质证书信息</p>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                    <h3 className="text-xl font-bold text-surface-900 mb-4">联系方式</h3>
                    {contactEmail || contactPhone ? (
                        <div className="space-y-2 text-surface-700">
                            {contactEmail && <div>邮箱：{contactEmail}</div>}
                            {contactPhone && <div>电话：{contactPhone}</div>}
                        </div>
                    ) : (
                        <p className="text-surface-500">暂无联系方式</p>
                    )}
                </div>

                <div>
                    <h3 className="text-xl font-bold text-surface-900 mb-4">社交媒体</h3>
                    {Object.keys(socialLinks).length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {Object.entries(socialLinks as Record<string, string>).map(([platform, url]) => (
                                <a
                                    key={platform}
                                    href={url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-3 py-1 rounded-full bg-surface-100 border border-surface-200 text-sm text-primary-700 hover:border-primary-300"
                                >
                                    {socialPlatformLabelMap[platform] || platform}
                                </a>
                            ))}
                        </div>
                    ) : (
                        <p className="text-surface-500">暂无社交媒体链接</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoachAboutPanel;