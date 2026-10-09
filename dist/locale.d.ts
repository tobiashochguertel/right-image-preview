import { LocaleStrings } from './localeTypes.js';
export type { LocaleStrings } from './localeTypes.js';
/**
 * Resolve a {@link LocaleStrings} object from a BCP 47 language tag.
 *
 * Matching is done on the primary subtag only (`zh-CN` → `zh`).
 * Falls back to English for any unrecognised locale.
 *
 * @param language – e.g. `"en"`, `"en-US"`, `"zh"`, `"zh-CN"`
 */
export declare function resolveStrings(language?: string): LocaleStrings;
/**
 * Merge caller-supplied overrides on top of the base locale resolved from `language`.
 *
 * Any field present in `overrides` replaces the corresponding built-in string;
 * omitted fields fall back to the base locale. Returns the base locale object
 * unchanged when `overrides` is `undefined` or empty.
 */
export declare function mergeStrings(base: LocaleStrings, overrides?: Partial<LocaleStrings>): LocaleStrings;
