/**
 * Style registry. Adding a visual language = one new file + one entry here.
 * Ids are public API: they live in shared URLs (`#s=`) and localStorage — never rename.
 */
import { classicStyle } from './classic';
import { contrastStyle } from './contrast';
import { deStijlStyle } from './de-stijl';
import { draftsmanStyle } from './draftsman';
import { toonStyle } from './toon';
import { unicornBarfStyle } from './unicorn-barf';
import type { PyramidStyle } from './types';

export type { PyramidStyle } from './types';
export { classicStyle };

export const DEFAULT_STYLE_ID = 'classic';

export const STYLES: PyramidStyle[] = [
    classicStyle,
    draftsmanStyle,
    contrastStyle,
    toonStyle,
    deStijlStyle,
    unicornBarfStyle,
];

export function isValidStyleId(id: string | null | undefined): id is string {
    return typeof id === 'string' && STYLES.some((style) => style.id === id);
}

/** Resolve a style by id, falling back to classic for unknown/absent ids (forward-compat). */
export function getStyle(id: string | null | undefined): PyramidStyle {
    return STYLES.find((style) => style.id === id) ?? classicStyle;
}
