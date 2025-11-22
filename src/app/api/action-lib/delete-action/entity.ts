export interface DeleteActionDto {
    id: string;
}

export type DeleteActionResponseDto = {
    success: boolean;
    message: string;
};