'use client';

import React from 'react';
import ContentManager from '@/app/dashboard/components/ContentManager';
import { useSession } from 'next-auth/react';
import { getCoach } from '@/app/dashboard/util';

const Content = () => {
    const { data: session } = useSession();
    const coach = getCoach(session);

    return (
        <div>
            <ContentManager 
                coachId={coach?.id || ''}
                coachName={coach?.name || ''}
            />
        </div>
    );
};

export default Content;