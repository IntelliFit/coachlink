'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { captchaService } from '@/app/service/captchaService';
import { Loader2, ChevronRight } from 'lucide-react';

interface SliderCaptchaProps {
    visible: boolean;
    onHide: () => void;
    onSuccess: (token: string) => void;
}

const TRACK_WIDTH = 280;
const THUMB_SIZE = 40;
const IMAGE_HEIGHT = 56;

export default function SliderCaptcha({ visible, onHide, onSuccess }: SliderCaptchaProps) {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [id, setId] = useState<string | null>(null);
    const [imageUrl, setImageUrl] = useState<string>('');
    const [position, setPosition] = useState(0);
    const [dragging, setDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, base: 0 });
    /** 同步标记，防止 pointerUp + pointerLeave 等重复触发导致连续两次 verify（第二次会拿到「验证已过期」） */
    const verifyInFlightRef = useRef(false);

    const loadChallenge = useCallback(async () => {
        verifyInFlightRef.current = false;
        setLoading(true);
        setId(null);
        setImageUrl('');
        setPosition(0);
        setVerifying(false);
        try {
            const data = await captchaService.create();
            setId(data.id);
            setImageUrl(data.imageUrl || '');
        } catch (e: any) {
            showToast({ severity: 'error', summary: '加载验证失败', detail: e?.message });
        } finally {
            setLoading(false);
        }
    }, [showToast]);

    useEffect(() => {
        if (visible) {
            loadChallenge();
        }
    }, [visible, loadChallenge]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!id || verifying) return;
        e.preventDefault(); // 防止默认行为
        const track = trackRef.current;
        if (!track) return;
        const rect = track.getBoundingClientRect();
        const x = e.clientX - rect.left;
        dragStartRef.current = { x, base: position };
        setDragging(true);
        (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    const handlePointerMove = (e: React.PointerEvent) => {
        if (!dragging || !trackRef.current) return;
        e.preventDefault(); // 防止默认行为
        const rect = trackRef.current.getBoundingClientRect();
        const delta = e.clientX - rect.left - dragStartRef.current.x;
        let next = dragStartRef.current.base + delta;
        next = Math.max(0, Math.min(TRACK_WIDTH - THUMB_SIZE, next));
        setPosition(next);
    };

    const handlePointerUp = async (e: React.PointerEvent) => {
        e.preventDefault();
        if (!dragging) return;
        setDragging(false);
        if (position === 0) return;
        if (!id || verifying || verifyInFlightRef.current) return;
        verifyInFlightRef.current = true;
        setVerifying(true);
        try {
            const token = await captchaService.verify(id, position);
            onSuccess(token);
            onHide();
        } catch (err: any) {
            verifyInFlightRef.current = false;
            setPosition(0);
            showToast({ severity: 'error', summary: '验证失败', detail: err?.message });
            loadChallenge();
        } finally {
            setVerifying(false);
        }
    };

    const handlePointerReset = () => {
        setDragging(false);
        setPosition(0);
    };

    return (
        <Dialog
            visible={visible}
            onHide={onHide}
            header='安全验证'
            closable={true}
            modal
            dismissableMask
            className="border-none shadow-2xl rounded-2xl overflow-hidden"
            style={{ width: '360px' }}
            contentClassName="p-0"
            pt={{ root: { className: 'rounded-2xl' }, content: { className: 'rounded-b-2xl' } }}
        >
            <div className="p-6">
                <p className="text-sm text-surface-500 mb-4">请将滑块滑动到缺口位置完成验证</p>

                {loading ? (
                    <div className="h-[140px] rounded-xl bg-surface-100 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                ) : id ? (
                    <>
                        {imageUrl ? (
                            <div
                                className="relative rounded-xl overflow-hidden border border-surface-200 mb-3"
                                style={{ width: TRACK_WIDTH, maxWidth: '100%' }}
                            >
                                <img
                                    src={imageUrl}
                                    alt="验证缺口"
                                    width={TRACK_WIDTH}
                                    height={IMAGE_HEIGHT}
                                    className="block w-full h-auto pointer-events-none"
                                />
                                {/* 与下滑块同步的虚影，方便用户对照缺口对齐 */}
                                <div
                                    className="absolute top-0 bottom-0 rounded-lg border-2 border-primary-400/80 bg-primary-500/25 pointer-events-none transition-[left] duration-0"
                                    style={{
                                        left: position,
                                        width: THUMB_SIZE,
                                        boxShadow: '0 0 0 1px rgba(14, 165, 233, 0.3)',
                                    }}
                                    aria-hidden
                                />
                            </div>
                        ) : null}
                        <div
                            ref={trackRef}
                            className="relative w-full h-11 rounded-xl bg-surface-100 border border-surface-200 select-none"
                            style={{ maxWidth: TRACK_WIDTH, touchAction: 'none' }}
                        >
                            <div
                                className="absolute inset-y-1 left-1 rounded-lg bg-primary-500 flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing transition-none"
                                style={{
                                    left: position,
                                    width: THUMB_SIZE,
                                    height: 36,
                                    touchAction: 'none',
                                }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerReset}
                                onPointerCancel={handlePointerReset}
                            >
                                {verifying ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <ChevronRight className="w-5 h-5" />
                                )}
                            </div>
                        </div>
                    </>
                ) : null}
            </div>
        </Dialog>
    );
}
