/**
 * 休息计时器 Hook
 * 
 * 提供倒计时功能，用于组间休息
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import type { UseRestTimerReturn } from '@/types/training-execution';

export const useRestTimer = (initialSeconds: number): UseRestTimerReturn => {
    const [timeLeft, setTimeLeft] = useState(initialSeconds);
    const [isRunning, setIsRunning] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [isCompleted, setIsCompleted] = useState(false);

    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // 清除定时器
    const clearTimer = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    // 开始计时
    const start = useCallback(() => {
        setTimeLeft(initialSeconds);
        setIsRunning(true);
        setIsPaused(false);
        setIsCompleted(false);
    }, [initialSeconds]);

    // 暂停
    const pause = useCallback(() => {
        setIsRunning(false);
        setIsPaused(true);
        clearTimer();
    }, [clearTimer]);

    // 恢复
    const resume = useCallback(() => {
        if (isPaused && timeLeft > 0) {
            setIsRunning(true);
            setIsPaused(false);
        }
    }, [isPaused, timeLeft]);

    // 重置
    const reset = useCallback(() => {
        clearTimer();
        setTimeLeft(initialSeconds);
        setIsRunning(false);
        setIsPaused(false);
        setIsCompleted(false);
    }, [initialSeconds, clearTimer]);

    // 跳过
    const skip = useCallback(() => {
        clearTimer();
        setTimeLeft(0);
        setIsRunning(false);
        setIsPaused(false);
        setIsCompleted(true);
    }, [clearTimer]);

    // 播放提示音
    const playNotificationSound = useCallback(() => {
        try {
            if (typeof window === 'undefined') return;
            const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
            const audioContext = new AudioContext();

            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.value = 800;
            oscillator.type = 'sine';

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.5);
        } catch (error) {
            console.error('播放提示音失败:', error);
        }
    }, []);

    // 显示通知
    const showNotification = useCallback((message: string) => {
        if (typeof window === 'undefined') return;
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('训练提醒', {
                body: message,
                icon: '/favicon.svg',
                badge: '/favicon.svg',
                tag: 'rest-timer'
            });
        }

        if ('vibrate' in navigator) {
            navigator.vibrate([200, 100, 200]);
        }
    }, []);

    // 主要的倒计时逻辑
    useEffect(() => {
        if (isRunning && !isPaused) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearTimer();
                        setIsRunning(false);
                        setIsCompleted(true);

                        playNotificationSound();
                        showNotification('休息结束，开始下一组！');

                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);

            return () => clearTimer();
        }
    }, [isRunning, isPaused, clearTimer, playNotificationSound, showNotification]);

    // 组件卸载时清理
    useEffect(() => {
        return () => clearTimer();
    }, [clearTimer]);

    return {
        timeLeft,
        isRunning,
        isPaused,
        isCompleted,
        start,
        pause,
        resume,
        reset,
        skip
    };
};

// 请求通知权限的辅助函数
export const requestNotificationPermission = async (): Promise<boolean> => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }

    return false;
};

