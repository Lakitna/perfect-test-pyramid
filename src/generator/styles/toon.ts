import type { PyramidStyle } from './types';

const BALOO = "'Baloo 2'";
const COMIC = "'Comic Neue'";
const STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Cartoon: wobbly ink outlines around every layer, rounded corners, sticker-shadow bubble
 * labels and a saturated playful palette on warm paper. Drawn by an enthusiastic inker.
 */
export const toonStyle: PyramidStyle = {
    id: 'toon',
    name: 'Cartoon',
    typography: {
        fallback: STACK,
        roles: {
            title: { family: BALOO, weight: 800, size: 22 },
            label: { family: BALOO, weight: 600, size: 15 },
            notes: { family: COMIC, weight: 700, size: 13, lineHeight: 17 },
            descriptor: { family: COMIC, weight: 400, size: 13, lineHeight: 17 },
            attribution: { family: COMIC, weight: 400, size: 10 },
        },
        fonts: [
            ['Baloo 2', 600],
            ['Baloo 2', 800],
            ['Comic Neue', 400],
            ['Comic Neue', 700],
        ],
    },
    canvas: {
        light: {
            background: '#fff7ea',
            separator: '#fff7ea',
            notes: '#463c2e',
            hint: '#b3a88f',
            chip: '#ffffff',
            chipStroke: '#16130e',
            chipText: '#16130e',
            title: '#16130e',
            ink: '#16130e',
        },
        dark: {
            // Night-time comic: the ink stays BLACK (cartoon means black lines, day or
            // night) — it reads as seams between the saturated fills and borders the white
            // bubbles. The title turns candy yellow so the sheet still feels lit up.
            background: '#191d2a',
            separator: '#191d2a',
            notes: '#e8ecf5',
            hint: '#5f6b85',
            chip: '#ffffff',
            chipStroke: '#0d0f16',
            chipText: '#16130e',
            title: '#ffd94d',
            ink: '#0d0f16',
        },
    },
    fills: {
        mode: 'solid',
        patterns: [{ name: 'none' }],
        patternSpacing: 6,
        patternStroke: 1,
        patternOpacity: 1,
    },
    stroke: { layerOutline: 4, separatorWidth: 2 },
    jitter: { amplitude: 5, segmentLength: 22, salt: 7 },
    label: {
        mode: 'bubble',
        rx: 12,
        padX: 10,
        height: 32,
        borderWidth: 2.5,
        shadowOffset: 3,
        haloWidth: 0,
    },
    frame: 'single',
    legendRule: false,
    // Comic pointer lines: softer than the black outlines, so they guide without shouting.
    legendLeaders: { width: 1.75, color: { light: '#463c2e', dark: '#e8ecf5ac' } },
    layers: {
        colorSource: 'palette',
        palette: {
            light: ['#ff5d5d', '#12b5a5', '#f7c948', '#4d96ff', '#9b5de5', '#ff9f45'],
            // Dark mode: same candy, pushed to maximum saturation so the fills glow.
            dark: ['#ff4d4d', '#00d9b0', '#ffcc33', '#4d94ff', '#b366ff', '#ff8c1a'],
        },
    },
    layout: {
        baseUnit: 6,
        padding: 18,
        titleSpace: 60,
        descriptorSpace: 30,
        targetAspect: 1.4,
        heightAnchor: 430,
        minLayerHeight: 52,
        maxLayerHeight: 300,
        // Comic Neue at 13px ran wide; a narrower column keeps the notes block compact.
        legendWidth: 340,
        legendGap: 24,
    },
    chrome: {
        light: {
            '--background': '#ffefdb',
            '--surface': '#fff7ea',
            '--border': '#d9c8ab',
            '--text': '#16130e',
            '--text-muted': '#8a7a63',
            '--accent': '#4d96ff',
            '--danger': '#e03131',
            '--hover': '#f7e8d2',
            '--font-ui': `${BALOO}, ${STACK}`,
        },
        dark: {
            '--background': '#12151f',
            '--surface': '#191d2a',
            '--border': '#2c3450',
            '--text': '#fff9ef',
            '--text-muted': '#9aa4b8',
            '--accent': '#6daaff',
            '--danger': '#ff6b6b',
            '--hover': '#232a3d',
            '--font-ui': `${BALOO}, ${STACK}`,
        },
    },
};
