import { ApiData } from "@/types/api";
import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios";

export class BaseService {
    constructor(
        protected baseUrl: string,
    ) {}

    private unwrapApiError(error: unknown): never {
        if (axios.isAxiosError(error)) {
            const message = (error.response?.data as any)?.message;
            if (typeof message === "string" && message.trim()) {
                throw new Error(message);
            }
            if (error.message) {
                throw new Error(error.message);
            }
        }
        throw error;
    }

    protected post<T = any>(name: string, data?: any, config?: AxiosRequestConfig<any> | undefined) {
        return axios
            .post<ApiData<T>>(`${this.baseUrl}/${name}`, data, config)
            .catch((error) => this.unwrapApiError(error));
    }

    protected get<T = any>(name: string, config?: AxiosRequestConfig<any> | undefined) {
        return axios
            .get<ApiData<T>>(`${this.baseUrl}/${name}`, config)
            .catch((error) => this.unwrapApiError(error));
    }

    protected put<T = any>(name: string, data?: any, config?: AxiosRequestConfig<any> | undefined) {
        return axios
            .put<ApiData<T>>(`${this.baseUrl}/${name}`, data, config)
            .catch((error) => this.unwrapApiError(error));
    }
}