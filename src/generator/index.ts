/*
Dear reader,

This code was written with AI. It was optimized for implementation speed.
Be careful to keep your sanity while reading this code.

You have been warned.

Lakitna
*/

import { createEditor, type PyramidEditor } from './editor';
import { buildSvgString, exportPng, exportSvg, measurePngSheet, renderPngPreview } from './export';
import { ensureFontFaces, loadStyleFonts } from './fonts';
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
const pngDialog = mustFind<HTMLDialogElement>('png-dialog');
const pngFilenameInput = mustFind<HTMLInputElement>('png-filename');
const pngThemeLightRadio = mustFind<HTMLInputElement>('png-theme-light');
const pngThemeDarkRadio = mustFind<HTMLInputElement>('png-theme-dark');
const pngWidthInput = mustFind<HTMLInputElement>('png-width');
const pngSizeHint = mustFind<HTMLElement>('png-size-hint');
const pngPreviewImg = mustFind<HTMLImageElement>('png-preview-img');
const pngTransparentInput = mustFind<HTMLInputElement>('png-transparent');
const pngCancelButton = mustFind<HTMLButtonElement>('png-cancel');
const pngDownloadButton = mustFind<HTMLButtonElement>('png-download');
const svgDialog = mustFind<HTMLDialogElement>('svg-dialog');
const svgFilenameInput = mustFind<HTMLInputElement>('svg-filename');
const svgThemeLightRadio = mustFind<HTMLInputElement>('svg-theme-light');
const svgThemeDarkRadio = mustFind<HTMLInputElement>('svg-theme-dark');
const svgTransparentInput = mustFind<HTMLInputElement>('svg-transparent');
const svgPreviewImg = mustFind<HTMLImageElement>('svg-preview-img');
const svgCancelButton = mustFind<HTMLButtonElement>('svg-cancel');
const svgDownloadButton = mustFind<HTMLButtonElement>('svg-download');

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

async function loadFromHash(): Promise<void> {
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
    // textWidth() measures with canvas metrics: gate the render on the real fonts of
    // the style we are about to draw — and only that style's (fonts load lazily).
    await loadStyleFonts(getActiveStyle());
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

// --- PNG export dialog ------------------------------------------------------

// Clicking the backdrop dismisses a dialog, like its Cancel button. The dialog
// element itself is only the click target when the click lands outside its content.
function closeOnBackdrop(dialog: HTMLDialogElement): void {
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) {
            dialog.close();
        }
    });
}

// Settings persist in localStorage (filename, color mode, transparency, width) so
// the dialog opens exactly as the user left it, even across reloads.
const PNG_SETTINGS_KEY = 'test-pyramid-png-export';
const PNG_MIN_WIDTH = 120;
const PNG_MAX_WIDTH = 8000;
const PNG_DEFAULT_WIDTH = 1500;

interface PngSettings {
    filename: string;
    width: number;
    transparent: boolean;
    theme: 'light' | 'dark';
}

function clampPngWidth(value: number): number {
    if (!Number.isFinite(value)) {
        return PNG_DEFAULT_WIDTH;
    }
    return Math.min(PNG_MAX_WIDTH, Math.max(PNG_MIN_WIDTH, Math.round(value)));
}

function defaultPngSettings(): PngSettings {
    return {
        filename: 'test-pyramid.png',
        width: PNG_DEFAULT_WIDTH,
        transparent: false,
        theme: isDarkMode() ? 'dark' : 'light',
    };
}

function readPngSettings(): PngSettings {
    const fallback = defaultPngSettings();
    try {
        const raw = window.localStorage.getItem(PNG_SETTINGS_KEY);
        if (raw === null) {
            return fallback;
        }
        const stored = JSON.parse(raw) as Partial<PngSettings>;
        return {
            filename:
                typeof stored.filename === 'string' && stored.filename.trim() !== ''
                    ? stored.filename
                    : fallback.filename,
            width:
                typeof stored.width === 'number' &&
                stored.width >= PNG_MIN_WIDTH &&
                stored.width <= PNG_MAX_WIDTH
                    ? clampPngWidth(stored.width)
                    : fallback.width,
            transparent: stored.transparent === true,
            theme:
                stored.theme === 'dark' || stored.theme === 'light' ? stored.theme : fallback.theme,
        };
    } catch {
        return fallback;
    }
}

function writePngSettings(settings: PngSettings): void {
    try {
        window.localStorage.setItem(PNG_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Private mode or quota — the dialog still works, just forgetful.
    }
}

let pngSettings = readPngSettings();

function normalizeFilename(raw: string, fallback: string, extension: string): string {
    const cleaned = raw.trim().replace(/[\\/:*?"<>|]/g, '');
    if (cleaned === '') {
        return fallback;
    }
    const suffix = `.${extension}`;
    return cleaned.toLowerCase().endsWith(suffix) ? cleaned : cleaned + suffix;
}

/** Sheet size at scale 1 for the dialog's current color mode and transparency. */
function currentPngSheet(): { width: number; height: number } {
    return measurePngSheet(model, {
        dark: pngThemeDarkRadio.checked,
        transparent: pngTransparentInput.checked,
    });
}

/** Rasterization scale that makes the sheet exactly `width` pixels wide. */
function pngExportScale(width: number): number {
    return Math.min(10, Math.max(0.1, width / currentPngSheet().width));
}

function updatePngSizeHint(): void {
    const sheet = currentPngSheet();
    const width = clampPngWidth(Number(pngWidthInput.value));
    const height = Math.round((width * sheet.height) / sheet.width);
    pngSizeHint.textContent = `Exports at about ${width} × ${height} px`;
}

// --- Live preview -------------------------------------------------------------

let previewTimer: number | undefined;
let previewToken = 0;

function schedulePngPreview(): void {
    window.clearTimeout(previewTimer);
    previewTimer = window.setTimeout(() => void updatePngPreview(), 150);
}

async function updatePngPreview(): Promise<void> {
    const token = ++previewToken;
    const dark = pngThemeDarkRadio.checked;
    const transparent = pngTransparentInput.checked;
    try {
        const blob = await renderPngPreview(model, { dark, transparent });
        if (token !== previewToken || !pngDialog.open) {
            return;
        }
        const url = URL.createObjectURL(blob);
        if (pngPreviewImg.dataset.url !== undefined) {
            URL.revokeObjectURL(pngPreviewImg.dataset.url);
        }
        pngPreviewImg.dataset.url = url;
        pngPreviewImg.src = url;
        pngPreviewImg.hidden = false;
    } catch {
        if (token === previewToken) {
            pngSizeHint.textContent = 'Preview unavailable — the download will still be attempted.';
        }
    }
}

// --- Dialog wiring --------------------------------------------------------------

function applyPngSettingsToUi(): void {
    pngFilenameInput.value = pngSettings.filename;
    pngWidthInput.value = String(pngSettings.width);
    pngTransparentInput.checked = pngSettings.transparent;
    (pngSettings.theme === 'dark' ? pngThemeDarkRadio : pngThemeLightRadio).checked = true;
}

function openPngDialog(): void {
    applyPngSettingsToUi();
    pngDialog.showModal();
    pngFilenameInput.focus();
    pngFilenameInput.select();
    updatePngSizeHint();
    schedulePngPreview();
}

exportPngButton.addEventListener('click', () => {
    setShareMenuOpen(false);
    openPngDialog();
});

pngCancelButton.addEventListener('click', () => {
    pngDialog.close();
});

closeOnBackdrop(pngDialog);

for (const control of [pngTransparentInput, pngThemeLightRadio, pngThemeDarkRadio]) {
    control.addEventListener('change', () => {
        schedulePngPreview();
    });
}

// A width change only rescales the sheet — the preview image itself is identical,
// so just the dimension hint is refreshed.
pngWidthInput.addEventListener('input', updatePngSizeHint);

pngDownloadButton.addEventListener('click', () => {
    const settings: PngSettings = {
        filename: normalizeFilename(pngFilenameInput.value, 'test-pyramid.png', 'png'),
        width: clampPngWidth(Number(pngWidthInput.value)),
        transparent: pngTransparentInput.checked,
        theme: pngThemeDarkRadio.checked ? 'dark' : 'light',
    };
    pngSettings = settings;
    writePngSettings(settings);
    const scale = pngExportScale(settings.width);
    pngDialog.close();
    exportPng(model, {
        filename: settings.filename,
        dark: settings.theme === 'dark',
        scale,
        transparent: settings.transparent,
    }).catch((error: unknown) => {
        warningMessage = `PNG export failed: ${String(error)}`;
        warningBanner.hidden = false;
        warningBanner.textContent = warningMessage;
    });
});

// --- SVG export dialog --------------------------------------------------------

const SVG_SETTINGS_KEY = 'test-pyramid-svg-export';

interface SvgSettings {
    filename: string;
    transparent: boolean;
    theme: 'light' | 'dark';
}

function defaultSvgSettings(): SvgSettings {
    return {
        filename: 'test-pyramid.svg',
        transparent: false,
        theme: isDarkMode() ? 'dark' : 'light',
    };
}

function readSvgSettings(): SvgSettings {
    const fallback = defaultSvgSettings();
    try {
        const raw = window.localStorage.getItem(SVG_SETTINGS_KEY);
        if (raw === null) {
            return fallback;
        }
        const stored = JSON.parse(raw) as Partial<SvgSettings>;
        return {
            filename:
                typeof stored.filename === 'string' && stored.filename.trim() !== ''
                    ? stored.filename
                    : fallback.filename,
            transparent: stored.transparent === true,
            theme:
                stored.theme === 'dark' || stored.theme === 'light' ? stored.theme : fallback.theme,
        };
    } catch {
        return fallback;
    }
}

function writeSvgSettings(settings: SvgSettings): void {
    try {
        window.localStorage.setItem(SVG_SETTINGS_KEY, JSON.stringify(settings));
    } catch {
        // Private mode or quota — the dialog still works, just forgetful.
    }
}

let svgSettings = readSvgSettings();

// SVG is vector output: no rasterization step, so the preview is the exact export
// bytes wrapped in a blob URL. Font bytes are fetched on demand, so the rebuild is
// async; a token guard drops results from settings changes that were superseded.
let svgPreviewToken = 0;

async function updateSvgPreview(): Promise<void> {
    const token = ++svgPreviewToken;
    try {
        const svgString = await buildSvgString(model, {
            dark: svgThemeDarkRadio.checked,
            transparent: svgTransparentInput.checked,
        });
        if (token !== svgPreviewToken || !svgDialog.open) {
            return; // a newer change (or a closed dialog) won
        }
        const url = URL.createObjectURL(
            new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' })
        );
        if (svgPreviewImg.dataset.url !== undefined) {
            URL.revokeObjectURL(svgPreviewImg.dataset.url);
        }
        svgPreviewImg.dataset.url = url;
        svgPreviewImg.src = url;
        svgPreviewImg.hidden = false;
    } catch {
        if (token === svgPreviewToken) {
            svgPreviewImg.hidden = true;
        }
    }
}

function openSvgDialog(): void {
    svgFilenameInput.value = svgSettings.filename;
    svgTransparentInput.checked = svgSettings.transparent;
    (svgSettings.theme === 'dark' ? svgThemeDarkRadio : svgThemeLightRadio).checked = true;
    svgDialog.showModal();
    svgFilenameInput.focus();
    svgFilenameInput.select();
    void updateSvgPreview();
}

exportSvgButton.addEventListener('click', () => {
    setShareMenuOpen(false);
    openSvgDialog();
});

svgCancelButton.addEventListener('click', () => {
    svgDialog.close();
});

closeOnBackdrop(svgDialog);

for (const control of [svgTransparentInput, svgThemeLightRadio, svgThemeDarkRadio]) {
    control.addEventListener('change', () => void updateSvgPreview());
}

svgDownloadButton.addEventListener('click', () => {
    const settings: SvgSettings = {
        filename: normalizeFilename(svgFilenameInput.value, 'test-pyramid.svg', 'svg'),
        transparent: svgTransparentInput.checked,
        theme: svgThemeDarkRadio.checked ? 'dark' : 'light',
    };
    svgSettings = settings;
    writeSvgSettings(settings);
    svgDialog.close();
    exportSvg(model, {
        filename: settings.filename,
        dark: settings.theme === 'dark',
        transparent: settings.transparent,
    }).catch((error: unknown) => {
        warningMessage = `SVG export failed: ${String(error)}`;
        warningBanner.hidden = false;
        warningBanner.textContent = warningMessage;
    });
});

// --- Keyboard shortcuts (WYSIWYG conventions) -------------------------------
document.addEventListener('keydown', (event: KeyboardEvent) => {
    if (pngDialog.open || svgDialog.open) {
        return; // the modal owns its keys (ESC closes it natively)
    }
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
    void loadFromHash();
});

// --- Boot ----------------------------------------------------------------------

// Viewer's stored preference first; a style in the URL overrides it in loadFromHash().
setActiveStyle(readStoredStyleId() ?? DEFAULT_STYLE_ID, false);
// Only the active style's @font-face rules go in at boot — other styles' faces are
// injected (and fetched) lazily when loadStyleFonts runs for them on first switch.
ensureFontFaces(getActiveStyle().typography.fonts);

async function boot(): Promise<void> {
    if (window.location.search.includes('validate-styles')) {
        const issues = validateAllStyles();
        console[issues.length === 0 ? 'log' : 'warn'](
            issues.length === 0 ? 'style validation: all styles pass' : issues
        );
    }
    // textWidth() measures with canvas metrics: gate the first render on the real fonts.
    await loadFromHash();
    // Fonts for the other styles load lazily on first switch (render + re-render once
    // loaded) — boot never downloads more than the active style's few woff2 files.
}

void boot();
