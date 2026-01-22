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

export default function SliderCaptcha({ visible, onHide, onSuccess }: SliderCaptchaProps) {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [id, setId] = useState<string | null>(null);
    const [backgroundImage, setBackgroundImage] = useState<string>('');
    const [position, setPosition] = useState(0);
    const [dragging, setDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, base: 0 });

    const loadChallenge = useCallback(async () => {
        setLoading(true);
        setId(null);
        setPosition(0);
        try {
            const data = await captchaService.create();
            setId(data.id);
            setBackgroundImage(data.backgroundImage || '/coachlink.jpg');
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
        const rect = trackRef.current.getBoundingClientRect();
        const delta = e.clientX - rect.left - dragStartRef.current.x;
        let next = dragStartRef.current.base + delta;
        next = Math.max(0, Math.min(TRACK_WIDTH - THUMB_SIZE, next));
        setPosition(next);
    };

    const handlePointerUp = async () => {
        setDragging(false);
        if (!id || verifying) return;
        const thumbRight = position + THUMB_SIZE;
        if (thumbRight < 250) {
            setPosition(0);
            showToast({ severity: 'warn', summary: '请滑动到最右侧完成验证' });
            return;
        }
        setVerifying(true);
        try {
            const token = await captchaService.verify(id, thumbRight);
            onSuccess(token);
            onHide();
        } catch (e: any) {
            setPosition(0);
            showToast({ severity: 'error', summary: '验证失败', detail: e?.message });
            loadChallenge();
        } finally {
            setVerifying(false);
        }
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
                <p className="text-sm text-surface-500 mb-4">请滑动到最右侧完成验证</p>

                {loading ? (
                    <div className="h-[140px] rounded-xl bg-surface-100 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                ) : id ? (
                    <>
                        <div
                            ref={trackRef}
                            className="relative w-full h-11 rounded-xl bg-surface-100 border border-surface-200 select-none"
                            style={{ maxWidth: TRACK_WIDTH }}
                        >
                            <div
                                className="absolute inset-y-1 left-1 rounded-lg bg-primary-500 flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing transition-none"
                                style={{
                                    left: position,
                                    width: THUMB_SIZE,
                                    height: 36,
                                }}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerLeave={handlePointerUp}
                                onPointerCancel={handlePointerUp}
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
