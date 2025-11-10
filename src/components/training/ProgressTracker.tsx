import React from 'react';
import { TrendingUp, Calendar, Target, Award, BarChart3 } from 'lucide-react';

interface ProgressData {
  date: string;
  value: number;
  type: 'weight' | 'reps' | 'time' | 'score';
}

interface ProgressTrackerProps {
  title: string;
  data: ProgressData[];
  unit: string;
  target?: number;
}

const ProgressTracker: React.FC<ProgressTrackerProps> = ({ title, data, unit, target }) => {
  const latestValue = data[data.length - 1]?.value || 0;
  const previousValue = data[data.length - 2]?.value || 0;
  const change = latestValue - previousValue;
  const changePercentage = previousValue > 0 ? ((change / previousValue) * 100).toFixed(1) : 0;

  const maxValue = Math.max(...data.map(d => d.value), target || 0);
  const minValue = Math.min(...data.map(d => d.value));

  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      {/* 头部 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">{title}</h3>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-2xl font-bold text-blue-600">{latestValue}</span>
            <span className="text-gray-500">{unit}</span>
            {change !== 0 && (
              <div className={`flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium ${
                change > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
              }`}>
                <TrendingUp className={`w-3 h-3 ${change < 0 ? 'transform rotate-180' : ''}`} />
                <span>{Math.abs(Number(changePercentage))}%</span>
              </div>
            )}
          </div>
        </div>
        <div className="text-blue-500">
          <BarChart3 className="w-8 h-8" />
        </div>
      </div>

      {/* 进度图表 */}
      <div className="mb-6">
        <div className="h-32 flex items-end space-x-1">
          {data.slice(-7).map((point, index) => {
            const height = ((point.value - minValue) / (maxValue - minValue)) * 100;
            return (
              <div key={index} className="flex-1 flex flex-col items-center">
                <div
                  className="w-full bg-gradient-to-t from-blue-500 to-blue-400 rounded-t-sm transition-all duration-300 hover:from-blue-600 hover:to-blue-500"
                  style={{ height: `${Math.max(height, 5)}%` }}
                  title={`${point.value} ${unit}`}
                ></div>
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(point.date).getDate()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 目标进度 */}
      {target && (
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-2">
            <span>目标进度</span>
            <span>{latestValue}/{target} {unit}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-green-400 h-2 rounded-full transition-all duration-300"
              style={{ width: `${Math.min((latestValue / target) * 100, 100)}%` }}
            ></div>
          </div>
        </div>
      )}

      {/* 统计信息 */}
      <div className="grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-sm text-gray-500 mb-1">最佳记录</div>
          <div className="font-bold text-gray-900">{Math.max(...data.map(d => d.value))}</div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">平均值</div>
          <div className="font-bold text-gray-900">
            {(data.reduce((sum, d) => sum + d.value, 0) / data.length).toFixed(1)}
          </div>
        </div>
        <div>
          <div className="text-sm text-gray-500 mb-1">训练天数</div>
          <div className="font-bold text-gray-900">{data.length}</div>
        </div>
      </div>
    </div>
  );
};

export default ProgressTracker;