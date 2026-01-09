import { ApiData } from "@/types/api";
import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios";

export class BaseService {
    constructor(
        protected baseUrl: string,
    ) {}

    protected post<T = any>(name: string, data?: any, config?: AxiosRequestConfig<any> | undefined) {
        return axios.post<ApiData<T>>(`${this.baseUrl}/${name}`, data, config);
    }

    protected get<T = any>(name: string, config?: AxiosRequestConfig<any> | undefined) {
        return axios.get<ApiData<T>>(`${this.baseUrl}/${name}`, config);
    }

    protected put<T = any>(name: string, data?: any, config?: AxiosRequestConfig<any> | undefined) {
        return axios.put<ApiData<T>>(`${this.baseUrl}/${name}`, data, config);
    }
}