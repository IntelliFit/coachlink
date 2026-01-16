'use client';

import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { Skeleton } from 'primereact/skeleton';
import { GetCoachResponseDto } from '@/app/api/coach/get-coach/entity';
import Tilt from 'react-parallax-tilt';
import { useToastContext } from '@/context/ToastContext';

interface InvitationPosterCardProps {
    coach: GetCoachResponseDto | null;
    savingPoster: 'exclusive' | 'open' | null;
    handleCopyModeLink: (mode: 'exclusive' | 'open') => void;
}

export const InvitationPosterCard: React.FC<InvitationPosterCardProps> = ({
    coach,
    savingPoster,
}) => {
    const themeColor = '#F28631';
    const { showToast } = useToastContext();

    // 新增状态：存储预加载的海报 Blob URL 和加载状态
    const [posterUrl, setPosterUrl] = useState<string | null>(null);
    const [isImageLoading, setIsImageLoading] = useState(true);

    // 初始化时请求海报
    useEffect(() => {
        const fetchPoster = async () => {
            if (!coach?.coach?.id) return;
            
            setIsImageLoading(true);
            try {
                const response = await fetch('/api/og/invitation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coachId: coach.coach.id }),
                });

                if (!response.ok) throw new Error('预加载海报失败');

                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                setPosterUrl(url);
            } catch (error) {
                console.error('Preload Poster Error:', error);
                showToast({ severity: 'error', summary: '加载失败', detail: '无法获取预览海报' });
            } finally {
                setIsImageLoading(false);
            }
        };

        fetchPoster();

        // 组件卸载时释放内存
        return () => {
            if (posterUrl) URL.revokeObjectURL(posterUrl);
        };
    }, [coach?.coach?.id]);

    // 下载逻辑：直接使用现成的 URL
    const handleDownload = () => {
        if (!posterUrl) {
            showToast({ severity: 'warn', summary: '请稍候', detail: '海报正在生成中' });
            return;
        }

        const link = document.createElement('a');
        link.href = posterUrl;
        link.download = `CoachLink_${coach?.coach?.name || 'Poster'}_${new Date().getTime()}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        showToast({ severity: 'success', summary: '保存成功', detail: '海报已开始下载' });
    };

    return (
        <div className="bg-surface rounded-[24px] border border-surface-100 p-8 transition-all duration-300 shadow-sm hover:shadow-md">
            <div className="flex flex-col lg:flex-row gap-12 items-center">
                
                {/* 左侧：海报展示区 */}
                <div className="relative group">
                    <Tilt
                        tiltMaxAngleX={8}
                        tiltMaxAngleY={8}
                        perspective={1000}
                        glareEnable={true}
                        glareMaxOpacity={0.25}
                        glareColor="#ffffff"
                        glarePosition="all"
                        scale={1.02}
                        transitionSpeed={1500}
                    >
                        <div
                            className="shadow-2xl"
                        >
                            {isImageLoading ? (
                                // 骨架屏：模拟海报比例和大致结构
                                <div className="p-8 h-full w-[320px] flex flex-col space-y-6">
                                    <div className="flex justify-between">
                                        <Skeleton width="60%" height="20px" />
                                        <Skeleton width="40px" height="30px" />
                                    </div>
                                    <div className="flex-1 flex flex-col justify-center">
                                        <Skeleton shape="circle" size="5rem" className="mb-4" />
                                        <Skeleton width="80%" height="40px" className="mb-2" />
                                        <Skeleton width="40%" height="20px" />
                                    </div>
                                    <Skeleton width="100%" height="80px" borderRadius="16px" />
                                </div>
                            ) : (
                                // 渲染请求回来的真实海报图片
                                posterUrl && (
                                    <img 
                                        src={posterUrl} 
                                        alt="Coach Poster" 
                                        className="w-[320px] animate-in fade-in duration-500" 
                                    />
                                )
                            )}
                        </div>
                    </Tilt>
                </div>

                {/* 右侧：操作说明 */}
                <div className="flex-1 w-full space-y-8">
                    <div className="space-y-4 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-full border border-orange-100">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: themeColor }} />
                            <span className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: themeColor }}>
                                {isImageLoading ? '正在准备高清海报...' : '高清海报已就绪'}
                            </span>
                        </div>
                        <h4 className="text-2xl font-black text-surface-900 tracking-tight italic leading-snug">
                            不仅是分享邀请 <br /> 更是 <span style={{ color: themeColor }}>专业形象</span> 的完美呈现
                        </h4>
                        <p className="text-xs font-bold text-surface-500 leading-relaxed max-w-sm mx-auto lg:mx-0">
                            海报已由云端实时生成，确保字体与设计的完美统一。通过此海报扫码注册的学员将自动绑定到您的管理名下。
                        </p>
                    </div>

                    <div className="pt-4">
                        <Button
                            label={isImageLoading ? '海报生成中...' : '保存高清海报'}
                            icon={isImageLoading ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
                            style={{ background: themeColor, borderColor: themeColor }}
                            className="w-full p-4 shadow-xl rounded-xl font-black tracking-tight active:scale-[0.98] transition-all border-none"
                            onClick={handleDownload}
                            disabled={isImageLoading}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};