import { fontFaceCss } from './fonts';
import type { PyramidModel } from './model';
import { renderPyramidSvg, serializeSvg } from './render';
import { getActiveStyle } from './styleState';
import { isDarkMode } from './theme';

function triggerDownload(objectUrl: string, filename: string): void {
    const anchor = document.createElement('a');
    anchor.href = objectUrl;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

/**
 * Download the pyramid (with legend) as a standalone .svg file, in the active style and
 * theme. The style's @font-face rules (data URIs) are embedded so the file renders the
 * same everywhere, offline.
 */
export function downloadSvg(model: PyramidModel, filename = 'test-pyramid.svg'): void {
    const style = getActiveStyle();
    const svgString = serializeSvg(
        renderPyramidSvg(model, { style, dark: isDarkMode(), attribution: true }),
        { embedFontCss: fontFaceCss(style.typography.fonts) }
    );
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(URL.createObjectURL(blob), filename);
}

/**
 * Download the pyramid (with legend) as a .png file, in the active style and theme.
 * The SVG is rasterized through a data-URL Image onto a canvas, which keeps the canvas
 * untainted — the embedded fonts travel as data URIs inside that same URL.
 */
export async function downloadPng(
    model: PyramidModel,
    filename = 'test-pyramid.png',
    scale = 2
): Promise<void> {
    const style = getActiveStyle();
    const dark = isDarkMode();
    const svg = renderPyramidSvg(model, { style, dark, attribution: true });
    const svgString = serializeSvg(svg, { embedFontCss: fontFaceCss(style.typography.fonts) });
    const viewBox = svg.viewBox.baseVal;

    const image = new Image();
    const dataUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgString);
    await new Promise<void>((resolve, reject) => {
        image.onload = () => resolve();
        image.onerror = () => reject(new Error('Could not rasterize the pyramid SVG'));
        image.src = dataUrl;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewBox.width * scale);
    canvas.height = Math.round(viewBox.height * scale);
    const context = canvas.getContext('2d');
    if (context === null) {
        throw new Error('Canvas 2D rendering context is not available');
    }
    context.fillStyle = (dark ? style.canvas.dark : style.canvas.light).background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob === null) {
        throw new Error('Could not encode the pyramid as PNG');
    }
    triggerDownload(URL.createObjectURL(blob), filename);
}
