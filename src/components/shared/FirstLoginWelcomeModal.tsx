import React from 'react';
import { X, User, Star, Gift, CheckCircle, ArrowRight, Sparkles } from 'lucide-react';

interface FirstLoginWelcomeModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGoToProfileSetup: () => void;
    userName?: string;
}

const FirstLoginWelcomeModal: React.FC<FirstLoginWelcomeModalProps> = ({
    isOpen,
    onClose,
    onGoToProfileSetup,
    userName
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
            <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    className="absolute top-2 right-2 sm:top-4 sm:right-4 text-gray-400 hover:text-gray-600 transition-colors p-2 rounded-lg hover:bg-gray-100"
                >
                    <X className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>

                <div className="text-center space-y-4 sm:space-y-6 lg:space-y-8">
                    {/* 欢迎标题 */}
                    <div className="space-y-2 sm:space-y-4">
                        <div className="flex items-center justify-center space-x-1 sm:space-x-2">
                            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">欢迎加入智健联盟！</h2>
                            <Sparkles className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-500" />
                        </div>
                        <p className="text-base sm:text-lg text-gray-600">
                            {userName ? `你好，${userName}！` : '你好！'} 我们很高兴你的加入
                        </p>
                    </div>

                    {/* 欢迎动画 */}
                    <div className="flex justify-center">
                        <div className="w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center animate-pulse">
                            <User className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 text-white" />
                        </div>
                    </div>

                    {/* 功能介绍 */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                        <div className="bg-blue-50 p-4 sm:p-6 rounded-xl border border-blue-200">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                <Star className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">专业教练</h3>
                            <p className="text-xs sm:text-sm text-gray-600">获得专业健身教练的个性化指导</p>
                        </div>

                        <div className="bg-green-50 p-4 sm:p-6 rounded-xl border border-green-200">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">每日抽奖</h3>
                            <p className="text-xs sm:text-sm text-gray-600">参与每日抽奖，赢取健身奖品</p>
                        </div>

                        <div className="bg-purple-50 p-4 sm:p-6 rounded-xl border border-purple-200">
                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-500 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                                <CheckCircle className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                            </div>
                            <h3 className="font-semibold text-gray-900 mb-2 text-sm sm:text-base">科学训练</h3>
                            <p className="text-xs sm:text-sm text-gray-600">基于科学的训练计划和进度跟踪</p>
                        </div>
                    </div>

                    {/* 完善信息提示 */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-4 sm:p-6 rounded-xl border border-amber-200">
                        <div className="flex items-center justify-center space-x-2 mb-3 sm:mb-4">
                            <div className="w-6 h-6 sm:w-8 sm:h-8 bg-amber-500 rounded-full flex items-center justify-center">
                                <User className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                            </div>
                            <h3 className="text-lg sm:text-xl font-bold text-amber-800">完善个人信息</h3>
                        </div>
                        <p className="text-amber-700 mb-3 sm:mb-4 text-sm sm:text-base">
                            为了更好地为您提供个性化服务，请完善您的个人信息。这将帮助我们：
                        </p>
                        <ul className="text-amber-700 text-xs sm:text-sm space-y-2 mb-4 sm:mb-6 text-left max-w-md mx-auto">
                            <li className="flex items-center space-x-2">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                                <span>为您推荐合适的训练计划</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                                <span>安排专业的教练指导</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                                <span>中奖后及时联系您发放奖品</span>
                            </li>
                            <li className="flex items-center space-x-2">
                                <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4 text-green-500 flex-shrink-0" />
                                <span>提供更精准的健身建议</span>
                            </li>
                        </ul>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                        <button
                            onClick={onGoToProfileSetup}
                            className="flex items-center justify-center space-x-2 bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:from-blue-600 hover:to-purple-600 transition-all transform hover:scale-105 shadow-lg text-sm sm:text-base"
                        >
                            <User className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>立即完善信息</span>
                            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>

                        <button
                            onClick={onClose}
                            className="px-6 sm:px-8 py-3 sm:py-4 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors text-sm sm:text-base"
                        >
                            稍后再说
                        </button>
                    </div>

                    {/* 温馨提示 */}
                    <div className="text-xs sm:text-sm text-gray-500">
                        <p>💡 提示：您可以随时在个人设置中完善或修改信息</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default FirstLoginWelcomeModal; 