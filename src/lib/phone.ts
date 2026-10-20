// Vietnamese mobile numbers: stored as 0xxxxxxxxx (10 digits). Accepts +84 / 84 prefixes, spaces, dots, dashes.
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/[\s.\-()]/g, "");
  if (digits.startsWith("+84")) digits = "0" + digits.slice(3);
  else if (digits.startsWith("84") && digits.length === 11) digits = "0" + digits.slice(2);
  return /^0\d{9}$/.test(digits) ? digits : null;
}
