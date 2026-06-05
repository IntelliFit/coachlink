'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { RadioButton } from 'primereact/radiobutton';
import { Calendar } from 'primereact/calendar';
import { addLocale } from 'primereact/api';
import { FileUpload, FileUploadHandlerEvent } from 'primereact/fileupload';
import { Image } from 'primereact/image';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types';
import WeixinzhifuIcon from '../icons/weixinzhifu';
import ZhifubaoIcon from '../icons/zhifubao';
import { AeroInputNumber } from '../AeroInputNumber';
import PaymentSkeleton from './PaymentSkeleton';
import TermDialog from './TermDialog';
import { yuanToFen } from '@/lib/moneyUtils';

// 中文语言包配置
addLocale('zh-CN', {
    firstDayOfWeek: 1,
    dayNames: ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'],
    dayNamesShort: ['周日', '周一', '周二', '周三', '周四', '周五', '周六'],
    dayNamesMin: ['日', '一', '二', '三', '四', '五', '六'],
    monthNames: ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月'],
    monthNamesShort: ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'],
    today: '今天',
    clear: '清除'
});

interface QrCodeItem {
    type: 'wechat' | 'alipay';
    name: string;
    url: string;
}

interface PaymentInfo {
    effectivePaymentMode: 'qrcode' | 'alipay_api' | 'both';
    allowPersonalQrcode: boolean;
    qrCodes: QrCodeItem[];
}

// 线下支付数据接口
export interface OfflinePaymentData {
    payment_type: 'offline';
    expires_at: string;      // ISO 日期字符串
    amount?: number;
    amount_unit?: 'fen';
    receipt_url?: string;    // 凭证图片 URL
    note?: string;
}

interface PaymentDialogProps {
    visible: boolean;
    onHide: () => void;
    coachId: string;
    /** Business order id for subscription purchase / renewal. Preferred over raw subscriptionId. */
    subscriptionOrderId?: string;
    /** Target subscription id to bind platform payment orders to (new subscribe or renew). */
    subscriptionId?: string;
    /**
     * When using platform Alipay, tells backend which subscription flow this payment is for.
     * - subscribe: create/activate subscription after payment success
     * - renew: extend existing subscription after payment success
     */
    subscriptionFlow?: 'subscribe' | 'renew';
    /** Used for renew flow (weeks to extend). */
    renewAdditionalWeeks?: number;
    amount?: number;
    /** Default payment method to select when dialog opens */
    defaultPaymentMethod?: 'qrcode' | 'alipay_api' | 'offline';
    /** Whether offline payment should be available in this dialog */
    allowOfflinePayment?: boolean;
    /** Whether legacy personal QR-code payment should be available in this dialog */
    allowPersonalQrcode?: boolean;
    onSuccess?: (note?: string, offlinePaymentData?: OfflinePaymentData) => void;
    onCancel?: () => void;
}

type PaymentMethodType = 'qrcode' | 'alipay_api' | 'offline';

const PaymentDialog: React.FC<PaymentDialogProps> = ({
    visible,
    onHide,
    coachId,
    subscriptionOrderId,
    subscriptionId,
    subscriptionFlow = 'subscribe',
    renewAdditionalWeeks,
    amount,
    defaultPaymentMethod,
    allowOfflinePayment = true,
    allowPersonalQrcode = false,
    onSuccess,
    onCancel
}) => {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [coach, setCoach] = useState<CoachesRow | null>(null);
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const [paymentNote, setPaymentNote] = useState('');
    const [showTermsDialog, setShowTermsDialog] = useState(false);
    const [selectedQrCode, setSelectedQrCode] = useState<QrCodeItem | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('qrcode');
    const [processingAlipay, setProcessingAlipay] = useState(false);

    // 线下支付相关状态
    const [offlineExpiresAt, setOfflineExpiresAt] = useState<Date | null>(null);
    const [offlineAmount, setOfflineAmount] = useState<number | null>(null);
    const [offlineReceiptUrl, setOfflineReceiptUrl] = useState<string>('');
    const [offlineNote, setOfflineNote] = useState('');
    const [uploadingReceipt, setUploadingReceipt] = useState(false);
    const fileUploadRef = useRef<FileUpload>(null);

    // 扫码支付凭证状态
    const [qrcodeReceiptUrl, setQrcodeReceiptUrl] = useState<string>('');
    const [uploadingQrcodeReceipt, setUploadingQrcodeReceipt] = useState(false);
    const qrcodeFileUploadRef = useRef<FileUpload>(null);
    const offlineAllowed = allowOfflinePayment !== false;
    const personalQrAllowed = allowPersonalQrcode === true;

    const getAvailablePaymentMethods = (info?: PaymentInfo | null): PaymentMethodType[] => {
        const methods: PaymentMethodType[] = [];
        const mode = info?.effectivePaymentMode || 'alipay_api';
        const hasQr = personalQrAllowed && info?.allowPersonalQrcode !== false && Boolean(info?.qrCodes?.length);

        if (hasQr) {
            methods.push('qrcode');
        }

        if (mode === 'alipay_api' || mode === 'both') {
            methods.push('alipay_api');
        }

        if (offlineAllowed) {
            methods.push('offline');
        }

        if (methods.length > 0) {
            return methods;
        }

        return offlineAllowed ? ['offline'] : ['alipay_api'];
    };

    const normalizePaymentMethod = (
        preferredMethod?: PaymentMethodType,
        info?: PaymentInfo | null,
    ): PaymentMethodType => {
        const available = getAvailablePaymentMethods(info);
        if (preferredMethod && available.includes(preferredMethod)) {
            return preferredMethod;
        }
        return available[0];
    };

    const loadCoach = async () => {
        const res = await coachService.getCoach({
            id: coachId,
            needQrCode: true,
            needPaymentInfo: true
        });

        if (res) {
            setCoach(res.coach);
            setPaymentInfo(res.paymentInfo || null);

            const normalizedMethod = normalizePaymentMethod(
                defaultPaymentMethod,
                res.paymentInfo || null,
            );
            setSelectedPaymentMethod(normalizedMethod);
            if (personalQrAllowed && normalizedMethod === 'qrcode' && res.paymentInfo?.qrCodes?.length > 0) {
                setSelectedQrCode(res.paymentInfo.qrCodes[0]);
            }
        }

        setLoading(false);
    };

    useEffect(() => {
        if (visible && coachId) {
            setLoading(true);
            setSelectedQrCode(null);
            // 初始先做一次默认方法兜底（最终会在 loadCoach 后按可用方式校正）
            setSelectedPaymentMethod(normalizePaymentMethod(defaultPaymentMethod));
            loadCoach();
        } else if (!visible) {
            setCoach(null);
            setPaymentInfo(null);
            setPaymentNote('');
            // 重置线下支付状态
            setOfflineExpiresAt(null);
            setOfflineAmount(null);
            setOfflineReceiptUrl('');
            setOfflineNote('');
            // 重置扫码支付凭证状态
            setQrcodeReceiptUrl('');
        }
    }, [visible, coachId, defaultPaymentMethod, allowOfflinePayment, allowPersonalQrcode]);

    useEffect(() => {
        const normalizedMethod = normalizePaymentMethod(selectedPaymentMethod, paymentInfo);
        if (normalizedMethod !== selectedPaymentMethod) {
            setSelectedPaymentMethod(normalizedMethod);
            if (normalizedMethod === 'qrcode' && paymentInfo?.qrCodes?.length) {
                setSelectedQrCode((prev) => prev || paymentInfo.qrCodes[0]);
            }
        }
    }, [selectedPaymentMethod, paymentInfo, allowOfflinePayment, allowPersonalQrcode]);

    // 上传支付凭证
    const handleReceiptUpload = async (event: FileUploadHandlerEvent) => {
        const file = event.files[0];
        if (!file) return;

        setUploadingReceipt(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload/payment-receipt', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success && data.data?.url) {
                setOfflineReceiptUrl(data.data.url);
                showToast({ severity: 'success', summary: '上传成功', detail: '凭证已上传' });
            } else {
                showToast({ severity: 'error', summary: '上传失败', detail: data.message || '请重试' });
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast({ severity: 'error', summary: '上传失败', detail: '网络错误，请重试' });
        } finally {
            setUploadingReceipt(false);
            fileUploadRef.current?.clear();
        }
    };

    // 上传扫码支付凭证
    const handleQrcodeReceiptUpload = async (event: FileUploadHandlerEvent) => {
        const file = event.files[0];
        if (!file) return;

        setUploadingQrcodeReceipt(true);
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload/payment-receipt', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (data.success && data.data?.url) {
                setQrcodeReceiptUrl(data.data.url);
                showToast({ severity: 'success', summary: '上传成功', detail: '付款凭证已上传' });
            } else {
                showToast({ severity: 'error', summary: '上传失败', detail: data.message || '请重试' });
            }
        } catch (error) {
            console.error('Upload error:', error);
            showToast({ severity: 'error', summary: '上传失败', detail: '网络错误，请重试' });
        } finally {
            setUploadingQrcodeReceipt(false);
            qrcodeFileUploadRef.current?.clear();
        }
    };

    // 提交线下支付
    const handleOfflinePaymentSubmit = () => {
        if (!offlineAllowed) {
            showToast({ severity: 'warn', summary: '该教练不支持线下已付', detail: '请使用线上支付方式完成支付' });
            return;
        }
        if (!offlineExpiresAt) {
            showToast({ severity: 'warn', summary: '请填写到期日期', detail: '到期日期为必填项' });
            return;
        }
        if (!offlineReceiptUrl) {
            showToast({ severity: 'warn', summary: '请上传支付凭证', detail: '支付凭证为必填项' });
            return;
        }

        const offlinePaymentData: OfflinePaymentData = {
            payment_type: 'offline',
            expires_at: offlineExpiresAt.toISOString(),
            amount: offlineAmount !== null ? yuanToFen(offlineAmount) : undefined,
            amount_unit: 'fen',
            receipt_url: offlineReceiptUrl,
            note: offlineNote || undefined,
        };

        showToast({ severity: 'success', summary: '已提交', detail: '请等待教练确认' });
        onSuccess?.(offlineNote, offlinePaymentData);
        onHide();
    };

    const handleQrCodePaymentConfirmation = () => {
        setShowTermsDialog(true);
    };

    const handleTermsAccept = () => {
        // 勾选同意条款的 gating 在 TermDialog 内部完成；这里直接执行确认逻辑。
        setShowTermsDialog(false);
        showToast({ severity: 'success', summary: '请等待教练确认收款', detail: '支付后请联系教练，系统会通知教练确认收款' });
        // 传递扫码支付凭证信息（如果有）
        const noteWithReceipt = qrcodeReceiptUrl
            ? `${paymentNote ? paymentNote + '\n' : ''}付款凭证: ${qrcodeReceiptUrl}`
            : paymentNote;
        onSuccess?.(noteWithReceipt);
        onHide();
    };

    const handleTermsReject = () => {
        setShowTermsDialog(false);
    };

    // 检测是否移动端
    const isMobile = () => {
        if (typeof window === 'undefined') return false;
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    };

    // 处理平台支付宝支付
    const handleAlipayPayment = async () => {
        if (!amount) {
            showToast({ severity: 'error', summary: '错误', detail: '缺少支付金额' });
            return;
        }
        if (!subscriptionOrderId && !subscriptionId) {
            showToast({ severity: 'error', summary: '错误', detail: '缺少订阅订单，无法创建平台支付订单' });
            return;
        }

        setProcessingAlipay(true);
        const mobile = isMobile();
        const redirect =
            typeof window !== 'undefined'
                ? `${window.location.pathname}${window.location.search || ''}`
                : '';

        try {
            const res = await fetch('/api/payment/alipay/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: `订阅教练 ${coach?.name || ''}`,
                    totalAmount: amount,
                    orderType: subscriptionFlow === 'renew' ? 'subscription_renew' : 'subscription',
                    orderData: {
                        coachId,
                        subscriptionOrderId,
                        subscriptionId,
                        note: paymentNote,
                        redirect,
                        renewAdditionalWeeks: subscriptionFlow === 'renew' ? (renewAdditionalWeeks || 0) : undefined
                    },
                    isMobile: mobile
                })
            });

            const data = await res.json();

            if (data.success && data.data?.paymentInfo?.formHtml) {
                const createdOrderId: string | undefined = data.data?.order?.id;
                if (mobile) {
                    document.open();
                    document.write(data.data.paymentInfo.formHtml);
                    document.close();
                } else {
                    const newWindow = window.open('', '_blank');
                    if (newWindow) {
                        newWindow.document.write(data.data.paymentInfo.formHtml);
                        newWindow.document.close();
                    }
                    showToast({ severity: 'info', summary: '正在跳转', detail: '请在新窗口完成支付；本页将展示支付结果' });
                    onHide();
                    // Redirect current tab to payment status page for reliable polling/auto-confirm
                    if (createdOrderId) {
                        window.location.assign(`/payment/${createdOrderId}`);
                    }
                }
            } else {
                showToast({ severity: 'error', summary: '错误', detail: data.message || '创建支付订单失败' });
            }
        } catch (error) {
            console.error('支付宝支付失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '支付请求失败' });
        } finally {
            setProcessingAlipay(false);
        }
    };

    const hasQrCodes = personalQrAllowed && paymentInfo?.allowPersonalQrcode !== false && paymentInfo?.qrCodes && paymentInfo.qrCodes.length > 0;
    const effectiveMode = paymentInfo?.effectivePaymentMode || 'alipay_api';

    const getFooterContent = () => {
        if (selectedPaymentMethod === 'alipay_api') {
            return (
                <div className="flex justify-end gap-2">
                    <Button
                        label="取消"
                        icon="pi pi-times"
                        onClick={() => {
                            onCancel?.();
                            onHide();
                        }}
                        className="p-button-text rounded-2xl"
                        disabled={loading || processingAlipay}
                    />
                    <Button
                        label="立即支付"
                        icon="pi pi-credit-card"
                        onClick={handleAlipayPayment}
                        disabled={!amount || processingAlipay}
                        loading={processingAlipay}
                        autoFocus
                        className="p-button-primary rounded-2xl"
                    />
                </div>
            );
        }

        if (selectedPaymentMethod === 'offline') {
            return (
                <div className="flex justify-end gap-2">
                    <Button
                        label="取消"
                        icon="pi pi-times"
                        onClick={() => {
                            onCancel?.();
                            onHide();
                        }}
                        className="p-button-text"
                        disabled={uploadingReceipt}
                    />
                    <Button
                        label="提交待确认"
                        icon="pi pi-check"
                        onClick={handleOfflinePaymentSubmit}
                        disabled={!offlineExpiresAt || !offlineReceiptUrl || uploadingReceipt}
                        loading={uploadingReceipt}
                        autoFocus
                        className="p-button-primary"
                    />
                </div>
            );
        }

        return (
            <div className="flex justify-end gap-2 pt-2">
                <Button
                    label="取消"
                    icon="pi pi-times"
                    onClick={() => {
                        onCancel?.();
                        onHide();
                    }}
                    className="p-button-text rounded-2xl"
                    disabled={loading}
                />
                <Button
                    label='我已支付'
                    icon="pi pi-check"
                    onClick={handleQrCodePaymentConfirmation}
                    disabled={!hasQrCodes || !selectedQrCode || !qrcodeReceiptUrl}
                    autoFocus
                    className="p-button-primary rounded-2xl"
                />
            </div>
        );
    };

    // 渲染支付方式选择（总是显示，包含线下支付选项）
    const renderPaymentMethodSelection = () => {
        const methods: Array<{
            id: PaymentMethodType;
            label: string;
            icon: string | ((isActive: boolean) => React.ReactNode);
            visible: boolean;
            activeClass: string;
            iconClass: string;
        }> = [
            {
                id: 'qrcode',
                label: '扫码支付',
                icon: (isActive: boolean) => <i className={`pi pi-qrcode ${isActive ? 'text-surface' : ''}`} />,
                visible: hasQrCodes,
                activeClass: 'bg-orange-50 border-orange-200 text-orange-600',
                iconClass: 'bg-orange-500'
            },
            {
                id: 'alipay_api',
                label: '支付宝',
                // 替换为 ZhifubaoIcon
                icon: (isActive: boolean) => <ZhifubaoIcon width="18" height="18" fill={isActive ? "#FFFFFF" : "#64748b"} />,
                visible: effectiveMode === 'alipay_api' || effectiveMode === 'both',
                activeClass: 'bg-blue-500 border-blue-600 text-white', // 调整激活样式以适应支付宝蓝
                iconClass: 'bg-blue-500'
            },
            {
                id: 'offline',
                label: '线下已付',
                icon: 'pi pi-wallet',
                visible: offlineAllowed,
                activeClass: 'bg-surface-900 border-surface-900 text-surface',
                iconClass: 'bg-surface-600'
            }
        ];
        const visibleMethods = methods.filter((m) => m.visible);
        const gridColsClass =
            visibleMethods.length >= 3
                ? 'grid-cols-3'
                : visibleMethods.length === 2
                    ? 'grid-cols-2'
                    : 'grid-cols-1';

        return (
            <div className="w-full mb-6">
                <div className="flex items-center gap-2 mb-3 px-1">
                    <span className="text-[10px] font-black text-surface-400 uppercase tracking-[0.2em]">
                        结算方式
                    </span>
                </div>

                <div className={`grid ${gridColsClass} gap-3`}>
                    {visibleMethods.map((method) => {
                        const isActive = selectedPaymentMethod === method.id;
                        return (
                            <div
                                key={method.id}
                                onClick={() => setSelectedPaymentMethod(method.id)}
                                className={`
                                cursor-pointer relative overflow-hidden transition-all duration-300
                                p-3 rounded-[16px] border flex flex-col items-center gap-2 active:scale-95
                                ${isActive
                                        ? `${method.activeClass} shadow-sm`
                                        : 'border-surface-100 bg-surface-50/50 hover:bg-surface hover:border-surface-200'
                                    }
                            `}
                            >
                                {/* 选中状态的小勾选标记 */}
                                {isActive && (
                                    <div className="absolute top-2 right-2">
                                        <i className="pi pi-check-circle text-[10px]" />
                                    </div>
                                )}

                                {/* 图标容器 */}
                                <div className={`
                                    w-8 h-8 rounded-xl flex items-center justify-center transition-transform duration-500
                                    ${isActive ? 'scale-110 ' + method.iconClass : 'bg-surface-200'}
                                `}>
                                    {typeof method.icon === 'function' ? method.icon(isActive) : <i className={`${method.icon} text-sm`} />}
                                </div>

                                <span className="text-[10px] font-black tracking-tight leading-none uppercase">
                                    {method.label}
                                </span>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // 渲染二维码支付界面
    const renderQrCodePayment = () => {
        if (!hasQrCodes) {
            return (
                <div className="text-center text-surface-500 py-8">
                    <i className="pi pi-exclamation-circle text-4xl mb-3"></i>
                    <p>该教练暂未设置收款码</p>
                </div>
            );
        }

        if (paymentInfo!.qrCodes.length === 1) {
            const qr = paymentInfo!.qrCodes[0];
            return (
                <div className="flex flex-col items-center">
                    <img
                        src={qr.url}
                        alt={qr.name}
                        className="max-w-[280px] h-auto object-contain mb-4 border rounded-lg shadow-sm"
                    />
                    <div className="text-center mb-4">
                        <div className="font-bold text-lg text-surface-900">{coach?.name} - {qr.name}</div>
                        {amount && <div className="text-primary font-bold mt-2 text-xl">支付金额：¥{amount.toFixed(2)}</div>}
                    </div>

                    {/* 付款凭证上传区域 */}
                    <div className="w-full max-w-[280px] p-4 bg-surface-50 rounded-lg border border-surface-200">
                        <div className="text-sm font-medium text-surface-700 mb-2">
                            <i className="pi pi-camera mr-2" />
                            上传付款凭证
                        </div>

                        {qrcodeReceiptUrl ? (
                            <div className="flex flex-col items-center gap-2">
                                <Image
                                    src={qrcodeReceiptUrl}
                                    alt="付款凭证"
                                    width="120"
                                    preview
                                    className="rounded border"
                                />
                                <Button
                                    label="重新上传"
                                    icon="pi pi-refresh"
                                    size="small"
                                    outlined
                                    onClick={() => setQrcodeReceiptUrl('')}
                                />
                            </div>
                        ) : (
                            <FileUpload
                                ref={qrcodeFileUploadRef}
                                mode="basic"
                                accept="image/*"
                                maxFileSize={5000000}
                                customUpload
                                uploadHandler={handleQrcodeReceiptUpload}
                                auto
                                chooseLabel={uploadingQrcodeReceipt ? "上传中..." : "选择图片"}
                                disabled={uploadingQrcodeReceipt}
                                className="w-full"
                            />
                        )}
                        <div className="text-xs text-surface-400 mt-2 text-center">
                            支持 JPG/PNG，≤5MB
                        </div>
                    </div>
                </div>
            );
        }

        // 多个收款码
        return (
            <div className="w-full">
                <div className="text-center mb-4">
                    <div className="font-bold text-lg text-surface-900">{coach?.name}</div>
                    {amount && <div className="text-primary font-bold mt-2 text-xl">支付金额：¥{amount.toFixed(2)}</div>}
                </div>

                <div className="text-sm text-surface-600 mb-3 text-center">请选择支付方式：</div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                    {paymentInfo!.qrCodes.map((qr) => (
                        <div
                            key={qr.type}
                            className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${selectedQrCode?.type === qr.type
                                ? 'border-primary bg-primary-50'
                                : 'border-surface-200 hover:border-surface-300'
                                }`}
                            onClick={() => setSelectedQrCode(qr)}
                        >
                            <div className="flex items-center gap-2 mb-2">
                                <RadioButton
                                    inputId={qr.type}
                                    value={qr.type}
                                    checked={selectedQrCode?.type === qr.type}
                                    onChange={() => setSelectedQrCode(qr)}
                                />
                                {/* 插入品牌图标 */}
                                {qr.type === 'wechat' ? (
                                    <WeixinzhifuIcon width="16" height="16" />
                                ) : (
                                    <ZhifubaoIcon width="16" height="16" fill="#1677FF" />
                                )}
                                <label htmlFor={qr.type} className="font-medium cursor-pointer text-sm">
                                    {qr.type === 'wechat' ? '微信支付' : '支付宝'}
                                </label>
                            </div>
                        </div>
                    ))}
                </div>

                {selectedQrCode && (
                    <div className="flex justify-center">
                        <img
                            src={selectedQrCode.url}
                            alt={selectedQrCode.name}
                            className="max-w-[240px] h-auto object-contain border rounded-lg shadow-sm"
                        />
                    </div>
                )}

                {/* 付款凭证上传区域 */}
                {selectedQrCode && (
                    <div className="mt-4 p-4 bg-surface-50 rounded-lg border border-surface-200">
                        <div className="text-sm font-medium text-surface-700 mb-2">
                            <i className="pi pi-camera mr-2" />
                            上传付款凭证
                        </div>

                        {qrcodeReceiptUrl ? (
                            <div className="flex flex-col items-center gap-2">
                                <Image
                                    src={qrcodeReceiptUrl}
                                    alt="付款凭证"
                                    width="120"
                                    preview
                                    className="rounded border"
                                />
                                <Button
                                    label="重新上传"
                                    icon="pi pi-refresh"
                                    size="small"
                                    outlined
                                    onClick={() => setQrcodeReceiptUrl('')}
                                />
                            </div>
                        ) : (
                            <FileUpload
                                ref={qrcodeFileUploadRef}
                                mode="basic"
                                accept="image/*"
                                maxFileSize={5000000}
                                customUpload
                                uploadHandler={handleQrcodeReceiptUpload}
                                auto
                                chooseLabel={uploadingQrcodeReceipt ? "上传中..." : "选择图片"}
                                disabled={uploadingQrcodeReceipt}
                                className="w-full"
                            />
                        )}
                        <div className="text-xs text-surface-400 mt-2">
                            支持 JPG/PNG，≤5MB
                        </div>
                    </div>
                )}
            </div>
        );
    };

    // 渲染平台支付宝界面
    const renderAlipayApiPayment = () => {
        return (
            <div className="flex flex-col items-center py-4">
                <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-4">
                    {/* 替换原有的 pi-credit-card */}
                    <ZhifubaoIcon width="40" height="40" fill="#1677FF" />
                </div>
                <div className="text-center mb-4">
                    <div className="font-bold text-lg text-surface-900">平台支付宝支付</div>
                    <div className="text-sm text-surface-500 mt-1">点击"立即支付"跳转至支付宝完成支付</div>
                </div>
                {amount && (
                    <div className="text-primary font-bold text-2xl mb-4">
                        ¥{amount.toFixed(2)}
                    </div>
                )}
            </div>
        );
    };

    // 渲染线下支付表单
    const renderOfflinePaymentForm = () => {
        return (
            <div className="w-full space-y-8 animate-in fade-in duration-500">
                {/* 1. 头部状态：采用低饱和功能色 & 视觉呼吸感 */}
                <div className="text-center py-4">
                    <div className="relative inline-block group">
                        {/* 1. 呼引导：规范 4 - 极其微弱的扩散光晕，模拟物理指示灯 */}
                        <div className="absolute -inset-3 bg-green-500/5 rounded-full blur-2xl animate-pulse"></div>

                        {/* 2. 外层容器：对应 activeClass 的逻辑 (Surface 自动化 + 呼吸感边框) */}
                        <div className={`
                            relative w-20 h-20 mx-auto mb-4
                            bg-surface-0 dark:bg-surface-800 
                            rounded-2xl /* 规范 1：统一采用 16px-24px 大圆角 */
                            flex items-center justify-center 
                            border border-surface-200/30
                            shadow-[0_8px_30px_rgb(0,0,0,0.04)]
                            transition-all duration-500
                        `}>
                            {/* 3. 内层图标背景：对应 iconClass 的逻辑 (低饱和功能色 + 非线性嵌套) */}
                            <div className={`
                                w-14 h-14
                                bg-green-50 dark:bg-green-900/20 
                                text-green-600 dark:text-green-400
                                rounded-xl /* 嵌套略小的圆角，模拟硬件精密感 */
                                flex items-center justify-center
                                transition-transform duration-500 group-hover:scale-110
                            `}>
                                {/* 4. 核心符号：规范 3 - 强调色作为视觉火花 */}
                                <i className="pi pi-check-circle text-3xl"></i>
                            </div>

                            {/* 5. 装饰层：规范 1 - 微妙的视觉差，模拟物理表面的微弱高光 */}
                            <div className="absolute inset-0 rounded-2xl border border-white/40 dark:border-white/5 pointer-events-none"></div>
                        </div>
                    </div>
                    {/* 规范 2：紧凑型字间距 tracking-tight */}
                    <h3 className="font-bold text-2xl text-surface-900 tracking-tight">线下已支付</h3>
                    <p className="text-sm text-surface-500 mt-2 tracking-wide opacity-80">
                        请填写支付信息，教练确认后即可生效
                    </p>
                </div>

                {/* 2. 表单主体：移除硬分割，利用间距形成天然布局 */}
                <div className="space-y-6">
                    {/* 订阅有效期：引入数值中心化逻辑 */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-surface-500 ml-1">
                            订阅有效期至 <span className="text-red-400/80">*</span>
                        </label>
                        <Calendar
                            value={offlineExpiresAt}
                            onChange={(e) => setOfflineExpiresAt(e.value)}
                            dateFormat="yy-mm-dd"
                            placeholder="选择日期"
                            locale='zh-CN'
                            minDate={new Date()}
                            pt={{
                                root: { className: 'rounded-2xl border-surface-200/50 hover:border-primary-400 transition-all duration-300' },
                            }}
                            className="w-full aero-input-container"
                        />
                    </div>

                    {/* 支付金额：数值中心化排版 (规范 2) */}
                    <div className="flex flex-col gap-2.5 bg-surface-50/30 p-4 rounded-2xl border border-surface-100/50">
                        <label className="text-xs font-bold uppercase tracking-widest text-surface-500">
                            本次支付金额 (CNY)
                        </label>
                        <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold text-surface-400">¥</span>
                            <AeroInputNumber
                                value={offlineAmount}
                                onValueChange={(e) => setOfflineAmount(e.value ?? null)}
                                minFractionDigits={2}
                                placeholder="0.00"
                                // 规范 2：核心指标加粗并增大字号
                                inputClassName="text-3xl font-black tracking-tight bg-transparent border-none p-0 focus:shadow-none w-full"
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* 支付凭证：模拟物理硬件的顺滑感 (规范 1) */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-surface-500 ml-1">
                            支付凭证 <span className="text-red-400/80">*</span>
                        </label>

                        {offlineReceiptUrl ? (
                            <div className="group relative rounded-2xl overflow-hidden border-2 border-dashed border-surface-200 aspect-video flex items-center justify-center transition-all active:scale-[0.98]">
                                <Image
                                    src={offlineReceiptUrl}
                                    alt="支付凭证"
                                    width="100%"
                                    preview
                                    className="object-cover"
                                />
                                {/* 悬浮删除：符合微交互逻辑 */}
                                <button
                                    className="absolute top-3 right-3 p-2 bg-red-500/80 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
                                    onClick={() => setOfflineReceiptUrl('')}
                                >
                                    <i className="pi pi-trash text-xs"></i>
                                </button>
                            </div>
                        ) : (
                            <FileUpload
                                mode="basic"
                                chooseLabel={uploadingReceipt ? "正在同步..." : "点击上传截图"}
                                className="w-full aero-upload-button"
                                pt={{
                                    chooseButton: {
                                        // 规范 4：物理缩放反馈 active:scale-95
                                        className: 'w-full py-8 rounded-2xl border-2 border-dashed border-surface-200 bg-surface-50 hover:bg-surface-100/50 text-surface-600 transition-all active:scale-[0.98]'
                                    }
                                }}
                                auto
                                customUpload
                                uploadHandler={handleReceiptUpload}
                            />
                        )}
                    </div>

                    {/* 备注说明 */}
                    <div className="flex flex-col gap-2.5">
                        <label className="text-xs font-bold uppercase tracking-widest text-surface-500 ml-1">
                            备注说明
                        </label>
                        <InputText
                            value={offlineNote}
                            onChange={(e) => setOfflineNote(e.target.value)}
                            placeholder="如：微信转账、线下现金等"
                            className="w-full p-3 rounded-2xl border bg-surface-50/50 focus:bg-surface-0 transition-colors"
                        />
                    </div>
                </div>
            </div>
        );
    };

    // 根据支付模式渲染内容
    const renderPaymentContent = () => {
        return (
            <>
                {renderPaymentMethodSelection()}

                {selectedPaymentMethod === 'qrcode' && (
                    <>
                        {renderQrCodePayment()}
                        {hasQrCodes && (
                            <>
                                <InputText
                                    type="text"
                                    className="w-full border rounded px-3 py-2 mb-2 text-sm mt-4"
                                    placeholder="支付备注（选填，例：学员姓名/手机号/用途等）"
                                    value={paymentNote}
                                    onChange={e => setPaymentNote(e.target.value)}
                                />
                                <div className="text-surface-500 text-xs text-center">
                                    请使用{selectedQrCode?.type === 'wechat' ? '微信' : '支付宝'}扫码支付，支付后请联系教练确认收款
                                </div>
                            </>
                        )}
                    </>
                )}

                {selectedPaymentMethod === 'alipay_api' && renderAlipayApiPayment()}

                {selectedPaymentMethod === 'offline' && renderOfflinePaymentForm()}
            </>
        );
    };

    return (
        <>
            <Dialog
                id="guide-payment-options"
                header={
                    selectedPaymentMethod === 'alipay_api' ? '平台支付' :
                        selectedPaymentMethod === 'offline' ? '线下支付确认' : '扫码支付'
                }
                visible={visible}
                onHide={onHide}
                footer={getFooterContent()}
                modal
                draggable={false}
                resizable={false}
                style={{ width: '450px' }}
                pt={{
                    root: {
                        className: 'shadow-none border-none bg-transparent min-h-screen md:min-h-[fit-content]'
                    },
                    header: {
                        className: 'p-8 pb-4 border-none bg-surface md:rounded-t-[24px] rounded-t-none'
                    },
                    content: {
                        className: 'text-xl font-black tracking-tight md:overflow-y-auto md:max-h-[calc(100vh-300px)]'
                    },
                    footer: {
                        className: 'p-8 md:rounded-b-[24px] rounded-b-none'
                    }
                }}
            >
                <div className="p-4 flex flex-col items-center">
                    {loading ? (
                        <PaymentSkeleton />
                    ) : (
                        renderPaymentContent()
                    )}
                </div>
            </Dialog>

            <TermDialog
                showTermsDialog={showTermsDialog}
                onHide={() => setShowTermsDialog(false)}
                onAccept={handleTermsAccept}
                onCancel={handleTermsReject}
            />
        </>
    );
};

export default PaymentDialog;
