import React from 'react';
import { Card } from 'primereact/card';
import { Button } from 'primereact/button';
import { QRCodeSVG } from 'qrcode.react';
import { GetCoachResponseDto } from '@/app/api/coach/get-coach/entity';

interface PosterProps {
    mode: 'exclusive' | 'open';
    coach: GetCoachResponseDto | null;
    posterRef: React.RefObject<HTMLDivElement>;
    savingPoster: string | null;
    onSave: (mode: 'exclusive' | 'open') => void;
    onCopy: (mode: 'exclusive' | 'open') => void;
}

const PosterItem: React.FC<PosterProps> = ({ mode, coach, posterRef, savingPoster, onSave, onCopy }) => {
    const isExclusive = mode === 'exclusive';
    const themeColor = isExclusive ? 'orange' : 'blue';
    const bgGradient = isExclusive 
        ? 'radial-gradient(1200px 400px at 10% 0%, rgba(249,115,22,0.28) 0%, rgba(255,255,255,0) 55%), radial-gradient(900px 360px at 90% 10%, rgba(236,72,153,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, #0b1220 0%, #111827 45%, #0b1220 100%)'
        : 'radial-gradient(1100px 380px at 0% 0%, rgba(59,130,246,0.30) 0%, rgba(255,255,255,0) 55%), radial-gradient(900px 360px at 100% 10%, rgba(16,185,129,0.22) 0%, rgba(255,255,255,0) 55%), linear-gradient(135deg, #07111f 0%, #0b1220 55%, #07111f 100%)';

    const inviteUrl = isExclusive ? coach?.invitationInfo.inviteUrlExclusive : coach?.invitationInfo.inviteUrlOpen;

    return (
        <div className="bg-surface-0 border border-surface-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-surface-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <i className={`pi ${isExclusive ? 'pi-shield text-orange-500' : 'pi-globe text-blue-500'}`} />
                    <div className="font-semibold">{isExclusive ? '专属海报' : '公开海报'}</div>
                </div>
                <Button icon="pi pi-copy" className="p-button-outlined p-button-sm" onClick={() => onCopy(mode)} />
            </div>

            <div className="p-5 space-y-4">
                <div className="flex justify-center">
                    <div ref={posterRef} className="w-[360px] rounded-2xl overflow-hidden shadow-sm bg-white border border-gray-200">
                        <div className="p-6" style={{ background: bgGradient, color: '#0b1220' }}>
                            <div className="text-xs font-semibold text-white/90">COACHLINK · 邀请加入训练</div>
                            <div className="mt-5 flex items-center gap-4">
                                <div className="w-14 h-14 rounded-2xl overflow-hidden bg-white/10 border border-white/15">
                                    {coach?.coach.avatar_url ? <img src={coach.coach.avatar_url} crossOrigin="anonymous" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-black">C</div>}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-white text-xl font-black truncate">{coach?.coach?.name || '教练'}</div>
                                    <div className="text-sm text-white/80 truncate">{coach?.coach?.title || '私人训练'}</div>
                                </div>
                            </div>
                            <div className="mt-5 flex items-center gap-4 rounded-2xl p-3 bg-white/5 border border-white/10">
                                <div className="p-2 rounded-xl bg-white">
                                    <QRCodeSVG value={inviteUrl || ''} size={84} level="M" />
                                </div>
                                <div className="flex-1 text-white">
                                    <div className="font-black text-base">扫码 · 立即注册</div>
                                    <div className="text-[12px] text-white/70">注册后查看教练主页</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button 
                        label={savingPoster === mode ? '保存中...' : `保存${isExclusive ? '专属' : '公开'}海报`}
                        icon={savingPoster === mode ? 'pi pi-spin pi-spinner' : 'pi pi-download'}
                        className={`flex-1 bg-${themeColor}-600`}
                        onClick={() => onSave(mode)}
                        disabled={savingPoster !== null}
                    />
                </div>
            </div>
        </div>
    );
};

interface InvitationPosterCardProps {
    coach: GetCoachResponseDto | null;
    posterRefExclusive: React.RefObject<HTMLDivElement | null>;
    posterRefOpen: React.RefObject<HTMLDivElement | null>;
    savingPoster: 'exclusive' | 'open' | null;
    savePoster: (mode: 'exclusive' | 'open') => void;
    handleCopyModeLink: (mode: 'exclusive' | 'open') => void;
}

export const InvitationPosterCard: React.FC<InvitationPosterCardProps> = ({
    coach,
    posterRefExclusive,
    posterRefOpen,
    savingPoster,
    savePoster,
    handleCopyModeLink
}) => {
    return (
        <Card
            title="邀请海报（社媒传播版）"
            subTitle="生成两张海报：专属模式（私域）与公开模式（公域），可分别投放不同渠道"
        >
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* 专属海报实例 */}
                <PosterItem
                    mode="exclusive"
                    coach={coach}
                    posterRef={posterRefExclusive}
                    savingPoster={savingPoster}
                    onSave={savePoster}
                    onCopy={handleCopyModeLink}
                />

                {/* 公开海报实例 */}
                <PosterItem
                    mode="open"
                    coach={coach}
                    posterRef={posterRefOpen}
                    savingPoster={savingPoster}
                    onSave={savePoster}
                    onCopy={handleCopyModeLink}
                />
            </div>
        </Card>
    );
};