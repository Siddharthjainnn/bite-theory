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

export const TIFFIN_PLAN = {
  key: 'monthly-1750',
  label: 'Daily Tiffin Plan',
  price: 1750,
  duration: 'per month',
  /* One-time payment for the month — no auto-renewal, no saved card. Said
     plainly on both the home tile and /tiffin, because "subscription" makes
     people assume recurring billing and hesitate. */
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
