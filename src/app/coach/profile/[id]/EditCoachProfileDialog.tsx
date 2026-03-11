'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import Image from 'next/image';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types';
import { Chip } from 'primereact/chip';
import { ConfirmDialog, confirmDialog } from 'primereact/confirmdialog';
import { useToastContext } from '@/context/ToastContext';
import { AeroInputNumber } from '@/components/AeroInputNumber';
import MapLocationPicker from '@/components/MapLocationPicker';
import { getCurrentLocation } from '@/lib/locationService';

/** 将接口/网络错误信息转为用户可读的中文提示 */
function getErrorMessageForUser(raw: string | undefined): string {
    if (!raw || typeof raw !== 'string') return '保存失败，请稍后重试';
    const s = raw.trim().toLowerCase();
    if (/status\s*500|500\s*error|internal\s*server\s*error/.test(s)) return '服务器繁忙，请稍后重试';
    if (/status\s*404|404\s*not\s*found/.test(s)) return '资源不存在，请刷新后重试';
    if (/status\s*401|401\s*unauthorized/.test(s)) return '登录已过期，请重新登录';
    if (/status\s*403|403\s*forbidden/.test(s)) return '没有操作权限';
    if (/network\s*error|failed\s*to\s*fetch|network\s*request\s*failed|load\s*failed/.test(s)) return '网络异常，请检查网络后重试';
    if (/timeout|timed\s*out/.test(s)) return '请求超时，请稍后重试';
    if (/status\s*502|502\s*bad\s*gateway/.test(s)) return '服务暂时不可用，请稍后重试';
    if (/status\s*503|503\s*service\s*unavailable/.test(s)) return '服务繁忙，请稍后重试';
    // 若已是中文或简短业务文案，直接返回；否则用通用提示
    if (/[\u4e00-\u9fa5]/.test(raw) && raw.length <= 60) return raw;
    return '保存失败，请稍后重试';
}

interface EditCoachProfileDialogProps {
    visible: boolean;
    onHide: () => void;
    coach: CoachesRow;
    onSave: () => void;
}

const EditCoachProfileDialog: React.FC<EditCoachProfileDialogProps> = ({ visible, onHide, coach, onSave }) => {
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [locating, setLocating] = useState(false);

    const { showToast } = useToastContext();

    // 教练个人信息字段
    const [name, setName] = useState('');
    const [title, setTitle] = useState('');
    const [avatarUrl, setAvatarUrl] = useState('');
    const [specialties, setSpecialties] = useState<string[]>([]);
    const [newSpecialty, setNewSpecialty] = useState('');
    const [yearsExperience, setYearsExperience] = useState<number>(0);
    const [bio, setBio] = useState('');
    const [teachingPhilosophy, setTeachingPhilosophy] = useState('');
    const [achievements, setAchievements] = useState<string[]>([]);
    const [newAchievement, setNewAchievement] = useState('');
    const [caseStudies, setCaseStudies] = useState<string[]>([]);
    const [newCaseStudy, setNewCaseStudy] = useState('');
    const [credentials, setCredentials] = useState<{ name: string; url?: string }[]>([]);
    const [newCredName, setNewCredName] = useState('');
    const [newCredUrl, setNewCredUrl] = useState('');
    const [contactEmail, setContactEmail] = useState<string | null>(null);
    const [contactPhone, setContactPhone] = useState<string | null>(null);
    const [socialLinks, setSocialLinks] = useState<{ name: string; url: string }[]>([]);
    const [newSocialPlatform, setNewSocialPlatform] = useState<string>('');
    const [newSocialUrl, setNewSocialUrl] = useState('');
    const [province, setProvince] = useState<string>('');
    const [city, setCity] = useState<string>('');
    const [county, setCounty] = useState<string>('');
    const [address, setAddress] = useState<string>('');
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    const SOCIAL_MEDIA_OPTIONS: { label: string; value: string }[] = [
        { label: '抖音', value: '抖音' },
        { label: '小红书', value: '小红书' },
        { label: '知乎', value: '知乎' },
        { label: 'B站', value: 'B站' },
        { label: '快手', value: '快手' },
        { label: '其他网站', value: '其他网站' },
    ];

    // 初始化表单数据
    useEffect(() => {
        if (visible && coach) {
            setName(coach.name || '');
            setTitle(coach.title || '');
            setAvatarUrl(coach.avatar_url || '');
            setSpecialties(Array.isArray(coach.specialties) ? coach.specialties : []);
            setYearsExperience(typeof coach.years_experience === 'number' ? coach.years_experience : 0);
            setBio(coach.bio || '');
            // 省、市、区平铺存
            setProvince(coach.province || '');
            setCity(coach.city || '');
            setCounty(coach.county || '');
            setAddress(coach.address || '');
            setLatitude(coach.latitude || null);
            setLongitude(coach.longitude || null);

            // 从profile字段中提取申请页对应字段
            if (coach.profile) {
                const profile = coach.profile as Record<string, any>;
                setTeachingPhilosophy(profile.teachingPhilosophy || '');
                setAchievements(Array.isArray(profile.achievements) ? profile.achievements : []);
                setCaseStudies(Array.isArray(profile.caseStudies) ? profile.caseStudies : []);
                setCredentials(Array.isArray(profile.credentials) ? profile.credentials : []);
                setContactEmail(profile.contactEmail ?? null);
                setContactPhone(profile.contactPhone ?? null);
                setSocialLinks(
                    profile.socialLinks && typeof profile.socialLinks === 'object'
                        ? Object.entries(profile.socialLinks as Record<string, string>).map(([key, url]) => {
                            const platformMap: Record<string, string> = {
                                douyin: '抖音',
                                xiaohongshu: '小红书',
                                zhihu: '知乎',
                                bilibili: 'B站',
                                kuaishou: '快手',
                                other: '其他网站',
                            };
                            const name = platformMap[key] || key;
                            return {
                                name,
                                url: url as string
                            };
                        })
                        : []
                );
            } else {
                setTeachingPhilosophy('');
                setAchievements([]);
                setCaseStudies([]);
                setCredentials([]);
                setContactEmail(null);
                setContactPhone(null);
                setSocialLinks([]);
            }

            // 自动获取位置（仅当没有位置信息时）
            const hasLocation = coach.province || coach.city || coach.county || coach.latitude != null || coach.longitude != null;
            if (!hasLocation) {
                console.log('教练信息中无位置数据，自动获取位置...');
                // 延迟执行，确保对话框已完全打开
                setTimeout(() => {
                    handleAutoLocation(false);
                }, 800);
            } else {
                console.log('教练信息中已有位置数据，跳过自动定位');
            }
        }
    }, [visible, coach]);

    // 弹窗打开时禁用背景页面滚动
    useEffect(() => {
        if (visible) {
            document.body.style.overflow = 'hidden';
            return () => { document.body.style.overflow = ''; };
        }
    }, [visible]);

    const handleAddSpecialty = () => {
        const value = newSpecialty.trim();
        if (!value) return;
        if (specialties.includes(value)) {
            setNewSpecialty('');
            return;
        }
        setSpecialties([...specialties, value]);
        setNewSpecialty('');
    };

    const handleRemoveSpecialty = (index: number) => {
        const next = [...specialties];
        next.splice(index, 1);
        setSpecialties(next);
        return true;
    };
    const handleAddAchievement = () => {
        if (newAchievement.trim() !== '') {
            setAchievements([...achievements, newAchievement.trim()]);
            setNewAchievement('');
        }
    };

    const handleRemoveAchievement = (index: number) => {
        const newAchievements = [...achievements];
        newAchievements.splice(index, 1);
        setAchievements(newAchievements);
        return true;
    };

    const handleAddCaseStudy = () => {
        if (newCaseStudy.trim() !== '') {
            setCaseStudies([...caseStudies, newCaseStudy.trim()]);
            setNewCaseStudy('');
        }
    };

    const handleRemoveCaseStudy = (index: number) => {
        const next = [...caseStudies];
        next.splice(index, 1);
        setCaseStudies(next);
        return true;
    };

    const handleAddCredential = () => {
        if (!newCredName.trim()) return;
        setCredentials([...credentials, { name: newCredName.trim(), url: newCredUrl?.trim() || undefined }]);
        setNewCredName('');
        setNewCredUrl('');
    };

    const handleRemoveCredential = (index: number) => {
        const next = [...credentials];
        next.splice(index, 1);
        setCredentials(next);
        return true;
    };

    const handleAddSocial = () => {
        if (!newSocialPlatform || !newSocialUrl.trim()) return;
        setSocialLinks([...socialLinks, { name: newSocialPlatform, url: newSocialUrl.trim() }]);
        setNewSocialPlatform('');
        setNewSocialUrl('');
    };

    const handleUploadAvatar = async (file?: File) => {
        const targetFile = file;
        if (!targetFile) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('file', targetFile);
            const res = await fetch('/api/upload/avatar', {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            if (data?.success && data?.data?.url) {
                setAvatarUrl(data.data.url);
                showToast({ severity: 'success', summary: '上传成功', detail: '头像已更新' });
            } else {
                showToast({ severity: 'error', summary: '上传失败', detail: data?.message || '请稍后再试' });
            }
        } catch (err) {
            console.error(err);
            showToast({ severity: 'error', summary: '上传失败', detail: '网络异常' });
        } finally {
            setUploading(false);
        }
    };

    const handleRemoveSocial = (index: number) => {
        const next = [...socialLinks];
        next.splice(index, 1);
        setSocialLinks(next);
        return true;
    };

    // 自动获取当前位置
    const handleAutoLocation = async (showToasts = true) => {
        setLocating(true);
        try {
            const location = await getCurrentLocation(true);
            
            if (location) {
                // 更新位置信息
                setCity(location.city || city);
                setAddress(location.address || address);
                setLatitude(location.latitude);
                setLongitude(location.longitude);

                if (showToasts) {
                    showToast({
                        severity: 'success',
                        summary: '定位成功',
                        detail: location.source === 'browser' ? '已使用精确定位' : '已使用IP定位',
                        life: 3000
                    });
                }

                console.log('自动定位成功:', {
                    source: location.source,
                    city: location.city,
                    latitude: location.latitude,
                    longitude: location.longitude
                });
            } else {
                if (showToasts) {
                    showToast({
                        severity: 'info',
                        summary: '提示',
                        detail: '自动定位失败，请手动选择城市',
                        life: 3000
                    });
                }
                console.log('自动定位失败');
            }
        } catch (error) {
            console.error('自动定位异常:', error);
            if (showToasts) {
                showToast({
                    severity: 'info',
                    summary: '提示',
                    detail: '自动定位失败，请手动选择城市',
                    life: 3000
                });
            }
        } finally {
            setLocating(false);
        }
    };

    const handleSubmit = async () => {
        setLoading(true);
        try {
            // 构造要更新的profile对象
            const socialLinksObj: Record<string, string> = {};
            socialLinks.forEach(item => {
                if (item.name && item.url) {
                    const keyMap: Record<string, string> = {
                        '抖音': 'douyin',
                        '小红书': 'xiaohongshu',
                        '知乎': 'zhihu',
                        'B站': 'bilibili',
                        '快手': 'kuaishou',
                        '其他网站': 'other'
                    };
                    const key = keyMap[item.name] || item.name;
                    socialLinksObj[key] = item.url;
                }
            });

            const profile = {
                teachingPhilosophy,
                achievements,
                caseStudies,
                credentials,
                contactEmail,
                contactPhone,
                socialLinks: Object.keys(socialLinksObj).length > 0 ? socialLinksObj : null,
            };

            const provinceValue = province?.trim() || null;
            const cityValue = city?.trim() || null;
            const countyValue = county?.trim() || null;

            // 调用服务更新教练信息（地址平铺：province、city、county）
            const res = await coachService.updateCoachProfile({
                id: coach.id,
                name,
                title: title || null,
                avatarUrl: avatarUrl || null,
                specialties: specialties.length ? specialties : null,
                yearsExperience: yearsExperience ?? 0,
                bio,
                profile,
                province: provinceValue,
                city: cityValue,
                county: countyValue,
                address: address || null,
                latitude,
                longitude
            });

            if (res.data.success) {
                showToast({
                    severity: 'success',
                    summary: '成功',
                    detail: '教练信息已更新'
                });

                // 保存成功后回调
                onSave();
                onHide();
            } else {
                showToast({
                    severity: 'error',
                    summary: '保存失败',
                    detail: getErrorMessageForUser(res.data.message)
                });
            }
        } catch (error) {
            const raw = error instanceof Error ? error.message : String(error);
            showToast({
                severity: 'error',
                summary: '保存失败',
                detail: getErrorMessageForUser(raw)
            });
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <div>
            <Button label="取消" icon="pi pi-times" onClick={onHide} className="p-button-text" />
            <Button label="保存" icon="pi pi-check" onClick={handleSubmit} loading={loading} />
        </div>
    );

    return (
        <>
            <ConfirmDialog />
            <Dialog
                header="编辑教练信息"
                visible={visible}
                style={{ width: 'min(900px, 92vw)' }}
                onHide={onHide}
                footer={footer}
            >
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-900 mb-2">
                                姓名
                            </label>
                            <InputText
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full"
                                placeholder="请输入姓名"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-900 mb-2">
                                称号/头衔
                            </label>
                            <InputText
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="w-full"
                                placeholder="如：国家一级健身指导员、CrossFit教练等"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            头像链接
                        </label>
                        <div className="flex items-center gap-3">
                            <InputText
                                value={avatarUrl}
                                onChange={(e) => setAvatarUrl(e.target.value)}
                                className="flex-1"
                                placeholder="输入图片 URL（支持公网链接）"
                            />
                            {avatarUrl ? (
                                <div className="w-14 h-14 rounded-full overflow-hidden bg-surface-100 border">
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img src={avatarUrl} alt="avatar preview" className="w-full h-full object-cover" />
                                </div>
                            ) : (
                                <div className="w-14 h-14 rounded-full bg-surface-100 border flex items-center justify-center text-surface-400 text-xs">无</div>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-2">
                            <label className="px-3 py-2 border border-surface-200 rounded-lg text-sm cursor-pointer hover:bg-surface-50">
                                <input
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) handleUploadAvatar(file);
                                    }}
                                />
                                选择本地图片
                            </label>
                            <Button
                                label="清空"
                                text
                                size="small"
                                onClick={() => setAvatarUrl('')}
                            />
                            {uploading && <span className="text-xs text-surface-500">上传中...</span>}
                        </div>
                        <p className="text-xs text-surface-500 mt-1">支持 PNG/JPG/WEBP，≤2MB。</p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            专业领域
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {specialties.map((item, index) => (
                                <Chip
                                    key={index}
                                    label={item}
                                    removable
                                    onRemove={() => handleRemoveSpecialty(index)}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newSpecialty}
                                onChange={(e) => setNewSpecialty(e.target.value)}
                                placeholder="输入专业领域，按回车添加"
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newSpecialty.trim()) {
                                        e.preventDefault();
                                        handleAddSpecialty();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                icon="pi pi-plus"
                                onClick={handleAddSpecialty}
                                disabled={!newSpecialty.trim()}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            教学年限（年）
                        </label>
                        <AeroInputNumber
                            value={yearsExperience}
                            onValueChange={(e) => setYearsExperience((e.value as number) || 0)}
                            min={0}
                            className="w-full"
                        />
                    </div>

                    <div>
                        <label htmlFor="bio" className="block text-sm font-medium text-surface-900 mb-2">
                            教练简介
                        </label>
                        <InputTextarea
                            id="bio"
                            value={bio || ''}
                            onChange={(e) => setBio(e.target.value)}
                            rows={4}
                            className="w-full"
                        />

                    </div>

                    <div>
                        <label htmlFor="teachingPhilosophy" className="block text-sm font-medium text-surface-900 mb-2">
                            教学理念
                        </label>
                        <InputTextarea
                            id="teachingPhilosophy"
                            value={teachingPhilosophy || ''}
                            onChange={(e) => setTeachingPhilosophy(e.target.value)}
                            rows={4}
                            className="w-full"
                        />

                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            成就奖项
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {achievements.map((achievement, index) => (
                                <Chip
                                    key={index}
                                    label={achievement}
                                    removable
                                    onRemove={() => handleRemoveAchievement(index)}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newAchievement}
                                onChange={(e) => setNewAchievement(e.target.value)}
                                placeholder="输入成就奖项"
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newAchievement.trim()) {
                                        e.preventDefault();
                                        handleAddAchievement();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                icon="pi pi-plus"
                                onClick={handleAddAchievement}
                                disabled={!newAchievement.trim()}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            成功案例
                        </label>
                        <div className="flex flex-wrap gap-2 mb-2">
                            {caseStudies.map((item, index) => (
                                <Chip
                                    key={index}
                                    label={item}
                                    removable
                                    onRemove={() => handleRemoveCaseStudy(index)}
                                />
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newCaseStudy}
                                onChange={(e) => setNewCaseStudy(e.target.value)}
                                placeholder="输入案例描述"
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newCaseStudy.trim()) {
                                        e.preventDefault();
                                        handleAddCaseStudy();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                icon="pi pi-plus"
                                onClick={handleAddCaseStudy}
                                disabled={!newCaseStudy.trim()}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">
                            资质证书
                        </label>
                        <div className="space-y-2 mb-2">
                            {credentials.map((cred, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <InputText
                                        value={cred.name}
                                        onChange={(e) => {
                                            const next = [...credentials];
                                            next[index] = { ...next[index], name: e.target.value };
                                            setCredentials(next);
                                        }}
                                        placeholder="证书名称"
                                        className="flex-1"
                                    />
                                    <InputText
                                        value={cred.url || ''}
                                        onChange={(e) => {
                                            const next = [...credentials];
                                            next[index] = { ...next[index], url: e.target.value };
                                            setCredentials(next);
                                        }}
                                        placeholder="证书链接（可选）"
                                        className="flex-1"
                                    />
                                    <Button icon="pi pi-times" outlined rounded onClick={() => handleRemoveCredential(index)} />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <InputText
                                value={newCredName}
                                onChange={(e) => setNewCredName(e.target.value)}
                                placeholder="证书名称"
                                className="flex-1"
                            />
                            <InputText
                                value={newCredUrl}
                                onChange={(e) => setNewCredUrl(e.target.value)}
                                placeholder="证书链接（可选）"
                                className="flex-1"
                            />
                            <Button type="button" icon="pi pi-plus" onClick={handleAddCredential} disabled={!newCredName.trim()} />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-surface-900 mb-2">联系邮箱</label>
                            <InputText
                                value={contactEmail || ''}
                                onChange={(e) => setContactEmail(e.target.value || null)}
                                placeholder="可公开的邮箱"
                                className="w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-surface-900 mb-2">联系电话</label>
                            <InputText
                                value={contactPhone || ''}
                                onChange={(e) => setContactPhone(e.target.value || null)}
                                placeholder="可公开的电话"
                                className="w-full"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-surface-900 mb-2">社交媒体</label>
                        <div className="space-y-2 mb-2">
                            {socialLinks.map((item, index) => (
                                <div key={index} className="flex gap-2 items-center">
                                    <Dropdown
                                        value={item.name || null}
                                        options={SOCIAL_MEDIA_OPTIONS}
                                        optionLabel="label"
                                        optionValue="value"
                                        onChange={(e) => {
                                            const next = [...socialLinks];
                                            next[index] = { ...next[index], name: e.value || '' };
                                            setSocialLinks(next);
                                        }}
                                        placeholder="选择平台"
                                        className="flex-1"
                                    />
                                    <InputText
                                        value={item.url}
                                        onChange={(e) => {
                                            const next = [...socialLinks];
                                            next[index] = { ...next[index], url: e.target.value };
                                            setSocialLinks(next);
                                        }}
                                        placeholder="链接"
                                        className="flex-1"
                                    />
                                    <Button icon="pi pi-times" outlined rounded onClick={() => handleRemoveSocial(index)} />
                                </div>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <Dropdown
                                value={newSocialPlatform}
                                options={SOCIAL_MEDIA_OPTIONS}
                                optionLabel="label"
                                optionValue="value"
                                onChange={(e) => setNewSocialPlatform(e.value || '')}
                                placeholder="选择平台"
                                className="flex-1"
                            />
                            <InputText
                                value={newSocialUrl}
                                onChange={(e) => setNewSocialUrl(e.target.value)}
                                placeholder="链接"
                                className="flex-1"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && newSocialPlatform && newSocialUrl.trim()) {
                                        e.preventDefault();
                                        handleAddSocial();
                                    }
                                }}
                            />
                            <Button
                                type="button"
                                icon="pi pi-plus"
                                onClick={handleAddSocial}
                                disabled={!newSocialPlatform || !newSocialUrl.trim()}
                            />
                        </div>
                    </div>

                    {/* 位置信息 */}
                    <div className="col-span-1 md:col-span-2 pt-6 border-t border-surface-200">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-base font-bold text-surface-900">位置信息</h4>
                            {locating && (
                                <div className="flex items-center gap-2 text-sm text-primary-500">
                                    <i className="pi pi-spin pi-spinner"></i>
                                    <span>正在获取位置...</span>
                                </div>
                            )}
                        </div>
                        <MapLocationPicker
                            value={{
                                province,
                                city,
                                county,
                                address,
                                latitude,
                                longitude,
                            }}
                            onChange={(v) => {
                                setProvince(v.province ?? '');
                                setCity(v.city ?? '');
                                setCounty(v.county ?? '');
                                setAddress(v.address ?? '');
                                setLatitude(v.latitude ?? null);
                                setLongitude(v.longitude ?? null);
                            }}
                            cityLabel="常住城市"
                            addressLabel="详细地址"
                            mapLabel="位置标记"
                            mapHeight="350px"
                            showRelocateButton
                            onRelocate={() => handleAutoLocation(true)}
                            hint="* 点击地图、拖动标记调整位置，或点击「重新定位」按钮重新获取当前位置"
                        />
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export default EditCoachProfileDialog;