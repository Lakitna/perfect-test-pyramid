import type { PyramidModel } from './model';
import { canvasPalette, renderPyramidSvg, serializeSvg } from './render';
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

/** Download the pyramid (with legend) as a standalone .svg file, matching the current theme. */
export function downloadSvg(model: PyramidModel, filename = 'test-pyramid.svg'): void {
    const svgString = serializeSvg(
        renderPyramidSvg(model, { dark: isDarkMode(), attribution: true })
    );
    const blob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
    triggerDownload(URL.createObjectURL(blob), filename);
}

/**
 * Download the pyramid (with legend) as a .png file.
 * The SVG is rasterized through a data-URL Image onto a canvas, which keeps the canvas
 * untainted (no external resources, system fonts only).
 */
export async function downloadPng(
    model: PyramidModel,
    filename = 'test-pyramid.png',
    scale = 2
): Promise<void> {
    const dark = isDarkMode();
    const svg = renderPyramidSvg(model, { dark, attribution: true });
    const svgString = serializeSvg(svg);
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
    context.fillStyle = canvasPalette(dark).background;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (blob === null) {
        throw new Error('Could not encode the pyramid as PNG');
    }
    triggerDownload(URL.createObjectURL(blob), filename);
}
