'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { coachService } from '@/app/service/coachService';
import { Card } from 'primereact/card';
import { Toast } from 'primereact/toast';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { InputNumberValueChangeEvent } from 'primereact/inputnumber';

// 导入新创建的组件
import CoachFormField from './CoachFormField';
import TagListField from './TagListField';
import CredentialField from './CredentialField';
import SocialLinkField from './SocialLinkField';
import SubmitButton from './SubmitButton';

// 导入自定义图标组件
import DouyinIcon from '@/components/icons/douyin';
import BilibiliIcon from '@/components/icons/bilibili';
import ZhihuIcon from '@/components/icons/zhihu';
import XiaohongshuIcon from '@/components/icons/xiaohongshu';
import KuaishouIcon from '@/components/icons/kuaishou';

// 定义资质证书和社交媒体的类型
interface Credential {
  name: string;
  url?: string;
}

interface SocialLink {
  name: string;
  url?: string;
}

// 社交媒体平台选项类型
interface SocialMediaOption {
  label: string;
  value: string;
  icon: React.ReactNode;
}

// 定义审核信息接口
interface ReviewInfo {
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
}

const CoachApplicationPage = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const toast = useRef<Toast>(null);

    // 表单状态
    const [formData, setFormData] = useState({
        name: '',
        title: '',
        bio: '',
        yearsExperience: 0,
        teachingPhilosophy: '',
        contactEmail: '',
        contactPhone: '',
        specialties: [] as string[],
        achievements: [] as string[],
        caseStudies: [] as string[],
        credentials: [] as Credential[], // 资质证书
        socialLinks: [] as SocialLink[] // 社交媒体链接
    });

    // 审核信息状态
    const [reviewInfo, setReviewInfo] = useState<ReviewInfo>({
        reviewed_by: null,
        reviewed_at: null,
        review_notes: null
    });

    // UI状态
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // 社交媒体平台选项
    const socialMediaOptions: SocialMediaOption[] = [
        { 
            label: '抖音', 
            value: '抖音', 
            icon: <DouyinIcon width="20" height="20" className="text-surface-500" /> 
        },
        { 
            label: '小红书', 
            value: '小红书', 
            icon: <XiaohongshuIcon width="20" height="20" className="text-surface-500" /> 
        },
        { 
            label: '知乎', 
            value: '知乎', 
            icon: <ZhihuIcon width="20" height="20" className="text-surface-500" /> 
        },
        { 
            label: 'B站', 
            value: 'B站', 
            icon: <BilibiliIcon width="20" height="20" className="text-surface-500" /> 
        },
        { 
            label: '快手', 
            value: '快手', 
            icon: <KuaishouIcon width="20" height="20" className="text-surface-500" /> 
        },
        { 
            label: '其他网站', 
            value: '其他网站', 
            icon: <i className="pi pi-globe text-surface-500" /> 
        }
    ];

    // 自定义下拉选项模板
    const socialMediaOptionTemplate = (option: SocialMediaOption) => {
        return (
            <div className="flex items-center gap-2">
                {option.icon}
                <span>{option.label}</span>
            </div>
        );
    };

    // 自定义下拉值模板
    const socialMediaValueTemplate = (option: SocialMediaOption | null) => {
        if (!option) {
            return <span>选择平台</span>;
        }

        return (
            <div className="flex items-center gap-2">
                {option.icon}
                <span>{option.label}</span>
            </div>
        );
    };

    // 检查是否已有申请
    useEffect(() => {
        const fetchExistingApplication = async () => {
            try {
                setLoading(true);
                const response = await coachService.getCoachApplication();
                
                if (response?.application) {
                    const app = response.application;
                    setFormData({
                        name: app.name || '',
                        title: app.title || '',
                        bio: app.bio || '',
                        yearsExperience: app.years_experience || 0,
                        teachingPhilosophy: app.teaching_philosophy || '',
                        contactEmail: app.contact_email || '',
                        contactPhone: app.contact_phone || '',
                        specialties: app.specialties || [],
                        achievements: app.achievements || [],
                        caseStudies: app.case_studies || [],
                        credentials: app.credentials ? app.credentials.map((cred: any) => ({
                            name: cred.name || '',
                            url: cred.url || ''
                        })) : [],
                        socialLinks: app.social_links ? Object.entries(app.social_links).map(([key, value]) => {
                            const platformMap: Record<string, string> = {
                                'douyin': '抖音',
                                'xiaohongshu': '小红书',
                                'zhihu': '知乎',
                                'bilibili': 'B站',
                                'kuaishou': '快手'
                            };
                            const name = platformMap[key] || key;
                            return { name, url: value as string };
                        }) : []
                    });
                    
                    // 设置审核信息
                    setReviewInfo({
                        reviewed_by: app.reviewed_by || null,
                        reviewed_at: app.reviewed_at || null,
                        review_notes: app.review_notes || null
                    });
                } else if (session?.user) {
                    // 如果没有申请但有用户信息，则预填姓名
                    setFormData(prev => ({
                        ...prev,
                        name: session.profile.nickname,
                        contactPhone: session.profile.phone
                    }));
                }
            } catch (error) {
                console.error('获取申请信息失败:', error);
                toast.current?.show({
                    severity: 'error',
                    summary: '错误',
                    detail: '获取申请信息失败',
                    life: 3000
                });
            } finally {
                setLoading(false);
            }
        };

        if (session?.user?.id) {
            fetchExistingApplication();
        }
    }, [session?.user?.id, session?.user?.name]);

    // 处理输入变化
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 处理数字输入变化
    const handleNumberChange = (e: InputNumberValueChangeEvent) => {
        const name = e.target.name;
        const value = e.value || 0;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    // 添加专业领域
    const addSpecialty = (specialty: string) => {
        setFormData(prev => ({
            ...prev,
            specialties: [...prev.specialties, specialty]
        }));
    };

    // 删除专业领域
    const removeSpecialty = (index: number) => {
        setFormData(prev => {
            const newSpecialties = [...prev.specialties];
            newSpecialties.splice(index, 1);
            return { ...prev, specialties: newSpecialties };
        });

        return true;
    };

    // 添加成就
    const addAchievement = (achievement: string) => {
        setFormData(prev => ({
            ...prev,
            achievements: [...prev.achievements, achievement]
        }));
    };

    // 删除成就
    const removeAchievement = (index: number) => {
        setFormData(prev => {
            const newAchievements = [...prev.achievements];
            newAchievements.splice(index, 1);
            return { ...prev, achievements: newAchievements };
        });

        return true;
    };

    // 添加案例研究
    const addCaseStudy = (caseStudy: string) => {
        setFormData(prev => ({
            ...prev,
            caseStudies: [...prev.caseStudies, caseStudy]
        }));
    };

    // 删除案例研究
    const removeCaseStudy = (index: number) => {
        setFormData(prev => {
            const newCaseStudies = [...prev.caseStudies];
            newCaseStudies.splice(index, 1);
            return { ...prev, caseStudies: newCaseStudies };
        });

        return true;
    };

    // 添加资质证书
    const addCredential = (credential: Credential) => {
        setFormData(prev => ({
            ...prev,
            credentials: [...prev.credentials, { ...credential }]
        }));
    };

    // 删除资质证书
    const removeCredential = (index: number) => {
        setFormData(prev => {
            const newCredentials = [...prev.credentials];
            newCredentials.splice(index, 1);
            return { ...prev, credentials: newCredentials };
        });

        return true;
    };

    // 更新资质证书字段
    const handleCredentialChange = (index: number, field: keyof Credential, value: string) => {
        setFormData(prev => {
            const newCredentials = [...prev.credentials];
            newCredentials[index] = { ...newCredentials[index], [field]: value };
            return { ...prev, credentials: newCredentials };
        });
    };

    // 添加社交媒体链接
    const addSocialLink = (socialLink: SocialLink) => {
        setFormData(prev => ({
            ...prev,
            socialLinks: [...prev.socialLinks, { ...socialLink }]
        }));
    };

    // 删除社交媒体链接
    const removeSocialLink = (index: number) => {
        setFormData(prev => {
            const newSocialLinks = [...prev.socialLinks];
            newSocialLinks.splice(index, 1);
            return { ...prev, socialLinks: newSocialLinks };
        });

        return true;
    };

    // 提交申请
    const handleSubmit = async () => {
        try {
            setSaving(true);
            
            // 检查必填字段
            if (!formData.name.trim()) {
                toast.current?.show({
                    severity: 'warn',
                    summary: '警告',
                    detail: '请输入姓名',
                    life: 3000
                });
                return;
            }

            // 构造社交媒体链接对象
            const socialLinksObj: Record<string, string> = {};
            formData.socialLinks.forEach(link => {
                if (link.url) {
                    const keyMap: Record<string, string> = {
                        '抖音': 'douyin',
                        '小红书': 'xiaohongshu',
                        '知乎': 'zhihu',
                        'B站': 'bilibili',
                        '快手': 'kuaishou'
                    };
                    const key = keyMap[link.name];
                    if (key) {
                        socialLinksObj[key] = link.url;
                    }
                }
            });

            // 如果已有申请ID，则更新，否则创建新申请
            const existingApplication = await coachService.getCoachApplication();
            
            if (existingApplication?.application) {
                // 更新现有申请
                await coachService.updateCoachApplication({
                    id: existingApplication.application.id,
                    name: formData.name,
                    title: formData.title || null,
                    bio: formData.bio || null,
                    yearsExperience: formData.yearsExperience || null,
                    teachingPhilosophy: formData.teachingPhilosophy || null,
                    contactEmail: formData.contactEmail || null,
                    contactPhone: formData.contactPhone || null,
                    specialties: formData.specialties.length > 0 ? formData.specialties : null,
                    achievements: formData.achievements.length > 0 ? formData.achievements : null,
                    caseStudies: formData.caseStudies.length > 0 ? formData.caseStudies : null,
                    credentials: formData.credentials.length > 0 ? formData.credentials : null,
                    socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null
                });
                
                toast.current?.show({
                    severity: 'success',
                    summary: '成功',
                    detail: '申请已更新',
                    life: 3000
                });
            } else {
                // 创建新申请
                await coachService.createCoachApplication({
                    name: formData.name,
                    title: formData.title || null,
                    bio: formData.bio || null,
                    yearsExperience: formData.yearsExperience || null,
                    teachingPhilosophy: formData.teachingPhilosophy || null,
                    contactEmail: formData.contactEmail || null,
                    contactPhone: formData.contactPhone || null,
                    specialties: formData.specialties.length > 0 ? formData.specialties : null,
                    achievements: formData.achievements.length > 0 ? formData.achievements : null,
                    caseStudies: formData.caseStudies.length > 0 ? formData.caseStudies : null,
                    credentials: formData.credentials.length > 0 ? formData.credentials : null,
                    socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null
                });
                
                toast.current?.show({
                    severity: 'success',
                    summary: '成功',
                    detail: '申请已提交',
                    life: 3000
                });
                
                // 跳转到申请状态页面
                setTimeout(() => {
                    router.push('/me/profile');
                }, 1500);
            }
        } catch (error: any) {
            console.error('提交申请失败:', error);
            toast.current?.show({
                severity: 'error',
                summary: '错误',
                detail: error.message || '提交申请失败',
                life: 5000
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="p-6 max-w-4xl mx-auto">
                <div className="mb-6">
                    <div className="h-8 bg-surface-200 rounded w-1/3 mb-4 animate-pulse"></div>
                    <div className="h-4 bg-surface-200 rounded w-2/3 animate-pulse"></div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((item) => (
                        <div key={item} className="bg-surface-100 rounded-xl p-6">
                            <div className="h-6 bg-surface-200 rounded w-1/4 mb-4 animate-pulse"></div>
                            <div className="h-10 bg-surface-200 rounded animate-pulse"></div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 max-w-4xl mx-auto">
            <Toast ref={toast} />
            <ConfirmDialog />
            
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-surface-900 mb-2">申请成为教练</h1>
                <p className="text-surface-600">
                    填写以下信息申请成为平台教练，审核通过后即可开始授课并获得收益。
                </p>
            </div>

            <Card className="mb-6 shadow-none border border-surface-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 姓名 - 必填字段 */}
                    <CoachFormField
                        id="name"
                        name="name"
                        label="姓名 *"
                        value={formData.name}
                        onChange={handleInputChange}
                        placeholder="请输入您的姓名"
                        required
                    />

                    {/* 称号/头衔 */}
                    <CoachFormField
                        id="title"
                        name="title"
                        label="称号/头衔"
                        value={formData.title}
                        onChange={handleInputChange}
                        placeholder="如：国家一级健身指导员、CrossFit教练等"
                    />

                    {/* 专业领域 */}
                    <TagListField
                        label="专业领域"
                        tags={formData.specialties}
                        onAdd={addSpecialty}
                        onRemove={removeSpecialty}
                        placeholder="输入专业领域，按回车添加"
                        colorClass="bg-primary-100 text-primary-700"
                    />

                    {/* 教学年限 */}
                    <div>
                        <label htmlFor="yearsExperience" className="block text-sm font-medium text-surface-900 mb-2">
                            教学年限（年）
                        </label>
                        <div className="w-full">
                            <CoachFormField
                                id="yearsExperience"
                                name="yearsExperience"
                                label=""
                                value={formData.yearsExperience}
                                onChange={handleInputChange}
                                type="number"
                                min={0}
                                onValueChange={handleNumberChange}
                            />
                        </div>
                    </div>

                    {/* 联系邮箱 */}
                    <CoachFormField
                        id="contactEmail"
                        name="contactEmail"
                        label="联系邮箱"
                        value={formData.contactEmail}
                        onChange={handleInputChange}
                        type="email"
                        placeholder="example@email.com"
                    />

                    {/* 联系电话 */}
                    <CoachFormField
                        id="contactPhone"
                        name="contactPhone"
                        label="联系电话"
                        value={formData.contactPhone}
                        onChange={handleInputChange}
                        placeholder="请输入联系电话"
                    />

                    {/* 个人简介 */}
                    <CoachFormField
                        id="bio"
                        name="bio"
                        label="个人简介"
                        value={formData.bio}
                        onChange={handleInputChange}
                        type="textarea"
                        placeholder="简要介绍您的背景、资质等信息"
                        rows={3}
                    />

                    {/* 教学理念 */}
                    <CoachFormField
                        id="teachingPhilosophy"
                        name="teachingPhilosophy"
                        label="教学理念"
                        value={formData.teachingPhilosophy}
                        onChange={handleInputChange}
                        type="textarea"
                        placeholder="描述您的教学方法和理念"
                        rows={3}
                    />

                    {/* 成就奖项 */}
                    <TagListField
                        label="成就奖项"
                        tags={formData.achievements}
                        onAdd={addAchievement}
                        onRemove={removeAchievement}
                        placeholder="输入成就奖项，按回车添加"
                        colorClass="bg-green-100 text-green-700"
                    />

                    {/* 代表案例 */}
                    <TagListField
                        label="代表案例"
                        tags={formData.caseStudies}
                        onAdd={addCaseStudy}
                        onRemove={removeCaseStudy}
                        placeholder="输入代表案例，按回车添加"
                        colorClass="bg-purple-100 text-purple-700"
                    />

                    {/* 资质证书 */}
                    <CredentialField
                        credentials={formData.credentials}
                        onAdd={addCredential}
                        onRemove={removeCredential}
                        onUpdate={handleCredentialChange}
                    />

                    {/* 社交媒体链接 */}
                    <SocialLinkField
                        socialLinks={formData.socialLinks}
                        onAdd={addSocialLink}
                        onRemove={removeSocialLink}
                        socialMediaOptions={socialMediaOptions}
                        socialMediaOptionTemplate={socialMediaOptionTemplate}
                        socialMediaValueTemplate={socialMediaValueTemplate}
                    />

                    {/* 审核信息部分 - 仅在有审核信息时显示 */}
                    {(reviewInfo.reviewed_by || reviewInfo.reviewed_at || reviewInfo.review_notes) && (
                        <div className="md:col-span-2 mt-6 pt-6 border-t border-surface-200">
                            <h2 className="text-xl font-semibold text-surface-800 mb-4">审核信息</h2>
                            
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {reviewInfo.reviewed_by && (
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 mb-1">审核人</label>
                                        <div className="text-surface-900">{reviewInfo.reviewed_by}</div>
                                    </div>
                                )}
                                
                                {reviewInfo.reviewed_at && (
                                    <div>
                                        <label className="block text-sm font-medium text-surface-700 mb-1">审核时间</label>
                                        <div className="text-surface-900">{new Date(reviewInfo.reviewed_at).toLocaleString('zh-CN')}</div>
                                    </div>
                                )}
                                
                                {reviewInfo.review_notes && (
                                    <div className="md:col-span-3">
                                        <label className="block text-sm font-medium text-surface-700 mb-1">审核意见</label>
                                        <div className="text-surface-900 p-3 bg-surface-50 rounded-md border border-surface-200">
                                            {reviewInfo.review_notes}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <SubmitButton saving={saving} onClick={handleSubmit} />
            </Card>
        </div>
    );
};

export default CoachApplicationPage;