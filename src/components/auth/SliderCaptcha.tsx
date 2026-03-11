'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog } from 'primereact/dialog';
import { useToastContext } from '@/context/ToastContext';
import { captchaService } from '@/app/service/captchaService';
import { Loader2, ChevronRight, ChevronsRight } from 'lucide-react';

interface SliderCaptchaProps {
    visible: boolean;
    onHide: () => void;
    onSuccess: (token: string) => void;
}

const TRACK_WIDTH = 280;
const THUMB_SIZE = 40;
/** 滑块距右端多少像素以内算"到底" */
const REACH_END_THRESHOLD = 8;

export default function SliderCaptcha({ visible, onHide, onSuccess }: SliderCaptchaProps) {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [verifying, setVerifying] = useState(false);
    const [id, setId] = useState<string | null>(null);
    const [position, setPosition] = useState(0);
    const [dragging, setDragging] = useState(false);
    const trackRef = useRef<HTMLDivElement>(null);
    const dragStartRef = useRef({ x: 0, base: 0 });
    const verifyInFlightRef = useRef(false);

    const MAX_POSITION = TRACK_WIDTH - THUMB_SIZE;

    const loadChallenge = useCallback(async () => {
        verifyInFlightRef.current = false;
        setLoading(true);
        setId(null);
        setPosition(0);
        setVerifying(false);
        try {
            const data = await captchaService.create();
            setId(data.id);
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

    const doVerify = useCallback(async (currentId: string, currentPosition: number) => {
        if (verifyInFlightRef.current) return;
        verifyInFlightRef.current = true;
        setVerifying(true);
        try {
            const token = await captchaService.verify(currentId, currentPosition);
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
    }, [onSuccess, onHide, showToast, loadChallenge]);

    const handlePointerDown = (e: React.PointerEvent) => {
        if (!id || verifying) return;
        e.preventDefault();
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
        e.preventDefault();
        const rect = trackRef.current.getBoundingClientRect();
        const delta = e.clientX - rect.left - dragStartRef.current.x;
        let next = dragStartRef.current.base + delta;
        next = Math.max(0, Math.min(MAX_POSITION, next));
        setPosition(next);
        // 滑到底自动触发验证
        if (id && next >= MAX_POSITION - REACH_END_THRESHOLD) {
            setDragging(false);
            doVerify(id, next);
        }
    };

    const handlePointerUp = (e: React.PointerEvent) => {
        e.preventDefault();
        if (!dragging) return;
        setDragging(false);
        // 松手时若已到底也触发（兜底）
        if (id && position >= MAX_POSITION - REACH_END_THRESHOLD) {
            doVerify(id, position);
        } else {
            // 没到底，弹回
            setPosition(0);
        }
    };

    const handlePointerReset = () => {
        setDragging(false);
        setPosition(0);
    };

    const reachedEnd = position >= MAX_POSITION - REACH_END_THRESHOLD;

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
                <p className="text-sm text-surface-500 mb-4">向右滑动滑块到底完成验证</p>

                {loading ? (
                    <div className="h-[60px] rounded-xl bg-surface-100 flex items-center justify-center">
                        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                    </div>
                ) : id ? (
                    <div
                        ref={trackRef}
                        className="relative w-full h-12 rounded-xl bg-surface-100 border border-surface-200 select-none overflow-hidden"
                        style={{ maxWidth: TRACK_WIDTH, touchAction: 'none' }}
                    >
                        {/* 已滑过的进度条 */}
                        <div
                            className="absolute inset-y-0 left-0 bg-primary-100 transition-none pointer-events-none"
                            style={{ width: position + THUMB_SIZE }}
                        />
                        {/* 提示文字 */}
                        {!dragging && position === 0 && (
                            <div className="absolute inset-0 flex items-center justify-center text-xs text-surface-400 pointer-events-none select-none">
                                向右滑动 →
                            </div>
                        )}
                        {/* 滑块 */}
                        <div
                            className={`absolute top-1 rounded-lg flex items-center justify-center text-white shadow-md cursor-grab active:cursor-grabbing transition-colors ${reachedEnd ? 'bg-green-500' : 'bg-primary-500'}`}
                            style={{
                                left: position,
                                width: THUMB_SIZE,
                                height: 40,
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
                            ) : reachedEnd ? (
                                <ChevronsRight className="w-5 h-5" />
                            ) : (
                                <ChevronRight className="w-5 h-5" />
                            )}
                        </div>
                    </div>
                ) : null}
            </div>
        </Dialog>
    );
}
