interface DevUser {
    name: string;
    phone: string;
    password: string;
}

export function getWhiteList(): DevUser[] {    
    const users = [];
    try {
        const data = JSON.parse(process.env.NEXT_PUBLIC_DEV_USERS);
        if (Array.isArray(data)) {
            return data;
        }

        return [];
    } catch (error) {
        return [];
    }
}