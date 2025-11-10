import { getServerSession as _getServerSession } from 'next-auth';
import { authOptions } from '../../auth/[...nextauth]/route';

export async function getServerSession() {
    const session = await _getServerSession(authOptions);
    return session;
}