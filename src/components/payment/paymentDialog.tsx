'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { RadioButton } from 'primereact/radiobutton';
import { ProgressSpinner } from 'primereact/progressspinner';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types';

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

interface PaymentDialogProps {
    visible: boolean;
    onHide: () => void;
    coachId: string;
    amount?: number;
    onSuccess?: (note?: string) => void;
    onCancel?: () => void;
}

type PaymentMethodType = 'qrcode' | 'alipay_api';

const PaymentDialog: React.FC<PaymentDialogProps> = ({
    visible,
    onHide,
    coachId,
    amount,
    onSuccess,
    onCancel
}) => {
    const { showToast } = useToastContext();
    const [loading, setLoading] = useState(false);
    const [coach, setCoach] = useState<CoachesRow | null>(null);
    const [paymentInfo, setPaymentInfo] = useState<PaymentInfo | null>(null);
    const [paymentNote, setPaymentNote] = useState('');
    const [showTermsDialog, setShowTermsDialog] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);
    const [selectedQrCode, setSelectedQrCode] = useState<QrCodeItem | null>(null);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType>('qrcode');
    const [processingAlipay, setProcessingAlipay] = useState(false);

    const loadCoach = async () => {
        const res = await coachService.getCoach({
            id: coachId,
            needQrCode: true,
            needPaymentInfo: true
        });

        if (res) {
            setCoach(res.coach);
            setPaymentInfo(res.paymentInfo || null);
            
            // 根据支付模式设置默认选项
            const mode = res.paymentInfo?.effectivePaymentMode || 'qrcode';
            if (mode === 'alipay_api') {
                setSelectedPaymentMethod('alipay_api');
            } else if (mode === 'qrcode') {
                setSelectedPaymentMethod('qrcode');
                if (res.paymentInfo?.qrCodes?.length > 0) {
                    setSelectedQrCode(res.paymentInfo.qrCodes[0]);
                }
            } else if (mode === 'both') {
                // both 模式下默认选择二维码（如果有的话）
                if (res.paymentInfo?.qrCodes?.length > 0) {
                    setSelectedPaymentMethod('qrcode');
                    setSelectedQrCode(res.paymentInfo.qrCodes[0]);
                } else {
                    setSelectedPaymentMethod('alipay_api');
                }
            }
        }

        setLoading(false);
    };

    useEffect(() => {
        if (visible && coachId) {
            setLoading(true);
            setSelectedQrCode(null);
            setSelectedPaymentMethod('qrcode');
            loadCoach();
        } else if (!visible) {
            setCoach(null);
            setPaymentInfo(null);
            setPaymentNote('');
            setAgreedToTerms(false);
        }
    }, [visible, coachId]);

    const handleQrCodePaymentConfirmation = () => {
        setShowTermsDialog(true);
    };

    const handleTermsAccept = () => {
        if (agreedToTerms) {
            setShowTermsDialog(false);
            showToast({ severity: 'success', summary: '请等待教练确认收款', detail: '支付后请联系教练，系统会通知教练确认收款' });
            onSuccess?.(paymentNote);
            onHide();
        }
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

        setProcessingAlipay(true);
        const mobile = isMobile();
        
        try {
            const res = await fetch('/api/payment/alipay/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    subject: `订阅教练 ${coach?.name || ''}`,
                    totalAmount: amount,
                    orderType: 'subscription',
                    orderData: {
                        coachId,
                        note: paymentNote
                    },
                    isMobile: mobile
                })
            });

            const data = await res.json();

            if (data.success && data.data?.paymentInfo?.formHtml) {
                if (mobile) {
                    // 移动端：直接在当前页面跳转（会唤起支付宝APP）
                    document.open();
                    document.write(data.data.paymentInfo.formHtml);
                    document.close();
                } else {
                    // PC端：新窗口打开
                    const newWindow = window.open('', '_blank');
                    if (newWindow) {
                        newWindow.document.write(data.data.paymentInfo.formHtml);
                        newWindow.document.close();
                    }
                    showToast({ severity: 'info', summary: '正在跳转', detail: '请在新窗口完成支付' });
                    onSuccess?.(paymentNote);
                    onHide();
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

    const hasQrCodes = paymentInfo?.qrCodes && paymentInfo.qrCodes.length > 0;
    const effectiveMode = paymentInfo?.effectivePaymentMode || 'qrcode';

    const termsFooterContent = (
        <div className="flex justify-end gap-2">
            <Button
                label="取消"
                icon="pi pi-times"
                onClick={handleTermsReject}
                className="p-button-text"
            />
            <Button
                label="我已知晓"
                icon="pi pi-check"
                onClick={handleTermsAccept}
                disabled={!agreedToTerms}
                className="p-button-primary"
            />
        </div>
    );

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
                        className="p-button-text"
                        disabled={loading || processingAlipay}
                    />
                    <Button
                        label="立即支付"
                        icon="pi pi-credit-card"
                        onClick={handleAlipayPayment}
                        disabled={!amount || processingAlipay}
                        loading={processingAlipay}
                        autoFocus
                        className="p-button-primary"
                    />
                </div>
            );
        }

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
                    disabled={loading}
                />
                <Button
                    label='我已支付'
                    icon="pi pi-check"
                    onClick={handleQrCodePaymentConfirmation}
                    disabled={!hasQrCodes || !selectedQrCode}
                    autoFocus
                    className="p-button-primary"
                />
            </div>
        );
    };

    // 渲染支付方式选择（both 模式）
    const renderPaymentMethodSelection = () => {
        if (effectiveMode !== 'both') return null;

        return (
            <div className="w-full mb-4 p-3 bg-surface-50 rounded-lg">
                <div className="text-sm font-medium text-surface-700 mb-2">选择支付方式：</div>
                <div className="flex gap-4">
                    {hasQrCodes && (
                        <div 
                            className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedPaymentMethod === 'qrcode' ? 'bg-primary-100' : ''}`}
                            onClick={() => setSelectedPaymentMethod('qrcode')}
                        >
                            <RadioButton
                                inputId="method-qrcode"
                                value="qrcode"
                                checked={selectedPaymentMethod === 'qrcode'}
                                onChange={() => setSelectedPaymentMethod('qrcode')}
                            />
                            <label htmlFor="method-qrcode" className="cursor-pointer">扫码支付</label>
                        </div>
                    )}
                    <div 
                        className={`flex items-center gap-2 p-2 rounded cursor-pointer ${selectedPaymentMethod === 'alipay_api' ? 'bg-primary-100' : ''}`}
                        onClick={() => setSelectedPaymentMethod('alipay_api')}
                    >
                        <RadioButton
                            inputId="method-alipay"
                            value="alipay_api"
                            checked={selectedPaymentMethod === 'alipay_api'}
                            onChange={() => setSelectedPaymentMethod('alipay_api')}
                        />
                        <label htmlFor="method-alipay" className="cursor-pointer">平台支付宝</label>
                    </div>
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
                            className={`border-2 rounded-lg p-3 cursor-pointer transition-all ${
                                selectedQrCode?.type === qr.type 
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
                                <label htmlFor={qr.type} className="font-medium cursor-pointer">
                                    {qr.type === 'wechat' ? '💚 微信支付' : '🔵 支付宝'}
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
            </div>
        );
    };

    // 渲染平台支付宝界面
    const renderAlipayApiPayment = () => {
        return (
            <div className="flex flex-col items-center py-4">
                <div className="w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center mb-4">
                    <i className="pi pi-credit-card text-white text-3xl"></i>
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
                <div className="text-xs text-surface-400 text-center">
                    支付将通过平台支付宝接口完成，款项由平台代收
                </div>
            </div>
        );
    };

    // 根据支付模式渲染内容
    const renderPaymentContent = () => {
        if (effectiveMode === 'alipay_api') {
            return renderAlipayApiPayment();
        }

        if (effectiveMode === 'qrcode') {
            return (
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
            );
        }

        // both 模式
        return (
            <>
                {renderPaymentMethodSelection()}
                
                {selectedPaymentMethod === 'qrcode' ? (
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
                ) : (
                    renderAlipayApiPayment()
                )}
            </>
        );
    };

    return (
        <>
            <Dialog
                header={selectedPaymentMethod === 'alipay_api' ? '平台支付' : '扫码支付'}
                visible={visible}
                onHide={onHide}
                footer={getFooterContent()}
                modal
                draggable={false}
                resizable={false}
                style={{ width: '90%', maxWidth: '500px' }}
            >
                <div className="p-4 flex flex-col items-center">
                    {loading ? (
                        <div className="py-8">
                            <ProgressSpinner style={{ width: '50px', height: '50px' }} />
                        </div>
                    ) : (
                        renderPaymentContent()
                    )}
                </div>
            </Dialog>

            <Dialog
                header="服务条款确认"
                visible={showTermsDialog}
                onHide={() => setShowTermsDialog(false)}
                footer={termsFooterContent}
                modal
                draggable={false}
                resizable={false}
                style={{ width: '90%', maxWidth: '500px' }}
            >
                <div className="p-4">
                    <div className="mb-4 text-surface-900">
                        <h3 className="font-bold text-lg mb-2">请仔细阅读以下服务条款：</h3>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>未来我们很快会支持全链路的支付，不再需要您点击确认，当前只是过度方案。</li>
                            <li>支付完成后，请主动联系教练确认收款</li>
                            <li>教练确认收款后，服务即生效</li>
                        </ul>
                    </div>
                    <div className="flex items-center mb-4">
                        <Checkbox 
                            inputId="agreement" 
                            onChange={e => setAgreedToTerms(e.checked || false)} 
                            checked={agreedToTerms} 
                        />
                        <label htmlFor="agreement" className="ml-2 text-surface-900">
                            我已阅读并同意以上服务条款
                        </label>
                    </div>
                </div>
            </Dialog>
        </>
    );
};

export default PaymentDialog;