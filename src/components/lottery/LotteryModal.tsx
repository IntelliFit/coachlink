import React from 'react';
import { X, Gift, Star, Trophy, Award } from 'lucide-react';
import { LotteryResult } from '../types';

interface LotteryModalProps {
  isOpen: boolean;
  result: LotteryResult | null;
  onClose: () => void;
}

const LotteryModal: React.FC<LotteryModalProps> = ({ isOpen, result, onClose }) => {
  if (!isOpen || !result) return null;

  const getPrizeIcon = (level: number) => {
    switch (level) {
      case 1: return <Trophy className="w-16 h-16 text-yellow-500" />;
      case 2: return <Award className="w-16 h-16 text-blue-500" />;
      case 3: return <Gift className="w-16 h-16 text-emerald-500" />;
      default: return <Star className="w-16 h-16 text-purple-500" />;
    }
  };

  const getPrizeTitle = (level: number) => {
    switch (level) {
      case 1: return '🎉 恭喜中奖！';
      case 2: return '🎊 恭喜中奖！';
      case 3: return '🎁 恭喜中奖！';
      default: return '📖 感谢参与！';
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 relative animate-bounce-in">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        {/* 奖品展示 */}
        <div className="text-center">
          {/* 动画效果 */}
          <div className="mb-6 animate-pulse">
            {getPrizeIcon(result.prize.level)}
          </div>

          {/* 标题 */}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {getPrizeTitle(result.prize.level)}
          </h2>

          {/* 奖品名称 */}
          <div className={`inline-block px-6 py-3 rounded-full text-white font-semibold mb-6 bg-gradient-to-r ${result.prize.color}`}>
            {result.prize.icon} {result.prize.name}
          </div>

          {/* 中奖信息 */}
          <p className="text-gray-600 leading-relaxed mb-8">
            {result.message}
          </p>

          {/* 操作按钮 */}
          <div className="space-y-3">
            {result.isWinner && (
              <button className="w-full bg-gradient-to-r from-blue-600 to-emerald-500 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all">
                查看我的奖品
              </button>
            )}
            
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-700 py-3 rounded-xl font-semibold hover:bg-gray-200 transition-all"
            >
              {result.isWinner ? '稍后查看' : '开始健身之旅'}
            </button>
          </div>

          {/* 分享按钮 */}
          {result.isWinner && (
            <div className="mt-6 pt-6 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-3">分享好运给朋友们</p>
              <div className="flex justify-center space-x-4">
                <button className="w-10 h-10 bg-green-500 text-white rounded-full flex items-center justify-center hover:bg-green-600 transition-colors">
                  <span className="text-sm">微</span>
                </button>
                <button className="w-10 h-10 bg-blue-500 text-white rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors">
                  <span className="text-sm">朋</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @keyframes bounce-in {
          0% {
            transform: scale(0.3);
            opacity: 0;
          }
          50% {
            transform: scale(1.05);
          }
          70% {
            transform: scale(0.9);
          }
          100% {
            transform: scale(1);
            opacity: 1;
          }
        }
        .animate-bounce-in {
          animation: bounce-in 0.6s ease-out;
        }
      `}</style>
    </div>
  );
};

export default LotteryModal;