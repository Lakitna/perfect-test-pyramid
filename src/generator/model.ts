/**
 * Data model for the web pyramid generator.
 *
 * A pyramid is a vertical stack of 1..20 equal-height layers. The silhouette is defined by
 * `widths`: one entry per horizontal edge (top edge, every border between two layers, bottom
 * edge). Each layer is drawn as a trapezoid with straight lines between its top and bottom
 * edge, so the result is not always a triangle — that is intentional.
 */

import type { PatternName } from './styles/types';

export interface GeneratorLayer {
    label: string;
    notes: string;
    /** Fill color as #rrggbb */
    color: string;
    /**
     * True once the user hand-picked `color` in the editor. Styles may override layer fills
     * with their own palette, but never override a custom color. Optional so old links
     * (without the field) keep parsing — absent means false.
     */
    colorCustom?: boolean;
    /**
     * Per-layer fill overrides chosen in the editor for styles whose layers are not plain
     * colors. They win over the style's default cycle but lose to `colorCustom`.
     */
    fillPattern?: PatternName;
    /**
     * The layer's own gradient stops (2–6 #rrggbb colors) picked in the editor — renders a
     * custom linearGradient instead of the style's predefined cycle. Like patternColor it
     * recolors the gradient WITHOUT flattening; only meaningful while the layer renders
     * a gradient.
     */
    gradientColors?: string[];
    /**
     * Tint picked for this layer's hatch pattern (draftsman et al.) — recolors the pattern
     * WITHOUT flattening it to a solid fill. Only meaningful while the layer renders a
     * pattern; ignored for solid fills.
     */
    patternColor?: string;
}

export interface PyramidModel {
    version: number;
    /** Optional heading drawn above the pyramid. */
    title?: string;
    /** Optional free-text line drawn below the pyramid — e.g. crediting the preset's creator. */
    descriptor?: string;
    /** Index 0 is the TOP layer of the pyramid. */
    layers: GeneratorLayer[];
    /** Length is always `layers.length + 1`. widths[i] is the top edge of layer i; the last entry is the bottom edge. Values 0..100. */
    widths: number[];
}

/**
 * Deep copy with normalized optional fields. Presets hold static models — the editor mutates
 * models in place, so every application of a preset (or initial load) must clone first.
 */
export function cloneModel(source: PyramidModel): PyramidModel {
    return {
        version: source.version,
        title: source.title ?? '',
        descriptor: source.descriptor ?? '',
        layers: source.layers.map((layer) => ({ ...layer })),
        widths: [...source.widths],
    };
}

export const MODEL_VERSION = 1;
export const MIN_LAYERS = 1;
export const MAX_LAYERS = 20;
export const MIN_WIDTH = 0;
export const MAX_WIDTH = 100;

/** Colors assigned to newly added layers, cycled by layer index. */
export const PALETTE = [
    '#e63946',
    '#f4a261',
    '#e9c46a',
    '#2a9d8f',
    '#457b9d',
    '#1d3557',
    '#b56576',
    '#6d597a',
    '#355c7d',
    '#99b898',
    '#f28482',
    '#84a98c',
];

/**
 * A named, complete pyramid model that can be applied to the editor in one step.
 * `data` is static — callers MUST apply it via cloneModel(), since the editor mutates models.
 */
export interface PyramidPreset {
    name: string;
    data: PyramidModel;
}

/** Full-pyramid presets shown in the toolbar "Preset…" dropdown. More will be added later. */
export const PRESETS: PyramidPreset[] = [
    {
        name: 'Original pyramid',
        data: {
            version: MODEL_VERSION,
            title: 'The Original Test Automation Pyramid',
            descriptor:
                "Created by Mike Cohn.\n\nBook: 'Succeeding with Agile: Software Development Using Scrum' (2009)",
            layers: [
                {
                    label: 'UI',
                    notes: 'Automated user interface testing is placed at the top of the test automation pyramid because we want to do as little of it as possible. We want this because [they are often brittle, expensive to write, and time consuming].',
                    color: PALETTE[0],
                },
                {
                    label: 'Service',
                    notes: 'Testing the services of an application separately from its user interface. Although I refer to [it] as the service layer, I am not restricting us to using only a service-oriented architecture. All applications are made up of various services. In the way I’m using it,a service is something the application does in response to some input or set of inputs.',
                    color: PALETTE[1],
                },
                {
                    label: 'Unit',
                    notes: 'Unit testing should be the foundation of a solid test automation strategy and as such represents the largest part of the pyramid.',
                    color: PALETTE[2],
                },
            ],
            widths: [0, 33, 66, 99],
        },
    },
    {
        name: 'Average pyramid',
        data: {
            version: MODEL_VERSION,
            title: 'The Most Average Test Pyramid',
            descriptor:
                'The most average pyramid based on this dataset: https://github.com/Lakitna/perfect-test-pyramid\n\n- 65% of models are test pyramids\n- Each pyramid has an average of 4 layers (avg: 3.8, min: 1, max: 8)\n- Most used layers: Unit (96%), Integration (73%), End-to-end (57%), GUI (39%), Component (20%)',
            layers: [
                {
                    label: 'End-to-end',
                    notes: 'Used in ~57% of models at an average position of 0% from the top.',
                    color: PALETTE[0],
                },
                {
                    label: 'Integration',
                    notes: 'Used in ~73% of models at an average position of 50% from the top.',
                    color: PALETTE[1],
                },
                {
                    label: 'Component',
                    notes: 'Used in ~20% of models at an average position of 76% from the top.',
                    color: PALETTE[2],
                },
                {
                    label: 'Unit',
                    notes: 'Used in ~96% of models at an average position of 96% from the top.',
                    color: PALETTE[3],
                },
            ],
            widths: [0, 25, 50, 75, 100],
        },
    },
    {
        name: 'Better pyramid',
        data: {
            version: MODEL_VERSION,
            title: 'A Better Test Pyramid',
            descriptor: 'Created by me. Optimized for communication and adaptability.',
            layers: [
                {
                    label: 'Multi-application',
                    notes: 'Multiple applications together.',
                    color: PALETTE[0],
                },
                {
                    label: 'Single application',
                    notes: 'A full application in isolation.',
                    color: PALETTE[1],
                },
                {
                    label: 'Part of application',
                    notes: 'Any part of your application. Common terms include: page, component, module, class.',
                    color: PALETTE[2],
                },
                {
                    label: 'Unit',
                    notes: 'A single function or class method.',
                    color: PALETTE[3],
                },
                {
                    label: 'Line of code',
                    notes: 'One or more lines of code.',
                    color: PALETTE[4],
                },
            ],
            widths: [0, 20, 40, 60, 80, 100],
        },
    },
    {
        name: 'Original trophy',
        data: {
            version: MODEL_VERSION,
            title: 'The Original Test Trophy',
            descriptor:
                'Created by Kent C. Dodds.\n\nhttps://kentcdodds.com/blog/the-testing-trophy-and-testing-classifications (2021)',
            layers: [
                {
                    label: 'End-to-end',
                    notes: 'A helper robot that behaves like a user to click around the app and very that it functions correctly.',
                    color: PALETTE[0],
                },
                {
                    label: 'Integration',
                    notes: 'Verify that several units work together in harmony.',
                    color: PALETTE[1],
                },
                {
                    label: 'Unit',
                    notes: 'Verify that individual, isolated parts work as expected.',
                    color: PALETTE[2],
                },
                {
                    label: 'Static',
                    notes: 'Catch typos and type errors as you write the code.',
                    color: PALETTE[3],
                },
            ],
            widths: [0, 75, 75, 25, 50],
        },
    },
    {
        name: 'Original honeycomb',
        data: {
            version: MODEL_VERSION,
            title: 'The Original Testing Honeycomb',
            descriptor:
                'Created by André Schaffer for Spotify.\n\nhttps://engineering.atspotify.com/2018/01/testing-of-microservices (2018)',
            layers: [
                {
                    label: 'Integrated',
                    notes: 'A test that will pass or fail based on the correctness of another system.',
                    color: PALETTE[0],
                },
                {
                    label: 'Integration',
                    notes: 'Verify the correctness of our service in a more isolated fashion while focusing on the interaction points and making them very explicit.',
                    color: PALETTE[1],
                },
                {
                    label: 'Implementation detail',
                    notes: 'Tests for parts of the code that are naturally isolated and have an internal complexity of their own.',
                    color: PALETTE[2],
                },
            ],
            widths: [0, 67, 67, 0],
        },
    },
    {
        name: 'Empty',
        data: {
            version: MODEL_VERSION,
            title: '',
            descriptor: '',
            layers: [
                {
                    label: '',
                    notes: '',
                    color: PALETTE[0],
                },
                {
                    label: '',
                    notes: '',
                    color: PALETTE[1],
                },
                {
                    label: '',
                    notes: '',
                    color: PALETTE[2],
                },
            ],
            widths: [100, 100, 100, 100],
        },
    },
];

export function clampWidth(value: number): number {
    if (!Number.isFinite(value)) return MIN_WIDTH;
    return Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, Math.round(value)));
}

/**
 * Create a layer for position `index`, cycling through the palette so its color does not
 * duplicate the colors of the layers it will end up next to.
 */
export function newLayer(model: PyramidModel, index: number): GeneratorLayer {
    const above = model.layers[index - 1]?.color;
    const below = model.layers[index]?.color;
    let color = PALETTE[index % PALETTE.length];
    for (let offset = 0; offset < PALETTE.length; offset++) {
        const candidate = PALETTE[(index + offset) % PALETTE.length];
        if (candidate !== above && candidate !== below) {
            color = candidate;
            break;
        }
    }
    return {
        label: `Layer ${index + 1}`,
        notes: '',
        color,
    };
}

/**
 * Insert a new layer at position `at` (0 = above the current top layer, layers.length = below
 * the current bottom layer). The new border gets the average width of its neighbors.
 */
export function insertLayer(model: PyramidModel, at: number): boolean {
    if (model.layers.length >= MAX_LAYERS) return false;

    const position = Math.max(0, Math.min(model.layers.length, at));
    model.layers.splice(position, 0, newLayer(model, position));

    const top = model.widths[position];
    const bottom = model.widths[position + 1] ?? top;
    model.widths.splice(position + 1, 0, Math.round((top + bottom) / 2));
    return true;
}

/** Remove the layer at `index`, collapsing the border below it. */
export function removeLayer(model: PyramidModel, index: number): boolean {
    if (model.layers.length <= MIN_LAYERS) return false;
    if (index < 0 || index >= model.layers.length) return false;

    model.layers.splice(index, 1);
    model.widths.splice(index + 1, 1);
    return true;
}

/**
 * Swap a layer with its neighbor. The silhouette (widths) is positional and stays untouched;
 * only the layer contents move.
 */
export function moveLayer(model: PyramidModel, index: number, offset: -1 | 1): boolean {
    const target = index + offset;
    if (target < 0 || target >= model.layers.length) return false;

    const swapped = model.layers[target];
    model.layers[target] = model.layers[index];
    model.layers[index] = swapped;
    return true;
}

/**
 * Move the layer at `from` so it ends up at index `to` (indices in the array after removal).
 * The silhouette (widths) is positional and stays untouched.
 */
export function reorderLayer(model: PyramidModel, from: number, to: number): boolean {
    if (from < 0 || from >= model.layers.length) return false;
    const target = Math.max(0, Math.min(model.layers.length - 1, to));
    if (target === from) return false;

    const [layer] = model.layers.splice(from, 1);
    model.layers.splice(target, 0, layer);
    return true;
}

export function canAddLayer(model: PyramidModel): boolean {
    return model.layers.length < MAX_LAYERS;
}

export const SHAPES = [
    'pyramid',
    'inverted-pyramid',
    'honeycomb',
    'rectangle',
    'trophy',
    'eiffel-tower',
    'inverted-eiffel-tower',
] as const;
export type ShapeName = (typeof SHAPES)[number];

export const SHAPE_LABELS: Record<ShapeName, string> = {
    pyramid: 'Pyramid',
    'inverted-pyramid': 'Inverted pyramid',
    honeycomb: 'Honeycomb',
    rectangle: 'Rectangle',
    trophy: 'Trophy',
    'eiffel-tower': 'Eiffel tower',
    'inverted-eiffel-tower': 'Inverted Eiffel tower',
};

/** Normalized width (0..1) of a shape at vertical position t (0 = top edge, 1 = bottom edge). */
function shapeProfile(shape: ShapeName, t: number): number {
    switch (shape) {
        case 'pyramid':
            return t;
        case 'inverted-pyramid':
            return 1 - t;
        case 'rectangle':
            return 1;
        case 'honeycomb':
            // Wide middle, tapered top and bottom (hexagon silhouette).
            return 1 - Math.abs(t - 0.5) * 2;
        case 'trophy':
            // Honeycomb cup with a flared base.
            if (t < 0.8) {
                const u = t / 0.8;
                return 1 - Math.abs(u - 0.5) * 2;
            }
            return 0.4 + ((t - 0.8) / 0.2) * 0.35;
        case 'eiffel-tower':
            return Math.pow(t, 2);
        case 'inverted-eiffel-tower':
            return 1 - (-Math.pow(t, 2) + 2 * t);
    }
}

/**
 * Set every edge width to the values of the given shape. The widths stay editable — the shape
 * is a one-time layout, not a lock.
 */
export function applyShape(model: PyramidModel, shape: ShapeName): void {
    const layerCount = model.layers.length;
    for (let edge = 0; edge <= layerCount; edge++) {
        model.widths[edge] = clampWidth(Math.round(shapeProfile(shape, edge / layerCount) * 100));
    }
}

export function canRemoveLayer(model: PyramidModel): boolean {
    return model.layers.length > MIN_LAYERS;
}

const COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
const PATTERN_NAMES: readonly string[] = [
    'none',
    'diag45',
    'diag-45',
    'cross',
    'dots',
    'horizontal',
];

/**
 * Validate and sanitize unknown data (e.g. JSON decoded from the URL) into a PyramidModel.
 * Returns null when the data cannot be interpreted as a model of the current version.
 */
export function parseModel(input: unknown): PyramidModel | null {
    if (typeof input !== 'object' || input === null) return null;

    const obj = input as Record<string, unknown>;
    if (obj.version !== MODEL_VERSION) return null;
    if (!Array.isArray(obj.layers) || !Array.isArray(obj.widths)) return null;
    if (obj.layers.length < MIN_LAYERS || obj.layers.length > MAX_LAYERS) return null;
    if (obj.widths.length !== obj.layers.length + 1) return null;
    if (obj.title !== undefined && typeof obj.title !== 'string') return null;
    if (obj.descriptor !== undefined && typeof obj.descriptor !== 'string') return null;

    const layers: GeneratorLayer[] = [];
    for (const rawLayer of obj.layers) {
        if (typeof rawLayer !== 'object' || rawLayer === null) return null;
        const layer = rawLayer as Record<string, unknown>;
        if (typeof layer.label !== 'string') return null;
        if (typeof layer.notes !== 'string') return null;
        if (typeof layer.color !== 'string' || !COLOR_PATTERN.test(layer.color)) return null;
        if (layer.colorCustom !== undefined && typeof layer.colorCustom !== 'boolean') {
            return null;
        }
        if (
            layer.fillPattern !== undefined &&
            !PATTERN_NAMES.includes(layer.fillPattern as string)
        ) {
            return null;
        }
        if (
            layer.patternColor !== undefined &&
            (typeof layer.patternColor !== 'string' || !COLOR_PATTERN.test(layer.patternColor))
        ) {
            return null;
        }
        if (
            layer.gradientColors !== undefined &&
            (!Array.isArray(layer.gradientColors) ||
                layer.gradientColors.length < 2 ||
                layer.gradientColors.length > 6 ||
                !layer.gradientColors.every((c) => typeof c === 'string' && COLOR_PATTERN.test(c)))
        ) {
            return null;
        }
        layers.push({
            label: layer.label,
            notes: layer.notes,
            color: layer.color.toLowerCase(),
            // Only serialize the flag when set, to keep URL payloads small.
            ...(layer.colorCustom === true ? { colorCustom: true } : {}),
            ...(typeof layer.fillPattern === 'string'
                ? { fillPattern: layer.fillPattern as PatternName }
                : {}),
            ...(typeof layer.patternColor === 'string'
                ? { patternColor: layer.patternColor.toLowerCase() }
                : {}),
            ...(Array.isArray(layer.gradientColors)
                ? {
                      gradientColors: (layer.gradientColors as string[]).map((c) =>
                          c.toLowerCase()
                      ),
                  }
                : {}),
        });
    }

    const widths: number[] = [];
    for (const rawWidth of obj.widths) {
        if (typeof rawWidth !== 'number' || !Number.isFinite(rawWidth)) return null;
        widths.push(clampWidth(rawWidth));
    }

    return {
        version: MODEL_VERSION,
        title: typeof obj.title === 'string' ? obj.title : '',
        descriptor: typeof obj.descriptor === 'string' ? obj.descriptor : '',
        layers,
        widths,
    };
}
