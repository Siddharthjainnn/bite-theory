import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '../../lib/auth';
import { query } from '../../lib/db';

/** PATCH /account/profile — update mobile / name for the current user. */
export async function PATCH(req: Request) {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Bad JSON' }, { status: 400 });
  }

  const mobile = (body.mobile ?? '').toString().trim();
  const firstName = body.firstName?.toString().trim();
  const lastName = body.lastName?.toString().trim();

  // basic Indian mobile validation (10 digits, optional +91)
  if (mobile) {
    const digits = mobile.replace(/\D/g, '').slice(-10);
    if (digits.length !== 10) {
      return NextResponse.json(
        { error: 'Enter a valid 10-digit mobile number' },
        { status: 400 },
      );
    }
  }

  const rows = await query(
    `UPDATE users
       SET mobile = COALESCE($1, mobile),
           first_name = COALESCE($2, first_name),
           last_name = COALESCE($3, last_name),
           updated_at = now()
     WHERE id = $4
     RETURNING id, first_name, last_name, mobile, email`,
    [mobile || null, firstName || null, lastName || null, userId],
  );

  return NextResponse.json({ ok: true, user: rows[0] });
}

/** GET /account/profile — current user with wallet, points, favorites count. */
export async function GET() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  const rows = await query(
    `SELECT id, first_name, last_name, email, mobile, profile_image,
            wallet_balance, loyalty_points, loyalty_level, referral_code
       FROM users WHERE id = $1 LIMIT 1`,
    [userId],
  );
  if (!rows.length) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const [{ count: ordersCount }] = await query(
    `SELECT COUNT(*)::int AS count FROM orders WHERE user_id = $1`,
    [userId],
  );
  const [{ count: favCount }] = await query(
    `SELECT COUNT(*)::int AS count FROM favorites WHERE user_id = $1`,
    [userId],
  );

  return NextResponse.json({
    user: rows[0],
    stats: { orders: ordersCount, favorites: favCount },
  });
}
