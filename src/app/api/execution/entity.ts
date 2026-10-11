// API Entity Types for Training Execution

// Start Execution
export interface StartExecutionDto {
    instanceId: string;
    dayIndex: number;
}

export interface StartExecutionResponseDto {
    success: boolean;
    data?: {
        id: string;
        instance_id: string;
        student_id: string;
        day_index: number;
        status: string;
        action_executions: any[];
        total_sets: number;
        completed_sets: number;
        started_at: string;
    };
    message?: string;
}

// Complete Set (STRENGTH type)
export interface CompleteSetDto {
    executionId: string;
    actionIndex: number;
    setIndex: number;
    actionId: string; // For video lookup
    actualWeight?: number | null;
    actualReps?: number | null;
    actualDuration?: number | null;
    rpe?: number;
    notes?: string;
    is_pr?: boolean; // PR flag
    has_video?: boolean; // Video uploaded flag
}

// Complete Item (DIET/CARDIO/HABIT types)
export interface CompleteItemDto {
    executionId: string;
    actionIndex: number;
    itemType: "DIET" | "CARDIO" | "HABIT";
    completed: boolean;
    // DIET specific
    photoUrl?: string;
    actualContent?: string;
    // CARDIO specific
    actualDistance?: number;
    actualDuration?: number;
    // Common
    notes?: string;
}

export interface CompleteSetResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        completedSets: number;
        totalSets: number;
        // Auto e1RM calculation result (for PR celebration)
        autoE1RM?: {
            e1rm: number;
            isPR: boolean;
            previousPR?: number;
        };
    };
    message?: string;
}

// Finish Training
export interface FinishTrainingDto {
    executionId: string;
    sessionNotes?: string;
}

export interface FinishTrainingResponseDto {
    success: boolean;
    data?: {
        id: string;
        status: string;
        completed_at: string;
        completed_sets: number;
        total_sets: number;
    };
    message?: string;
}

// Upload Set Video
export interface UploadSetVideoResponseDto {
    success: boolean;
    data?: {
        id: string;
        execution_id: string;
        action_id: string;
        set_number: number;
        video_url: string;
        storage_path: string;
    };
    message?: string;
}

// Add Set Video Link (external URL, no storage usage)
export interface AddSetVideoLinkDto {
    executionId: string;
    actionId: string;
    setNumber: number;
    videoUrl: string;
}

export interface AddSetVideoLinkResponseDto {
    success: boolean;
    data?: {
        id: string;
        execution_id: string;
        action_id: string;
        set_number: number;
        video_url: string;
        storage_path: string;
    };
    message?: string;
}

// Create PR
export interface CreatePRDto {
    executionId: string;
    actionId: string;
    actionName: string;
    setNumber: number;
    weight: number;
    reps: number;
    rpe?: number;
    notes?: string;
    videoId?: string;
}

export interface CreatePRResponseDto {
    success: boolean;
    data?: {
        id: string;
        user_id: string;
        exercise_name: string;
        weight: number; // Training weight
        reps: number; // Training reps
        e1rm: number; // Calculated e1RM
        load_formula: string;
        date_achieved: string;
    };
    message?: string;
}

// Get Execution
export interface GetExecutionResponseDto {
    success: boolean;
    data?: {
        id: string;
        instance_id: string;
        student_id: string;
        dayIndex: number;
        status: string;
        action_executions: any[];
        total_sets: number;
        completed_sets: number;
        session_notes?: string;
        started_at: string;
        completed_at?: string;
    };
    message?: string;
}
// Get Share Info
export interface ShareInfoResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        shareToken: string;
        dayIndex: number;
        planName: string;
        completedAt: string;
        totalVolume: number;
        totalSets: number;
        durationMinutes: number;
        prRecords: Array<{
            exerciseName: string;
            weight: number;
            reps: number;
        }>;
        monthlyTrainingDays: string[];
        user: {
            nickname: string;
            avatarUrl: string;
        };
    };
    message?: string;
}
// Public Training Details
export interface PublicTrainingResponseDto {
    success: boolean;
    data?: {
        executionId: string;
        planName: string;
        completedAt: string;
        totalVolume: number;
        totalSets: number;
        durationMinutes: number;
        actionExecutions: any[]; // Summary of exercises
        user: {
            nickname: string;
            avatarUrl: string;
        };
    };
    message?: string;
}
