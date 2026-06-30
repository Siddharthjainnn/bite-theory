'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

/**
 * basePath must match where the NextAuth route lives.
 * Our route is app/auth/[...nextauth] -> served at /auth
 * (NOT /api/auth, because /api is taken by the Express backend).
 */
export default function AuthProvider({ children }: { children: ReactNode }) {
  return (
    <SessionProvider basePath="/auth">{children}</SessionProvider>
  );
}
