/**
 * Uzbek/Russian Cyrillic → Latin folding for search normalization. Uzbek is written in BOTH
 * Latin and Cyrillic, and buyers mix scripts freely — so a Cyrillic query ("дизайн") must reach
 * Latin content/synonyms ("dizayn"). Folding BOTH the query and the taxonomy synonyms to a
 * common Latin form bridges the scripts. Latin input passes through unchanged (no regression);
 * only Cyrillic characters are mapped. Operates on already-lowercased text.
 */
const CYR_TO_LAT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", ғ: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "y", к: "k", қ: "q", л: "l", м: "m", н: "n", о: "o", ў: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ф: "f", х: "x", ҳ: "h", ц: "ts", ч: "ch", ш: "sh",
  щ: "sh", ъ: "", ы: "i", ь: "", э: "e", ю: "yu", я: "ya",
};

/** Map Cyrillic characters to their Latin equivalent; leave Latin (and everything else) as-is. */
export function foldToLatin(lowercased: string): string {
  let out = "";
  for (const ch of lowercased) out += ch in CYR_TO_LAT ? CYR_TO_LAT[ch] : ch;
  return out;
}
