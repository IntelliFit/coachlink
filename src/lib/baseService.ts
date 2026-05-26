import { ApiData } from "@/types/api";
import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios";

export class ApiServiceError extends Error {
    status?: number;
    code?: string;
    data?: unknown;

    constructor(message: string, options: { status?: number; code?: string; data?: unknown } = {}) {
        super(message);
        this.name = "ApiServiceError";
        this.status = options.status;
        this.code = options.code;
        this.data = options.data;
    }
}

export class BaseService {
    constructor(
        protected baseUrl: string,
    ) {}

    private unwrapApiError(error: unknown): never {
        if (axios.isAxiosError(error)) {
            const responseData = error.response?.data as any;
            const message = responseData?.message;
            if (typeof message === "string" && message.trim()) {
                throw new ApiServiceError(message, {
                    status: error.response?.status,
                    code: typeof responseData?.code === "string" ? responseData.code : undefined,
                    data: responseData,
                });
            }
            if (error.message) {
                throw new ApiServiceError(error.message, {
                    status: error.response?.status,
                    code: typeof responseData?.code === "string" ? responseData.code : undefined,
                    data: responseData,
                });
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
