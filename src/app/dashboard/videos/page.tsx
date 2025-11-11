'use client';

import React, { useState, useEffect } from 'react';
import { Card } from 'primereact/card';
import { Skeleton } from 'primereact/skeleton';
import VideoReview from '@/app/dashboard/components/VideoReview';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';

const Videos = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);
    const [loading, setLoading] = useState<boolean>(true);

    useEffect(() => {
        // 模拟加载数据
        const timer = setTimeout(() => {
            setLoading(false);
        }, 800);
        
        return () => clearTimeout(timer);
    }, []);

    return (
        <div>
            {loading ? (
                <div className="space-y-6">
                    <Card className="shadow-sm">
                        <div className="flex justify-between items-center mb-4">
                            <Skeleton width="10rem" height="1.5rem" />
                            <Skeleton width="5rem" height="2rem" />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {[1, 2, 3].map((index) => (
                                <div key={index} className="border rounded-lg p-4">
                                    <Skeleton width="100%" height="10rem" className="mb-4" />
                                    <Skeleton width="80%" height="1rem" className="mb-2" />
                                    <Skeleton width="60%" height="0.75rem" className="mb-3" />
                                    <div className="flex justify-between">
                                        <Skeleton width="4rem" height="1.5rem" />
                                        <Skeleton width="4rem" height="1.5rem" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            ) : (
                <VideoReview coachId={coach?.id || ''} />
            )}
        </div>
    );
};

export default Videos;