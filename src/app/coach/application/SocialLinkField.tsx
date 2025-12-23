import React, { useState } from 'react';
import { Chip } from 'primereact/chip';
import { InputText } from 'primereact/inputtext';
import { Button } from 'primereact/button';
import { Dropdown } from 'primereact/dropdown';
import DouyinIcon from '@/components/icons/douyin';
import BilibiliIcon from '@/components/icons/bilibili';
import ZhihuIcon from '@/components/icons/zhihu';
import XiaohongshuIcon from '@/components/icons/xiaohongshu';
import KuaishouIcon from '@/components/icons/kuaishou';

interface SocialLink {
    name: string;
    url?: string;
}

interface SocialMediaOption {
    label: string;
    value: string;
    icon: React.ReactNode;
}

interface SocialLinkFieldProps {
    socialLinks: SocialLink[];
    onAdd: (socialLink: SocialLink) => void;
    onRemove: (index: number) => boolean;
    socialMediaOptions: SocialMediaOption[];
    socialMediaOptionTemplate: (option: SocialMediaOption) => JSX.Element;
    socialMediaValueTemplate: (option: SocialMediaOption | null) => JSX.Element;
}

const SocialLinkField: React.FC<SocialLinkFieldProps> = ({
    socialLinks,
    onAdd,
    onRemove,
    socialMediaOptions,
    socialMediaOptionTemplate,
    socialMediaValueTemplate
}) => {
    const [newSocialLink, setNewSocialLink] = useState<SocialLink>({ name: '', url: '' });

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            addSocialLink();
        }
    };

    const addSocialLink = () => {
        if (newSocialLink.name.trim() && newSocialLink.url.trim()) {
            onAdd({ ...newSocialLink });
            setNewSocialLink({ name: '', url: '' });
        }
    };

    const handleSocialLinkChange = (field: keyof SocialLink, value: string) => {
        setNewSocialLink(prev => ({
            ...prev,
            [field]: value
        }));
    };

    return (
        <div className="md:col-span-2">
            <label className="block text-sm font-medium text-surface-900 mb-2">
                社交媒体
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
                {socialLinks.map((socialLink, index) => (
                    <Chip
                        key={index}
                        label={`${socialLink.name}: ${socialLink.url}`}
                        removable
                        onRemove={() => onRemove(index)}
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
                        onKeyDown={handleKeyPress}
                    />
                    <Button
                        icon="pi pi-plus"
                        onClick={addSocialLink}
                        disabled={!newSocialLink.name.trim() || !newSocialLink.url?.trim()}
                    />
                </div>
            </div>
        </div>
    );
};

export default SocialLinkField;