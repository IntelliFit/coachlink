'use client';

import React from 'react';
import VideoReview from '@/app/dashboard/components/VideoReview';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';

const Videos = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    return (
        <div>
            <VideoReview coachId={coach?.id || ''} />
        </div>
    );
};

export default Videos;