import React, { useState, useEffect } from 'react';
import { Gift, Star, Sparkles, Trophy, Zap, X, Users, Crown, Medal } from 'lucide-react';

interface AdminLotteryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLotteryComplete: (result: any) => void;
  leaderboardData: any[];
}

interface LotteryPrize {
  id: string;
  name: string;
  level: number;
  color: string;
  icon: string;
  stock: number;
  maxStock: number;
}

interface LotteryResult {
  prize: LotteryPrize;
  winner: any;
  message: string;
}

const AdminLotteryModal: React.FC<AdminLotteryModalProps> = ({ 
  isOpen, 
  onClose, 
  onLotteryComplete, 
  leaderboardData 
}) => {
  const [isSpinning, setIsSpinning] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const [resultPrize, setResultPrize] = useState<any>(null);
  const [winner, setWinner] = useState<any>(null);
  const [lotteryType, setLotteryType] = useState<'top20' | 'all' | null>(null);
  
  // 奖品配置
  const prizes: LotteryPrize[] = [
    {
      id: 'protein',
      name: '蛋白粉',
      level: 1,
      color: 'from-yellow-400 to-orange-400',
      icon: '🥤',
      stock: 10,
      maxStock: 10
    }
  ];

  // 抽奖动画
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isSpinning) {
      interval = setInterval(() => {
        setHighlightedIndex((prev) => (prev + 1) % prizes.length);
      }, 150);
    }
    return () => clearInterval(interval);
  }, [isSpinning, prizes.length]);

  // 执行抽奖逻辑
  const performLottery = (type: 'top20' | 'all'): any => {
    let participants: any[] = [];
    
    if (type === 'top20') {
      // 前20名参与抽奖
      participants = leaderboardData.slice(0, 20);
    } else {
      // 所有人参与抽奖
      participants = leaderboardData;
    }
    
    if (participants.length === 0) {
      throw new Error('没有参与者');
    }
    
    // 随机选择获奖者
    const randomIndex = Math.floor(Math.random() * participants.length);
    return participants[randomIndex];
  };

  const handleSpin = async (type: 'top20' | 'all') => {
    if (isSpinning) return;

    setIsSpinning(true);
    setShowResult(false);
    setLotteryType(type);
    
    try {
      // 模拟抽奖延迟
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // 执行抽奖
      const selectedWinner = performLottery(type);
      const selectedPrize = prizes[0]; // 蛋白粉
      
      // 找到奖品索引
      const prizeIndex = prizes.findIndex(p => p.id === selectedPrize.id);
      
      // 显示结果
      setHighlightedIndex(prizeIndex);
      setResultPrize(selectedPrize);
      setWinner(selectedWinner);
      setShowResult(true);
      setIsSpinning(false);
      
      // 生成结果消息
      const result: LotteryResult = {
        prize: selectedPrize,
        winner: selectedWinner,
        message: `恭喜 ${selectedWinner.name} 获得蛋白粉！`
      };
      
      // 再等 2 秒后触发结果回调
      setTimeout(() => {
        onLotteryComplete(result);
        onClose();
      }, 2000);
      
    } catch (error) {
      console.error('抽奖失败:', error);
      setIsSpinning(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl max-h-[95vh] sm:max-h-[90vh] overflow-y-auto p-4 sm:p-6 lg:p-8 relative">
        {/* 关闭按钮 */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <X className="w-6 h-6" />
        </button>

        <div className="flex flex-col items-center space-y-8">
          {/* 标题 */}
          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 mb-4">
              <Crown className="w-6 h-6 text-yellow-500" />
              <h3 className="text-2xl font-bold text-gray-900">管理员抽奖系统</h3>
              <Crown className="w-6 h-6 text-yellow-500" />
            </div>
            <p className="text-gray-600">负重引体排行榜抽奖</p>
          </div>

          {/* 抽奖状态 */}
          {isSpinning && (
            <div className="text-orange-600 font-medium animate-pulse text-lg">
              🎲 正在抽奖中，请稍等...
            </div>
          )}

          {/* 抽奖结果 */}
          {showResult && resultPrize && winner && (
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-6 rounded-xl border border-green-200 w-full max-w-2xl">
              <div className="text-center">
                <div className="text-green-700 font-bold text-xl mb-2">
                  🎉 抽奖结果
                </div>
                <div className="text-lg mb-2">
                  获奖者：<span className="font-bold text-blue-600">{winner.name}</span>
                </div>
                <div className="text-lg mb-2">
                  奖品：<span className="font-bold text-orange-600">{resultPrize.name}</span>
                </div>
                <div className="text-sm text-gray-600">
                  排名：第 {winner.rank} 名 | 成绩：{winner.weight_kg} 公斤
                </div>
              </div>
            </div>
          )}

          {/* 奖品展示 */}
          <div className="grid grid-cols-1 gap-4 max-w-2xl w-full">
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
                    <div className="text-sm text-green-600 font-medium">
                      剩余 {prize.stock} 份
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* 抽奖按钮组 */}
          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-2xl">
            {/* 前20名抽奖 */}
            <button
              onClick={() => handleSpin('top20')}
              disabled={isSpinning || leaderboardData.length < 1}
              className={`
                flex-1 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform
                ${isSpinning || leaderboardData.length < 1
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-1'
                }
              `}
            >
              {isSpinning && lotteryType === 'top20' ? (
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>抽奖中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Medal className="w-5 h-5" />
                  <span>前20名抽奖</span>
                  <span className="text-sm">({Math.min(20, leaderboardData.length)}人)</span>
                </div>
              )}
            </button>

            {/* 所有人抽奖 */}
            <button
              onClick={() => handleSpin('all')}
              disabled={isSpinning || leaderboardData.length < 1}
              className={`
                flex-1 px-8 py-4 rounded-2xl font-bold text-lg transition-all duration-300 transform
                ${isSpinning || leaderboardData.length < 1
                  ? 'bg-gray-400 cursor-not-allowed text-white'
                  : 'bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 text-white shadow-lg hover:shadow-xl hover:-translate-y-1'
                }
              `}
            >
              {isSpinning && lotteryType === 'all' ? (
                <div className="flex items-center justify-center space-x-3">
                  <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>抽奖中...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center space-x-2">
                  <Users className="w-5 h-5" />
                  <span>所有人抽奖</span>
                  <span className="text-sm">({leaderboardData.length}人)</span>
                </div>
              )}
            </button>
          </div>

          {/* 抽奖说明 */}
          <div className="bg-blue-50 p-6 rounded-2xl border border-blue-200 max-w-2xl w-full">
            <h4 className="font-bold text-blue-900 mb-3 text-center">抽奖说明</h4>
            <div className="text-blue-800 text-sm space-y-2">
              <div>• <strong>前20名抽奖：</strong>仅限排行榜前20名参与者</div>
              <div>• <strong>所有人抽奖：</strong>所有排行榜参与者均可参与</div>
              <div>• 每次抽奖将随机选择一名获奖者</div>
              <div>• 获奖者将获得蛋白粉一份</div>
              <div>• 管理员负责联系获奖者安排奖品发放</div>
            </div>
          </div>

          {/* 参与者统计 */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 max-w-2xl w-full">
            <h4 className="font-bold text-gray-900 mb-2 text-center">参与者统计</h4>
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <div className="text-2xl font-bold text-blue-600">{Math.min(20, leaderboardData.length)}</div>
                <div className="text-sm text-gray-600">前20名</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">{leaderboardData.length}</div>
                <div className="text-sm text-gray-600">总参与人数</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminLotteryModal; 