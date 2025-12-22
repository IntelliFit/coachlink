'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { coachService } from '@/app/service/coachService';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { Toast } from 'primereact/toast';
import { Chip } from 'primereact/chip';
import { ConfirmDialog } from 'primereact/confirmdialog';
import { InputNumber, InputNumberValueChangeEvent } from 'primereact/inputnumber';
import { Dropdown } from 'primereact/dropdown';

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

const CoachApplicationPage = () => {
    const router = useRouter();
    const { data: session } = useSession();
    const toast = React.useRef<Toast>(null);

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

    // UI状态
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newSpecialty, setNewSpecialty] = useState('');
    const [newAchievement, setNewAchievement] = useState('');
    const [newCaseStudy, setNewCaseStudy] = useState('');
    const [newCredential, setNewCredential] = useState<Credential>({ name: '', url: '' });
    const [newSocialLink, setNewSocialLink] = useState<SocialLink>({ name: '', url: '' });

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
    const addSpecialty = () => {
        if (newSpecialty.trim() && !formData.specialties.includes(newSpecialty.trim())) {
            setFormData(prev => ({
                ...prev,
                specialties: [...prev.specialties, newSpecialty.trim()]
            }));
            setNewSpecialty('');
        }
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
    const addAchievement = () => {
        if (newAchievement.trim() && !formData.achievements.includes(newAchievement.trim())) {
            setFormData(prev => ({
                ...prev,
                achievements: [...prev.achievements, newAchievement.trim()]
            }));
            setNewAchievement('');
        }
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
    const addCaseStudy = () => {
        if (newCaseStudy.trim() && !formData.caseStudies.includes(newCaseStudy.trim())) {
            setFormData(prev => ({
                ...prev,
                caseStudies: [...prev.caseStudies, newCaseStudy.trim()]
            }));
            setNewCaseStudy('');
        }
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
    const addCredential = () => {
        if (newCredential.name.trim()) {
            setFormData(prev => ({
                ...prev,
                credentials: [...prev.credentials, { ...newCredential }]
            }));
            setNewCredential({ name: '', url: '' });
        }
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
    const addSocialLink = () => {
        if (newSocialLink.name.trim() && newSocialLink.url.trim()) {
            setFormData(prev => ({
                ...prev,
                socialLinks: [...prev.socialLinks, { ...newSocialLink }]
            }));
            setNewSocialLink({ name: '', url: '' });
        }
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

    // 更新社交媒体链接字段
    const handleSocialLinkChange = (field: keyof SocialLink, value: string) => {
        setNewSocialLink(prev => ({
            ...prev,
            [field]: value
        }));
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

    // 处理回车键添加标签
    const handleSpecialtyKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSpecialty();
        }
    };

    const handleAchievementKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addAchievement();
        }
    };

    const handleCaseStudyKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCaseStudy();
        }
    };

    const handleCredentialKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addCredential();
        }
    };

    const handleSocialLinkKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSocialLink();
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

            <Card className="mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* 姓名 */}
                    <div className="md:col-span-2">
                        <label htmlFor="name" className="block text-sm font-medium text-surface-900 mb-2">
                            姓名 *
                        </label>
                        <InputText
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleInputChange}
                            className="w-full"
                            placeholder="请输入您的姓名"
                        />
                    </div>

                    {/* 称号/头衔 */}
                    <div className="md:col-span-2">
                        <label htmlFor="title" className="block text-sm font-medium text-surface-900 mb-2">
                            称号/头衔
                        </label>
                        <InputText
                            id="title"
                            name="title"
                            value={formData.title}
                            onChange={handleInputChange}
                            className="w-full"
                            placeholder="如：国家一级健身指导员、CrossFit教练等"
                        />
                    </div>

                    {/* 专业领域 */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            专业领域
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {formData.specialties.map((specialty, index) => (
                                <Chip 
                                    key={index} 
                                    label={specialty} 
                                    removable 
                                    onRemove={() => removeSpecialty(index)}
                                    className="bg-primary-100 text-primary-700"
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newSpecialty}
                                onChange={(e) => setNewSpecialty(e.target.value)}
                                onKeyDown={handleSpecialtyKeyPress}
                                className="flex-1"
                                placeholder="输入专业领域，按回车添加"
                            />
                            <Button 
                                icon="pi pi-plus" 
                                onClick={addSpecialty}
                                disabled={!newSpecialty.trim()}
                            />
                        </div>
                    </div>

                    {/* 教学年限 */}
                    <div>
                        <label htmlFor="yearsExperience" className="block text-sm font-medium text-surface-900 mb-2">
                            教学年限（年）
                        </label>
                        <InputNumber
                            id="yearsExperience"
                            name="yearsExperience"
                            showButtons
                            value={formData.yearsExperience}
                            onValueChange={handleNumberChange}
                            className="w-full"
                            min={0}
                        />
                    </div>

                    {/* 联系邮箱 */}
                    <div>
                        <label htmlFor="contactEmail" className="block text-sm font-medium text-surface-900 mb-2">
                            联系邮箱
                        </label>
                        <InputText
                            id="contactEmail"
                            name="contactEmail"
                            type="email"
                            value={formData.contactEmail}
                            onChange={handleInputChange}
                            className="w-full"
                            placeholder="example@email.com"
                        />
                    </div>

                    {/* 联系电话 */}
                    <div>
                        <label htmlFor="contactPhone" className="block text-sm font-medium text-surface-900 mb-2">
                            联系电话
                        </label>
                        <InputText
                            id="contactPhone"
                            name="contactPhone"
                            value={formData.contactPhone}
                            onChange={handleInputChange}
                            className="w-full"
                            placeholder="请输入联系电话"
                        />
                    </div>

                    {/* 个人简介 */}
                    <div className="md:col-span-2">
                        <label htmlFor="bio" className="block text-sm font-medium text-surface-900 mb-2">
                            个人简介
                        </label>
                        <InputTextarea
                            id="bio"
                            name="bio"
                            value={formData.bio}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full"
                            placeholder="简要介绍您的背景、资质等信息"
                        />
                    </div>

                    {/* 教学理念 */}
                    <div className="md:col-span-2">
                        <label htmlFor="teachingPhilosophy" className="block text-sm font-medium text-surface-900 mb-2">
                            教学理念
                        </label>
                        <InputTextarea
                            id="teachingPhilosophy"
                            name="teachingPhilosophy"
                            value={formData.teachingPhilosophy}
                            onChange={handleInputChange}
                            rows={3}
                            className="w-full"
                            placeholder="描述您的教学方法和理念"
                        />
                    </div>

                    {/* 成就奖项 */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            成就奖项
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {formData.achievements.map((achievement, index) => (
                                <Chip 
                                    key={index} 
                                    label={achievement} 
                                    removable 
                                    onRemove={() => removeAchievement(index)}
                                    className="bg-green-100 text-green-700"
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newAchievement}
                                onChange={(e) => setNewAchievement(e.target.value)}
                                onKeyDown={handleAchievementKeyPress}
                                className="flex-1"
                                placeholder="输入成就奖项，按回车添加"
                            />
                            <Button 
                                icon="pi pi-plus" 
                                onClick={addAchievement}
                                disabled={!newAchievement.trim()}
                            />
                        </div>
                    </div>

                    {/* 代表案例 */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            代表案例
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {formData.caseStudies.map((caseStudy, index) => (
                                <Chip 
                                    key={index} 
                                    label={caseStudy} 
                                    removable 
                                    onRemove={() => removeCaseStudy(index)}
                                    className="bg-purple-100 text-purple-700"
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newCaseStudy}
                                onChange={(e) => setNewCaseStudy(e.target.value)}
                                onKeyDown={handleCaseStudyKeyPress}
                                className="flex-1"
                                placeholder="输入代表案例，按回车添加"
                            />
                            <Button 
                                icon="pi pi-plus" 
                                onClick={addCaseStudy}
                                disabled={!newCaseStudy.trim()}
                            />
                        </div>
                    </div>

                    {/* 资质证书 */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            资质证书
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {formData.credentials.map((credential, index) => (
                                <Chip 
                                    key={index} 
                                    label={`${credential.name}${credential.url ? `` : ''}`} 
                                    removable 
                                    onRemove={() => removeCredential(index)}
                                    className="bg-blue-100 text-blue-700"
                                />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
                            <InputText
                                value={newCredential.name}
                                onChange={(e) => setNewCredential({...newCredential, name: e.target.value})}
                                placeholder="证书名称"
                            />
                            <div className="flex gap-2">
                                <InputText
                                    value={newCredential.url || ''}
                                    onChange={(e) => setNewCredential({...newCredential, url: e.target.value})}
                                    placeholder="证书链接（可选）"
                                    className="flex-1"
                                />
                                <Button 
                                    icon="pi pi-plus" 
                                    onClick={addCredential}
                                    disabled={!newCredential.name.trim()}
                                />
                            </div>
                        </div>
                    </div>

                    {/* 社交媒体链接 */}
                    <div className="md:col-span-2">
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            社交媒体
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {formData.socialLinks.map((socialLink, index) => (
                                <Chip 
                                    key={index} 
                                    label={`${socialLink.name}: ${socialLink.url}`} 
                                    removable 
                                    onRemove={() => removeSocialLink(index)}
                                    className="bg-indigo-100 text-indigo-700"
                                />
                            ))}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-2">
                            <div className="md:col-span-1">
                                <Dropdown
                                    value={newSocialLink.name}
                                    options={socialMediaOptions}
                                    onChange={(e) => handleSocialLinkChange('name', e.value)}
                                    placeholder="选择平台"
                                    className="w-full"
                                    itemTemplate={socialMediaOptionTemplate}
                                    valueTemplate={socialMediaValueTemplate}
                                />
                            </div>
                            <div className="md:col-span-2 flex gap-2">
                                <InputText
                                    value={newSocialLink.url || ''}
                                    onChange={(e) => handleSocialLinkChange('url', e.target.value)}
                                    placeholder="请输入链接"
                                    className="flex-1"
                                    onKeyDown={handleSocialLinkKeyPress}
                                />
                                <Button 
                                    icon="pi pi-plus" 
                                    onClick={addSocialLink}
                                    disabled={!newSocialLink.name.trim() || !newSocialLink.url?.trim()}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <Button 
                        label="返回" 
                        icon="pi pi-arrow-left"
                        onClick={() => router.back()}
                        className="p-button-text"
                    />
                    <Button 
                        label={saving ? "提交中..." : "提交申请"}
                        icon={saving ? "pi pi-spin pi-spinner" : "pi pi-send"}
                        onClick={handleSubmit}
                        disabled={saving}
                        className="p-button-primary"
                    />
                </div>
            </Card>
        </div>
    );
};

export default CoachApplicationPage;