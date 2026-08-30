/**
 * Tiffin funnel config — everything the business is likely to retune lives here
 * so copy/price/area changes never require touching component code.
 */

/* ⚠️ VERIFY BEFORE THE ADS GO LIVE.
   The number supplied was 999306022 — that is NINE digits. Indian mobiles are
   ten. It is almost certainly missing one. A wrong number on a paid campaign
   means you pay for every click and lose every call, so this is left obviously
   broken on purpose rather than silently guessed at. */
export const TIFFIN_PHONE = '999306022';
export const TIFFIN_PHONE_PRETTY = '+91 999306022';

/* ── Plans ────────────────────────────────────────────────────────────────
   A ladder, not a single price: a stranger from an ad will not commit to a
   month of food they have never tasted, but they will risk one lunch. The
   per-day rate falls as commitment rises, so the trial is deliberately the
   most expensive way to eat and monthly the cheapest — that gap is what
   moves people up the ladder.

   Prices below are what the customer pays, delivery included — there is no
   separate delivery line any more.

   ⚠️ THE LADDER IS ALMOST FLAT at these numbers: Rs80 / Rs80 / Rs77 a meal.
   Six single-day trials cost Rs480, exactly the same as the weekly plan, so
   the weekly plan currently buys the customer nothing and there is no reason
   to commit. Raising the trial (Rs99-Rs120) or cutting weekly to ~Rs430 would
   restore a real reason to move up. Left as specified. */

export type TiffinPlan = {
  key: string;
  label: string;
  /** Deliveries included. Drives the day-picker limit on /tiffin. */
  days: number;
  /** Cap on distinct weekdays the customer may choose, null = no cap. */
  maxWeekdays: number | null;
  price: number;
  delivery: number;
  total: number;
  perDay: number;
  duration: string;
  blurb: string;
  badge?: string;
};

const mk = (
  key: string, label: string, days: number, maxWeekdays: number | null,
  price: number, delivery: number, duration: string, blurb: string, badge?: string,
): TiffinPlan => ({
  key, label, days, maxWeekdays, price, delivery,
  total: price + delivery,
  perDay: Math.round((price + delivery) / days),
  duration, blurb, badge,
});

export const TIFFIN_PLANS: TiffinPlan[] = [
  mk('trial-1', 'Try 1 Day', 1, 1, 80, 0, 'one meal',
     'Taste it first. One tiffin, one day, no commitment.', 'START HERE'),
  mk('weekly-6', 'Weekly', 6, 6, 480, 0, 'per week',
     'A full working week. See if the routine suits you.'),
  mk('monthly-26', 'Monthly', 26, null, 2000, 0, 'per month',
     'Best value. One payment, delivery included.', 'BEST VALUE'),
];

export const DEFAULT_PLAN_KEY = 'monthly-26';
export const TRIAL_PLAN = TIFFIN_PLANS[0];
export const MONTHLY_PLAN = TIFFIN_PLANS[2];

/** Kept for the shared copy that is not plan-specific. */
export const TIFFIN_PLAN = {
  label: 'Daily Tiffin Plan',
  /* One-time payment — no auto-renewal, no saved card. Said plainly, because
     "subscription" reads as recurring billing and makes people hesitate. */
  note: 'One-time payment · no auto-renewal',
  /* ⚠️ VERIFY: what a single tiffin actually contains. Customers will hold
     you to whatever this says. */
  includes: ['4 Roti', 'Sabzi', 'Dal / Kadhi', 'Rice', 'Salad'],
};

/** Serviceable localities, all Indore. Value is what gets stored on the lead. */
export const TIFFIN_AREAS: { value: string; label: string }[] = [
  { value: 'vijay-nagar', label: 'Vijay Nagar' },
  { value: 'scheme-78', label: 'Scheme No. 78' },
  { value: 'scheme-114', label: 'Scheme No. 114' },
  { value: 'nakshatra', label: 'Nakshatra' },
  { value: 'brk-business-park', label: 'BRK Business Park' },
  { value: 'winway', label: 'Winway' },
  { value: 'mangal-city', label: 'Mangal City' },
  { value: 'palasia', label: 'Palasia' },
  { value: 'lig', label: 'LIG' },
  { value: 'bhawarkuan', label: 'Bhawarkuan' },
  { value: 'bholaram-ustad-marg', label: 'Bholaram Ustad Marg' },
  { value: 'kajrana', label: 'Kanadia / Kajrana' },
  { value: 'mig', label: 'MIG' },
  { value: 'patnipura', label: 'Patnipura' },
  { value: 'sukliya', label: 'Sukliya' },
  { value: 'other', label: 'Other / nearby — call me' },
];

export const TIFFIN_SLOTS = [
  { value: '08:00-09:00', label: 'Breakfast · 8–9 AM' },
  { value: '12:00-13:00', label: 'Lunch · 12–1 PM' },
  { value: '13:00-14:00', label: 'Lunch · 1–2 PM' },
  { value: '19:00-20:00', label: 'Dinner · 7–8 PM' },
  { value: '20:00-21:00', label: 'Dinner · 8–9 PM' },
];

export const DAYS: { key: 'mon'|'tue'|'wed'|'thu'|'fri'|'sat'|'sun'; short: string; long: string }[] = [
  { key: 'mon', short: 'Mon', long: 'Monday' },
  { key: 'tue', short: 'Tue', long: 'Tuesday' },
  { key: 'wed', short: 'Wed', long: 'Wednesday' },
  { key: 'thu', short: 'Thu', long: 'Thursday' },
  { key: 'fri', short: 'Fri', long: 'Friday' },
  { key: 'sat', short: 'Sat', long: 'Saturday' },
  { key: 'sun', short: 'Sun', long: 'Sunday' },
];
