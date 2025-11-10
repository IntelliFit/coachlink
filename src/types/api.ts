export interface ApiData<T> {
    success: boolean;
    message?: string;
    data?: T;
}