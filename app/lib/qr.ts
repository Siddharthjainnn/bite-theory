/**
 * QR helpers for invoices. Uses the `qrcode` library (npm i qrcode) which is a
 * correct, battle-tested encoder — do NOT hand-roll QR encoding, the format-info
 * and masking are easy to get subtly wrong (a QR that "looks right" but won't
 * scan is worse than none on a printed receipt).
 *
 * Returns an inline SVG string of black modules on white — prints crisp on a
 * thermal head with no image loading and no network call.
 */
import QRCode from 'qrcode';

export interface QrOptions {
  /** module pixel size is derived from `scale`; 3–5 reads well on 80mm thermal */
  scale?: number;
  margin?: number;
}

/** Async: get a scannable QR as an inline SVG string. '' on failure. */
export async function qrSvg(text: string, opts: QrOptions = {}): Promise<string> {
  if (!text) return '';
  try {
    return await QRCode.toString(text, {
      type: 'svg',
      errorCorrectionLevel: 'M',
      margin: opts.margin ?? 2,
      scale: opts.scale ?? 4,
      color: { dark: '#000000', light: '#ffffff' },
    });
  } catch {
    return '';
  }
}

/**
 * Build the "come back and reorder" URL for an order. Adjust the path to match
 * your app's actual reorder route.
 */
export function reorderUrl(baseUrl: string, orderNumber: string): string {
  const base = (baseUrl || '').replace(/\/+$/, '');
  return `${base}/reorder?o=${encodeURIComponent(orderNumber)}`;
}
