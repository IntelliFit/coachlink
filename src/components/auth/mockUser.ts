export function getMockUsers() {
    try {
        const users = JSON.parse(process.env.NEXT_PUBLIC_DEV_USERS);
        return users;
    } catch (error) {
        return []
    }
}