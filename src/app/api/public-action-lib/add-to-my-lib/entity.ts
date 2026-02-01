export interface AddPublicActionToMyLibDto {
    actionId: string;
    /**
     * 加入到哪种“我的动作库”
     * - student: student_actions（学员端）
     * - coach: coach_actions（教练端）
     */
    targetActionType?: "student" | "coach";
}

export interface AddPublicActionToMyLibResponseDto {
    action: any;
}

