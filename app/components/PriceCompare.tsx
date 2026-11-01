'use client';

import { money } from '../lib/bite';
import type { PriceComparison } from '../lib/storefront';

/** Zomato | Swiggy | Toing | Order here — then "You save up to ₹X by ordering here". */
export default function PriceCompare({ cmp, name }: { cmp: PriceComparison; name: string }) {
  return (
    <>
      <div
        className="sf-cmp"
        role="group"
        aria-label={`${name}: ${cmp.apps.map((a) => `${a.name} ${money(a.price)}`).join(', ')}, here ${money(cmp.ours)}`}
        style={{ gridTemplateColumns: `repeat(${cmp.apps.length + 1}, minmax(0, 1fr))` }}
      >
        {cmp.apps.map((a) => (
          <div key={a.key}>
            <span>{a.name}</span>
            <b>{money(a.price)}</b>
          </div>
        ))}
        <div className="ours">
          <span>Order here</span>
          <b>{money(cmp.ours)}</b>
        </div>
      </div>
      <div className="sf-save">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1F7A3A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="9" />
          <path d="M8 12l3 3 5-6" />
        </svg>
        You save up to {money(cmp.saveUpTo)} by ordering here
      </div>
    </>
  );
}
