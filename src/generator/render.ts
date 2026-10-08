/**
 * Style-driven SVG renderer. Everything visual comes from the active `PyramidStyle`:
 * geometry, colors, typography, fills (solid or hatch patterns), hand-drawn jitter,
 * label treatment, frame and legend rule. The same element is used for on-page display
 * and for both export formats, so all styling is baked into SVG attributes.
 */

import type { GeneratorLayer, PyramidModel } from './model';
import { classicStyle } from './styles/classic';
import type { PatternName, PyramidStyle, StyleFills, StyleRole } from './styles/types';

const SVG_NS = 'http://www.w3.org/2000/svg';

export interface EdgeGeometry {
    y: number;
    leftX: number;
    rightX: number;
    centerX: number;
}

/** Equal layer height for the current model, so total height scales with layer count. */
export function layerHeightFor(model: PyramidModel, style: PyramidStyle = classicStyle): number {
    const layout = style.layout;
    return Math.min(
        layout.maxLayerHeight,
        Math.max(layout.minLayerHeight, Math.round(layout.heightAnchor / model.layers.length))
    );
}

/** Pixels per width unit for the current model — shrinks the pyramid for few layers. */
export function unitFor(model: PyramidModel, style: PyramidStyle = classicStyle): number {
    const layout = style.layout;
    const target = (model.layers.length * layerHeightFor(model, style) * layout.targetAspect) / 100;
    return Math.min(layout.baseUnit, target);
}

/**
 * Geometry of horizontal edge `edgeIndex` (0 = top edge, layers.length = bottom edge).
 * `bandsTop` defaults to the full title reservation (what the editing canvas always uses);
 * compact exports pass their content-aware top offset so paths and sheet agree.
 */
export function edgeGeometry(
    model: PyramidModel,
    edgeIndex: number,
    style: PyramidStyle = classicStyle,
    bandsTop: number = style.layout.padding + style.layout.titleSpace
): EdgeGeometry {
    const layout = style.layout;
    const unit = unitFor(model, style);
    const layerHeight = layerHeightFor(model, style);
    const maxUnitWidth = Math.max(1, ...model.widths);
    const centerX = (maxUnitWidth * unit) / 2 + layout.padding;
    const half = ((model.widths[edgeIndex] ?? 0) * unit) / 2;
    return {
        y: bandsTop + edgeIndex * layerHeight,
        leftX: centerX - half,
        rightX: centerX + half,
        centerX,
    };
}

/** Straight SVG polygon "points" string for the layer — used by editing overlays. */
export function layerPolygonPoints(
    model: PyramidModel,
    layerIndex: number,
    style: PyramidStyle = classicStyle
): string {
    const top = edgeGeometry(model, layerIndex, style);
    const bottom = edgeGeometry(model, layerIndex + 1, style);
    return `${top.leftX},${top.y} ${top.rightX},${top.y} ${bottom.rightX},${bottom.y} ${bottom.leftX},${bottom.y}`;
}

// --- Hand-drawn jitter -------------------------------------------------------

function mulberry32(a: number): () => number {
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashNumbers(nums: number[]): number {
    let h = 2166136261;
    for (const n of nums) {
        h = Math.imul(h ^ Math.round(n), 16777619);
    }
    return h >>> 0;
}

interface Pt {
    x: number;
    y: number;
}

/**
 * Smooth 1D noise: a few sine harmonics with random frequency and phase, normalized to
 * [-1, 1]. Independent per-point randomness reads as sawtooth; a band-limited sum flows
 * like an actual hand stroke even at large amplitudes.
 */
function smoothNoise(seed: number): (t: number) => number {
    const rand = mulberry32(seed);
    const waves = [
        { a: 1, f: 0.7 + rand() * 0.6 },
        { a: 0.5, f: 1.9 + rand() * 1.1 },
        { a: 0.22, f: 3.4 + rand() * 1.6 },
    ];
    const phases = waves.map(() => rand() * Math.PI * 2);
    const norm = waves.reduce((sum, w) => sum + w.a, 0);
    return (t) =>
        waves.reduce((sum, w, i) => sum + w.a * Math.sin(2 * Math.PI * w.f * t + phases[i]), 0) /
        norm;
}

interface SideFrame {
    pts: Pt[];
    arc: number[];
    total: number;
    nx: number;
    ny: number;
    offsetAt: (s: number) => number;
    corner: (i: number) => Pt;
}

interface SketchGeometry {
    /** Horizontal edge i, sampled left→right; shared exactly by the two adjacent layers. */
    edges: Pt[][];
    /** Left/right side of layer i, sampled top→bottom; corners shared with neighbors. */
    left: Pt[][];
    right: Pt[][];
}

/**
 * All jittered outline points for the model, computed in one pass. The property that keeps
 * a hand-drawn silhouette continuous: each side of the pyramid is ONE wobble function over
 * the side's arc length, and the corner points it yields are shared exactly by the two
 * layers touching that corner and by the horizontal edge ending there. When every layer
 * wobbled its own sides independently, large amplitudes tore the silhouette apart into
 * background wedges that read as a "double line". The wobble tapers to zero at the extreme
 * apex/base corners so the overall outline stays anchored; horizontal edges keep exact
 * (jittered) endpoints via a sine envelope.
 */
function sketchGeometry(
    model: PyramidModel,
    style: PyramidStyle,
    bandsTop?: number
): SketchGeometry {
    const count = model.layers.length;
    const rawEdges: EdgeGeometry[] = [];
    for (let i = 0; i <= count; i++) rawEdges.push(edgeGeometry(model, i, style, bandsTop));

    const { amplitude, segmentLength, salt } = style.jitter;
    const cornersL = rawEdges.map((e) => ({ x: e.leftX, y: e.y }));
    const cornersR = rawEdges.map((e) => ({ x: e.rightX, y: e.y }));
    if (amplitude <= 0) {
        return {
            edges: cornersL.map((c, i) => [c, cornersR[i]]),
            left: cornersL.slice(0, count).map((c, i) => [c, cornersL[i + 1]]),
            right: cornersR.slice(0, count).map((c, i) => [c, cornersR[i + 1]]),
        };
    }

    const sideFrame = (side: 'left' | 'right'): SideFrame => {
        const pts = side === 'left' ? cornersL : cornersR;
        const dx = pts[count].x - pts[0].x;
        const dy = pts[count].y - pts[0].y;
        const span = Math.hypot(dx, dy) || 1;
        const nx = -dy / span;
        const ny = dx / span;
        const arc: number[] = [0];
        for (let i = 1; i <= count; i++) {
            arc.push(arc[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
        }
        const total = arc[count] || 1;
        const noise = smoothNoise(
            hashNumbers([
                salt,
                side === 'left' ? 31 : 47,
                count,
                Math.round(pts[0].x * 2),
                Math.round(pts[count].x * 2),
            ])
        );
        const ramp = (2 * segmentLength) / total;
        const offsetAt = (s: number): number =>
            amplitude * noise(s) * Math.min(1, s / ramp, (1 - s) / ramp);
        return {
            pts,
            arc,
            total,
            nx,
            ny,
            offsetAt,
            corner: (i) => {
                const off = offsetAt(arc[i] / total);
                return { x: pts[i].x + nx * off, y: pts[i].y + ny * off };
            },
        };
    };

    const leftFrame = sideFrame('left');
    const rightFrame = sideFrame('right');

    const sideSegments = (frame: SideFrame): Pt[][] => {
        const segments: Pt[][] = [];
        for (let i = 0; i < count; i++) {
            const a = frame.pts[i];
            const b = frame.pts[i + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            const steps = Math.max(1, Math.round(len / segmentLength));
            const pts: Pt[] = [];
            for (let k = 0; k <= steps; k++) {
                const t = k / steps;
                const s = (frame.arc[i] + (frame.arc[i + 1] - frame.arc[i]) * t) / frame.total;
                const off = frame.offsetAt(s);
                pts.push({
                    x: a.x + (b.x - a.x) * t + frame.nx * off,
                    y: a.y + (b.y - a.y) * t + frame.ny * off,
                });
            }
            segments.push(pts);
        }
        return segments;
    };

    const edgeSamples: Pt[][] = [];
    for (let i = 0; i <= count; i++) {
        const cl = leftFrame.corner(i);
        const cr = rightFrame.corner(i);
        const len = Math.hypot(cr.x - cl.x, cr.y - cl.y);
        const steps = Math.max(1, Math.round(len / segmentLength));
        const noise = smoothNoise(hashNumbers([salt, 7, i, Math.round(rawEdges[i].y * 2)]));
        const pts: Pt[] = [];
        for (let k = 0; k <= steps; k++) {
            const t = k / steps;
            const off = amplitude * noise(t) * Math.sin(Math.PI * t);
            pts.push({
                x: cl.x + (cr.x - cl.x) * t,
                y: cl.y + (cr.y - cl.y) * t + off,
            });
        }
        edgeSamples.push(pts);
    }

    return { edges: edgeSamples, left: sideSegments(leftFrame), right: sideSegments(rightFrame) };
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** All layer `d` strings for the model, computed with one shared sketch pass. */
export function layerShapePaths(
    model: PyramidModel,
    style: PyramidStyle,
    bandsTop?: number
): string[] {
    const sketch = sketchGeometry(model, style, bandsTop);
    const toPath = (pts: Pt[]): string =>
        'M' + pts.map((p) => `${round2(p.x)},${round2(p.y)}`).join('L') + 'Z';
    return model.layers.map((_, i) =>
        toPath([
            ...sketch.edges[i],
            ...sketch.right[i].slice(1),
            ...sketch.edges[i + 1].slice(1).reverse(),
            ...sketch.left[i].slice(1).reverse(),
        ])
    );
}

/** SVG `d` for one layer's shape, with the style's jitter applied (straight when amplitude 0). */
export function layerShapePath(
    model: PyramidModel,
    layerIndex: number,
    style: PyramidStyle = classicStyle,
    bandsTop?: number
): string {
    return layerShapePaths(model, style, bandsTop)[layerIndex];
}

// --- Typography --------------------------------------------------------------

function fontStack(style: PyramidStyle, role: StyleRole): string {
    const r = style.typography.roles[role];
    return r.family === ''
        ? style.typography.fallback
        : `${r.family}, ${style.typography.fallback}`;
}

function fontString(style: PyramidStyle, role: StyleRole): string {
    const r = style.typography.roles[role];
    return `${r.weight} ${r.size}px ${fontStack(style, role)}`;
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

/**
 * Greedy word wrap by MEASURED width (works for any typeface — script and mono fonts vary
 * far too much for char-count heuristics). Newlines are explicit breaks; empty lines are
 * kept so blank lines reserve vertical space; overlong words are hard-broken.
 */
function wrapToWidth(text: string, maxWidth: number, font: string): string[] {
    const lines: string[] = [];
    if (text === '') return lines;
    for (const paragraph of text.split('\n')) {
        if (paragraph === '') {
            lines.push('');
            continue;
        }
        let current = '';
        const flush = (): void => {
            if (current !== '') {
                lines.push(current);
                current = '';
            }
        };
        for (const word of paragraph.split(/\s+/).filter((w) => w !== '')) {
            const candidate = current === '' ? word : current + ' ' + word;
            if (textWidth(candidate, font) <= maxWidth) {
                current = candidate;
                continue;
            }
            flush();
            if (textWidth(word, font) <= maxWidth) {
                current = word;
                continue;
            }
            let chunk = '';
            for (const ch of word) {
                if (chunk !== '' && textWidth(chunk + ch, font) > maxWidth) {
                    lines.push(chunk);
                    chunk = ch;
                } else {
                    chunk += ch;
                }
            }
            current = chunk;
        }
        flush();
    }
    return lines;
}

// --- Fills -------------------------------------------------------------------

/** One hatch tile, addressed by a per-layer id so each layer can carry its own color. */
function patternElement(
    id: string,
    name: PatternName,
    color: string,
    fills: StyleFills
): SVGPatternElement {
    const s = fills.patternSpacing;
    const w = fills.patternStroke;
    const op = fills.patternOpacity;
    const pattern = svgEl('pattern', {
        id,
        width: s,
        height: s,
        patternUnits: 'userSpaceOnUse',
    });
    if (name === 'dots') {
        pattern.appendChild(
            svgEl('circle', {
                cx: s / 2,
                cy: s / 2,
                r: Math.max(1, w * 1.1),
                fill: color,
                opacity: op,
            })
        );
    } else {
        const d45 = `M0 ${s} L${s} 0 M${-s / 2} ${s / 2} L${s / 2} ${-s / 2} M${s / 2} ${s * 1.5} L${s * 1.5} ${s / 2}`;
        const d135 = `M0 0 L${s} ${s} M${-s / 2} ${s / 2} L${s / 2} ${s * 1.5} M${s / 2} ${-s / 2} L${s * 1.5} ${s / 2}`;
        const dH = `M0 ${s / 2} L${s} ${s / 2}`;
        const d =
            name === 'diag45'
                ? d45
                : name === 'diag-45'
                  ? d135
                  : name === 'cross'
                    ? `${d45} ${d135}`
                    : dH;
        pattern.appendChild(
            svgEl('path', { d, stroke: color, 'stroke-width': w, opacity: op, fill: 'none' })
        );
    }
    return pattern;
}

function fillDefs(style: PyramidStyle, ink: string, model: PyramidModel): SVGDefsElement | null {
    const defs = svgEl('defs', {});
    let any = false;
    // Pattern AND gradient defs are PER LAYER (ids pyr-pat-{i} / pyr-grad-{i}) so each
    // layer can carry its own pencil tint or custom gradient stops, editable live from
    // the toolbar without touching other layers.
    model.layers.forEach((layer, index) => {
        const pattern = effectiveLayerPattern(style, layer, index, ink);
        if (pattern !== null && pattern.name !== 'none') {
            any = true;
            defs.appendChild(
                patternElement(`pyr-pat-${index}`, pattern.name, pattern.color, style.fills)
            );
        }
        const gradient = effectiveLayerGradient(style, layer, index);
        if (gradient !== null) {
            any = true;
            const grad = svgEl('linearGradient', {
                id: `pyr-grad-${index}`,
                x1: '0%',
                y1: '0%',
                x2: '100%',
                y2: '100%',
            });
            gradient.stops.forEach((color, stopIndex) => {
                const offset =
                    gradient.stops.length === 1
                        ? 0
                        : (stopIndex / (gradient.stops.length - 1)) * 100;
                grad.appendChild(
                    svgEl('stop', { offset: `${Math.round(offset)}%`, 'stop-color': color })
                );
            });
            defs.appendChild(grad);
        }
    });
    return any ? defs : null;
}

export interface LayerPattern {
    name: PatternName;
    color: string;
}

export interface LayerGradient {
    stops: string[];
}

/**
 * The gradient this layer shows, or null when the layer is not a gradient fill. Priority:
 * the layer's own picked `gradientColors` (custom gradient) > the style's gradient cycle
 * (by layer position). Exported so the editor can seed a custom gradient from the stops
 * the layer currently shows, and know when to show per-stop pickers.
 */
export function effectiveLayerGradient(
    style: PyramidStyle,
    layer: GeneratorLayer,
    index: number
): LayerGradient | null {
    if (layer.colorCustom === true || layer.fillPattern !== undefined) return null;
    if (layer.gradientColors !== undefined && layer.gradientColors.length >= 2) {
        return { stops: layer.gradientColors };
    }
    const gradients = style.fills.gradients ?? [];
    if (gradients.length === 0) return null;
    if (style.fills.mode === 'gradient') {
        return { stops: gradients[index % gradients.length].stops };
    }
    return null;
}

/**
 * The hatch this layer shows (name + effective color), or null when the layer is a solid
 * fill. Color priority: the layer's picked `patternColor` > the style pattern's pencil
 * color > ink. Exported so the editor knows whether the color picker tints a pattern or
 * sets a solid color.
 */
export function effectiveLayerPattern(
    style: PyramidStyle,
    layer: GeneratorLayer,
    index: number,
    ink: string
): LayerPattern | null {
    if (layer.colorCustom === true) return null;
    if (layer.fillPattern !== undefined) {
        return { name: layer.fillPattern, color: layer.patternColor ?? ink };
    }
    if (style.fills.mode === 'pattern') {
        const entry = style.fills.patterns[index % style.fills.patterns.length];
        return { name: entry.name, color: layer.patternColor ?? entry.color ?? ink };
    }
    return null;
}

/**
 * Effective fill for a layer. Priority: custom solid color > hatch (per-layer def, own
 * pencil color) > gradient (per-layer def: custom stops or style cycle) > style palette >
 * stored data color. Exported so the editor can update fills surgically without a re-render.
 */
export function effectiveLayerFill(
    style: PyramidStyle,
    layer: GeneratorLayer,
    index: number,
    dark: boolean
): string {
    if (layer.colorCustom === true) return layer.color;
    const ink = (dark ? style.canvas.dark : style.canvas.light).ink;
    const pattern = effectiveLayerPattern(style, layer, index, ink);
    if (pattern !== null) {
        return pattern.name === 'none' ? 'none' : `url(#pyr-pat-${index})`;
    }
    if (effectiveLayerGradient(style, layer, index) !== null) {
        return `url(#pyr-grad-${index})`;
    }
    if (style.layers.colorSource === 'palette') {
        const palette = dark ? style.layers.palette.dark : style.layers.palette.light;
        return palette[index % palette.length] ?? layer.color;
    }
    return layer.color;
}

// --- SVG helpers -------------------------------------------------------------

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

/** Four-point sparkle star centered on (cx, cy) with arm length s. */
function sparkleStar(cx: number, cy: number, s: number): string {
    const k = s * 0.22;
    return (
        `M${round2(cx)} ${round2(cy - s)} L${round2(cx + k)} ${round2(cy - k)} ` +
        `L${round2(cx + s)} ${round2(cy)} L${round2(cx + k)} ${round2(cy + k)} ` +
        `L${round2(cx)} ${round2(cy + s)} L${round2(cx - k)} ${round2(cy + k)} ` +
        `L${round2(cx - s)} ${round2(cy)} L${round2(cx - k)} ${round2(cy - k)} Z`
    );
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

/** Draw the layer label according to the style's label treatment. */
function renderLabel(
    svg: SVGSVGElement,
    style: PyramidStyle,
    palette: PyramidStyle['canvas']['light'],
    layer: GeneratorLayer,
    layerIndex: number,
    centerX: number,
    textY: number,
    editing: boolean
): void {
    const role = style.typography.roles.label;
    const t = style.label;
    const chipWidth = textWidth(layer.label, fontString(style, 'label')) + t.padX * 2;
    const chipX = centerX - chipWidth / 2;
    const chipY = textY - (t.height - 10);

    if (t.mode === 'plain-halo') {
        // Ink text with a ground-colored halo (paint-order) instead of a box.
        const text = svgEl('text', {
            x: centerX,
            y: textY,
            'text-anchor': 'middle',
            'font-size': role.size,
            'font-weight': role.weight,
            'data-layer-index': layerIndex,
            'data-edit-field': 'label',
            fill: palette.title,
            stroke: palette.background,
            'stroke-width': t.haloWidth,
            'paint-order': 'stroke',
            'stroke-linejoin': 'round',
            class: editing ? 'editable-text' : '',
        });
        text.textContent = layer.label;
        svg.appendChild(text);
        return;
    }

    if (t.shadowOffset > 0) {
        svg.appendChild(
            svgEl('rect', {
                x: chipX + t.shadowOffset,
                y: chipY + t.shadowOffset,
                width: chipWidth,
                height: t.height,
                rx: t.rx,
                fill: palette.ink,
                'pointer-events': 'none',
            })
        );
    }
    svg.appendChild(
        svgEl('rect', {
            x: chipX,
            y: chipY,
            width: chipWidth,
            height: t.height,
            rx: t.rx,
            'data-label-chip': layerIndex,
            fill: palette.chip,
            stroke: t.mode === 'chip' ? palette.chipStroke : palette.ink,
            'stroke-width': t.borderWidth,
            'pointer-events': 'none',
        })
    );
    const text = svgEl('text', {
        x: centerX,
        y: textY,
        'text-anchor': 'middle',
        'font-size': role.size,
        'font-weight': role.weight,
        'data-layer-index': layerIndex,
        'data-edit-field': 'label',
        fill: palette.chipText,
        class: editing ? 'editable-text' : '',
    });
    text.textContent = layer.label;
    svg.appendChild(text);
}

// --- Main render -------------------------------------------------------------

export interface RenderOptions {
    /** Add WYSIWYG affordances (placeholders, hover classes). Exports render without them. */
    editing?: boolean;
    /** Render with the dark canvas palette. Matches the app's current theme. */
    dark?: boolean;
    /** Draw the subtle builder attribution as a caption below the sheet. Set by exports. */
    attribution?: boolean;
    /** The visual language to render in. Defaults to classic. */
    style?: PyramidStyle;
    /** Omit the canvas background rect so the sheet stays transparent (PNG exports). */
    transparentBackground?: boolean;
}

/**
 * Render the complete view representation (pyramid + legend) as a single standalone SVG element.
 */
export function renderPyramidSvg(model: PyramidModel, options: RenderOptions = {}): SVGSVGElement {
    const style = options.style ?? classicStyle;
    const dark = options.dark === true;
    const palette = dark ? style.canvas.dark : style.canvas.light;
    const { layers, widths } = model;
    const title = model.title ?? '';
    const descriptor = model.descriptor ?? '';
    const editing = options.editing === true;
    const layout = style.layout;
    const unit = unitFor(model, style);
    const layerHeight = layerHeightFor(model, style);

    // Exports (non-editing) drop reserved space for content that isn't there — a bare
    // pyramid must not export with huge empty title/descriptor bands or a full-width
    // empty legend column. The editing canvas keeps the full layout: placeholders need
    // the room, and the page must not jump around while the user types.
    const hasTitle = editing || title !== '';
    const hasLegend = editing || layers.some((l) => l.notes !== '');
    // Without a title, keep a symmetric top clearance (one sheet padding) — collapsing it
    // to 0 jams the pyramid's apex against the frame and pulls the labels up with it.
    const titleSpace = hasTitle ? layout.titleSpace : layout.padding;
    const legendWidth = hasLegend ? layout.legendWidth : 0;
    const legendGap = hasLegend ? layout.legendGap : 0;

    const maxUnitWidth = Math.max(1, ...widths);
    const pyramidWidth = maxUnitWidth * unit + 2 * layout.padding;
    const bandsTop = layout.padding + titleSpace;
    const bandsBottom = bandsTop + layers.length * layerHeight;
    const centerX = pyramidWidth / 2;

    // --- Legend layout: notes only, centered in the layer's band -----------
    const notesRole = style.typography.roles.notes;
    const notesBaseline = Math.round(notesRole.lineHeight * 0.73);
    const rowLayouts = layers.map((layer, index) => {
        // 3% safety factor: canvas measureText can run slightly narrower than SVG text
        // rendering (hinting/kerning), which would otherwise let a line poke past the
        // column edge and out of the viewBox.
        const notesLines = wrapToWidth(
            layer.notes,
            (legendWidth - 8) * 0.97,
            fontString(style, 'notes')
        );
        const blockHeight = notesLines.length * notesRole.lineHeight;
        const rowY = bandsTop + index * layerHeight;
        const blockTop = Math.max(rowY + 2, rowY + (layerHeight - blockHeight) / 2);
        return { index, layer, notesLines, rowY, blockTop, blockHeight };
    });
    const legendBottom = rowLayouts.reduce(
        (bottom, row) => Math.max(bottom, row.blockTop + row.blockHeight),
        0
    );
    const totalWidth = pyramidWidth + legendGap + legendWidth + layout.padding;

    // --- Descriptor layout: newlines are explicit breaks, long lines soft-wrap -----------
    const descriptorRole = style.typography.roles.descriptor;
    // descriptorSpace is the gap between the pyramid's bottom edge and the descriptor.
    const descriptorTop = bandsBottom + layout.descriptorSpace;
    const descriptorLines = wrapToWidth(
        descriptor,
        pyramidWidth - 8,
        fontString(style, 'descriptor')
    );

    const hasDescriptor = editing || descriptor !== '';
    // The sheet itself: everything the frame (or the implied box) contains.
    const contentHeight = Math.max(
        // Framed styles need breathing room below the descriptor — text must not touch
        // the border (classic keeps its original 6px margin). Without a descriptor, the
        // sheet ends right below the pyramid.
        hasDescriptor
            ? descriptorTop +
                  Math.max(1, descriptorLines.length) * descriptorRole.lineHeight +
                  (style.frame === 'none' ? 6 : 16)
            : bandsBottom + layout.padding,
        legendBottom + layout.padding
    );
    // The export attribution is a caption BELOW the sheet — outside the box holding the
    // model, title, descriptor and notes — so it gets its own band under the content.
    const attributionBand = options.attribution === true ? 16 : 0;
    const totalHeight = contentHeight + attributionBand;

    const svg = svgEl('svg', {
        xmlns: SVG_NS,
        viewBox: `0 0 ${totalWidth} ${totalHeight}`,
        width: totalWidth,
        height: totalHeight,
        'font-family': style.typography.fallback,
        role: 'img',
        'aria-label': 'Test pyramid',
    });

    const defs = fillDefs(style, palette.ink, model);
    if (defs !== null) svg.appendChild(defs);

    if (options.transparentBackground !== true) {
        svg.appendChild(
            svgEl('rect', {
                x: 0,
                y: 0,
                width: totalWidth,
                height: totalHeight,
                fill: palette.background,
            })
        );
    }

    // --- Sparkles (glitter under everything, deterministic per model+style) ----
    if (style.sparkles) {
        const { count, colors, opacity, minSize, maxSize } = style.sparkles;
        const rand = mulberry32(
            hashNumbers([style.jitter.salt + 991, count, totalWidth, contentHeight])
        );
        const inset = layout.padding;
        for (let i = 0; i < count; i++) {
            const x = inset + rand() * Math.max(1, totalWidth - 2 * inset);
            const y = inset + rand() * Math.max(1, contentHeight - 2 * inset);
            const size = minSize + rand() * (maxSize - minSize);
            const color = colors[Math.floor(rand() * colors.length)];
            svg.appendChild(
                svgEl('path', {
                    d: sparkleStar(x, y, size),
                    fill: color,
                    opacity,
                    'pointer-events': 'none',
                })
            );
        }
    }

    // --- Frame (wall-art border, around the sheet — not the caption band) ----
    if (style.frame !== 'none') {
        svg.appendChild(
            svgEl('rect', {
                x: 4,
                y: 4,
                width: totalWidth - 8,
                height: contentHeight - 8,
                fill: 'none',
                stroke: palette.ink,
                'stroke-width': 1.5,
            })
        );
        if (style.frame === 'double') {
            svg.appendChild(
                svgEl('rect', {
                    x: 8,
                    y: 8,
                    width: totalWidth - 16,
                    height: contentHeight - 16,
                    fill: 'none',
                    stroke: palette.ink,
                    'stroke-width': 0.75,
                })
            );
        }
    }

    // --- Title (above the pyramid) ------------------------------------------
    const titleRole = style.typography.roles.title;
    const titleY = layout.padding + Math.round(layout.titleSpace * 0.625);
    if (title !== '') {
        const text = svgEl('text', {
            x: totalWidth / 2,
            y: titleY,
            'text-anchor': 'middle',
            'font-size': titleRole.size,
            'font-weight': titleRole.weight,
            'data-edit-field': 'title',
            fill: palette.title,
            class: editing ? 'editable-text' : '',
        });
        text.textContent = title;
        svg.appendChild(text);
    } else if (editing) {
        svg.appendChild(
            hintPlaceholder(totalWidth / 2, titleY - 6, 70, palette.hint, {
                'data-edit-field': 'title',
            })
        );
    }

    // --- Pyramid layers ---------------------------------------------------
    // One shared sketch pass computes every layer's jittered outline, so adjacent layers
    // agree exactly on the points of their shared edges and corners. The content-aware
    // bandsTop keeps the paths aligned with the sheet layout (compact exports differ).
    const shapePaths = layerShapePaths(model, style, bandsTop);

    // Pass 1: fills. These paths carry interaction (pointer-events 'all' makes even
    // unfilled 'none'-pattern layers clickable) and the native tooltip.
    layers.forEach((layer, i) => {
        const shape = svgEl('path', {
            d: shapePaths[i],
            'data-layer-index': i,
            class: 'layer-fill' + (editing ? ' editable' : ''),
            fill: effectiveLayerFill(style, layer, i, dark),
            'pointer-events': 'all',
        });
        const tip = svgEl('title', {});
        tip.textContent = layer.notes === '' ? layer.label : `${layer.label}\n${layer.notes}`;
        shape.appendChild(tip);
        svg.appendChild(shape);
    });

    // Pass 2: ink/separator outlines on top of ALL fills. Drawing them after every fill
    // means a later layer's fill can never clip an earlier layer's stroke, and round caps
    // close the corner notches between consecutive silhouette segments (no "double line").
    const outline = style.stroke.layerOutline;
    layers.forEach((_, i) => {
        svg.appendChild(
            svgEl('path', {
                d: shapePaths[i],
                class: 'layer-stroke',
                'data-layer-index': i,
                fill: 'none',
                stroke: outline > 0 ? palette.ink : palette.separator,
                'stroke-width': outline > 0 ? outline : style.stroke.separatorWidth,
                'stroke-linejoin': 'round',
                'stroke-linecap': 'round',
                'pointer-events': 'none',
            })
        );
    });

    // Pass 3: labels sit on the pyramid's center line; the style decides chip/plate/bubble/halo.
    layers.forEach((layer, i) => {
        const yTop = bandsTop + i * layerHeight;
        if (layer.label !== '') {
            renderLabel(
                svg,
                style,
                palette,
                layer,
                i,
                centerX,
                yTop + layerHeight / 2 + 7,
                editing
            );
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
    const legendX = pyramidWidth + legendGap;
    if (hasLegend && style.legendRule === true) {
        const ruleX = pyramidWidth + legendGap / 2;
        svg.appendChild(
            svgEl('line', {
                x1: ruleX,
                x2: ruleX,
                y1: bandsTop - 4,
                y2: Math.max(legendBottom, bandsBottom) + 4,
                stroke: palette.ink,
                'stroke-width': 3,
            })
        );
    }
    // Leader lines: short jittered horizontal strokes from each layer's right edge to its
    // notes block — engineering-drawing callouts (draftsman) / comic pointer lines (toon).
    if (hasLegend && style.legendLeaders !== null) {
        const amp = Math.min(style.jitter.amplitude, 2.5);
        for (const row of rowLayouts) {
            if (row.notesLines.length === 0) continue;
            const bandTop = edgeGeometry(model, row.index, style, bandsTop);
            const bandBottom = edgeGeometry(model, row.index + 1, style, bandsTop);
            const y = row.blockTop + row.blockHeight / 2;
            const yFrac = Math.min(1, Math.max(0, (y - bandTop.y) / layerHeight));
            const edgeX = bandTop.rightX + (bandBottom.rightX - bandTop.rightX) * yFrac;
            const startX = edgeX + 10;
            const endX = legendX - 10;
            if (endX - startX < 10) continue;
            const noise = smoothNoise(
                hashNumbers([style.jitter.salt, 91, row.index, Math.round(y)])
            );
            const steps = Math.max(2, Math.round((endX - startX) / style.jitter.segmentLength));
            const pts: Pt[] = [];
            for (let k = 0; k <= steps; k++) {
                const t = k / steps;
                const off = amp * noise(t) * Math.sin(Math.PI * t);
                pts.push({ x: startX + (endX - startX) * t, y: y + off });
            }
            svg.appendChild(
                svgEl('path', {
                    d: 'M' + pts.map((p) => `${round2(p.x)},${round2(p.y)}`).join('L'),
                    fill: 'none',
                    stroke: dark ? style.legendLeaders.color.dark : style.legendLeaders.color.light,
                    'stroke-width': style.legendLeaders.width,
                    'stroke-linecap': 'round',
                    'pointer-events': 'none',
                })
            );
        }
    }
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
                width: legendWidth,
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
                y: row.blockTop + lineIndex * notesRole.lineHeight + notesBaseline,
                'font-size': notesRole.size,
                'font-weight': notesRole.weight,
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
        const descriptorFont = fontString(style, 'descriptor');
        const blockWidth = Math.max(
            ...descriptorLines.map((line) => textWidth(line, descriptorFont))
        );
        const blockX = (totalWidth - blockWidth) / 2;
        const descriptorBaseline = Math.round(descriptorRole.lineHeight * 0.71);
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
                height: descriptorLines.length * descriptorRole.lineHeight + 6,
                fill: 'transparent',
            })
        );
        descriptorLines.forEach((line, lineIndex) => {
            const text = svgEl('text', {
                x: blockX,
                y: descriptorTop + lineIndex * descriptorRole.lineHeight + descriptorBaseline,
                'text-anchor': 'start',
                'font-size': descriptorRole.size,
                'font-weight': descriptorRole.weight,
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

    // --- Attribution (exports only) — caption below the framed sheet ---------
    if (options.attribution === true) {
        const role = style.typography.roles.attribution;
        const text = svgEl('text', {
            x: totalWidth - 4,
            y: contentHeight + 10,
            'text-anchor': 'end',
            'font-size': role.size,
            'font-weight': role.weight,
            fill: palette.hint,
        });
        text.textContent = 'https://share.lakitna.nl/test-pyramid-builder';
        svg.appendChild(text);
    }

    return svg;
}

export interface SerializeOptions {
    /**
     * `@font-face` CSS (with data-URI sources) inlined as a <style> child so the exported
     * SVG renders with the style's fonts anywhere, offline. Build it with `embeddedFontFaceCss()`.
     */
    embedFontCss?: string;
}

/** Serialize an SVG element into a standalone SVG document string. */
export function serializeSvg(svg: SVGSVGElement, options: SerializeOptions = {}): string {
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', SVG_NS);
    const viewBox = (clone.getAttribute('viewBox') ?? '0 0 0 0').split(/\s+/).map(Number);
    clone.setAttribute('width', String(viewBox[2]));
    clone.setAttribute('height', String(viewBox[3]));
    if (options.embedFontCss !== undefined && options.embedFontCss !== '') {
        const styleEl = document.createElementNS(SVG_NS, 'style');
        styleEl.textContent = options.embedFontCss;
        clone.insertBefore(styleEl, clone.firstChild);
    }
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n' + new XMLSerializer().serializeToString(clone)
    );
}
