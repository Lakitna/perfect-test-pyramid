import { parseModel, type PyramidModel } from './model';

const HASH_PARAM = 'p';

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
}

export function readHash(): HashReadResult {
    const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const value = params.get(HASH_PARAM);
    if (value === null || value === '') {
        return { model: null, present: false };
    }
    return { model: decodeModel(value), present: true };
}

/** Write the model into the URL hash without adding a history entry. Returns the encoded string. */
export function writeModelToHash(model: PyramidModel): string {
    const encoded = encodeModel(model);
    window.history.replaceState(null, '', `#${HASH_PARAM}=${encoded}`);
    return encoded;
}
