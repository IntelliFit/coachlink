import { DEV_USERS } from "@/config/devUsers";

export function getMockUsers() {
    return process.env.NODE_ENV === "development" ? DEV_USERS : [];
}