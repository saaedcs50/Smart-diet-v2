/**
 * Arabic-aware search helpers shared by the patient body tab and lab tracker.
 * Matching is accent-insensitive and handles common Arabic letter variants.
 */
export function normalizeBodySearchQuery(value: string): string {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ar');
}

export function matchesBodySearch(
  query: string,
  fields: Array<string | number | null | undefined>,
): boolean {
  const normalizedQuery = normalizeBodySearchQuery(query);
  if (!normalizedQuery) return true;
  return fields.some((field) =>
    normalizeBodySearchQuery(String(field ?? '')).includes(normalizedQuery),
  );
}
