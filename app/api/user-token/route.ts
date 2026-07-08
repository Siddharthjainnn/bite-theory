import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import crypto from 'crypto';
import { authOptions } from '../../lib/auth';

/**
 * GET /api/user-token
 * Mints a short-lived token proving "this browser is logged in as user X",
 * for the NestJS backend to verify (src/common/user-auth.guard.ts).
 *
 * Format: base64url(JSON{ uid, exp }) + "." + HMAC_SHA256(payload, USER_TOKEN_SECRET)
 * Set the SAME USER_TOKEN_SECRET on Vercel and Render.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  const uid = (session?.user as any)?.id;
  if (!uid) {
    return NextResponse.json({ message: 'Not signed in' }, { status: 401 });
  }
  const secret = process.env.USER_TOKEN_SECRET;
  if (!secret) {
    // Not configured yet — backend guard also allows in this mode.
    return NextResponse.json({ token: null });
  }
  const payload = Buffer.from(
    JSON.stringify({ uid: Number(uid), exp: Math.floor(Date.now() / 1000) + 60 * 30 }), // 30 min
  ).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return NextResponse.json({ token: `${payload}.${sig}` });
}
