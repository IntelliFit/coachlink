'use client';

import React, { useState, useEffect } from 'react';
import { Dialog } from 'primereact/dialog';
import { Button } from 'primereact/button';
import { useToastContext } from '@/context/ToastContext';
import { alipayService } from '@/app/service/alipayService';
import type { CreateAlipayOrderDto } from '@/app/api/payment/alipay/create/entity';
import type { QueryAlipayOrderDto, QueryAlipayOrderResponseDto, TradeStatus } from '@/app/api/payment/alipay/query/entity';

interface PaymentDialogProps {
    visible: boolean;
    onHide: () => void;
    orderDetails?: CreateAlipayOrderDto;
    onSuccess?: () => void;
    onCancel?: () => void;
}

const PaymentDialog: React.FC<PaymentDialogProps> = ({
    visible,
    onHide,
    orderDetails,
    onSuccess,
    onCancel
}) => {
    const { showToast } = useToastContext();
    const [processing, setProcessing] = useState(false);
    const [polling, setPolling] = useState(false);
    const [orderId, setOrderId] = useState<string | null>(null);

    // 轮询检查订单状态
    useEffect(() => {
        let pollInterval: NodeJS.Timeout | null = null;

        // if (polling && orderId) {
        //     pollInterval = setInterval(async () => {
        //         try {
        //             const queryDto: QueryAlipayOrderDto = { orderId: orderId };
        //             const result: QueryAlipayOrderResponseDto | null = await alipayService.queryOrder(queryDto);
                    
        //             const tradeStatus = result?.order?.trade_status as TradeStatus | undefined;
                    
        //             if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
        //                 clearInterval(pollInterval!);
        //                 setPolling(false);
        //                 showToast({ severity: 'success', summary: '支付成功', detail: '订单已支付成功' });
        //                 onSuccess?.();
        //                 onHide();
        //             } else if (tradeStatus === 'TRADE_CLOSED') {
        //                 clearInterval(pollInterval!);
        //                 setPolling(false);
        //                 showToast({ severity: 'warn', summary: '支付取消', detail: '订单支付已被取消' });
        //             }
        //         } catch (error) {
        //             console.error('轮询订单状态失败:', error);
        //         }
        //     }, 3000); // 每3秒轮询一次
        // }

        return () => {
            if (pollInterval) {
                clearInterval(pollInterval);
            }
        };
    }, [polling, orderId, onSuccess, onHide]);

    const handlePayment = async () => {
        try {
            setProcessing(true);
            
            const orderResponse = await alipayService.createOrder(orderDetails);
            
            if (orderResponse?.order?.id) {
                setOrderId(orderResponse.order.id);
            }
            
            if (orderResponse?.paymentInfo?.formHtml) {
                // 在新窗口/标签页中打开支付页面
                const newWindow = window.open('', '_blank');
                if (newWindow) {
                    newWindow.document.write(orderResponse.paymentInfo.formHtml);
                    newWindow.document.close();
                    newWindow.focus();
                    // 开始轮询订单状态
                    setPolling(true);
                } else {
                    showToast({ severity: 'error', summary: '无法打开支付页面', detail: '请允许弹出窗口以完成支付' });
                }
            } else {
                showToast({ severity: 'error', summary: '支付信息不完整', detail: '无法完成支付' });
            }
        } catch (error) {
            console.error('支付过程中出现错误:', error);
            showToast({ severity: 'error', summary: '支付过程中出现错误' });
        } finally {
            setProcessing(false);
        }
    };

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
                disabled={processing || polling}
            />
            <Button 
                label={polling ? "支付中..." : "确认支付"} 
                icon={polling ? "pi pi-spin pi-spinner" : "pi pi-check"} 
                onClick={handlePayment}
                loading={processing}
                disabled={polling}
                autoFocus
            />
        </div>
    );

    return (
        <Dialog
            header="确认订单"
            visible={visible}
            onHide={() => {
                if (!polling) {
                    onHide();
                }
            }}
            footer={footerContent}
            modal
            draggable={false}
            resizable={false}
            style={{ width: '90%', maxWidth: '500px' }}
            closable={!polling}
        >
            <div className="p-4">
                <div className="mb-4">
                    <h3 className="text-lg font-semibold mb-2">订单详情</h3>
                    <div className="surface-card p-4 rounded-lg">
                        <div className="flex justify-between mb-2">
                            <span className="text-surface-600">商品名称:</span>
                            <span className="font-medium">{orderDetails?.subject}</span>
                        </div>
                        <div className="flex justify-between mb-2">
                            <span className="text-surface-600">订单类型:</span>
                            <span className="font-medium">{orderDetails?.order_type || '普通订单'}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-surface-600">金额:</span>
                            <span className="font-bold text-primary">¥{orderDetails?.total_amount.toFixed(2)}</span>
                        </div>
                    </div>
                </div>
                
                <div className="mb-4">
                    <p className="text-surface-600 text-sm">
                        {polling 
                            ? "支付页面已在新窗口打开，请在新窗口中完成支付。此窗口将自动检测支付结果..." 
                            : "请确认订单信息无误，点击\"确认支付\"按钮将在新窗口中打开支付页面。"}
                    </p>
                </div>
            </div>
        </Dialog>
    );
};

export default PaymentDialog;