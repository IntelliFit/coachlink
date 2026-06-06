'use client';

import React from 'react';
import { Dialog } from 'primereact/dialog';
import { Chip } from 'primereact/chip';
import { Card } from 'primereact/card';
import type { CoachApplicationRow } from '@/types';
import { formatBeijingDate } from '@/lib/beijingTime';
import {
    getCoachTrackLabel,
    getServiceModeLabel,
    getTargetStudentLevelLabel,
} from '@/lib/coachApplicationOptions';
import {
    COACH_APPLICATION_MATERIAL_CATEGORIES,
    groupCoachApplicationMaterials,
} from '@/lib/coachApplicationMaterials';

interface CoachApplicationDialogProps {
    visible: boolean;
    application: CoachApplicationRow | null;
    onHide: () => void;
}

const CoachApplicationDialog: React.FC<CoachApplicationDialogProps> = ({ 
    visible, 
    application, 
    onHide 
}) => {
    // 状态选项映射
    const statusLabels: Record<string, string> = {
        'pending': '待审核',
        'reviewing': '审核中',
        'approved': '已通过',
        'rejected': '已拒绝',
        'needs_info': '需要补充材料'
    };

    const formatDate = (dateString: string) => {
        return formatBeijingDate(dateString, 'zh-CN', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const renderField = (label: string, value: string | number | null | undefined) => {
        if (!value) return null;
        
        return (
            <div className="mb-3">
                <label className="block text-sm font-medium text-surface-700 mb-1">
                    {label}
                </label>
                <div className="text-surface-900">
                    {value}
                </div>
            </div>
        );
    };

    const renderArrayField = (label: string, items: string[] | null | undefined) => {
        if (!items || items.length === 0) return null;
        
        return (
            <div className="mb-3">
                <label className="block text-sm font-medium text-surface-700 mb-1">
                    {label}
                </label>
                <div className="flex flex-wrap gap-2">
                    {items.map((item, index) => (
                        <Chip key={index} label={item} className="bg-primary-100 text-primary-700" />
                    ))}
                </div>
            </div>
        );
    };

    const renderJsonArrayField = (label: string, items: any[] | null | undefined) => {
        if (!items || items.length === 0) return null;
        
        return (
            <div className="mb-3">
                <label className="block text-sm font-medium text-surface-700 mb-1">
                    {label}
                </label>
                <div className="flex flex-wrap gap-2">
                    {items.map((item, index) => {
                        const displayText = typeof item === 'string' 
                            ? item 
                            : item.name || JSON.stringify(item);
                        return (
                            <Chip 
                                key={index} 
                                label={displayText} 
                                className="bg-primary-100 text-primary-700" 
                            />
                        );
                    })}
                </div>
            </div>
        );
    };

    const renderObjectField = (label: string, obj: any | null | undefined) => {
        if (!obj || Object.keys(obj).length === 0) return null;
        
        return (
            <div className="mb-3">
                <label className="block text-sm font-medium text-surface-700 mb-1">
                    {label}
                </label>
                <div className="flex flex-wrap gap-2">
                    {Object.entries(obj).map(([key, value], index) => (
                        <Chip 
                            key={index} 
                            label={`${key}: ${value}`} 
                            className="bg-blue-100 text-blue-700" 
                        />
                    ))}
                </div>
            </div>
        );
    };

    const renderApplicationMaterials = (materials: any) => {
        const grouped = groupCoachApplicationMaterials(materials);
        if (!grouped.all.length) return null;
        const labelMap = Object.fromEntries(COACH_APPLICATION_MATERIAL_CATEGORIES.map((item) => [item.value, item.label]));

        return (
            <div className="space-y-4">
                {grouped.all.map((item) => (
                    <div key={item.id} className="rounded-xl border border-surface-200 bg-surface-0 p-4">
                        <div className="flex flex-wrap items-center gap-2 mb-2">
                            <Chip label={labelMap[item.category] || '材料'} className="bg-primary-100 text-primary-700" />
                            {!item.isPublic && <Chip label="仅审核可见" className="bg-yellow-100 text-yellow-700" />}
                        </div>
                        <div className="font-semibold text-surface-900">{item.title}</div>
                        {item.summary && <div className="text-sm text-surface-600 mt-1">{item.summary}</div>}
                        {item.detail && <div className="text-sm text-surface-700 mt-2 whitespace-pre-line">{item.detail}</div>}
                        {(item.media.length > 0 || item.links.length > 0) && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {item.media.map((media) => (
                                    <a
                                        key={media.id}
                                        href={media.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-bold text-surface-700 hover:text-primary-600"
                                    >
                                        {media.type === 'video' ? '视频' : '图片'}：{media.fileName || '查看'}
                                    </a>
                                ))}
                                {item.links.map((link) => (
                                    <a
                                        key={link.id}
                                        href={link.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-lg border border-surface-200 px-3 py-1.5 text-xs font-bold text-surface-700 hover:text-primary-600"
                                    >
                                        {link.label || '外部链接'}
                                    </a>
                                ))}
                            </div>
                        )}
                    </div>
                ))}
            </div>
        );
    };

    const renderSection = (title: string, children: React.ReactNode) => {
        if (!children) return null;
        
        return (
            <Card className="mb-4 border border-surface-200 shadow-none">
                <h3 className="text-lg font-semibold text-surface-900 mb-3">{title}</h3>
                {children}
            </Card>
        );
    };

    return (
        <Dialog
            header={`教练申请详情 - ${application?.name || ''}`}
            visible={visible}
            onHide={onHide}
            maximizable
            style={{ width: '80vw' }}
            breakpoints={{
                '960px': '90vw',
                '640px': '95vw'
            }}
        >
            {application && (
                <div className="p-2">
                    {/* 基本信息 */}
                    {renderSection("基本信息", (
                        <>
                            {renderField("申请ID", application.id)}
                            {renderField("申请人姓名", application.name)}
                            {renderField("称号/头衔", application.title)}
                            {renderField("个人简介", application.bio)}
                            {renderField("申请时间", formatDate(application.applied_at))}
                            {renderField("申请状态", statusLabels[application.status] || application.status)}
                            {renderField("申请层级", getCoachTrackLabel((application as any).coach_track))}
                            {renderField("教学年限", application.years_experience ? `${application.years_experience}年` : null)}
                        </>
                    ))}

                    {/* 联系信息 */}
                    {renderSection("联系信息", (
                        <>
                            {renderField("联系邮箱", application.contact_email)}
                            {renderField("联系电话", application.contact_phone)}
                            {renderField("简历链接", application.resume_url)}
                            {renderField("作品集链接", application.portfolio_url)}
                        </>
                    ))}

                    {/* 专业信息 */}
                    {renderSection("专业信息", (
                        <>
                            {renderArrayField("专业领域", application.specialties)}
                            {renderArrayField("服务方式", ((application as any).service_modes || []).map((item: string) => getServiceModeLabel(item)))}
                            {renderArrayField("适合学员阶段", ((application as any).target_student_levels || []).map((item: string) => getTargetStudentLevelLabel(item)))}
                            {renderField("阶段问题聚焦", (application as any).support_focus)}
                            {renderField("教学理念", application.teaching_philosophy)}
                        </>
                    ))}

                    {/* 成就与案例 */}
                    {renderSection("成就与案例", (
                        <>
                            {renderArrayField("成就奖项", application.achievements)}
                            {renderArrayField("代表案例", application.case_studies)}
                            {renderApplicationMaterials((application as any).application_materials)}
                        </>
                    ))}

                    {/* 资质证书 */}
                    {renderSection("资质证书", (
                        renderJsonArrayField("资质证书", application.credentials)
                    ))}

                    {/* 社交媒体链接 */}
                    {renderSection("社交媒体", (
                        renderObjectField("社交媒体链接", application.social_links)
                    ))}

                    {/* 审核信息 */}
                    {renderSection("审核信息", (
                        <>
                            {renderField("审核人ID", application.reviewed_by)}
                            {renderField("审核时间", application.reviewed_at ? formatDate(application.reviewed_at) : null)}
                            {renderField("审核意见", application.review_notes)}
                        </>
                    ))}
                </div>
            )}
        </Dialog>
    );
};

export default CoachApplicationDialog;
