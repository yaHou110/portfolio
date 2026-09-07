/**
 * Normalize Persian (۰-۹) and Arabic (٠-٩) digits to Latin (0-9).
 * Used for national ID, phone and center-ID inputs so the server only ever
 * sees ASCII digits.
 */
export function toLatinDigits(s: string): string {
  return s
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}
