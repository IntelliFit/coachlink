// 获取学生档案请求和响应的类型定义

export interface GetStudentProfileDto {
    userId: string;
}

export interface StudentProfileData {
    profile: any;
    questionnaire: any;
    videos: any[];
    lifestyle: any[];
}

export interface GetStudentProfileResponseDto {
    success: boolean;
    message: string;
    data: StudentProfileData;
}