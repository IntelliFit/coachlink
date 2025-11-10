import React, { useState } from 'react';
import { X, User, CheckCircle, AlertCircle, Upload, Award, Calendar } from 'lucide-react';

interface CoachApplicationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (applicationData: CoachApplicationData) => void;
}

interface CoachApplicationData {
    specialties: string[];
    experience_years: number;
    certifications: string[];
    teaching_philosophy: string;
    sample_plan: string;
    available_hours: string;
    expected_rate: number;
}

const CoachApplicationModal: React.FC<CoachApplicationModalProps> = ({
    isOpen,
    onClose,
    onSubmit
}) => {
    const [formData, setFormData] = useState<CoachApplicationData>({
        specialties: [],
        experience_years: 0,
        certifications: [],
        teaching_philosophy: '',
        sample_plan: '',
        available_hours: '',
        expected_rate: 99
    });

    const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const specialtyOptions = [
        '增肌训练', '减脂塑形', '力量训练', '有氧运动',
        '核心训练', '柔韧性训练', '功能性训练', '康复训练',
        '营养指导', '心理辅导', '竞技体能', '老年健身'
    ];

    const handleSpecialtyChange = (specialty: string) => {
        setFormData(prev => ({
            ...prev,
            specialties: prev.specialties.includes(specialty)
                ? prev.specialties.filter(s => s !== specialty)
                : [...prev.specialties, specialty]
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // 验证必填项
        if (formData.specialties.length === 0) {
            setMessage({ type: 'error', text: '请至少选择一个专业领域！' });
            return;
        }

        if (formData.experience_years < 1) {
            setMessage({ type: 'error', text: '请输入您的健身经验年数！' });
            return;
        }

        if (!formData.teaching_philosophy.trim()) {
            setMessage({ type: 'error', text: '请分享您的教学理念！' });
            return;
        }

        if (!formData.sample_plan.trim()) {
            setMessage({ type: 'error', text: '请提供一个示例训练计划！' });
            return;
        }

        setIsSubmitting(true);

        try {
            onSubmit(formData);
            setMessage({ type: 'success', text: '申请提交成功！我们会在3个工作日内审核并通知您结果。' });
            setTimeout(() => {
                onClose();
            }, 2000);
        } catch (error) {
            setMessage({ type: 'error', text: '提交失败，请稍后重试！' });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
                {/* 头部 */}
                <div className="sticky top-0 bg-white border-b border-gray-100 p-4 sm:p-6 rounded-t-2xl hover:bg-gray-50 transition-colors duration-200 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 pr-4">
                            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">申请成为教练</h2>
                            <p className="text-gray-600 mt-1 text-sm sm:text-base">分享您的专业知识，帮助更多人实现健身目标</p>
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

                    {/* 申请说明 */}
                    <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <div className="flex items-center space-x-2 mb-2">
                            <Award className="w-5 h-5 text-blue-600" />
                            <span className="font-medium text-blue-800">教练认证说明</span>
                        </div>
                        <div className="text-blue-700 text-sm space-y-1">
                            <p>• 成为教练后，您可以开设各等级的训练服务</p>
                            <p>• 我们会根据您的专业程度分配初级/中级/高级教练等级</p>
                            <p>• 教练需要遵守平台规范，提供专业的健身指导</p>
                            <p>• 审核通过后，您将获得教练认证徽章</p>
                        </div>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* 专业领域 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-3">
                                专业领域 <span className="text-red-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                                {specialtyOptions.map((specialty) => (
                                    <label
                                        key={specialty}
                                        className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all ${formData.specialties.includes(specialty)
                                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-400'
                                            }`}
                                    >
                                        <input
                                            type="checkbox"
                                            checked={formData.specialties.includes(specialty)}
                                            onChange={() => handleSpecialtyChange(specialty)}
                                            className="sr-only"
                                        />
                                        <span className="text-sm">{specialty}</span>
                                    </label>
                                ))}
                            </div>
                            <div className="mt-2 text-xs text-gray-500">
                                已选择 {formData.specialties.length} 个专业领域
                            </div>
                        </div>

                        {/* 经验和资质 */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {/* 健身经验年数 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    健身经验年数 <span className="text-red-500">*</span>
                                </label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                                        <Calendar className="w-5 h-5 text-gray-400" />
                                    </div>
                                    <input
                                        type="number"
                                        value={formData.experience_years}
                                        onChange={(e) => setFormData(prev => ({
                                            ...prev,
                                            experience_years: parseInt(e.target.value) || 0
                                        }))}
                                        placeholder="例如：3"
                                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                        min="0"
                                        max="50"
                                    />
                                </div>
                            </div>

                            {/* 期望时薪 */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    期望起始价格 (元/月)
                                </label>
                                <input
                                    type="number"
                                    value={formData.expected_rate}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        expected_rate: parseInt(e.target.value) || 99
                                    }))}
                                    placeholder="建议：99-299"
                                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                    min="99"
                                    max="999"
                                />
                            </div>
                        </div>

                        {/* 教学理念 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                教学理念 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.teaching_philosophy}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    teaching_philosophy: e.target.value
                                }))}
                                placeholder="请分享您的健身教学理念，如何帮助学员达成目标..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                rows={4}
                                maxLength={500}
                            />
                            <div className="mt-1 text-xs text-gray-500">
                                {formData.teaching_philosophy.length}/500 字符
                            </div>
                        </div>

                        {/* 示例训练计划 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                示例训练计划 <span className="text-red-500">*</span>
                            </label>
                            <textarea
                                value={formData.sample_plan}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    sample_plan: e.target.value
                                }))}
                                placeholder="请提供一个完整的训练计划示例，包括动作、组数、次数等..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none"
                                rows={6}
                                maxLength={1000}
                            />
                            <div className="mt-1 text-xs text-gray-500">
                                {formData.sample_plan.length}/1000 字符
                            </div>
                        </div>

                        {/* 可授课时间 */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                可授课时间
                            </label>
                            <input
                                type="text"
                                value={formData.available_hours}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    available_hours: e.target.value
                                }))}
                                placeholder="例如：周一到周五 19:00-21:00，周末全天"
                                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
                                maxLength={100}
                            />
                        </div>

                        {/* 提交按钮 */}
                        <div className="flex space-x-4 pt-4">
                            <button
                                type="button"
                                onClick={onClose}
                                className="flex-1 py-3 px-4 border border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-colors"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className={`flex-1 py-3 px-4 rounded-xl font-medium text-white transition-all ${isSubmitting
                                    ? 'bg-gray-400 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-primary-500 to-primary-600 hover:from-primary-600 hover:to-primary-700 hover:shadow-lg'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <div className="flex items-center justify-center space-x-2">
                                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                        <span>提交中...</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center space-x-2">
                                        <Upload className="w-4 h-4" />
                                        <span>提交申请</span>
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

export default CoachApplicationModal; 