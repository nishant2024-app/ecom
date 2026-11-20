/**
 * Courier shipping across India. Zones are configured in admin as pincode prefixes;
 * the longest matching prefix wins. Fees are integer paise.
 */

export interface ShippingZone {
  code: string;
  name: string;
  /** e.g. ['411', '412'] for Pune; '' matches everything (the national fallback). */
  pincodePrefixes: readonly string[];
  feePaise: number;
  /** Order subtotal at or above which shipping is free. null = never free. */
  freeAbovePaise: number | null;
  /** Weight included in the base fee. */
  includedGrams: number;
  /** Extra fee per started kilogram above includedGrams. */
  perExtraKgPaise: number;
  etaMinDays: number;
  etaMaxDays: number;
  serviceable: boolean;
}

export const PINCODE_RE = /^[1-9][0-9]{5}$/;

export function isPincode(value: string): boolean {
  return PINCODE_RE.test(value);
}

/** Longest-prefix match. Returns null when nothing matches. */
export function zoneForPincode<Z extends ShippingZone>(pincode: string, zones: readonly Z[]): Z | null {
  if (!isPincode(pincode)) return null;
  let best: { zone: Z; length: number } | null = null;
  for (const zone of zones) {
    for (const prefix of zone.pincodePrefixes) {
      if (pincode.startsWith(prefix) && (!best || prefix.length > best.length)) best = { zone, length: prefix.length };
    }
  }
  return best?.zone ?? null;
}

export interface ShippingQuote {
  zoneCode: string;
  zoneName: string;
  feePaise: number;
  free: boolean;
  /** How much more to spend for free shipping (0 when already free or never free). */
  remainingForFreePaise: number;
  etaMinDays: number;
  etaMaxDays: number;
}

export class ShippingError extends Error {
  constructor(
    public readonly code: 'INVALID_PINCODE' | 'NOT_SERVICEABLE',
    message: string,
  ) {
    super(message);
  }
}

export function quoteShipping(pincode: string, subtotalPaise: number, weightGrams: number, zones: readonly ShippingZone[]): ShippingQuote {
  if (!isPincode(pincode)) throw new ShippingError('INVALID_PINCODE', 'Enter a valid 6-digit pincode');
  const zone = zoneForPincode(pincode, zones);
  if (!zone || !zone.serviceable) throw new ShippingError('NOT_SERVICEABLE', 'We do not ship to this pincode yet');
  const free = zone.freeAbovePaise !== null && subtotalPaise >= zone.freeAbovePaise;
  const extraKg = Math.max(0, Math.ceil((weightGrams - zone.includedGrams) / 1000));
  const fee = free ? 0 : zone.feePaise + extraKg * zone.perExtraKgPaise;
  return {
    zoneCode: zone.code,
    zoneName: zone.name,
    feePaise: fee,
    free,
    remainingForFreePaise: zone.freeAbovePaise === null || free ? 0 : zone.freeAbovePaise - subtotalPaise,
    etaMinDays: zone.etaMinDays,
    etaMaxDays: zone.etaMaxDays,
  };
}

/** Indian state (or UT) from the first two digits of a pincode. Good enough for addresses and tax place of supply. */
const STATE_BY_PREFIX: [string, string][] = [
  ['11', 'Delhi'], ['12', 'Haryana'], ['13', 'Haryana'], ['14', 'Punjab'], ['15', 'Punjab'], ['16', 'Chandigarh'],
  ['17', 'Himachal Pradesh'], ['18', 'Jammu and Kashmir'], ['19', 'Jammu and Kashmir'], ['20', 'Uttar Pradesh'],
  ['21', 'Uttar Pradesh'], ['22', 'Uttar Pradesh'], ['23', 'Uttar Pradesh'], ['24', 'Uttarakhand'], ['25', 'Uttar Pradesh'],
  ['26', 'Uttarakhand'], ['27', 'Uttar Pradesh'], ['28', 'Uttar Pradesh'], ['30', 'Rajasthan'], ['31', 'Rajasthan'],
  ['32', 'Rajasthan'], ['33', 'Rajasthan'], ['34', 'Rajasthan'], ['36', 'Gujarat'], ['37', 'Gujarat'], ['38', 'Gujarat'],
  ['39', 'Gujarat'], ['40', 'Maharashtra'], ['41', 'Maharashtra'], ['42', 'Maharashtra'], ['43', 'Maharashtra'],
  ['44', 'Maharashtra'], ['45', 'Madhya Pradesh'], ['46', 'Madhya Pradesh'], ['47', 'Madhya Pradesh'], ['48', 'Madhya Pradesh'],
  ['49', 'Chhattisgarh'], ['50', 'Telangana'], ['51', 'Andhra Pradesh'], ['52', 'Andhra Pradesh'], ['53', 'Andhra Pradesh'],
  ['56', 'Karnataka'], ['57', 'Karnataka'], ['58', 'Karnataka'], ['59', 'Karnataka'], ['60', 'Tamil Nadu'], ['61', 'Tamil Nadu'],
  ['62', 'Tamil Nadu'], ['63', 'Tamil Nadu'], ['64', 'Tamil Nadu'], ['67', 'Kerala'], ['68', 'Kerala'], ['69', 'Kerala'],
  ['70', 'West Bengal'], ['71', 'West Bengal'], ['72', 'West Bengal'], ['73', 'West Bengal'], ['74', 'West Bengal'],
  ['75', 'Odisha'], ['76', 'Odisha'], ['77', 'Odisha'], ['78', 'Assam'], ['79', 'North East'], ['80', 'Bihar'], ['81', 'Bihar'],
  ['82', 'Jharkhand'], ['83', 'Jharkhand'], ['84', 'Bihar'], ['85', 'Bihar'],
];
const STATE_MAP = new Map(STATE_BY_PREFIX);

export function stateForPincode(pincode: string): string | null {
  if (!isPincode(pincode)) return null;
  if (pincode.startsWith('403')) return 'Goa';
  if (pincode.startsWith('605')) return 'Puducherry';
  if (pincode.startsWith('744')) return 'Andaman and Nicobar Islands';
  return STATE_MAP.get(pincode.slice(0, 2)) ?? null;
}

/** Calendar-day delivery window from a business date, e.g. "Thu 4 – Sat 6 Dec". */
export function etaRange(from: string, minDays: number, maxDays: number): { earliest: string; latest: string } {
  const add = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);
  return { earliest: add(from, minDays), latest: add(from, maxDays) };
}
