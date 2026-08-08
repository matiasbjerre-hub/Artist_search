/**
 * Danish-aware name matching.
 *
 * People routinely type "Soren" for "Søren" or "Bogelund" for "Bøgelund", so a
 * name is reduced to two folded forms — æ/ø/å as digraphs ("ae"/"oe"/"aa") and
 * as plain vowels ("a"/"o"/"a") — and a match on either form counts.
 */

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/** The folded forms a name should be compared through. */
export function foldedVariants(value: string): string[] {
  const lower = (value ?? "").toLowerCase();
  const digraph = lower
    .replaceAll("æ", "ae")
    .replaceAll("ø", "oe")
    .replaceAll("å", "aa");
  const plain = lower
    .replaceAll("æ", "a")
    .replaceAll("ø", "o")
    .replaceAll("å", "a");
  return [
    collapse(stripDiacritics(digraph)),
    collapse(stripDiacritics(plain)),
  ];
}

/** True when `query` appears inside `target` under any folding. */
export function nameMatches(query: string, target: string): boolean {
  const queries = foldedVariants(query).filter(Boolean);
  const targets = foldedVariants(target).filter(Boolean);
  return queries.some((q) => targets.some((t) => t.includes(q)));
}
