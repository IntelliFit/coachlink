import { DEV_USERS, type DevUser } from "@/config/devUsers";

export type { DevUser };

export function getWhiteList(): DevUser[] {
    return process.env.NODE_ENV === "development" ? DEV_USERS : [];
}