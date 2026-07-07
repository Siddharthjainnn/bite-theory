/**
 * NextAuth (Auth.js) configuration for Bite Theory customers.
 *
 * Flow:
 *  1. User clicks "Continue with Google".
 *  2. On success we UPSERT into your existing `users` table by google_id/email.
 *  3. The session carries the DB user id, name, email, photo, mobile,
 *     wallet/points/tier, and a `profileComplete` flag (true once mobile is set).
 *  4. Pages use `profileComplete` to decide whether to push the user to
 *     /complete-profile to collect their phone number.
 *
 * No password is stored — Google-only, matching your schema.
 */
import type { NextAuthOptions } from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { query } from './db';

/** Generate a short unique referral code for new users. */
function makeReferralCode(seed: string): string {
  const base = (seed || 'BITE').replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 4) || 'BITE';
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${base}${rand}`;
}

interface DbUser {
  id: string;
  google_id: string | null;
  email: string;
  first_name: string | null;
  last_name: string | null;
  mobile: string | null;
  profile_image: string | null;
  wallet_balance: string | number | null;
  loyalty_points: number | null;
  loyalty_level: string | null;
  referral_code: string | null;
}

/** Find existing user by google_id or email, else create. Returns the row. */
async function upsertUser(profile: {
  googleId: string;
  email: string;
  firstName: string;
  lastName: string;
  photo: string;
}): Promise<DbUser> {
  // 1) try by google_id
  let rows = await query<DbUser>(
    `SELECT * FROM users WHERE google_id = $1 LIMIT 1`,
    [profile.googleId],
  );
  if (rows.length) return rows[0];

  // 2) try by email (user may have registered another way before)
  rows = await query<DbUser>(
    `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    [profile.email],
  );
  if (rows.length) {
    // link google_id + fill any missing name/photo
    const u = rows[0];
    const updated = await query<DbUser>(
      `UPDATE users
         SET google_id = COALESCE(google_id, $1),
             first_name = COALESCE(first_name, $2),
             last_name  = COALESCE(last_name, $3),
             profile_image = COALESCE(profile_image, $4),
             updated_at = now()
       WHERE id = $5
       RETURNING *`,
      [profile.googleId, profile.firstName, profile.lastName, profile.photo, u.id],
    );
    return updated[0];
  }

  // 3) create new user — with a 50-point welcome bonus
  const WELCOME_POINTS = 50;
  const created = await query<DbUser>(
    `INSERT INTO users
       (google_id, email, first_name, last_name, profile_image, referral_code, status, loyalty_points, loyalty_level)
     VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, 'bronze')
     RETURNING *`,
    [
      profile.googleId,
      profile.email,
      profile.firstName,
      profile.lastName,
      profile.photo,
      makeReferralCode(profile.firstName || profile.email),
      WELCOME_POINTS,
    ],
  );
  // log the bonus so it appears in the user's points history
  try {
    await query(
      `INSERT INTO loyalty_points (user_id, points, type, reason)
       VALUES ($1, $2, 'earn', 'Welcome bonus 🎉')`,
      [created[0].id, WELCOME_POINTS],
    );
  } catch (e) {
    console.error('welcome bonus log failed', e);
  }
  return created[0];
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    /** On first sign-in, upsert into DB and stash the DB id on the token. */
    async signIn({ user, account, profile }) {
      if (account?.provider !== 'google') return false;
      const p = profile as any;
      try {
        const dbUser = await upsertUser({
          googleId: (account.providerAccountId as string) || (p.sub as string),
          email: user.email || (p.email as string),
          firstName: (p.given_name as string) || user.name?.split(' ')[0] || '',
          lastName:
            (p.family_name as string) ||
            user.name?.split(' ').slice(1).join(' ') ||
            '',
          photo: (user.image as string) || (p.picture as string) || '',
        });
        // attach for the jwt callback
        (user as any).dbId = dbUser.id;
        return true;
      } catch (e) {
        console.error('signIn upsert failed', e);
        return false;
      }
    },

    /** Load fresh DB fields into the token each time. */
    async jwt({ token, user }) {
      const dbId = (user as any)?.dbId || token.dbId;
      if (dbId) {
        token.dbId = dbId;
        const rows = await query<DbUser>(
          `SELECT id, email, first_name, last_name, mobile, profile_image,
                  wallet_balance, loyalty_points, loyalty_level, referral_code
             FROM users WHERE id = $1 LIMIT 1`,
          [dbId],
        );
        if (rows.length) {
          const u = rows[0];
          token.name = `${u.first_name || ''} ${u.last_name || ''}`.trim();
          token.email = u.email;
          token.picture = u.profile_image || token.picture;
          token.mobile = u.mobile || null;
          token.walletBalance = Number(u.wallet_balance || 0);
          token.loyaltyPoints = Number(u.loyalty_points || 0);
          token.loyaltyLevel = u.loyalty_level || 'bronze';
          token.referralCode = u.referral_code || null;
          token.profileComplete = !!u.mobile; // phone present = complete
        }
      }
      return token;
    },

    /** Expose the useful fields to the client session. */
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.dbId;
        (session.user as any).mobile = token.mobile || null;
        (session.user as any).walletBalance = token.walletBalance || 0;
        (session.user as any).loyaltyPoints = token.loyaltyPoints || 0;
        (session.user as any).loyaltyLevel = token.loyaltyLevel || 'bronze';
        (session.user as any).referralCode = token.referralCode || null;
        (session.user as any).profileComplete = !!token.profileComplete;
      }
      return session;
    },
  },
};
