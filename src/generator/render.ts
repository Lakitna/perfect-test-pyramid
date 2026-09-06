import type { PyramidModel } from './model';

/** Pixels per relative width unit (widths range 0..100) at the reference size. */
export const BASE_UNIT = 6;
/** Padding around the drawing. */
export const PADDING = 12; /** Reserved space above the pyramid for the optional title. */
export const TITLE_SPACE = 48;
/** Reserved space below the pyramid for the optional descriptor. */
export const DESCRIPTOR_SPACE = 40; /** Target pyramid width / height ratio — anchored on the 5-layer look (600×430). */
const TARGET_ASPECT = 1.4;
/** Height that keeps the pyramid at its reference size for the reference layer count. */
const HEIGHT_ANCHOR = 430;
/** Min layer height keeps a clickable band around the 21px label chip; max stops fat strips. */
const MIN_LAYER_HEIGHT = 50;
const MAX_LAYER_HEIGHT = 300;

/** Equal layer height for the current model, so total height scales with layer count. */
export function layerHeightFor(model: PyramidModel): number {
    return Math.min(
        MAX_LAYER_HEIGHT,
        Math.max(MIN_LAYER_HEIGHT, Math.round(HEIGHT_ANCHOR / model.layers.length))
    );
}

/** Pixels per width unit for the current model — shrinks the pyramid for few layers. */
export function unitFor(model: PyramidModel): number {
    const target = (model.layers.length * layerHeightFor(model) * TARGET_ASPECT) / 100;
    return Math.min(BASE_UNIT, target);
}
/** Width of the legend column next to the pyramid. */
const LEGEND_WIDTH = 400;
/** Gap between pyramid and legend. */
const LEGEND_GAP = 24;

export interface EdgeGeometry {
    y: number;
    leftX: number;
    rightX: number;
    centerX: number;
}

/** Geometry of horizontal edge `edgeIndex` (0 = top edge, layers.length = bottom edge). */
export function edgeGeometry(model: PyramidModel, edgeIndex: number): EdgeGeometry {
    const unit = unitFor(model);
    const layerHeight = layerHeightFor(model);
    const maxUnitWidth = Math.max(1, ...model.widths);
    const centerX = (maxUnitWidth * unit) / 2 + PADDING;
    const half = ((model.widths[edgeIndex] ?? 0) * unit) / 2;
    return {
        y: PADDING + TITLE_SPACE + edgeIndex * layerHeight,
        leftX: centerX - half,
        rightX: centerX + half,
        centerX,
    };
}

/** SVG polygon "points" string for the layer at `layerIndex`. */
export function layerPolygonPoints(model: PyramidModel, layerIndex: number): string {
    const top = edgeGeometry(model, layerIndex);
    const bottom = edgeGeometry(model, layerIndex + 1);
    return `${top.leftX},${top.y} ${top.rightX},${top.y} ${bottom.rightX},${bottom.y} ${bottom.leftX},${bottom.y}`;
}

const FONT_FAMILY =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

const SVG_NS = 'http://www.w3.org/2000/svg';

function svgEl<Tag extends keyof SVGElementTagNameMap>(
    tag: Tag,
    attrs: Record<string, string | number>
): SVGElementTagNameMap[Tag] {
    const element = document.createElementNS(SVG_NS, tag);
    for (const [name, value] of Object.entries(attrs)) {
        element.setAttribute(name, String(value));
    }
    return element;
}

/** Approximate rendered width of SVG text using the same font stack (canvas metrics). */
let measureContext: CanvasRenderingContext2D | null | undefined;
function textWidth(text: string, font: string): number {
    if (measureContext === undefined) {
        measureContext = document.createElement('canvas').getContext('2d');
    }
    if (measureContext === null) {
        return text.length * 8;
    }
    measureContext.font = font;
    return measureContext.measureText(text).width;
}

const LABEL_FONT = '600 14px ' + FONT_FAMILY;

/**
 * Greedy word wrap with hard breaks for overlong words. Newline characters are explicit
 * line breaks; empty lines are kept so blank lines reserve vertical space.
 */
function wrapText(text: string, maxChars: number): string[] {
    const lines: string[] = [];
    if (text === '') return lines;
    for (const paragraph of text.split('\n')) {
        if (paragraph === '') {
            lines.push('');
            continue;
        }
        let current = '';
        for (let word of paragraph.split(/\s+/).filter((w) => w !== '')) {
            while (word.length > maxChars) {
                if (current !== '') {
                    lines.push(current);
                    current = '';
                }
                lines.push(word.slice(0, maxChars));
                word = word.slice(maxChars);
            }
            if (current === '') {
                current = word;
            } else if (current.length + 1 + word.length <= maxChars) {
                current += ' ' + word;
            } else {
                lines.push(current);
                current = word;
            }
        }
        if (current !== '') lines.push(current);
    }
    return lines;
}

/**
 * Dashed blank-line placeholder wrapped in a group with a transparent hit rect, so the
 * click target matches the visual placeholder instead of the 1.5px line itself.
 */
function hintPlaceholder(
    centerX: number,
    y: number,
    halfWidth: number,
    hintColor: string,
    attrs: Record<string, string | number>
): SVGGElement {
    const group = svgEl('g', { ...attrs, class: 'editable-text empty-hint' });
    group.appendChild(
        svgEl('rect', {
            x: centerX - halfWidth - 8,
            y: y - 12,
            width: (halfWidth + 8) * 2,
            height: 24,
            fill: 'transparent',
        })
    );
    group.appendChild(
        svgEl('line', {
            x1: centerX - halfWidth,
            x2: centerX + halfWidth,
            y1: y,
            y2: y,
            stroke: hintColor,
            'stroke-width': 1.5,
            'stroke-dasharray': '4 4',
        })
    );
    return group;
}

export interface RenderOptions {
    /** Add WYSIWYG affordances (placeholders, hover classes). Exports render without them. */
    editing?: boolean;
    /** Render with the dark canvas palette. Matches the app's current theme. */
    dark?: boolean;
    /** Draw the subtle builder attribution in the bottom-right corner. Set by exports. */
    attribution?: boolean;
}

export interface CanvasPalette {
    background: string;
    separator: string;
    notes: string;
    hint: string;
    chip: string;
    chipStroke: string;
    chipText: string;
    title: string;
}

/** Colors baked into the SVG attributes (CSS variables would not survive export). */
export function canvasPalette(dark: boolean): CanvasPalette {
    return dark
        ? {
              background: '#1e232b',
              separator: '#1e232b',
              notes: '#a9b3c0',
              hint: '#5f6b7a',
              chip: '#2a313c',
              chipStroke: '#ffffff33',
              chipText: '#e6e9ee',
              title: '#e6e9ee',
          }
        : {
              background: '#ffffff',
              separator: '#ffffff',
              notes: '#555555',
              hint: '#9aa5b1',
              chip: '#ffffff',
              chipStroke: '#00000022',
              chipText: '#1c1c1c',
              title: '#1c1c1c',
          };
}

/**
 * Render the complete view representation (pyramid + legend) as a single standalone SVG element.
 * The same element is used for on-page display and for both export formats.
 */
export function renderPyramidSvg(model: PyramidModel, options: RenderOptions = {}): SVGSVGElement {
    const { layers, widths } = model;
    const title = model.title ?? '';
    const descriptor = model.descriptor ?? '';
    const editing = options.editing === true;
    const palette = canvasPalette(options.dark === true);
    const unit = unitFor(model);
    const layerHeight = layerHeightFor(model);

    const maxUnitWidth = Math.max(1, ...widths);
    const pyramidWidth = maxUnitWidth * unit + 2 * PADDING;
    const bandsTop = PADDING + TITLE_SPACE;
    const bandsBottom = bandsTop + layers.length * layerHeight;
    const centerX = pyramidWidth / 2;

    // --- Legend layout: notes only, centered in the layer's band -----------
    const notesFont = 12;
    const notesLineHeight = 15;
    const notesMaxChars = Math.max(10, Math.floor((LEGEND_WIDTH - 8) / (notesFont * 0.55)));

    const rowLayouts = layers.map((layer, index) => {
        const notesLines = wrapText(layer.notes, notesMaxChars);
        const blockHeight = notesLines.length * notesLineHeight;
        const rowY = bandsTop + index * layerHeight;
        const blockTop = Math.max(rowY + 2, rowY + (layerHeight - blockHeight) / 2);
        return { index, layer, notesLines, rowY, blockTop, blockHeight };
    });

    const legendBottom = rowLayouts.reduce(
        (bottom, row) => Math.max(bottom, row.blockTop + row.blockHeight),
        0
    );

    const totalWidth = pyramidWidth + LEGEND_GAP + LEGEND_WIDTH + PADDING;

    // --- Descriptor layout: newlines are explicit breaks, long lines soft-wrap -----------
    const descriptorFont = 13;
    const descriptorLineHeight = 17;
    const descriptorTop = bandsBottom + 10;
    const descriptorLines = wrapText(
        descriptor,
        Math.max(10, Math.floor((pyramidWidth - 8) / (descriptorFont * 0.55)))
    );

    const totalHeight = Math.max(
        descriptorTop + Math.max(1, descriptorLines.length) * descriptorLineHeight + 6,
        bandsBottom + DESCRIPTOR_SPACE + PADDING,
        legendBottom + PADDING
    );

    const svg = svgEl('svg', {
        xmlns: SVG_NS,
        viewBox: `0 0 ${totalWidth} ${totalHeight}`,
        width: totalWidth,
        height: totalHeight,
        'font-family': FONT_FAMILY,
        role: 'img',
        'aria-label': 'Test pyramid',
    });

    svg.appendChild(
        svgEl('rect', {
            x: 0,
            y: 0,
            width: totalWidth,
            height: totalHeight,
            fill: palette.background,
        })
    );

    // --- Title (above the pyramid) ------------------------------------------
    if (title !== '') {
        const text = svgEl('text', {
            x: totalWidth / 2,
            y: PADDING + 30,
            'text-anchor': 'middle',
            'font-size': 20,
            'font-weight': 700,
            'data-edit-field': 'title',
            fill: palette.title,
            class: editing ? 'editable-text' : '',
        });
        text.textContent = title;
        svg.appendChild(text);
    } else if (editing) {
        svg.appendChild(
            hintPlaceholder(totalWidth / 2, PADDING + 24, 70, palette.hint, {
                'data-edit-field': 'title',
            })
        );
    }

    // --- Pyramid layers ---------------------------------------------------
    layers.forEach((layer, i) => {
        const yTop = bandsTop + i * layerHeight;

        const polygon = svgEl('polygon', {
            points: layerPolygonPoints(model, i),
            'data-layer-index': i,
            class: editing ? 'editable' : '',
            fill: layer.color,
            stroke: palette.separator,
            'stroke-width': 2,
        });
        const title = svgEl('title', {});
        title.textContent = layer.notes === '' ? layer.label : `${layer.label}\n${layer.notes}`;
        polygon.appendChild(title);
        svg.appendChild(polygon);

        // Labels are left-aligned with their left edge on the pyramid's center line and may
        // flow outside the layer; a contrasting background chip keeps them readable and gives
        // the diagram an outspoken visual style.
        if (layer.label !== '') {
            // Themed chip (light: black on white, dark: light on dark); baseline sits 2px lower.
            const textY = yTop + layerHeight / 2 + 7;
            const chipPadX = 7;
            const chipWidth = textWidth(layer.label, LABEL_FONT) + chipPadX * 2;

            svg.appendChild(
                svgEl('rect', {
                    x: centerX - chipWidth / 2,
                    y: textY - 19,
                    width: chipWidth,
                    height: 29,
                    rx: 5,
                    'data-label-chip': i,
                    fill: palette.chip,
                    stroke: palette.chipStroke,
                    'pointer-events': 'none',
                })
            );

            const text = svgEl('text', {
                x: centerX - chipWidth / 2 + chipPadX,
                y: textY,
                'text-anchor': 'start',
                'font-size': 14,
                'font-weight': 600,
                'data-layer-index': i,
                'data-edit-field': 'label',
                fill: palette.chipText,
                class: editing ? 'editable-text' : '',
            });
            text.textContent = layer.label;
            svg.appendChild(text);
        } else if (editing) {
            // Dashed blank-line hint: shows where a label can be added (clickable, no text).
            svg.appendChild(
                hintPlaceholder(centerX, yTop + layerHeight / 2, 30, palette.hint, {
                    'data-layer-index': i,
                    'data-edit-field': 'label',
                })
            );
        }
    });

    // --- Legend (notes aligned to the layer bands) ---------------------------
    const legendX = pyramidWidth + LEGEND_GAP;
    for (const row of rowLayouts) {
        const notesGroup = svgEl('g', {
            'data-layer-index': row.index,
            'data-edit-field': 'notes',
            'data-legend-row': row.index,
            class: editing ? 'editable-text' : '',
        });
        // Transparent hit area so even empty notes can be clicked.
        notesGroup.appendChild(
            svgEl('rect', {
                x: legendX - 4,
                y: row.blockTop - 3,
                width: LEGEND_WIDTH,
                height: Math.max(16, row.blockHeight + 6),
                fill: 'transparent',
            })
        );
        if (editing && row.notesLines.length === 0) {
            notesGroup.appendChild(
                svgEl('line', {
                    x1: legendX,
                    x2: legendX + 120,
                    y1: row.rowY + layerHeight / 2,
                    y2: row.rowY + layerHeight / 2,
                    stroke: palette.hint,
                    'stroke-width': 1.5,
                    'stroke-dasharray': '4 4',
                    class: 'empty-hint',
                })
            );
        }
        row.notesLines.forEach((line, lineIndex) => {
            const notes = svgEl('text', {
                x: legendX,
                y: row.blockTop + lineIndex * notesLineHeight + 11,
                'font-size': notesFont,
                fill: palette.notes,
            });
            notes.textContent = line;
            notesGroup.appendChild(notes);
        });
        svg.appendChild(notesGroup);
    }

    // --- Descriptor (below the pyramid) --------------------------------------
    if (descriptorLines.length > 0) {
        // The block is centered under the pyramid, but its lines are left-aligned.
        const descriptorFontString = descriptorFont + 'px ' + FONT_FAMILY;
        const blockWidth = Math.max(
            ...descriptorLines.map((line) => textWidth(line, descriptorFontString))
        );
        const blockX = (totalWidth - blockWidth) / 2;
        // Wrapped in a group so the whole multi-line block is one clickable edit target.
        const group = svgEl('g', {
            'data-edit-field': 'descriptor',
            class: editing ? 'editable-text' : '',
        });
        // Transparent hit area covering every line, so even blank lines stay clickable.
        group.appendChild(
            svgEl('rect', {
                x: blockX - 8,
                y: descriptorTop - 3,
                width: blockWidth + 16,
                height: descriptorLines.length * descriptorLineHeight + 6,
                fill: 'transparent',
            })
        );
        descriptorLines.forEach((line, lineIndex) => {
            const text = svgEl('text', {
                x: blockX,
                y: descriptorTop + lineIndex * descriptorLineHeight + 12,
                'text-anchor': 'start',
                'font-size': descriptorFont,
                fill: palette.notes,
            });
            text.textContent = line;
            group.appendChild(text);
        });
        svg.appendChild(group);
    } else if (editing) {
        svg.appendChild(
            hintPlaceholder(totalWidth / 2, descriptorTop + 9, 60, palette.hint, {
                'data-edit-field': 'descriptor',
            })
        );
    }

    // --- Attribution (exports only) ------------------------------------------
    if (options.attribution === true) {
        const text = svgEl('text', {
            x: totalWidth - PADDING,
            y: totalHeight - PADDING,
            'text-anchor': 'end',
            'font-size': 10,
            fill: palette.hint,
        });
        text.textContent = 'https://share.lakitna.nl/test-pyramid-builder';
        svg.appendChild(text);
    }

    return svg;
}

/** Serialize an SVG element into a standalone SVG document string. */
export function serializeSvg(svg: SVGSVGElement): string {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', SVG_NS);
    const viewBox = (clone.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number);
    clone.setAttribute('width', String(viewBox[2]));
    clone.setAttribute('height', String(viewBox[3]));
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
    );
}
