/**
 * Loads the Razorpay Checkout script once and opens the payment popup.
 * Works entirely on the client. The public key id is passed in from the
 * backend's create-payment response (or NEXT_PUBLIC_RAZORPAY_KEY_ID).
 */
declare global {
  interface Window { Razorpay?: any }
}

let scriptPromise: Promise<boolean> | null = null;

export function loadRazorpay(): Promise<boolean> {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<boolean>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve(true);
    s.onerror = () => resolve(false);
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

/**
 * Opens the Razorpay popup and resolves with the payment result once the
 * user pays. Rejects if the popup is dismissed or the script fails to load.
 */
export function openRazorpay(opts: {
  keyId: string;
  amount: number;         // in paise
  currency: string;
  orderId: string;        // razorpay order id
  name: string;
  description?: string;
  prefill?: { name?: string; email?: string; contact?: string };
  themeColor?: string;
}): Promise<RazorpayResult> {
  return new Promise(async (resolve, reject) => {
    const ok = await loadRazorpay();
    if (!ok || !window.Razorpay) {
      reject(new Error('Could not load payment gateway. Check your connection.'));
      return;
    }
    const rzp = new window.Razorpay({
      key: opts.keyId,
      amount: opts.amount,
      currency: opts.currency,
      order_id: opts.orderId,
      name: opts.name,
      description: opts.description || 'Order payment',
      prefill: opts.prefill || {},
      theme: { color: opts.themeColor || '#0D3B2E' },
      handler: (res: RazorpayResult) => resolve(res),
      modal: {
        ondismiss: () => reject(new Error('Payment cancelled')),
      },
    });
    rzp.on('payment.failed', (resp: any) => {
      reject(new Error(resp?.error?.description || 'Payment failed'));
    });
    rzp.open();
  });
}
