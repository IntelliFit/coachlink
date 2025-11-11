'use client'

import React, { useState, useEffect } from 'react';
// import pullupLeaderboardService from '../services/pullupLeaderboardService';
// import { LeaderboardRecord } from '../services/pullupLeaderboardService';

// --- 1. 修改 Props 接口 ---
// 定义表单可以处理的数据结构
interface FormState {
    douyin_nickname: string;
    gender: 'male' | 'female' | '';
    weight_kg: number | '';
    video_url: string;
    notes: string;
}

interface AdminPullupRecordFormProps {
    // 接收一个可选的、用于编辑的记录。如果提供了这个prop，组件就进入“编辑模式”。
    recordToEdit?: LeaderboardRecord | null;
    // 提交成功后的回调，能区分是新增还是编辑
    onSubmitSuccess: (mode: 'add' | 'edit', data: any) => void;
    // 取消操作的回调
    onCancel: () => void;
}

// --- 2. 重构组件 ---
const AdminPullupRecordForm: React.FC<AdminPullupRecordFormProps> = ({ recordToEdit, onSubmitSuccess, onCancel }) => {
    // 使用一个对象来管理所有表单字段的状态
    const [formData, setFormData] = useState<FormState>({
        douyin_nickname: '',
        gender: '',
        weight_kg: '',
        video_url: '',
        notes: '',
    });

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 判断当前是添加模式还是编辑模式
    const isEditMode = !!recordToEdit;

    // 如果是编辑模式，当 recordToEdit 变化时，用它的数据填充表单
    useEffect(() => {
        if (isEditMode && recordToEdit) {
            setFormData({
                // 注意：LeaderboardRecord 的 name 对应表单的 douyin_nickname
                douyin_nickname: recordToEdit.name,
                gender: recordToEdit.gender as 'male' | 'female' | '',
                weight_kg: recordToEdit.weight_kg,
                video_url: recordToEdit.video_url || '',
                notes: recordToEdit.notes || '',
            });
        }
    }, [recordToEdit, isEditMode]);

    // --- 3. 统一的输入处理函数 ---
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;

        if (name === 'weight_kg') {
            setFormData(prev => ({ ...prev, [name]: value === '' ? '' : parseFloat(value) }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    // --- 4. 修改提交处理函数，以支持两种模式 ---
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        // 使用 formData 进行验证
        if (!formData.douyin_nickname || formData.weight_kg === '' || !formData.gender) {
            setError('昵称、性别和重量为必填项');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            if (isEditMode && recordToEdit) {
                // --- 编辑逻辑 ---
                const updates = {
                    douyin_nickname: formData.douyin_nickname,
                    gender: formData.gender,
                    weight_kg: Number(formData.weight_kg),
                    video_url: formData.video_url,
                    notes: formData.notes
                };
                const result = await pullupLeaderboardService.updateRecord(recordToEdit.id, updates);
                onSubmitSuccess('edit', result);
            } else {
                // --- 添加逻辑 ---
                const claimCode = await pullupLeaderboardService.addUnclaimedRecord(
                    formData.douyin_nickname,
                    Number(formData.weight_kg),
                    formData.gender,
                    formData.video_url,
                    formData.notes
                );
                onSubmitSuccess('add', { claim_code: claimCode });
            }
        } catch (err: any) {
            setError(err.message || '操作失败');
        } finally {
            setLoading(false);
        }
    };

    // --- 5. 修改 JSX，使其成为一个模态框，并绑定新的状态和处理函数 ---
    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-start justify-center z-[9999] p-2 sm:p-4 pt-8 sm:pt-20" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
            <div className="bg-white rounded-xl shadow-2xl p-4 sm:p-6 w-full max-w-sm sm:max-w-md lg:max-w-lg max-h-[90vh] sm:max-h-[80vh] overflow-y-auto" style={{ position: 'relative', zIndex: 10000 }}>
                <h2 className="text-2xl font-bold mb-6 text-gray-800 border-b pb-4">
                    {isEditMode ? '编辑排行榜记录' : '添加新记录'}
                </h2>

                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">{error}</div>}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 所有输入框的 name/id 和 value/onChange 都需要修改 */}
                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="douyin_nickname">
                            抖音昵称
                        </label>
                        <input
                            id="douyin_nickname"
                            name="douyin_nickname"
                            type="text"
                            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.douyin_nickname}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="gender">
                            性别
                        </label>
                        <select
                            id="gender"
                            name="gender"
                            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.gender}
                            onChange={handleInputChange}
                            required
                        >
                            <option value="">-- 选择性别 --</option>
                            <option value="male">男</option>
                            <option value="female">女</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="weight_kg">
                            负重重量 (KG)
                        </label>
                        <input
                            id="weight_kg"
                            name="weight_kg"
                            type="number"
                            step="0.01"
                            min="0"
                            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.weight_kg}
                            onChange={handleInputChange}
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="video_url">
                            视频链接 (选填)
                        </label>
                        <input
                            id="video_url"
                            name="video_url"
                            type="url"
                            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.video_url}
                            onChange={handleInputChange}
                            placeholder="https://v.douyin.com/..."
                        />
                    </div>

                    <div>
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="notes">
                            备注 (选填)
                        </label>
                        <textarea
                            id="notes"
                            name="notes"
                            className="shadow-sm appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500"
                            value={formData.notes}
                            onChange={handleInputChange}
                            rows={3}
                            placeholder="例如：动作不标准，但重量真实"
                        />
                    </div>

                    <div className="flex items-center justify-end pt-4 space-x-4">
                        <button
                            type="button"
                            onClick={onCancel}
                            className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline transition-colors"
                        >
                            取消
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg focus:outline-none focus:shadow-outline transition-colors disabled:bg-gray-400"
                        >
                            {loading ? '保存中...' : (isEditMode ? '保存更改' : '添加记录')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AdminPullupRecordForm;