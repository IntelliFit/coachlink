import React, { useState, useEffect } from 'react';
import { X, User, CheckCircle, AlertCircle, Save, Phone, MapPin } from 'lucide-react';
import { AuthService } from '../services/authService';
import { UserProfilesRow } from '@/types';

interface ProfileSetupModalProps {
    isOpen: boolean;
    onClose: () => void;
    onComplete: (profile: UserProfilesRow) => void;
}

interface ProfileFormData {
    full_name: string;
    nickname: string;
    phone: string;
    address: string;
    gender: 'male' | 'female' | 'other' | '';
    birth_date: string;
    height: string;
    weight: string;
    fitness_goal: string;
    fitness_level: 'beginner' | 'intermediate' | 'advanced' | '';
    bio: string;
}

const ProfileSetupModal: React.FC<ProfileSetupModalProps> = ({ isOpen, onClose, onComplete }) => {
    const [formData, setFormData] = useState<ProfileFormData>({
        full_name: '',
        nickname: '',
        phone: '',
        address: '',
        gender: '',
        birth_date: '',
        height: '',
        weight: '',
        fitness_goal: '',
        fitness_level: '',
        bio: ''
    });

    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isInitialLoad, setIsInitialLoad] = useState(true);

    const authService = AuthService.getInstance();
    const authState = authService.getAuthState();

    // 预填充已有的用户信息
    useEffect(() => {
        if (isOpen) {
            if (isInitialLoad) {
                if (authState.profile) {
                    setFormData({
                        full_name: authState.profile.full_name || '',
                        nickname: authState.profile.nickname || '',
                        phone: authState.profile.phone || authState.user?.phone || '',
                        address: authState.profile.address || '',
                        gender: authState.profile.gender || '',
                        birth_date: authState.profile.birth_date || '',
                        height: authState.profile.height?.toString() || '',
                        weight: authState.profile.weight?.toString() || '',
                        fitness_goal: authState.profile.fitness_goal || '',
                        fitness_level: authState.profile.fitness_level || '',
                        bio: authState.profile.bio || ''
                    });
                } else if (authState.user) {
                    setFormData(prev => ({
                        ...prev,
                        phone: authState.user?.phone || ''
                    }));
                }
                setIsInitialLoad(false);
            }
        } else {
            setIsInitialLoad(true);
        }
    }, [isOpen, authState.profile, authState.user, isInitialLoad]);

    // 清除消息
    useEffect(() => {
        if (message) {
            const timer = setTimeout(() => setMessage(null), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    if (!isOpen) return null;

    // 提交个人信息
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.nickname.trim()) {
            setMessage({ type: 'error', text: '请输入昵称！' });
            return;
        }

        if (!formData.phone.trim()) {
            setMessage({ type: 'error', text: '请输入手机号！' });
            return;
        }

        // 验证手机号格式
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(formData.phone)) {
            setMessage({ type: 'error', text: '手机号格式不正确！' });
            return;
        }

        // 验证手机号与注册手机号一致
        if (authState.user?.phone && formData.phone !== authState.user.phone) {
            setMessage({ type: 'error', text: '手机号必须与注册时的手机号一致！' });
            return;
        }

        if (!formData.address.trim()) {
            setMessage({ type: 'error', text: '请输入详细地址！' });
            return;
        }

        if (formData.address.length < 10) {
            setMessage({ type: 'error', text: '地址信息过于简单，请填写详细地址！' });
            return;
        }
        setIsSubmitting(true);

        try {
            const profileData = {
                full_name: formData.full_name || undefined,
                nickname: formData.nickname,
                phone: formData.phone,
                address: formData.address,
                gender: formData.gender || undefined,
                birth_date: formData.birth_date || undefined,
                height: formData.height ? parseInt(formData.height) : undefined,
                weight: formData.weight ? parseInt(formData.weight) : undefined,
                fitness_goal: formData.fitness_goal || undefined,
                fitness_level: (formData.fitness_level as any) || undefined,
                bio: formData.bio || undefined
            };

            const result = await authService.updateProfile(profileData);

            if (result.success && result.data) {
                setMessage({ type: 'success', text: '个人信息保存成功！' });

                // 更新表单数据以反映最新状态
                setFormData(prev => ({
                    ...prev,
                    full_name: result.data?.full_name || prev.full_name,
                    nickname: result.data?.nickname || prev.nickname,
                    phone: result.data?.phone || prev.phone,
                    address: result.data?.address || prev.address,
                    gender: result.data?.gender || prev.gender,
                    birth_date: result.data?.birth_date || prev.birth_date,
                    height: result.data?.height?.toString() || prev.height,
                    weight: result.data?.weight?.toString() || prev.weight,
                    fitness_goal: result.data?.fitness_goal || prev.fitness_goal,
                    fitness_level: result.data?.fitness_level || prev.fitness_level,
                    bio: result.data?.bio || prev.bio
                }));

                setTimeout(() => {
                    onComplete(result.data!);
                    // 关闭模态框后重置表单状态
                    setMessage(null);
                }, 1500);
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            console.error('保存个人信息失败:', error);
            setMessage({ type: 'error', text: '保存失败，请稍后重试！' });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                {/* 头部 */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-4 sm:p-6 rounded-t-2xl">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">完善个人信息</h2>
                            <p className="text-gray-600 mt-1 text-sm sm:text-base">填写基本信息，获得更好的健身体验</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0 p-2 -m-2 rounded-lg hover:bg-gray-100"
                        >
                            <X className="w-5 h-5 sm:w-6 sm:h-6" />
                        </button>
                    </div>
                </div>

                {/* 内容区域 */}
                <div className="p-4 sm:p-6">
                    {/* 消息提示 */}
                    {message && (
                        <div className={`mb-6 p-4 rounded-lg flex items-center space-x-2 ${message.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' :
                                message.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' :
                                    'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}>
                            {message.type === 'success' ? (
                                <CheckCircle className="w-5 h-5" />
                            ) : (
                                <AlertCircle className="w-5 h-5" />
                            )}
                            <span>{message.text}</span>
                        </div>
                    )}

                    {/* 重要提示 */}
                    <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600" />
                            <span className="font-medium text-blue-800 text-sm sm:text-base">重要提示</span>
                        </div>
                        <div className="text-blue-700 text-xs sm:text-sm space-y-1">
                            <p>• <strong>昵称</strong>是您在平台上的主要显示名称，请认真设置</p>
                            <p>• 手机号必须与注册时保持一致，用于中奖验证</p>
                            <p>• 地址信息将用于实物奖品的快递发送</p>
                            <p>• 真实姓名为可选项，仅用于必要的身份验证</p>
                        </div>
                    </div>
                    <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
                        {/* 基本信息 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            {/* 昵称 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    昵称 <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                        <User className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="text"
                                        value={formData.nickname}
                                        onChange={(e) => setFormData(prev => ({ ...prev, nickname: e.target.value }))}
                                        placeholder="请输入昵称"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        maxLength={50}
                                    />
                                </div>
                            </div>

                            {/* 真实姓名 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    真实姓名
                                </label>
                                <input
                                    type="text"
                                    value={formData.full_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                                    placeholder="请输入真实姓名（可选）"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    maxLength={50}
                                />
                            </div>
                        </div>

                        {/* 联系信息 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            {/* 手机号 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    手机号 <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                        <Phone className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                                        placeholder="请输入手机号"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        maxLength={11}
                                        readOnly={!!authState.user?.phone}
                                    />
                                </div>
                                {authState.user?.phone && (
                                    <div className="mt-1 text-xs text-gray-500">
                                        手机号与注册时保持一致，不可修改
                                    </div>
                                )}
                            </div>

                            {/* 详细地址 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    详细地址 <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-3">
                                        <MapPin className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                                        placeholder="请输入详细地址（省市区街道门牌号）"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                        rows={2}
                                        maxLength={200}
                                    />
                                </div>
                                <div className="mt-1 text-xs text-gray-500">
                                    {formData.address.length}/200 字符，用于实物奖品快递
                                </div>
                            </div>
                        </div>
                        {/* 性别和生日 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            {/* 性别 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    性别
                                </label>
                                <select
                                    value={formData.gender}
                                    onChange={(e) => setFormData(prev => ({ ...prev, gender: e.target.value as any }))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="">请选择性别</option>
                                    <option value="male">男</option>
                                    <option value="female">女</option>
                                    <option value="other">其他</option>
                                </select>
                            </div>

                            {/* 生日 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    生日
                                </label>
                                <input
                                    type="date"
                                    value={formData.birth_date}
                                    onChange={(e) => setFormData(prev => ({ ...prev, birth_date: e.target.value }))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                />
                            </div>
                        </div>

                        {/* 身高和体重 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            {/* 身高 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    身高 (cm)
                                </label>
                                <input
                                    type="number"
                                    value={formData.height}
                                    onChange={(e) => setFormData(prev => ({ ...prev, height: e.target.value }))}
                                    placeholder="请输入身高"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    min="100"
                                    max="250"
                                />
                            </div>

                            {/* 体重 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    体重 (kg)
                                </label>
                                <input
                                    type="number"
                                    value={formData.weight}
                                    onChange={(e) => setFormData(prev => ({ ...prev, weight: e.target.value }))}
                                    placeholder="请输入体重"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    min="30"
                                    max="200"
                                />
                            </div>
                        </div>

                        {/* 健身目标和水平 */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                            {/* 健身目标 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    健身目标
                                </label>
                                <select
                                    value={formData.fitness_goal}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fitness_goal: e.target.value }))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="">请选择健身目标</option>
                                    <option value="lose_weight">减重塑形</option>
                                    <option value="gain_muscle">增肌强身</option>
                                    <option value="improve_fitness">提升体能</option>
                                    <option value="maintain_health">保持健康</option>
                                    <option value="rehabilitation">康复训练</option>
                                </select>
                            </div>

                            {/* 健身水平 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    健身水平
                                </label>
                                <select
                                    value={formData.fitness_level}
                                    onChange={(e) => setFormData(prev => ({ ...prev, fitness_level: e.target.value as any }))}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                >
                                    <option value="">请选择健身水平</option>
                                    <option value="beginner">初学者</option>
                                    <option value="intermediate">中级</option>
                                    <option value="advanced">高级</option>
                                </select>
                            </div>
                        </div>

                        {/* 个人简介 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                个人简介
                            </label>
                            <textarea
                                value={formData.bio}
                                onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                                placeholder="简单介绍一下自己的健身经历或目标（可选）"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                rows={3}
                                maxLength={200}
                            />
                            <div className="mt-1 text-xs text-gray-500">
                                {formData.bio.length}/200 字符
                            </div>
                        </div>

                        {/* 提交按钮 */}
                        <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                稍后设置
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-all ${isSubmitting
                                        ? 'bg-gray-400 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-blue-500 to-emerald-500 hover:shadow-lg'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>保存中...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-2">
                                        <Save className="w-4 h-4" />
                                        <span>保存信息</span>
                                    </div>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ProfileSetupModal;