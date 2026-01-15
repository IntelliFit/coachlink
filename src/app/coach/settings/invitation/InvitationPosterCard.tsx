'use client';

import React from 'react';
import { Button } from 'primereact/button';
import { QRCodeSVG } from 'qrcode.react';
import { GetCoachResponseDto } from '@/app/api/coach/get-coach/entity';
import Tilt from 'react-parallax-tilt';

interface InvitationPosterCardProps {
    coach: GetCoachResponseDto | null;
    posterRefExclusive: React.RefObject<HTMLDivElement | null>;
    posterRefOpen?: React.RefObject<HTMLDivElement | null>;
    savingPoster: 'exclusive' | 'open' | null;
    savePoster: (mode: 'exclusive' | 'open') => void;
    handleCopyModeLink: (mode: 'exclusive' | 'open') => void;
}

export const InvitationPosterCard: React.FC<InvitationPosterCardProps> = ({
    coach,
    posterRefExclusive,
    savingPoster,
    savePoster,
    handleCopyModeLink
}) => {
    // 主题色变量
    const themeColor = '#F28631';

    // 渐变色背景优化：将蓝色改为主题色 F28631 的半透明效果
    const bgGradient = `radial-gradient(1100px 380px at 0% 0%, rgba(242,134,49,0.25) 0%, rgba(255,255,255,0) 55%), radial-gradient(900px 360px at 100% 10%, rgba(242,134,49,0.18) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, #07111f 0%, #0b1220 55%, #07111f 100%)`;

    return (
        <div className="bg-surface rounded-[24px] border border-surface-100 p-8 transition-all duration-300 shadow-sm hover:shadow-md">
            {/* 头部标题区保持不变... */}

            <div className="flex flex-col lg:flex-row gap-12 items-center">
                {/* 左侧：海报展示区 */}
                <div className="relative group">
                    {/* 使用 Tilt 组件包裹 */}
                    <Tilt
                        tiltMaxAngleX={8}        // X轴最大倾斜角度
                        tiltMaxAngleY={8}        // Y轴最大倾斜角度
                        perspective={1000}       // 视差透视距离
                        glareEnable={true}       // 开启光泽感
                        glareMaxOpacity={0.25}   // 光泽最大透明度
                        glareColor="#ffffff"      // 光泽颜色
                        glarePosition="all"      // 全方位反光
                        glareBorderRadius="0px"  // 匹配海报圆角
                        scale={1.02}             // 悬浮时微放大的比例
                        transitionSpeed={1500}   // 恢复平滑度
                    >
                        {/* 海报本体 */}
                        <div
                            ref={posterRefExclusive}
                            data-poster-root="exclusive"
                            className="w-[320px] shadow-2xl overflow-hidden" // 增加 overflow-hidden 让光泽不出界
                            style={{ background: '#ffffff', border: '1px solid #e5e7eb' }}
                        >
                            <div
                                className="p-8 flex flex-col min-h-[480px] relative"
                                style={{
                                    color: '#ffffff',
                                    background: bgGradient,
                                }}
                            >
                                {/* 1. 顶部品牌 */}
                                <div className="flex justify-between items-center mb-10 relative z-10">
                                    <div className="flex flex-col">
                                        <span className="text-[12px] font-black tracking-[0.2em]">COACHLINK<span style={{ color: themeColor }}>.FIT</span></span>
                                        <span className="text-[7px] font-bold uppercase tracking-[0.2em] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>教链 - 专业数字化教练平台</span>
                                    </div>
                                    <div className="w-12 h-8 border border-surface/20">
                                        <img src="/favicon.jpg" crossOrigin="anonymous" className="w-full h-full object-cover" alt="logo" />
                                    </div>
                                </div>

                                {/* 2. 教练中心区域 */}
                                <div className="flex-1 flex flex-col justify-center relative z-10">
                                    <div className="relative w-20 h-20 mb-6">
                                        <div className="absolute inset-0 blur-xl rounded-full" style={{ background: 'rgba(242,134,49,0.2)' }} />
                                        <div
                                            className="relative w-full h-full rounded-[24px] overflow-hidden border shadow-xl"
                                            style={{ borderColor: 'rgba(255,255,255,0.2)', background: '#1e293b' }}
                                        >
                                            {coach?.coach.avatar_url
                                                ? <img src={coach.coach.avatar_url} crossOrigin="anonymous" className="w-full h-full object-cover" alt="avatar" />
                                                : <div className="w-full h-full flex items-center justify-center font-black text-2xl" style={{ background: '#0f172a' }}>C</div>
                                            }
                                        </div>
                                    </div>

                                    <div className="space-y-1">
                                        {/* 姓名与年限标签同行 */}
                                        <div className="flex items-baseline gap-3 mb-2">
                                            <h4 className="text-4xl font-black tracking-tighter italic leading-none">
                                                {coach?.coach?.name || '主教练'}
                                            </h4>

                                            {coach?.coach?.years_experience && (
                                                <div
                                                    className="flex items-center gap-1 px-2 py-0.5 rounded-md border transform translate-y-[-2px]"
                                                    style={{
                                                        background: 'rgba(255,255,255,0.08)',
                                                        borderColor: 'rgba(255,255,255,0.15)'
                                                    }}
                                                >
                                                    <span style={{ color: themeColor }} className="text-[11px] font-black italic">
                                                        {coach.coach.years_experience}
                                                    </span>
                                                    <span className="text-[9px] font-bold text-surface/70">年经验</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* 头衔部分 */}
                                        <p className="text-sm font-bold tracking-widest uppercase text-surface/60">
                                            {coach?.coach?.title || '专业健身指导'}
                                        </p>
                                    </div>
                                    <div className="w-8 h-1 mt-4 rounded-full" style={{ background: themeColor }} />
                                </div>

                                {/* 3. 底部：扫码区域 */}
                                <div
                                    className="mt-8 flex items-center gap-4 rounded-[22px] p-4 relative z-10"
                                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
                                >
                                    <div className="p-2 rounded-xl shadow-lg" style={{ background: '#ffffff' }}>
                                        <QRCodeSVG value={coach?.invitationInfo.inviteUrlExclusive || ''} size={70} level="H" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="text-[14px] font-black tracking-tighter mb-1">立即扫码加入</div>
                                        <div className="text-[10px] font-bold leading-snug text-surface/50">
                                            扫码建立专属教练关联 <br />
                                            开启数字化训练体验
                                        </div>
                                    </div>
                                </div>

                                {/* 背景装饰 */}
                                <div className="absolute -bottom-6 -left-8 text-[80px] font-black italic pointer-events-none select-none tracking-tighter z-0"
                                    style={{ color: 'rgba(255,255,255,0.02)' }}>
                                    FIT.
                                </div>
                            </div>
                        </div>
                    </Tilt>
                </div>

                {/* 右侧：操作说明 */}
                <div className="flex-1 w-full space-y-8">
                    <div className="space-y-4 text-center lg:text-left">
                        <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 rounded-full border border-orange-100">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: themeColor }} />
                            <span className="text-[10px] font-black uppercase tracking-widest px-1" style={{ color: themeColor }}>高清名片海报</span>
                        </div>
                        <h4 className="text-2xl font-black text-surface-900 tracking-tight italic leading-snug">
                            不仅是分享邀请 <br /> 更是 <span style={{ color: themeColor }}>专业形象</span> 的完美呈现
                        </h4>
                        <p className="text-xs font-bold text-surface-500 leading-relaxed max-w-sm mx-auto lg:mx-0">
                            海报已自动集成 coachlink.fit 专属品牌印记。通过此海报注册的学员将自动锁定在您的专属管理体系下。
                        </p>
                    </div>

                    <div className="pt-4">
                        <Button
                            label={savingPoster === 'exclusive' ? '正在渲染海报...' : '保存专属高清海报'}
                            icon={savingPoster === 'exclusive' ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
                            style={{ background: themeColor, borderColor: themeColor }}
                            className="w-full p-4 shadow-xl rounded-xl font-black tracking-tight active:scale-[0.98] transition-all border-none"
                            onClick={() => savePoster('exclusive')}
                            disabled={savingPoster !== null}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};