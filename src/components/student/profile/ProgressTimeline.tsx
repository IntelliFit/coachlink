import React, { useState } from 'react';
import { History, Trophy, Video, Play, Calendar } from 'lucide-react';
import { Dialog } from 'primereact/dialog';
import { ProfileData } from './types';

interface ProgressTimelineProps {
    data: ProfileData;
}

export const ProgressTimeline: React.FC<ProgressTimelineProps> = ({ data }) => {
    const { timelineData } = data;
    const [selectedVideo, setSelectedVideo] = useState<string | null>(null);

    if (!timelineData || timelineData.length === 0) {
        return null;
    }

    return (
        <div className="bg-surface rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-bold text-surface-900 flex items-center gap-2 mb-6">
                <History className="text-indigo-600" size={20} />
                进步足迹
            </h2>

            <div className="relative pl-4 border-l-2 border-indigo-100 space-y-8">
                {timelineData.map((item) => (
                    <div key={item.id} className="relative">
                        {/* Dot */}
                        <div className={`absolute -left-[21px] top-0 w-4 h-4 rounded-full border-2 border-surface shadow-sm ${
                            item.type === 'pr' ? 'bg-yellow-400' : 
                            item.type === 'video' ? 'bg-blue-400' : 'bg-indigo-400'
                        }`} />

                        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                            <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="text-xs font-medium text-surface-500 bg-surface-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                        <Calendar size={10} />
                                        {item.date}
                                    </span>
                                    {item.type === 'pr' && (
                                        <span className="text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <Trophy size={10} />
                                            新纪录
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-base font-semibold text-surface-900">{item.title}</h3>
                                <p className="text-sm text-surface-600 mt-1">{item.description}</p>
                                
                                {item.stats && (
                                    <div className="flex gap-3 mt-2">
                                        <div className="text-xs bg-surface-50 px-2 py-1 rounded border border-surface-100">
                                            <span className="text-surface-500">重量:</span> <span className="font-medium">{item.stats.weight}kg</span>
                                        </div>
                                        <div className="text-xs bg-surface-50 px-2 py-1 rounded border border-surface-100">
                                            <span className="text-surface-500">次数:</span> <span className="font-medium">{item.stats.reps}</span>
                                        </div>
                                        <div className="text-xs bg-surface-50 px-2 py-1 rounded border border-surface-100">
                                            <span className="text-surface-500">RPE:</span> <span className="font-medium">{item.stats.rpe}</span>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {item.videoUrl && (
                                <div 
                                    className="relative w-32 h-20 bg-surface-900 rounded-lg overflow-hidden cursor-pointer group flex-shrink-0"
                                    onClick={() => setSelectedVideo(item.videoUrl || null)}
                                >
                                    <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                                        <div className="w-8 h-8 rounded-full bg-surface/90 flex items-center justify-center shadow-lg transform group-hover:scale-110 transition-transform">
                                            <Play size={14} className="text-indigo-600 ml-0.5" />
                                        </div>
                                    </div>
                                    {/* Placeholder for video thumbnail, in real app use actual thumbnail */}
                                    <div className="w-full h-full bg-surface-800 flex items-center justify-center text-surface-500">
                                        <Video size={20} />
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            <Dialog 
                header="训练视频" 
                visible={!!selectedVideo} 
                style={{ width: '90vw', maxWidth: '800px' }} 
                onHide={() => setSelectedVideo(null)}
                dismissableMask
            >
                {selectedVideo && (
                    <div className="aspect-video bg-black rounded-lg overflow-hidden">
                        <video 
                            src={selectedVideo} 
                            controls 
                            className="w-full h-full" 
                            autoPlay
                        />
                    </div>
                )}
            </Dialog>
        </div>
    );
};
