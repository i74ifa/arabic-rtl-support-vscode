/**
 * كل علامات التشكيل والمدّ والتطويل التي يجب تجاهلها أثناء البحث.
 * Arabic combining marks (harakat), Quranic annotation marks, superscript
 * alef, and tatweel/kashida — anything that should NOT affect a match.
 */
const DIACRITICS = "\\u0610-\\u061A\\u064B-\\u065F\\u0670\\u06D6-\\u06ED\\u0640";

/** Matches a single diacritic — used to strip them out of the query itself. */
const DIACRITIC_RE = new RegExp(`[${DIACRITICS}]`, "g");

/** "Optional run of diacritics" inserted after every base letter. */
const OPT_DIACRITICS = `[${DIACRITICS}]*`;

/**
 * أحرف يُعامل بعضها كبعض أثناء البحث (همزات الألف، الواو، الياء، التاء المربوطة...).
 * Equivalence classes: any character in a group matches any other in it.
 */
const EQUIVALENCE_GROUPS = [
  "اأإآٱء", // ا أ إ آ ٱ ء  (alef + hamza forms)
  "وؤۇ", // و ؤ ۇ        (waw forms)
  "يىئی", // ي ى ئ ی     (ya forms)
  "ةه", // ة ه          (ta marbuta / ha)
  "كک", // ك ک          (arabic kaf / keheh)
];

/** Build a quick lookup from a single char to its character-class string. */
const CLASS_BY_CHAR = new Map<string, string>();
for (const group of EQUIVALENCE_GROUPS) {
  const cls = `[${group}]`;
  for (const ch of group) {
    CLASS_BY_CHAR.set(ch, cls);
  }
}

/** Escape regex metacharacters in non-Arabic input (latin, spaces, digits). */
function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * تحويل عبارة البحث إلى ريجيكس يتجاهل التشكيل وصور الهمزة.
 *
 * "أيفون" -> matches "آيفون", "أَيْفُون", "ايفون", "إيفون" ... etc.
 *
 * Each base letter becomes its equivalence class, and an optional run of
 * diacritics is allowed after every letter so harakat in the file are ignored.
 */
export function toDiacriticInsensitiveRegex(query: string): string {
  const stripped = query.replace(DIACRITIC_RE, "");

  return [...stripped]
    .map((ch) => CLASS_BY_CHAR.get(ch) ?? escapeRegex(ch))
    .join(OPT_DIACRITICS);
}
