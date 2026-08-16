import NextAuth from 'next-auth';
import { authOptions } from '../../../lib/auth';

// Auth responses are per-user and must NEVER be cached or statically rendered —
// caching a session response would serve one user's identity to everyone.
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';
export const revalidate = 0;

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };