export interface DeleteActionDto {
    id: string;
}

export type DeleteActionRequest = {
  id: string;
};

export type DeleteActionResponse = {
  success: boolean;
  message?: string;
};
