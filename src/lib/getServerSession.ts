import { getServerSession as getNextAuthServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

export async function getServerSession() {
    return await getNextAuthServerSession(authOptions);
}