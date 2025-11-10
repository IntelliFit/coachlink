import React from 'react';
import { Trophy, Target, Zap, Dumbbell } from 'lucide-react';

interface LeaderboardHubPageProps {
  onNavigate: (view: string) => void;
}

const LeaderboardHubPage: React.FC<LeaderboardHubPageProps> = ({ onNavigate }) => {
  const leaderboards = [
    {
      id: 'pullup_leaderboard',
      title: '负重引体向上',
      description: '查看谁是负重引体的王者！',
      icon: Target,
      color: 'bg-blue-600 hover:bg-blue-700'
    },
    {
      id: 'bench_press_leaderboard',
      title: '卧推最大重量',
      description: '展示胸肌力量的巅峰对决！',
      icon: Dumbbell,
      color: 'bg-red-600 hover:bg-red-700'
    },
    {
      id: 'squat_leaderboard',
      title: '深蹲最大重量',
      description: '腿部力量的终极较量！',
      icon: Zap,
      color: 'bg-green-600 hover:bg-green-700'
    },
    {
      id: 'deadlift_leaderboard',
      title: '硬拉最大重量',
      description: '全身力量的极限挑战！',
      icon: Trophy,
      color: 'bg-purple-600 hover:bg-purple-700'
    }
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-center mb-8">排行榜</h1>
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {leaderboards.map((leaderboard) => {
            const IconComponent = leaderboard.icon;
            return (
              <div
                key={leaderboard.id}
                className="bg-white rounded-lg shadow-lg p-6 cursor-pointer hover:bg-gray-50 transition-all transform hover:scale-105"
                onClick={() => onNavigate(leaderboard.id)}
              >
                <div className="flex items-center justify-center mb-4">
                  <div className={`p-3 rounded-full ${leaderboard.color.split(' ')[0]} text-white`}>
                    <IconComponent className="w-8 h-8" />
                  </div>
                </div>
                <h2 className="text-xl font-semibold text-center mb-2">{leaderboard.title}</h2>
                <p className="text-gray-600 text-center mb-4">{leaderboard.description}</p>
                <div className="flex justify-center">
                  <button
                    className={`${leaderboard.color} text-white font-bold py-2 px-6 rounded-full transition-colors`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onNavigate(leaderboard.id);
                    }}
                  >
                    查看排行榜
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LeaderboardHubPage;