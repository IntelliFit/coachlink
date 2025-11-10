import { ApiData } from "@/types/api";
import axios, { type AxiosResponse, type AxiosRequestConfig } from "axios";

export class BaseService {
    constructor(
        protected baseUrl: string,
    ) {}

    protected post<T = any>(name: string, data?: any, config?: AxiosRequestConfig<any> | undefined) {
        return axios.post<ApiData<T>>(`${this.baseUrl}/${name}`, data, config);
    }
}