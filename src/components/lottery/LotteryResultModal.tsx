import React from 'react';
import { X, Trophy, Gift, Star } from 'lucide-react';

interface LotteryResultModalProps {
    isOpen: boolean;
    onClose: () => void;
    result: any;
}

const LotteryResultModal: React.FC<LotteryResultModalProps> = ({ isOpen, onClose, result }) => {
    if (!isOpen || !result) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-8 relative">
                {/* 关闭按钮 */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X className="w-6 h-6" />
                </button>

                <div className="text-center space-y-6">
                    {/* 标题 */}
                    <div className="flex items-center justify-center space-x-2">
                        <Trophy className="w-8 h-8 text-yellow-500" />
                        <h3 className="text-2xl font-bold text-gray-900">抽奖结果</h3>
                        <Trophy className="w-8 h-8 text-yellow-500" />
                    </div>

                    {/* 获奖者信息 */}
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 p-6 rounded-xl border border-blue-200">
                        <div className="text-4xl mb-4">🎉</div>
                        <h4 className="text-xl font-bold text-gray-900 mb-2">
                            获奖者：{result.winner.name}
                        </h4>
                        <div className="text-gray-600 space-y-1">
                            <div>排名：第 {result.winner.rank} 名</div>
                            <div>成绩：{result.winner.weight_kg} 公斤</div>
                            <div>性别：{result.winner.gender === 'male' ? '男' : '女'}</div>
                        </div>
                    </div>

                    {/* 奖品信息 */}
                    <div className="bg-gradient-to-r from-orange-50 to-yellow-50 p-6 rounded-xl border border-orange-200">
                        <div className="flex items-center justify-center space-x-3 mb-3">
                            <Gift className="w-6 h-6 text-orange-500" />
                            <h4 className="text-lg font-bold text-gray-900">奖品</h4>
                            <Gift className="w-6 h-6 text-orange-500" />
                        </div>
                        <div className="text-2xl mb-2">{result.prize.icon}</div>
                        <div className="text-xl font-bold text-orange-600">
                            {result.prize.name}
                        </div>
                    </div>

                    {/* 操作说明 */}
                    <div className="bg-green-50 p-4 rounded-xl border border-green-200">
                        <div className="text-green-800 text-sm">
                            <div className="font-semibold mb-2">📞 后续操作：</div>
                            <div>• 管理员将联系获奖者安排奖品发放</div>
                            <div>• 请确保获奖者信息准确无误</div>
                        </div>
                    </div>

                    {/* 确认按钮 */}
                    <button
                        onClick={onClose}
                        className="w-full bg-blue-600 text-white py-3 px-6 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
                    >
                        确认
                    </button>
                </div>
            </div>
        </div>
    );
};

export default LotteryResultModal; 