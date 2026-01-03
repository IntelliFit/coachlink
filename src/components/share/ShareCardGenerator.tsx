'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { ProgressSpinner } from 'primereact/progressspinner';
import { ArrowLeft, Download, Share2, Copy } from 'lucide-react';
import html2canvas from 'html2canvas';
import { executionService } from '@/app/service/executionService';
import { useToastContext } from '@/context/ToastContext';
import TemplateDataFlow from './TemplateDataFlow';
import TemplateCalendar from './TemplateCalendar';
import TemplateMinimalist from './TemplateMinimalist';

interface ShareCardGeneratorProps {
    visible: boolean;
    onHide: () => void;
    executionId: string;
}

const ShareCardGenerator: React.FC<ShareCardGeneratorProps> = ({
    visible,
    onHide,
    executionId
}) => {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [shareData, setShareData] = useState<any>(null);
    const [activeTemplate, setActiveTemplate] = useState<'data' | 'calendar' | 'minimalist'>('data');
    const cardRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (visible && executionId) {
            loadShareData();
        }
    }, [visible, executionId]);

    const loadShareData = async () => {
        try {
            setLoading(true);
            const data = await executionService.getShareInfo(executionId);
            
            if (data?.success) {
                setShareData(data.data);
            } else {
                showToast({
                    severity: 'error',
                    summary: '获取分享信息失败',
                    detail: data.message
                });
            }
        } catch (error) {
            console.error('Failed to load share data:', error);
        } finally {
            setLoading(false);
        }
    };

    // 将 html2canvas 不支持的 color() / color-mix() 等值替换为安全值
    const sanitizeColors = (root: HTMLElement) => {
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);

        const fallbackValue = (prop: string) => {
            const p = prop.toLowerCase();
            if (p.includes("background")) return "transparent";
            if (p.includes("shadow") || p.includes("image") || p.includes("filter")) return "none";
            if (p.includes("color")) return "#ffffff";
            return "#ffffff";
        };

        while (walker.nextNode()) {
            const el = walker.currentNode as HTMLElement;
            const style = window.getComputedStyle(el);

            // 覆盖所有包含 color() 的属性（含 CSS 变量）
            for (let i = 0; i < style.length; i += 1) {
                const prop = style.item(i);
                const value = style.getPropertyValue(prop);
                if (value && value.includes("color(")) {
                    el.style.setProperty(prop, fallbackValue(prop), "important");
                }
            }

            // 针对常见属性再兜底一次
            const boxShadow = style.getPropertyValue("box-shadow");
            if (boxShadow && boxShadow.includes("color(")) {
                el.style.boxShadow = "none";
            }

            const bgImage = style.getPropertyValue("background-image");
            if (bgImage && bgImage.includes("color(")) {
                el.style.backgroundImage = "none";
            }
        }
    };

    const handleShare = async () => {
        if (!cardRef.current) return;
        
        try {
            setGenerating(true);
            // 克隆节点，避免污染原始 DOM
            const cloned = cardRef.current.cloneNode(true) as HTMLElement;
            cloned.style.position = "fixed";
            cloned.style.left = "-9999px";
            cloned.style.top = "0";
            document.body.appendChild(cloned);

            sanitizeColors(cloned);

            const canvas = await html2canvas(cloned, {
                useCORS: true,
                scale: 2,
                backgroundColor: null,
            } as any);

            document.body.removeChild(cloned);
            
            const dataUrl = canvas.toDataURL('image/png');
            
            // 移动端优先使用 Web Share API
            if (navigator.share && /mobile/i.test(navigator.userAgent)) {
                const blob = await (await fetch(dataUrl)).blob();
                const file = new File([blob], `CoachLink_Training_${executionId}.png`, { type: 'image/png' });
                
                await navigator.share({
                    files: [file],
                    title: '我的训练打卡',
                    text: '看看我今天的训练成果！',
                });
            } else {
                // 桌面端下载
                const link = document.createElement('a');
                link.download = `CoachLink_Training_${executionId}.png`;
                link.href = dataUrl;
                link.click();
            }
        } catch (error) {
            console.error('Generation failed:', error);
            showToast({
                severity: 'error',
                summary: '生成图片失败',
                detail: '请重试或尝试截图分享'
            });
        } finally {
            setGenerating(false);
        }
    };

    const templates = [
        { id: 'data', name: '数据流', icon: '⚡' },
        { id: 'calendar', name: '日历流', icon: '📅' },
        { id: 'minimalist', name: '极简', icon: '✨' },
    ];

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header="分享训练打卡"
            style={{ width: '95vw', maxWidth: '500px' }}
            modal
            className="share-card-dialog"
            breakpoints={{ '960px': '75vw', '641px': '95vw' }}
        >
            {loading ? (
                <div className="flex flex-col items-center py-12">
                    <ProgressSpinner style={{ width: '50px', height: '50px' }} />
                    <p className="mt-4 text-surface-500">正在准备精美卡片...</p>
                </div>
            ) : shareData ? (
                <div className="flex flex-col gap-6">
                    {/* Preview Area */}
                    <div className="bg-surface-100 rounded-2xl p-4 flex justify-center overflow-hidden">
                        <div ref={cardRef} className="shadow-2xl">
                            {activeTemplate === 'data' && <TemplateDataFlow data={shareData} />}
                            {activeTemplate === 'calendar' && <TemplateCalendar data={shareData} />}
                            {activeTemplate === 'minimalist' && <TemplateMinimalist data={shareData} />}
                        </div>
                    </div>

                    {/* Template Selector */}
                    <div className="flex justify-between gap-2">
                        {templates.map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setActiveTemplate(t.id as any)}
                                className={`flex-1 py-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${
                                    activeTemplate === t.id
                                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                                        : 'border-surface-200 bg-white text-surface-500 hover:border-surface-300'
                                }`}
                            >
                                <span className="text-xl">{t.icon}</span>
                                <span className="text-xs font-bold">{t.name}</span>
                            </button>
                        ))}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-4">
                        <Button
                            label={generating ? "生成中..." : "保存图片"}
                            icon={generating ? <ProgressSpinner style={{ width: '18px', height: '18px' }} /> : <Download className="w-4 h-4 mr-2" />}
                            className="flex-1 py-4 font-bold rounded-2xl"
                            onClick={handleShare}
                            disabled={generating}
                        />
                        <Button
                            label="复制链接"
                            icon={<Copy className="w-4 h-4 mr-2" />}
                            outlined
                            className="flex-1 py-4 font-bold rounded-2xl"
                            onClick={() => {
                                const url = `${window.location.origin}/public/training/${shareData.shareToken}`;
                                navigator.clipboard.writeText(url);
                                showToast({ severity: 'success', summary: '已复制', detail: '分享链接已复制到剪贴板' });
                            }}
                        />
                    </div>
                </div>
            ) : (
                <div className="text-center py-12 text-surface-500">
                    加载数据失败，请重试
                </div>
            )}
        </Dialog>
    );
};

export default ShareCardGenerator;
