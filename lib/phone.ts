// Canonical key for matching "the same phone number" across different formats
// (local vs. international, with/without +, spaces, dashes, leading 00, etc.).
// Stripping to digits-only isn't enough: 01001234567 (local) and 201001234567
// (same number, country code instead of the leading 0) strip to different-length
// strings. The last 9 digits are the actual subscriber number in both Egyptian
// and UAE mobile formats regardless of how the country code/trunk prefix was
// written, so they're a reliable dedup key.
export function normalizePhoneKey(phone: string): string {
  return phone.replace(/\D/g, '').slice(-9)
}
