'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { FloatLabel } from 'primereact/floatlabel';
import { SelectButton } from 'primereact/selectbutton';
import { Card } from 'primereact/card';
import {
    getHuifuRegionCities,
    huifuBankOptions,
    huifuRegionOptions,
} from '@/config/huifuAccountOptions';

const validityTypeOptions = [
    { label: '长期有效', value: '1' },
    { label: '非长期', value: '0' },
];

export default function OpenHuifuAccountPage() {
    const router = useRouter();
    const [step, setStep] = useState(0);

    const [name, setName] = useState('');
    const [certNo, setCertNo] = useState('');
    const [mobileNo, setMobileNo] = useState('');
    const [certValidityType, setCertValidityType] = useState<string>('1');
    const [certBeginDate, setCertBeginDate] = useState('');
    const [certEndDate, setCertEndDate] = useState('');
    const [idCardFrontBase64, setIdCardFrontBase64] = useState<string | null>(null);
    const [idCardBackBase64, setIdCardBackBase64] = useState<string | null>(null);
    const [frontFileName, setFrontFileName] = useState('');
    const [backFileName, setBackFileName] = useState('');

    const [cardNo, setCardNo] = useState('');
    const [cardName, setCardName] = useState('');
    const [bankCode, setBankCode] = useState('');
    const [branchCode, setBranchCode] = useState('');
    const [branchName, setBranchName] = useState('');
    const [provId, setProvId] = useState('');
    const [areaId, setAreaId] = useState('');

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [showLocalDebugShortcut, setShowLocalDebugShortcut] = useState(false);
    const cityOptions = getHuifuRegionCities(provId);
    const selectedBankName = huifuBankOptions.find(option => option.code === bankCode)?.name;
    const selectedProvinceName = huifuRegionOptions.find(option => option.code === provId)?.name;
    const selectedCityName = cityOptions.find(option => option.code === areaId)?.name;

    const handleProvinceChange = (value: string) => {
        setProvId(value);
        setAreaId('');
    };

    useEffect(() => {
        const host = window.location.hostname;
        setShowLocalDebugShortcut(
            process.env.NODE_ENV !== 'production'
            || host === 'localhost'
            || host === '127.0.0.1',
        );
    }, []);

    const compressImage = (file: File, maxWidth = 1024, quality = 0.7): Promise<string> =>
        new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const img = new window.Image();
                img.onload = () => {
                    let { width, height } = img;
                    if (width > maxWidth || height > maxWidth) {
                        const ratio = maxWidth / Math.max(width, height);
                        width = Math.round(width * ratio);
                        height = Math.round(height * ratio);
                    }
                    const canvas = document.createElement('canvas');
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    if (!ctx) {
                        reject(new Error('无法处理图片'));
                        return;
                    }
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', quality).split(',')[1] || '');
                };
                img.onerror = reject;
                img.src = reader.result as string;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

    const handleFrontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const b64 = await compressImage(file);
            setIdCardFrontBase64(b64);
            setFrontFileName(file.name);
        } catch {
            setMessage('读取身份证人像面失败');
        }
    };

    const handleBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const b64 = await compressImage(file);
            setIdCardBackBase64(b64);
            setBackFileName(file.name);
        } catch {
            setMessage('读取身份证国徽面失败');
        }
    };

    const canNext = (): boolean => {
        if (!name.trim() || !certNo.trim() || !mobileNo.trim()) return false;
        if (!certBeginDate) return false;
        if (certValidityType === '0' && !certEndDate) return false;
        return Boolean(idCardFrontBase64 && idCardBackBase64);
    };

    const canSubmit = (): boolean => Boolean(
        cardNo.trim() &&
        cardName.trim() &&
        bankCode.trim() &&
        branchCode.trim() &&
        branchName.trim() &&
        provId.trim() &&
        areaId.trim(),
    );

    const submit = async () => {
        setMessage(null);
        if (!canSubmit()) {
            setMessage('请填写完整的银行卡、开户行和地区编码信息');
            return;
        }
        setLoading(true);
        try {
            const res = await axios.post('/api/coach/merchant/open-huifu-account', {
                name: name.trim(),
                certNo: certNo.trim(),
                mobileNo: mobileNo.trim(),
                certValidityType,
                certBeginDate: certBeginDate.replace(/-/g, ''),
                certEndDate: certValidityType === '1' ? undefined : certEndDate.replace(/-/g, ''),
                idCardFront: idCardFrontBase64,
                idCardBack: idCardBackBase64,
                cardNo: cardNo.trim(),
                cardName: cardName.trim(),
                bankCode: bankCode.trim(),
                branchCode: branchCode.trim(),
                branchName: branchName.trim(),
                provId: provId.trim(),
                areaId: areaId.trim(),
            });
            if (res.data?.success) {
                setMessage('收款账户开通成功');
                setTimeout(() => router.push('/dashboard/wallet'), 1500);
            } else {
                setMessage(res.data?.message || '开通失败');
            }
        } catch (err: any) {
            setMessage(err?.response?.data?.message || err?.message || '开通失败');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto p-4 max-w-2xl">
            <h1 className="text-2xl font-bold mb-2 text-surface-900">开通收款账户</h1>
            <p className="text-sm text-surface-500 mb-6">完成汇付个人用户开户和业务入驻后，学员订阅收入才能分账到您的汇付账户并提现到银行卡。</p>

            <div className="flex items-center gap-2 mb-6">
                {['身份信息', '提现银行卡'].map((label, i) => (
                    <React.Fragment key={label}>
                        <button
                            type="button"
                            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                                step === i
                                    ? 'bg-primary-600 text-white'
                                    : step > i
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-surface-100 text-surface-500'
                            }`}
                            onClick={() => i < step ? setStep(i) : undefined}
                            disabled={i > step}
                        >
                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                step === i ? 'bg-white text-primary-600' : step > i ? 'bg-green-500 text-white' : 'bg-surface-300 text-surface-500'
                            }`}>
                                {step > i ? '✓' : i + 1}
                            </span>
                            {label}
                        </button>
                        {i === 0 && <div className={`flex-1 h-0.5 ${step > 0 ? 'bg-green-400' : 'bg-surface-200'}`} />}
                    </React.Fragment>
                ))}
            </div>

            {showLocalDebugShortcut && step === 0 && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p>本地调试入口：仅用于预览银行卡信息表单，不会绕过后端汇付开户校验。</p>
                        <Button
                            type="button"
                            label="跳到银行卡信息"
                            icon="pi pi-arrow-right"
                            className="p-button-sm bg-primary-600 border-primary-600"
                            onClick={() => setStep(1)}
                        />
                    </div>
                </div>
            )}

            {step === 0 && (
                <Card className="shadow-sm">
                    <div className="space-y-5">
                        <h3 className="text-lg font-semibold text-surface-900">身份信息</h3>
                        <p className="text-xs text-surface-500 -mt-2">请填写与身份证一致的信息。证件开始日期按身份证有效期填写。</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FloatLabel>
                                <InputText id="name" className="w-full" value={name} onChange={e => setName(e.target.value)} />
                                <label htmlFor="name">姓名 *</label>
                            </FloatLabel>
                            <FloatLabel>
                                <InputText id="certNo" className="w-full" value={certNo} onChange={e => setCertNo(e.target.value)} maxLength={18} />
                                <label htmlFor="certNo">身份证号 *</label>
                            </FloatLabel>
                            <FloatLabel>
                                <InputText id="mobileNo" className="w-full" value={mobileNo} onChange={e => setMobileNo(e.target.value)} maxLength={11} />
                                <label htmlFor="mobileNo">手机号 *</label>
                            </FloatLabel>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">身份证有效期 *</label>
                            <SelectButton value={certValidityType} onChange={e => setCertValidityType(e.value as string)} options={validityTypeOptions} />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label htmlFor="certBeginDate" className="block text-sm font-medium text-surface-700 mb-2">
                                    身份证有效期开始日期 *
                                </label>
                                <InputText
                                    id="certBeginDate"
                                    type="date"
                                    className="w-full"
                                    value={certBeginDate}
                                    onChange={e => setCertBeginDate(e.target.value)}
                                />
                                <p className="mt-1 text-xs text-surface-500">
                                    填身份证背面“有效期限”的起始日期，例如 2020.01.01-2040.01.01 中的 2020.01.01。
                                </p>
                            </div>
                            {certValidityType === '0' && (
                                <div>
                                    <label htmlFor="certEndDate" className="block text-sm font-medium text-surface-700 mb-2">
                                        身份证有效期截止日期 *
                                    </label>
                                    <InputText
                                        id="certEndDate"
                                        type="date"
                                        className="w-full"
                                        value={certEndDate}
                                        onChange={e => setCertEndDate(e.target.value)}
                                    />
                                    <p className="mt-1 text-xs text-surface-500">
                                        非长期身份证填写有效期限的结束日期；长期有效可不填截止日期。
                                    </p>
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-surface-700 mb-2">身份证照片 *</label>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs text-surface-500 mb-1">人像面</label>
                                    <div className="border-2 border-dashed border-surface-300 rounded-lg p-4 text-center hover:border-primary-400 transition-colors cursor-pointer">
                                        <input type="file" accept="image/*" onChange={handleFrontUpload} className="hidden" id="front-upload" />
                                        <label htmlFor="front-upload" className="cursor-pointer block">
                                            {idCardFrontBase64 ? (
                                                <div>
                                                    <img src={`data:image/jpeg;base64,${idCardFrontBase64}`} alt="人像面" className="max-h-32 mx-auto rounded" />
                                                    <p className="text-xs text-green-600 mt-1">{frontFileName}</p>
                                                </div>
                                            ) : (
                                                <div className="py-6 text-surface-400">
                                                    <i className="pi pi-camera text-2xl mb-1 block" />
                                                    <span className="text-sm">点击上传人像面</span>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs text-surface-500 mb-1">国徽面</label>
                                    <div className="border-2 border-dashed border-surface-300 rounded-lg p-4 text-center hover:border-primary-400 transition-colors cursor-pointer">
                                        <input type="file" accept="image/*" onChange={handleBackUpload} className="hidden" id="back-upload" />
                                        <label htmlFor="back-upload" className="cursor-pointer block">
                                            {idCardBackBase64 ? (
                                                <div>
                                                    <img src={`data:image/jpeg;base64,${idCardBackBase64}`} alt="国徽面" className="max-h-32 mx-auto rounded" />
                                                    <p className="text-xs text-green-600 mt-1">{backFileName}</p>
                                                </div>
                                            ) : (
                                                <div className="py-6 text-surface-400">
                                                    <i className="pi pi-camera text-2xl mb-1 block" />
                                                    <span className="text-sm">点击上传国徽面</span>
                                                </div>
                                            )}
                                        </label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end pt-2">
                            <Button label="下一步" icon="pi pi-arrow-right" disabled={!canNext()} onClick={() => setStep(1)} className="bg-primary-600 border-primary-600" />
                        </div>
                    </div>
                </Card>
            )}

            {step === 1 && (
                <Card className="shadow-sm">
                    <div className="space-y-5">
                        <h3 className="text-lg font-semibold text-surface-900">提现银行卡</h3>
                        <p className="text-xs text-surface-500 -mt-2">用于汇付结算和提现。请选择银行卡所属银行，系统会自动带出银行编码；支行联行号是具体开户支行的清算编号，需按实际支行填写。</p>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FloatLabel>
                                <InputText id="cardName" className="w-full" value={cardName} onChange={e => setCardName(e.target.value)} />
                                <label htmlFor="cardName">卡户名 *</label>
                            </FloatLabel>
                            <FloatLabel>
                                <InputText id="cardNo" className="w-full" value={cardNo} onChange={e => setCardNo(e.target.value)} />
                                <label htmlFor="cardNo">银行卡号 *</label>
                            </FloatLabel>
                            <div>
                                <label htmlFor="bankSelect" className="block text-sm font-medium text-surface-700 mb-2">开户银行 *</label>
                                <select
                                    id="bankSelect"
                                    className="w-full h-12 rounded-md border border-surface-300 bg-white px-3 text-sm text-surface-900"
                                    value={huifuBankOptions.some(option => option.code === bankCode) ? bankCode : ''}
                                    onChange={e => setBankCode(e.target.value)}
                                >
                                    <option value="">请选择银行卡所属银行</option>
                                    {huifuBankOptions.map(option => (
                                        <option key={option.code} value={option.code}>{option.name}</option>
                                    ))}
                                </select>
                                <p className="mt-1 text-xs text-surface-500">选择后自动提交开户银行编码；列表没有时请联系平台运营补充，不要随便选择相近银行。</p>
                            </div>
                            <div className="rounded-md border border-surface-200 bg-surface-50 px-3 py-2">
                                <p className="text-xs text-surface-500">开户银行编码</p>
                                <p className="mt-1 text-sm font-semibold text-surface-900">
                                    {bankCode ? `${selectedBankName || '已选择银行'} · ${bankCode}` : '选择开户银行后自动生成'}
                                </p>
                            </div>
                            <FloatLabel>
                                <InputText id="branchCode" className="w-full" value={branchCode} onChange={e => setBranchCode(e.target.value.replace(/\D/g, '').slice(0, 12))} maxLength={12} />
                                <label htmlFor="branchCode">具体支行联行号 *</label>
                            </FloatLabel>
                            <FloatLabel>
                                <InputText id="branchName" className="w-full" value={branchName} onChange={e => setBranchName(e.target.value)} />
                                <label htmlFor="branchName">支行名称 *</label>
                            </FloatLabel>
                            <div className="md:col-span-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                                <p className="font-semibold">不知道支行联行号怎么找？</p>
                                <p className="mt-1">优先在银行 App/网银查看开户网点，或拨打银行卡背面的银行客服电话，询问“开户支行名称”和“12 位支行联行号/CNAPS 号”。</p>
                                <p className="mt-1">注意：银行卡所属银行、开户银行选择、支行联行号必须属于同一家银行；不确定时不要用相近银行编码代替。</p>
                            </div>
                            <div>
                                <label htmlFor="provinceSelect" className="block text-sm font-medium text-surface-700 mb-2">开户省份 *</label>
                                <select
                                    id="provinceSelect"
                                    className="w-full h-12 rounded-md border border-surface-300 bg-white px-3 text-sm text-surface-900"
                                    value={provId}
                                    onChange={e => handleProvinceChange(e.target.value)}
                                >
                                    <option value="">请选择开户省份</option>
                                    {huifuRegionOptions.map(option => (
                                        <option key={option.code} value={option.code}>{option.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label htmlFor="citySelect" className="block text-sm font-medium text-surface-700 mb-2">开户城市/区县 *</label>
                                <select
                                    id="citySelect"
                                    className="w-full h-12 rounded-md border border-surface-300 bg-white px-3 text-sm text-surface-900"
                                    value={areaId}
                                    onChange={e => setAreaId(e.target.value)}
                                    disabled={!provId}
                                >
                                    <option value="">{provId ? '请选择开户城市/区县' : '请先选择省份'}</option>
                                    {cityOptions.map(option => (
                                        <option key={option.code} value={option.code}>{option.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="md:col-span-2 rounded-md border border-surface-200 bg-surface-50 px-3 py-2">
                                <p className="text-xs text-surface-500">地区编码</p>
                                <p className="mt-1 text-sm font-semibold text-surface-900">
                                    {provId && areaId
                                        ? `${selectedProvinceName || '已选省份'} ${selectedCityName || '已选城市'} · ${provId} / ${areaId}`
                                        : '选择省份和城市/区县后自动生成'}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-2">
                            <Button label="上一步" icon="pi pi-arrow-left" onClick={() => setStep(0)} className="p-button-outlined" />
                            <Button label="提交开通" icon="pi pi-check" loading={loading} disabled={!canSubmit()} onClick={submit} className="bg-primary-600 border-primary-600" />
                        </div>
                    </div>
                </Card>
            )}

            {message && (
                <div className={`mt-4 p-3 rounded text-sm ${message.includes('成功') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                    {message}
                </div>
            )}

            <div className="mt-4">
                <Link href="/dashboard/wallet" className="text-sm text-primary-600 hover:underline">返回钱包</Link>
            </div>
        </div>
    );
}
