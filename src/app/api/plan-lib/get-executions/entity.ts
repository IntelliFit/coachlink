import { PlanInstanceExecutionRow } from "@/types";

export interface GetExecutionsDto {
    instanceId: string;
}


export interface GetExecutionsResponseDto {
    executions: PlanInstanceExecutionRow[];
}
