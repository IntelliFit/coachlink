import React from 'react';
import { Star, Target, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';

export default function ActivityInfo() {
    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center mb-4">
                    <Star className="w-6 h-6 text-yellow-500 mr-2" />
                    <h2 className="text-xl font-bold">活动介绍</h2>
                </div>
                <div className="space-y-3 text-gray-700 dark:text-gray-300 text-sm sm:text-base leading-relaxed">
                    <p>🏆 <strong>负重引体之王</strong> 是由17项吉尼斯纪录保持者刘三乐发起的月度挑战赛，旨在推广负重引体向上运动。</p>
                    <p>📱 在抖音发布挑战视频，并带话题 <span className="text-primary-600 font-medium">#bannydeer旗舰店</span> 与 <span className="text-purple-600 font-medium">#刘三乐挑战</span></p>
                    <p>🎯 挑战者在视频评论区留言成绩，格式："成绩：XX公斤"</p>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-md border border-gray-100 dark:border-gray-700">
                <div className="flex items-center mb-4">
                    <Target className="w-6 h-6 text-red-500 mr-2" />
                    <h2 className="text-xl font-bold">评判标准</h2>
                </div>
                <ul className="space-y-3 text-sm sm:text-base text-gray-700 dark:text-gray-300 leading-relaxed">
                    <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" /> 一镜到底，禁止剪辑。</li>
                    <li className="flex items-start"><CheckCircle className="w-5 h-5 text-green-500 mr-2 mt-0.5" /> 起始手臂完全伸直，下巴过杠。</li>
                    <li className="flex items-start"><XCircle className="w-5 h-5 text-red-500 mr-2 mt-0.5" /> 禁止借力，如甩腿或蹬地。</li>
                    <li className="flex items-start"><AlertTriangle className="w-5 h-5 text-orange-500 mr-2 mt-0.5" /> 负重60kg以上需附称重视频。</li>
                </ul>
            </div>
        </div>
    );
}