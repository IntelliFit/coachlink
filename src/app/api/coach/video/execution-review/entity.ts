import type { ExecutionSetVideoRow } from '@/types';

export type ReviewExecutionVideoDto = {
    videoId: string;
    feedback: {
        rating?: number;
        comment?: string;
        tips?: string[];
    };
};

export type ReviewExecutionVideoResponseDto = ExecutionSetVideoRow;

