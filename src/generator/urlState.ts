import { parseModel, type PyramidModel } from './model';
import { DEFAULT_STYLE_ID, isValidStyleId } from './styles';

const HASH_PARAM = 'p';
const STYLE_PARAM = 's';

/** Encode a model as URL-safe base64 of its JSON (UTF-8 safe). */
export function encodeModel(model: PyramidModel): string {
    const json = JSON.stringify(model);
    const bytes = new TextEncoder().encode(json);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

/** Decode a base64url string back into a validated model, or null when invalid. */
export function decodeModel(encoded: string): PyramidModel | null {
    try {
        let base64 = encoded.replaceAll('-', '+').replaceAll('_', '/');
        while (base64.length % 4 !== 0) {
            base64 += '=';
        }
        const binary = atob(base64);
        const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
        const json = new TextDecoder().decode(bytes);
        return parseModel(JSON.parse(json));
    } catch {
        return null;
    }
}

export interface HashReadResult {
    /** The decoded model, or null when absent/invalid. */
    model: PyramidModel | null;
    /** Whether the hash contained pyramid data at all (even if invalid). */
    present: boolean;
    /** The style id from `#s=`, or null when absent/unknown (viewer's preference applies). */
    styleId: string | null;
}

export function readHash(): HashReadResult {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const value = params.get(HASH_PARAM);
    const styleParam = params.get(STYLE_PARAM);
    const styleId = isValidStyleId(styleParam) ? styleParam : null;
    if (value === null || value === '') {
        return { model: null, present: false, styleId };
    }
    return { model: decodeModel(value), present: true, styleId };
}

/**
 * Write model (+ non-default style id) into the URL hash without adding a history entry.
 * Returns the encoded model string. The `s` param is omitted for the default style so
 * classic links stay as short as they were before styles existed.
 */
export function writeStateToHash(model: PyramidModel, styleId: string): string {
    const encoded = encodeModel(model);
    const params = new URLSearchParams();
    params.set(HASH_PARAM, encoded);
    if (styleId !== DEFAULT_STYLE_ID) {
        params.set(STYLE_PARAM, styleId);
    }
    window.history.replaceState(null, '', `#${params.toString()}`);
    return encoded;
}
