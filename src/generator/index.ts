/*
Dear reader,

This code was written with AI. It was optimized for implementation speed.
Be careful to keep your sanity while reading this code.

You have been warned.

Lakitna
*/

import { createEditor, type PyramidEditor } from './editor';
import { downloadPng, downloadSvg } from './export';
import { injectFontFaces, loadStyleFonts } from './fonts';
import { cloneModel, parseModel, PRESETS, type PyramidModel } from './model';
import {
    applyChromeVars,
    getActiveStyle,
    getActiveStyleId,
    readStoredStyleId,
    setActiveStyle,
} from './styleState';
import { DEFAULT_STYLE_ID, STYLES } from './styles';
import { validateAllStyles } from './styles/validate';
import { initTheme, isDarkMode, toggleTheme } from './theme';
import { encodeModel, readHash, writeStateToHash } from './urlState';

initTheme();

const DEFAULT_MODEL = PRESETS[2];
const URL_SYNC_DELAY_MS = 250;
const HISTORY_LIMIT = 100;
const INVALID_HASH_MESSAGE =
    'The pyramid data in the URL is invalid or from an incompatible version. The default pyramid was loaded instead.';

function mustFind<T extends HTMLElement>(id: string): T {
    const element = document.getElementById(id);
    if (element === null) {
        throw new Error(`Required element #${id} is missing from the page`);
    }
    return element as T;
}

const pyramidContainer = mustFind<HTMLElement>('pyramid-container');
const editorToolbar = mustFind<HTMLElement>('editor-toolbar');
const warningBanner = mustFind<HTMLElement>('warning');
const copyButton = mustFind<HTMLButtonElement>('btn-copy-link');
const exportSvgButton = mustFind<HTMLButtonElement>('btn-export-svg');
const exportPngButton = mustFind<HTMLButtonElement>('btn-export-png');
const shareButton = mustFind<HTMLButtonElement>('btn-share');
const shareMenu = mustFind<HTMLElement>('share-menu');
const themeButton = mustFind<HTMLButtonElement>('btn-theme');
const styleButton = mustFind<HTMLButtonElement>('btn-style');
const styleMenu = mustFind<HTMLElement>('style-menu');

let model: PyramidModel;
let currentEncoded = '';
let warningMessage = '';
let urlTimer: number | undefined;

// --- Undo/redo history -----------------------------------------------------
const history: string[] = [];
let historyIndex = -1;

function pushHistory(): void {
    const snapshot = JSON.stringify(model);
    if (history[historyIndex] === snapshot) return;
    history.splice(historyIndex + 1);
    history.push(snapshot);
    if (history.length > HISTORY_LIMIT) history.shift();
    historyIndex = history.length - 1;
}

function restoreHistory(index: number): void {
    const parsed = parseModel(JSON.parse(history[index]));
    if (parsed === null) return;
    historyIndex = index;
    model = parsed;
    render();
}

function undo(): void {
    if (historyIndex > 0) restoreHistory(historyIndex - 1);
}

function redo(): void {
    if (historyIndex < history.length - 1) restoreHistory(historyIndex + 1);
}

// --- Editor ----------------------------------------------------------------
const editor: PyramidEditor = createEditor(editorToolbar, pyramidContainer, {
    getModel: () => model,
    onCommit: () => {
        pushHistory();
        render();
    },
    onLive: () => syncUrl(),
    undo,
    redo,
    canUndo: () => historyIndex > 0,
    canRedo: () => historyIndex < history.length - 1,
});

function syncUrl(immediate = false): void {
    if (urlTimer !== undefined) {
        window.clearTimeout(urlTimer);
        urlTimer = undefined;
    }
    if (immediate) {
        currentEncoded = writeStateToHash(model, getActiveStyleId());
        return;
    }
    urlTimer = window.setTimeout(() => {
        urlTimer = undefined;
        currentEncoded = writeStateToHash(model, getActiveStyleId());
    }, URL_SYNC_DELAY_MS);
}

function render(): void {
    warningBanner.hidden = warningMessage === '';
    warningBanner.textContent = warningMessage;

    updateThemeButton();
    renderStyleMenu();
    editor.render();
    syncUrl();
}

function updateThemeButton(): void {
    const dark = isDarkMode();
    themeButton.textContent = dark ? '☀️' : '🌙';
    themeButton.title = dark ? 'Switch to light mode' : 'Switch to dark mode';
}

themeButton.addEventListener('click', () => {
    toggleTheme();
    applyChromeVars(); // the active style's chrome tokens follow the theme
    updateThemeButton();
    editor.render(); // re-render the canvas with the new palette
});

// --- Style selector ------------------------------------------------------------

function setStyleMenuOpen(open: boolean): void {
    styleMenu.hidden = !open;
    styleButton.setAttribute('aria-expanded', String(open));
}

function renderStyleMenu(): void {
    const activeId = getActiveStyleId();
    const dark = isDarkMode();
    styleMenu.textContent = '';
    for (const style of STYLES) {
        const item = document.createElement('button');
        item.type = 'button';
        if (style.id === activeId) item.classList.add('active');
        const swatches = document.createElement('span');
        swatches.className = 'style-swatches';
        const palette = dark ? style.layers.palette.dark : style.layers.palette.light;
        for (const color of palette.slice(0, 4)) {
            const swatch = document.createElement('span');
            swatch.className = 'style-swatch';
            swatch.style.background = color;
            swatches.appendChild(swatch);
        }
        const name = document.createElement('span');
        name.textContent = style.name;
        item.append(swatches, name);
        item.addEventListener('click', () => {
            const applied = setActiveStyle(style.id);
            setStyleMenuOpen(false);
            render();
            // Re-render once the new style's fonts are confirmed loaded (metrics!).
            void loadStyleFonts(applied).then(() => render());
        });
        styleMenu.appendChild(item);
    }
    styleButton.textContent = `Style: ${getActiveStyle().name} ▾`;
}

styleButton.addEventListener('click', () => {
    setStyleMenuOpen(!!styleMenu.hidden);
});

function loadFromHash(): void {
    const hash = readHash();
    if (hash.styleId !== null) {
        // A link carries its author's style. It wins for this page load but never
        // overwrites the viewer's own stored preference.
        setActiveStyle(hash.styleId, false);
    }
    if (hash.model !== null) {
        model = hash.model;
        warningMessage = '';
    } else if (hash.present) {
        model = cloneModel(DEFAULT_MODEL.data);
        warningMessage = INVALID_HASH_MESSAGE;
    } else {
        model = cloneModel(DEFAULT_MODEL.data);
        warningMessage = '';
    }
    history.length = 0;
    historyIndex = -1;
    pushHistory();
    render();
}

async function copyLink(): Promise<void> {
    syncUrl(true);
    try {
        await navigator.clipboard.writeText(window.location.href);
        flashButton(copyButton, 'Copied!');
    } catch {
        flashButton(copyButton, 'Copy failed');
    }
}

function flashButton(button: HTMLButtonElement, message: string): void {
    const original = button.textContent;
    button.textContent = message;
    button.disabled = true;
    window.setTimeout(() => {
        button.textContent = original;
        button.disabled = false;
    }, 1200);
}

function setShareMenuOpen(open: boolean): void {
    shareMenu.hidden = !open;
    shareButton.setAttribute('aria-expanded', String(open));
}

shareButton.addEventListener('click', () => {
    setShareMenuOpen(!!shareMenu.hidden);
});

document.addEventListener('pointerdown', (event: PointerEvent) => {
    const target = event.target;
    const inside = (selector: string): boolean =>
        target instanceof Element && target.closest(selector) !== null;
    if (!shareMenu.hidden && !inside('.share-wrap')) {
        setShareMenuOpen(false);
    }
    if (!styleMenu.hidden && !inside('.style-wrap')) {
        setStyleMenuOpen(false);
    }
});

copyButton.addEventListener('click', () => {
    void copyLink().then(() => setShareMenuOpen(false));
});

exportSvgButton.addEventListener('click', () => {
    downloadSvg(model);
    setShareMenuOpen(false);
});

exportPngButton.addEventListener('click', () => {
    exportPngButton.disabled = true;
    setShareMenuOpen(false);
    downloadPng(model)
        .catch((error: unknown) => {
            warningMessage = `PNG export failed: ${String(error)}`;
            warningBanner.hidden = false;
            warningBanner.textContent = warningMessage;
        })
        .finally(() => {
            exportPngButton.disabled = false;
        });
});

// --- Keyboard shortcuts (WYSIWYG conventions) -------------------------------
document.addEventListener('keydown', (event: KeyboardEvent) => {
    const target = event.target as HTMLElement | null;
    const typing =
        target !== null &&
        (target instanceof HTMLInputElement ||
            target instanceof HTMLTextAreaElement ||
            target.isContentEditable);
    if (typing) {
        return;
    }
    const key = event.key.toLowerCase();
    if ((event.ctrlKey || event.metaKey) && key === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
    } else if ((event.ctrlKey || event.metaKey) && key === 'y') {
        event.preventDefault();
        redo();
    } else if (key === 'delete' || key === 'backspace') {
        if (editor.deleteSelected()) {
            event.preventDefault();
        }
    } else if (key === 'escape') {
        if (!styleMenu.hidden) {
            setStyleMenuOpen(false);
        } else if (!shareMenu.hidden) {
            setShareMenuOpen(false);
        } else {
            editor.clearSelection();
        }
    }
});

window.addEventListener('hashchange', () => {
    const hash = readHash();
    const encoded = hash.model === null ? '' : encodeModel(hash.model);
    const styleChanged = hash.styleId !== null && hash.styleId !== getActiveStyleId();
    if (encoded === currentEncoded && !styleChanged) {
        return; // our own URL update or an equivalent hash
    }
    loadFromHash();
});

// --- Boot ----------------------------------------------------------------------

injectFontFaces();
// Viewer's stored preference first; a style in the URL overrides it in loadFromHash().
setActiveStyle(readStoredStyleId() ?? DEFAULT_STYLE_ID, false);

async function boot(): Promise<void> {
    if (window.location.search.includes('validate-styles')) {
        const issues = validateAllStyles();
        console[issues.length === 0 ? 'log' : 'warn'](
            issues.length === 0 ? 'style validation: all styles pass' : issues
        );
    }
    // textWidth() measures with canvas metrics: gate the first render on the real fonts.
    await loadStyleFonts(getActiveStyle());
    loadFromHash();
    // Warm every style's fonts so switching renders with correct metrics immediately.
    void Promise.all(STYLES.map((style) => loadStyleFonts(style)));
}

void boot();
