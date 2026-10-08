import { embeddedFontFaceCss } from './fonts';
import type { PyramidModel } from './model';
import { renderPyramidSvg, serializeSvg } from './render';
import { getActiveStyle } from './styleState';

function triggerDownload(objectUrl: string, filename: string): void {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

export interface SvgExportOptions {
    /** Download name for the file; the modal normalizes it to end in .svg. */
    filename: string;
    /** Render with the dark palette — independent of the app's current theme. */
    dark: boolean;
    /** Omit the paper background so the SVG sheet stays transparent. */
    transparent: boolean;
}

/**
 * Serialize the pyramid (with legend) as a standalone SVG document string, in the
 * active style. The style's @font-face rules are embedded with data URIs (fetched from
 * the static font files on demand) so the file renders the same everywhere, offline —
 * which also lets the string double as an <img> preview inside the export dialog.
 */
export async function buildSvgString(
    model: PyramidModel,
    options: { dark: boolean; transparent: boolean }
): Promise<string> {
    const style = getActiveStyle();
    return serializeSvg(
        renderPyramidSvg(model, {
            style,
            dark: options.dark,
            attribution: true,
            transparentBackground: options.transparent,
        }),
        { embedFontCss: await embeddedFontFaceCss(style.typography.fonts) }
    );
}

/**
 * Download the pyramid as a standalone .svg file, in the active style, with the color
 * mode, background transparency and file name chosen by the caller.
 */
export async function exportSvg(model: PyramidModel, options: SvgExportOptions): Promise<void> {
    const blob = new Blob([await buildSvgString(model, options)], {
        type: 'image/svg+xml;charset=utf-8',
    });
    triggerDownload(URL.createObjectURL(blob), options.filename);
}

export interface PngExportOptions {
    /** Download name for the file; the modal normalizes it to end in .png. */
    filename: string;
    /** Render with the dark palette — independent of the app's current theme. */
    dark: boolean;
    /** Rasterization pixel ratio. 2 gives retina quality. */
    scale: number;
    /** Omit the paper background so the PNG keeps its alpha channel. */
    transparent: boolean;
}

interface PngSheet {
    svgString: string;
    /** Sheet size at scale 1 — the modal converts pixel widths through this. */
    width: number;
    height: number;
}

async function buildPngSheet(
    model: PyramidModel,
    dark: boolean,
    transparent: boolean
): Promise<PngSheet> {
    const style = getActiveStyle();
    const svg = renderPyramidSvg(model, {
        style,
        dark,
        attribution: true,
        transparentBackground: transparent,
    });
    const svgString = serializeSvg(svg, {
        embedFontCss: await embeddedFontFaceCss(style.typography.fonts),
    });
    const viewBox = svg.viewBox.baseVal;
    return { svgString, width: viewBox.width, height: viewBox.height };
}

async function rasterizeSheet(
    sheet: PngSheet,
    dark: boolean,
    transparent: boolean,
    scale: number
): Promise<Blob> {
    const style = getActiveStyle();
    const image = new Image();
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(sheet.svgString);
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not rasterize the pyramid SVG'));
        image.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(sheet.width * scale);
    canvas.height = Math.round(sheet.height * scale);
    const context = canvas.getContext('2d');
    if (context === null) {
        throw new Error('Canvas 2D rendering context is not available');
    }
    if (!transparent) {
        context.fillStyle = (dark ? style.canvas.dark : style.canvas.light).background;
        context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob === null) {
        throw new Error('Could not encode the pyramid as PNG');
    }
    return blob;
}

/**
 * Download the pyramid (with legend) as a .png file, in the active style, with the
 * theme, scale, background transparency and file name chosen by the caller.
 * The SVG is rasterized through a data-URL Image onto a canvas, which keeps the canvas
 * untainted — the embedded fonts travel as data URIs inside that same URL.
 */
export async function exportPng(model: PyramidModel, options: PngExportOptions): Promise<void> {
    const sheet = await buildPngSheet(model, options.dark, options.transparent);
    const blob = await rasterizeSheet(sheet, options.dark, options.transparent, options.scale);
    triggerDownload(URL.createObjectURL(blob), options.filename);
}

/** Sheet size in pixels at scale 1 — lets the modal convert a width into a scale. ViewBox only: no fonts fetched or serialized. */
export function measurePngSheet(
    model: PyramidModel,
    options: { dark: boolean; transparent: boolean }
): { width: number; height: number } {
    const svg = renderPyramidSvg(model, {
        style: getActiveStyle(),
        dark: options.dark,
        attribution: true,
        transparentBackground: options.transparent,
    });
    const viewBox = svg.viewBox.baseVal;
    return { width: viewBox.width, height: viewBox.height };
}

/**
 * Rasterize a small preview of the PNG export (theme and transparency applied) without
 * triggering a download. The sheet is never previewed above scale 1.
 */
export async function renderPngPreview(
    model: PyramidModel,
    options: { dark: boolean; transparent: boolean },
    maxWidth = 320
): Promise<Blob> {
    const sheet = await buildPngSheet(model, options.dark, options.transparent);
    const scale = Math.min(1, maxWidth / sheet.width);
    return rasterizeSheet(sheet, options.dark, options.transparent, scale);
}
