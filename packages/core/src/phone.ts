/** Indian mobile numbers in E.164: +91 followed by 10 digits starting 6–9. */
const E164_IN = /^\+91[6-9]\d{9}$/;

export function isIndianMobile(value: string): boolean {
  return E164_IN.test(value);
}

/** Accepts common inputs ("98765 43210", "09876543210", "+91-9876543210") and returns E.164, or null. */
export function normalizeIndianMobile(input: string): string | null {
  let digits = input.replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.startsWith('0091')) digits = digits.slice(4);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  const e164 = `+91${digits}`;
  return isIndianMobile(e164) ? e164 : null;
}

/** For agent screens and logs: +91 98•••••210 */
export function maskPhone(e164: string): string {
  return e164.length < 8 ? e164 : `${e164.slice(0, 5)}•••••${e164.slice(-3)}`;
}
