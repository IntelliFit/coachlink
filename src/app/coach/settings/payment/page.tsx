'use client';

import React, { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Button } from 'primereact/button';
import { Card } from 'primereact/card';
import { FileUpload } from 'primereact/fileupload';
import { ProgressSpinner } from 'primereact/progressspinner';
import { Message } from 'primereact/message';
import { useToastContext } from '@/context/ToastContext';

interface QrCodeItem {
    type: 'wechat' | 'alipay';
    name: string;
    url: string;
}

export default function CoachPaymentSettingsPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const { showToast } = useToastContext();

    const [loading, setLoading] = useState(true);
    const [allowPersonalQrcode, setAllowPersonalQrcode] = useState(true);
    const [qrCodes, setQrCodes] = useState<QrCodeItem[]>([]);
    const [uploading, setUploading] = useState<'wechat' | 'alipay' | null>(null);

    useEffect(() => {
        if (status === 'loading') return;

        if (!session?.user?.id) {
            router.push('/login');
            return;
        }

        loadQrCodes();
    }, [session, status]);

    const loadQrCodes = async () => {
        try {
            setLoading(true);
            const res = await fetch('/api/coach/payment-qrcodes');
            const data = await res.json();

            if (data.success) {
                setQrCodes(data.data.qrCodes || []);
                setAllowPersonalQrcode(data.data.allowPersonalQrcode);
            } else {
                showToast({ severity: 'error', summary: '错误', detail: data.message });
            }
        } catch (error) {
            console.error('加载收款码失败:', error);
            showToast({ severity: 'error', summary: '错误', detail: '加载收款码失败' });
        } finally {
            setLoading(false);
        }
    };

    // 使用服务端 API 上传文件
    const uploadFile = async (file: File, type: 'wechat' | 'alipay'): Promise<string> => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('type', type);

        const res = await fetch('/api/coach/upload-qrcode', {
            method: 'POST',
            body: formData
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || '上传失败');
        }

        return data.data.url;
    };

    const handleUpload = async (event: any, type: 'wechat' | 'alipay') => {
        const file = event.files[0];
        if (!file) return;

        setUploading(type);
        try {
            const url = await uploadFile(file, type);
            
            // 更新本地状态
            const name = type === 'wechat' ? '微信支付' : '支付宝';
            const existingIndex = qrCodes.findIndex(qr => qr.type === type);
            
            let newQrCodes: QrCodeItem[];
            if (existingIndex >= 0) {
                newQrCodes = [...qrCodes];
                newQrCodes[existingIndex] = { type, name, url };
            } else {
                newQrCodes = [...qrCodes, { type, name, url }];
            }
            
            setQrCodes(newQrCodes);
            
            // 保存到后端
            await saveQrCodes(newQrCodes);
            
            showToast({ severity: 'success', summary: '成功', detail: `${name}收款码上传成功` });
        } catch (error: any) {
            showToast({ severity: 'error', summary: '错误', detail: error.message || '上传失败' });
        } finally {
            setUploading(null);
        }
    };

    const saveQrCodes = async (codes: QrCodeItem[]) => {
        try {
            const res = await fetch('/api/coach/payment-qrcodes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ qrCodes: codes })
            });

            const data = await res.json();

            if (!data.success) {
                throw new Error(data.message);
            }
        } catch (error: any) {
            showToast({ severity: 'error', summary: '错误', detail: error.message || '保存失败' });
        }
    };

    const handleDelete = async (type: 'wechat' | 'alipay') => {
        const newQrCodes = qrCodes.filter(qr => qr.type !== type);
        setQrCodes(newQrCodes);
        await saveQrCodes(newQrCodes);
        showToast({ severity: 'success', summary: '成功', detail: '收款码已删除' });
    };

    const getQrCode = (type: 'wechat' | 'alipay') => {
        return qrCodes.find(qr => qr.type === type);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <ProgressSpinner />
            </div>
        );
    }

    if (!allowPersonalQrcode) {
        return (
            <Message 
                severity="warn" 
                text="管理员已禁止您使用个人收款码。如有疑问请联系管理员。" 
                className="w-full"
            />
        );
    }

    return (
        <div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 微信支付 */}
                <Card title="微信支付收款码" className="h-full">
                    <div className="flex flex-col items-center">
                        {getQrCode('wechat') ? (
                            <>
                                <img 
                                    src={getQrCode('wechat')?.url} 
                                    alt="微信收款码" 
                                    className="max-w-[200px] h-auto border rounded mb-4"
                                />
                                <div className="flex gap-2">
                                    <FileUpload
                                        mode="basic"
                                        accept="image/*"
                                        maxFileSize={5000000}
                                        chooseLabel="更换"
                                        auto
                                        customUpload
                                        uploadHandler={(e) => handleUpload(e, 'wechat')}
                                        disabled={uploading === 'wechat'}
                                    />
                                    <Button
                                        icon="pi pi-trash"
                                        className="p-button-danger p-button-outlined"
                                        onClick={() => handleDelete('wechat')}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <i className="pi pi-image text-4xl text-surface-400 mb-4"></i>
                                <p className="text-surface-500 mb-4">暂未上传微信收款码</p>
                                <FileUpload
                                    mode="basic"
                                    accept="image/*"
                                    maxFileSize={5000000}
                                    chooseLabel="上传微信收款码"
                                    auto
                                    customUpload
                                    uploadHandler={(e) => handleUpload(e, 'wechat')}
                                    disabled={uploading === 'wechat'}
                                />
                            </div>
                        )}
                    </div>
                </Card>

                {/* 支付宝 */}
                <Card title="支付宝收款码" className="h-full">
                    <div className="flex flex-col items-center">
                        {getQrCode('alipay') ? (
                            <>
                                <img 
                                    src={getQrCode('alipay')?.url} 
                                    alt="支付宝收款码" 
                                    className="max-w-[200px] h-auto border rounded mb-4"
                                />
                                <div className="flex gap-2">
                                    <FileUpload
                                        mode="basic"
                                        accept="image/*"
                                        maxFileSize={5000000}
                                        chooseLabel="更换"
                                        auto
                                        customUpload
                                        uploadHandler={(e) => handleUpload(e, 'alipay')}
                                        disabled={uploading === 'alipay'}
                                    />
                                    <Button
                                        icon="pi pi-trash"
                                        className="p-button-danger p-button-outlined"
                                        onClick={() => handleDelete('alipay')}
                                    />
                                </div>
                            </>
                        ) : (
                            <div className="text-center">
                                <i className="pi pi-image text-4xl text-surface-400 mb-4"></i>
                                <p className="text-surface-500 mb-4">暂未上传支付宝收款码</p>
                                <FileUpload
                                    mode="basic"
                                    accept="image/*"
                                    maxFileSize={5000000}
                                    chooseLabel="上传支付宝收款码"
                                    auto
                                    customUpload
                                    uploadHandler={(e) => handleUpload(e, 'alipay')}
                                    disabled={uploading === 'alipay'}
                                />
                            </div>
                        )}
                    </div>
                </Card>
            </div>

            <div className="mt-6 p-4 bg-surface-100 rounded-lg">
                <h4 className="font-semibold text-surface-800 mb-2">注意事项</h4>
                <ul className="text-sm text-surface-600 space-y-1">
                    <li>• 请上传清晰的收款二维码图片</li>
                    <li>• 支持 JPG、PNG 格式，最大 5MB</li>
                    <li>• 学员订阅时将看到您上传的收款码</li>
                    <li>• 建议同时上传微信和支付宝收款码，方便学员选择</li>
                </ul>
            </div>
        </div>
    );
}
