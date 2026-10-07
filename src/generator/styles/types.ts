/**
 * The style contract: one `PyramidStyle` object fully describes a visual language —
 * typography, canvas colors, fills (solid or hatched), hand-drawn jitter, label treatment,
 * frame, layout geometry and the app-chrome CSS variables.
 *
 * A style is chrome, NOT data: it never changes what a pyramid *is* (layers, widths, labels,
 * notes), only how it looks. Layer fills are resolved at render time: a layer keeps its own
 * color only when `colorCustom` is set; otherwise the style's palette (or hatch pattern) wins.
 *
 * Authoring rules (accessibility, see also styles/validate.ts):
 * - No all-caps anywhere; no text-transform, tracking stays ≤ 0.01em.
 * - No acid/neon yellow as an accent; strong blues (Klein-class) are the safe accent.
 * - Text on chips/plates must reach 7:1 contrast; layer fills 3:1 against the ground.
 * - Dyslexia-friendly: generous line height, avoid wide letter-spacing and justified text.
 */

export type StyleRole = 'title' | 'label' | 'notes' | 'descriptor' | 'attribution';

export interface TypographyRole {
    /** Primary family; appended with the style's fallback stack. '' = fallback only. */
    family: string;
    weight: number;
    /** Font size in px. */
    size: number;
}

/**
 * Roles that can stack multiple lines carry the line height they stack by. Single-line
 * roles (title, label, attribution) take their vertical metrics from layout.titleSpace
 * and label.height instead — no dead lineHeight on those.
 */
export interface MultilineTypographyRole extends TypographyRole {
    lineHeight: number;
}

export interface StyleTypography {
    /** System stack used when a bundled family is unavailable. */
    fallback: string;
    roles: {
        title: TypographyRole;
        label: TypographyRole;
        notes: MultilineTypographyRole;
        descriptor: MultilineTypographyRole;
        attribution: TypographyRole;
    };
    /** [family, weight] pairs to load before first render and embed in exports. */
    fonts: [string, number][];
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
    /** Ink for hand-drawn outlines, frames and hatch patterns. */
    ink: string;
}

export type PatternName = 'none' | 'diag45' | 'diag-45' | 'cross' | 'dots' | 'horizontal';

export interface StyleGradient {
    /** Evenly spaced color stops, drawn along the layer's diagonal (the barf angle). */
    stops: string[];
}

export interface PatternDef {
    name: PatternName;
    /** Default color for this pattern — e.g. a colored-pencil hue. Falls back to ink. */
    color?: string;
}

export interface StyleFills {
    /** 'pattern' cycles `patterns` per layer; 'gradient' cycles `gradients` per layer. */
    mode: 'solid' | 'pattern' | 'gradient';
    patterns: PatternDef[];
    /** Cycled per layer when mode='gradient' (each layer gets its own rainbow). */
    gradients?: StyleGradient[];
    patternSpacing: number;
    patternStroke: number;
    patternOpacity: number;
}

export interface StyleStroke {
    /** Outline drawn around every layer in `ink` (0 = none; separators then apply). */
    layerOutline: number;
    separatorWidth: number;
}

export interface StyleJitter {
    /** Perpendicular wobble amplitude in px; 0 = straight edges. */
    amplitude: number;
    /** Distance between wobble control points. */
    segmentLength: number;
    /** Seed salt so different styles wobble differently but deterministically. */
    salt: number;
}

export type LabelMode = 'chip' | 'plain-halo' | 'plate' | 'bubble';

export interface StyleLabelTreatment {
    mode: LabelMode;
    /** Corner radius of the label box (plate = 0). */
    rx: number;
    padX: number;
    /** Box height in px; the baseline sits 7px below the vertical center. */
    height: number;
    borderWidth: number;
    /** Sticker shadow offset for 'bubble' (0 = none). */
    shadowOffset: number;
    /** Halo stroke width for 'plain-halo'. */
    haloWidth: number;
}

export interface StyleLayout {
    /** Pixels per relative width unit (widths range 0..100) at the reference size. */
    baseUnit: number;
    padding: number;
    /** Band reserved above the pyramid for the title (baseline sits at 62.5% of it). */
    titleSpace: number;
    /** Vertical gap between the pyramid's bottom edge and the descriptor text. */
    descriptorSpace: number;
    targetAspect: number;
    heightAnchor: number;
    minLayerHeight: number;
    maxLayerHeight: number;
    legendWidth: number;
    legendGap: number;
}

export type FrameMode = 'none' | 'single' | 'double';

export interface ChromeTokens {
    '--background': string;
    '--surface': string;
    '--border': string;
    '--text': string;
    '--text-muted': string;
    '--accent': string;
    /**
     * Readable text color ON accent-filled surfaces (primary buttons). Optional: styles
     * with saturated/dark accents can rely on the stylesheet default (white); styles whose
     * accent is a light paper color (draftsman dark) must set a dark ink here.
     */
    '--accent-ink'?: string;
    '--danger': string;
    '--hover': string;
    '--font-ui': string;
}

export interface PyramidStyle {
    /** Stable id used in the URL `#s=` param and localStorage. Never rename shipped ids. */
    id: string;
    /** Display name in the style selector. */
    name: string;
    typography: StyleTypography;
    canvas: { light: CanvasPalette; dark: CanvasPalette };
    fills: StyleFills;
    stroke: StyleStroke;
    jitter: StyleJitter;
    label: StyleLabelTreatment;
    frame: FrameMode;
    /** Draw a vertical rule (in ink) between pyramid and legend. */
    legendRule: boolean;
    /**
     * Short jittered horizontal leader lines from each layer's edge to its notes block
     * (engineering-drawing callouts). Null = none. Complements or replaces legendRule.
     * Own theme-aware color so leaders can sit back from the layer outlines (ink).
     */
    legendLeaders: { width: number; color: { light: string; dark: string } } | null;
    /** Glitter scattered deterministically across the canvas, under all content. */
    sparkles?: {
        count: number;
        colors: string[];
        opacity: number;
        minSize: number;
        maxSize: number;
    } | null;
    layers: {
        /**
         * 'data' honors each layer's stored color (classic — keeps old shared links and
         * reorder semantics intact); 'palette' lets the style palette win positionally
         * unless the layer is marked `colorCustom`.
         */
        colorSource: 'data' | 'palette';
        palette: { light: string[]; dark: string[] };
    };
    layout: StyleLayout;
    chrome: { light: ChromeTokens; dark: ChromeTokens };
}
