import React, { useState, useEffect } from 'react';
import { Gift, Star, Sparkles, Trophy, Zap, X } from 'lucide-react';
import { LotteryService } from '../services/lottery';
import { LotteryResult } from '../types';

interface LotteryWheelProps {
  isOpen: boolean;
  onClose: () => void;
  onLotteryComplete: (result: LotteryResult) => void;
  disabled: boolean;
}

const LotteryWheel: React.FC<LotteryWheelProps> = ({ isOpen, onClose, onLotteryComplete, disabled }) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [resultPrize, setResultPrize] = useState<any>(null);
  
  const lotteryService = LotteryService.getInstance();
  const prizes = lotteryService.getPrizes();

  // 抽奖卡片高亮动画
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSpinning) {
      interval = setInterval(() => {
        setHighlightedIndex((prev) => (prev + 1) % prizes.length);
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isSpinning, prizes.length]);

  const handleSpin = async () => {
    if (isSpinning || disabled) return;

    setIsSpinning(true);
    setShowResult(false);
    
    try {
      // 开始抽奖
      const result = await lotteryService.drawLottery();
      
      // 找到中奖的奖品索引
      const prizeIndex = prizes.findIndex(p => p.id === result.prize.id);
      
      // 执行高亮动画 3 秒
      setTimeout(() => {
        setHighlightedIndex(prizeIndex);
        setResultPrize(result.prize);
        setShowResult(true);
        setIsSpinning(false);
        
        // 再等 1 秒后触发结果回调
        setTimeout(() => {
          onLotteryComplete(result);
          onClose();
        }, 2000);
      }, 3000);
      
    } catch (error) {
      console.error('抽奖失败:', error);
      setIsSpinning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center space-y-8">
          {/* 抽奖状态指示 */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Sparkles className="w-6 h-6 text-yellow-500" />
              <h3 className="text-2xl font-bold text-gray-900">智健联盟抽奖</h3>
              <Sparkles className="w-6 h-6 text-yellow-500" />
            </div>
            {isSpinning && (
              <div className="text-orange-600 font-medium animate-pulse">
                🎲 正在抽奖中，请稍等...
              </div>
            )}
            {showResult && resultPrize && (
              <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-xl border border-green-200">
                <div className="text-green-700 font-bold text-lg">
                  🎉 恭喜您抽中了：{resultPrize.name}！
                </div>
              </div>
            )}
          </div>

          {/* 奖品卡片网格 */}
          <div className="grid grid-cols-2 gap-4 max-w-2xl w-full">
            {prizes.map((prize, index) => {
              const isHighlighted = highlightedIndex === index;
              const isResult = showResult && resultPrize && resultPrize.id === prize.id;
              
              return (
                <div
                  key={prize.id}
                  className={`
                    relative p-6 rounded-2xl border-2 transition-all duration-300 transform
                    ${isResult ? 'border-green-400 shadow-2xl scale-105 bg-gradient-to-br from-green-50 to-emerald-50' :
                      isHighlighted && isSpinning ? 'border-orange-400 shadow-xl scale-105 bg-gradient-to-br from-orange-50 to-red-50' :
                      'border-gray-200 bg-white hover:border-gray-300 hover:shadow-lg'}
                  `}
                >
                  {/* 中奖标识 */}
                  {isResult && (
                    <div className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-green-500 to-emerald-500 rounded-full flex items-center justify-center">
                      <Trophy className="w-4 h-4 text-white" />
                    </div>
                  )}

                  {/* 动画效果 */}
                  {isHighlighted && isSpinning && (
                    <div className="absolute inset-0 bg-gradient-to-r from-orange-400/20 to-red-400/20 rounded-2xl animate-pulse" />
                  )}
                  
                  {/* 奖品图标 */}
                  <div className={`
                    w-16 h-16 rounded-2xl flex items-center justify-center text-2xl mb-4 mx-auto
                    bg-gradient-to-r ${prize.color}
                  `}>
                    {prize.icon}
                  </div>

                  {/* 奖品信息 */}
                  <div className="text-center">
                    <h4 className="font-bold text-lg mb-2 text-gray-900">
                      {prize.name}
                    </h4>
                    
                    {/* 概率显示 */}
                    {prize.level !== 4 && (
                      <div className="text-sm mb-2 text-gray-600">
                        {prize.level === 1 && '超稀有'}
                        {prize.level === 2 && '稀有'}
                        {prize.level === 3 && '常见'}
                      </div>
                    )}
                    
                    {/* 库存状态 */}
                    <div className={`text-sm font-medium ${
                      prize.level === 4 ? 'text-blue-500' : 'text-green-600'
                    }`}>
                      {prize.level === 4 ? '无限库存' : `剩余 ${prize.stock}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 抽奖按钮 */}
          <div className="text-center">
            <button
              onClick={handleSpin}
              disabled={isSpinning || disabled}
              className={`
                px-12 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform
                ${isSpinning || disabled
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-1'
                }
              `}
            >
              {isSpinning ? (
                <div className="flex items-center space-x-3">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>抽奖中...</span>
                </div>
              ) : disabled ? (
                <div className="flex items-center space-x-2">
                  <Gift className="w-5 h-5" />
                  <span>今日已抽奖</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <Zap className="w-5 h-5" />
                  <span>开始抽奖</span>
                  <Star className="w-5 h-5" />
                </div>
              )}
            </button>
            
            {!disabled && !isSpinning && (
              <p className="text-gray-500 text-sm mt-3">
                点击按钮开始抽奖，每人每天只能抽一次哦！
              </p>
            )}
          </div>

          {/* 抽奖说明 */}
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 max-w-2xl w-full">
            <h4 className="font-bold text-blue-900 mb-3 text-center">抽奖说明</h4>
            <div className="text-blue-800 text-sm space-y-2">
              <div>• 每位用户每天仅可参与一次抽奖</div>
              <div>• 实物奖品将在 3 个工作日内联系您安排发放</div>
              <div>• 健身教程将直接发送到您的邮箱</div>
              <div>• 活动最终解释权归智健联盟所有</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LotteryWheel;