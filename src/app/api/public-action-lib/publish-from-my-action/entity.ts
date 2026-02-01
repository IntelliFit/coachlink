export interface PublishFromMyActionDto {
    actionType: "student" | "coach";
    actionId: string;
}

export interface PublishFromMyActionResponseDto {
    publicAction: any;
}

