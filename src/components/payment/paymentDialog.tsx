'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { Checkbox } from 'primereact/checkbox';
import { useToastContext } from '@/context/ToastContext';
import { coachService } from '@/app/service/coachService';
import { CoachesRow } from '@/types';

interface PaymentDialogProps {
    visible: boolean;
    onHide: () => void;
    coachId: string;
    amount?: number;
    onSuccess?: (note?: string) => void;
    onCancel?: () => void;
}

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
    const [paymentNote, setPaymentNote] = useState('');
    const [showTermsDialog, setShowTermsDialog] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    const loadCoach = async () => {
        const res = await coachService.getCoach({
            id: coachId,
            needQrCode: true
        });

        if (res) {
            setCoach(res.coach);
        }

        setLoading(false);
    }

    useEffect(() => {
        if (visible && coachId) {
            setLoading(true);
            loadCoach();
            
        } else if (!visible) {
            setCoach(null);
        }
    }, [visible, coachId, showToast]);

    const handlePaymentConfirmation = () => {
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

    const footerContent = (
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
                onClick={handlePaymentConfirmation}
                disabled={!coach?.payment_qr_code}
                autoFocus
                className="p-button-primary"
            />
        </div>
    );

    return (
        <>
            <Dialog
                header="扫码支付"
                visible={visible}
                onHide={onHide}
                footer={footerContent}
                modal
                draggable={false}
                resizable={false}
                style={{ width: '90%', maxWidth: '500px' }}
            >
                <div className="p-4 flex flex-col items-center">
                    {loading ? (
                        <div className="text-center text-surface-500">
                            
                        </div>
                    ) : coach?.payment_qr_code ? (
                        <>
                            <img src={coach.payment_qr_code} alt="支付宝收款二维码" className="max-w-[300px] object-contain mb-4 border rounded" />
                            <div className="mb-2 text-center">
                                <div className="font-bold text-lg text-surface-900">{coach.name} 收款码</div>
                                {amount && <div className="text-primary font-bold mt-2">支付金额：¥{amount.toFixed(2)}</div>}
                            </div>
                            <InputText
                                type="text"
                                className="w-full border rounded px-3 py-2 mb-2 text-sm"
                                placeholder="支付备注（选填，例：学员姓名/手机号/用途等）"
                                value={paymentNote}
                                onChange={e => setPaymentNote(e.target.value)}
                            />
                            <div className="text-surface-500 text-xs mb-2">请使用支付宝扫码支付，支付后请联系教练确认收款</div>
                        </>
                    ) : (
                        <div className="text-center text-surface-500">未能获取二维码</div>
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