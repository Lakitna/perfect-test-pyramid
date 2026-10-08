import type { PyramidStyle } from './types';

const HYPER = "'Atkinson Hyperlegible'";
const STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * WCAG AAA classic: pure black/white grounds, Atkinson Hyperlegible (designed by the
 * Braille Institute for low-vision readers), oversized chips with 2px borders, and a
 * palette where every layer fill reaches ≥ 3:1 against the ground while all text pairs
 * reach ≥ 7:1. No jitter, no shadows, no decoration — maximum legibility.
 */
export const contrastStyle: PyramidStyle = {
    id: 'contrast',
    name: 'High contrast',
    typography: {
        fallback: STACK,
        roles: {
            title: { family: HYPER, weight: 700, size: 21 },
            label: { family: HYPER, weight: 700, size: 15 },
            notes: { family: HYPER, weight: 400, size: 13, lineHeight: 18 },
            descriptor: { family: HYPER, weight: 400, size: 13, lineHeight: 18 },
            attribution: { family: HYPER, weight: 400, size: 10 },
        },
        fonts: [
            ['Atkinson Hyperlegible', 400],
            ['Atkinson Hyperlegible', 700],
        ],
    },
    canvas: {
        light: {
            background: '#ffffff',
            separator: '#ffffff',
            notes: '#000000',
            hint: '#595959', // 7:1 on white
            chip: '#ffffff',
            chipStroke: '#000000',
            chipText: '#000000', // 21:1 on chip
            title: '#000000',
            ink: '#000000',
        },
        dark: {
            background: '#000000',
            separator: '#000000',
            notes: '#ffffff',
            hint: '#a6a6a6', // 8.5:1 on black
            chip: '#000000',
            chipStroke: '#ffffff',
            chipText: '#ffffff',
            title: '#ffffff',
            ink: '#ffffff',
        },
    },
    fills: {
        mode: 'solid',
        patterns: [{ name: 'none' }],
        patternSpacing: 6,
        patternStroke: 1,
        patternOpacity: 1,
    },
    // Wide ground-colored gaps between layers: every band reads as its own object.
    stroke: { layerOutline: 0, separatorWidth: 6 },
    jitter: { amplitude: 0, segmentLength: 24, salt: 0 },
    label: {
        mode: 'chip',
        rx: 4,
        padX: 9,
        height: 30,
        borderWidth: 2,
        shadowOffset: 0,
        haloWidth: 0,
    },
    frame: 'none',
    legendRule: true,
    legendLeaders: null,
    layers: {
        colorSource: 'palette',
        palette: {
            // All ≥ 3:1 against white; Klein blue leads (also ≥ 7:1, so chip-less text works).
            light: ['#002fa7', '#b1000f', '#005e2e', '#5e0092', '#00676e', '#8a4b00'],
            // All ≥ 3:1 against black.
            dark: ['#6c8cff', '#ff6b6b', '#58d68d', '#bb86fc', '#4dd0e1', '#ffb74d'],
        },
    },
    layout: {
        baseUnit: 6,
        padding: 12,
        titleSpace: 60,
        descriptorSpace: 30,
        targetAspect: 1.4,
        heightAnchor: 430,
        minLayerHeight: 50,
        maxLayerHeight: 300,
        legendWidth: 400,
        legendGap: 24,
    },
    chrome: {
        light: {
            '--background': '#f2f2f2',
            '--surface': '#ffffff',
            '--border': '#000000',
            '--text': '#000000',
            '--text-muted': '#595959',
            '--accent': '#002fa7',
            '--danger': '#b1000f',
            '--hover': '#e6e6e6',
            '--font-ui': `${HYPER}, ${STACK}`,
        },
        dark: {
            '--background': '#0a0a0a',
            '--surface': '#000000',
            '--border': '#ffffff',
            '--text': '#ffffff',
            '--text-muted': '#a6a6a6',
            '--accent': '#6c8cff',
            '--danger': '#ff6b6b',
            '--hover': '#1a1a1a',
            '--font-ui': `${HYPER}, ${STACK}`,
        },
    },
};
