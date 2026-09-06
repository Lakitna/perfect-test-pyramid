import { FONT_FACES } from './fonts.generated';
import type { PyramidStyle } from './styles/types';

/**
 * Font loading and export embedding. All bundled faces are injected once as @font-face
 * rules with data-URI sources; exports inline the same rules so SVG/PNG leave the page
 * with the style's real typefaces, offline and untainted.
 */

export function fontFaceCss(keys: readonly (readonly [string, number])[]): string {
    const parts: string[] = [];
    for (const [family, weight] of keys) {
        const face = FONT_FACES.find((f) => f.family === family && f.weight === weight);
        if (face === undefined) continue;
        parts.push(
            `@font-face { font-family: '${family}'; font-style: normal; font-weight: ${weight}; ` +
                `src: url(${face.dataUri}) format('woff2'); }`
        );
    }
    return parts.join('\n');
}

/** Inject @font-face rules for every bundled face (once, at boot). */
export function injectFontFaces(): void {
    const element = document.createElement('style');
    element.id = 'bundled-fonts';
    element.textContent = fontFaceCss(FONT_FACES.map((face) => [face.family, face.weight]));
    document.head.appendChild(element);
}

/**
 * Wait for a style's fonts to be ready. `textWidth()` measures with canvas metrics, so
 * wrapping and chip sizing must not run before the real typefaces are available.
 */
export async function loadStyleFonts(style: PyramidStyle): Promise<void> {
    const sample = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,:;!?()&/%-—’';
    await Promise.all(
        style.typography.fonts.map(
            ([family, weight]) =>
                document.fonts.load(`${weight} 16px "${family}"`, sample).catch(() => undefined) // offline/failed: fallback stack still renders
        )
    );
}
