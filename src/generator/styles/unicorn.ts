import type { PyramidStyle } from './types';

const FREDOKA = "'Fredoka'";
const QUICKSAND = "'Quicksand'";
const STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Unicorn: maximum candy. Every layer is its own diagonal pastel rainbow, bubbles
 * have pink sticker shadows, glitter is scattered across the whole sheet, and Fredoka
 * rounds everything within an inch of its life. Unapologetically too much — that is the
 * point. Text contrast stays readable (deep plum on white bubbles) per the house rules.
 */
export const unicornStyle: PyramidStyle = {
    id: 'unicorn',
    name: 'Unicorn',
    typography: {
        fallback: STACK,
        roles: {
            title: { family: FREDOKA, weight: 700, size: 23 },
            label: { family: FREDOKA, weight: 600, size: 15 },
            notes: { family: QUICKSAND, weight: 500, size: 13, lineHeight: 17 },
            descriptor: { family: QUICKSAND, weight: 400, size: 12.5, lineHeight: 16 },
            attribution: { family: QUICKSAND, weight: 400, size: 10 },
        },
        fonts: [
            ['Fredoka', 400],
            ['Fredoka', 600],
            ['Fredoka', 700],
            ['Quicksand', 400],
            ['Quicksand', 500],
        ],
    },
    canvas: {
        light: {
            background: '#ffe9fb',
            separator: '#ffe9fb',
            notes: '#5b2a72',
            hint: '#c98fd6',
            chip: '#ffffff',
            chipStroke: '#ff5fbf',
            chipText: '#5b1246',
            title: '#a01a8c',
            ink: '#ff5fbf',
        },
        dark: {
            background: '#241033',
            separator: '#241033',
            notes: '#e6d2f2',
            hint: '#8a5fa8',
            chip: '#ffffff',
            chipStroke: '#ff7ac6',
            chipText: '#3d0c33',
            title: '#ffb3e6',
            ink: '#ff7ac6',
        },
    },
    fills: {
        mode: 'gradient',
        patterns: [{ name: 'none' }],
        gradients: [
            { stops: ['#ff9a9e', '#fad0c4', '#fbc2eb'] },
            { stops: ['#a18cd1', '#fbc2eb', '#f6d5f7'] },
            { stops: ['#8ec5fc', '#e0c3fc', '#fbc2eb'] },
            { stops: ['#84fab0', '#8fd3f4', '#a1c4fd'] },
            { stops: ['#fbc2eb', '#a6c1ee', '#c3aed6'] },
            { stops: ['#ffecd2', '#fcb69f', '#ff9a9e'] },
        ],
        patternSpacing: 6,
        patternStroke: 1,
        patternOpacity: 1,
    },
    stroke: { layerOutline: 4, separatorWidth: 2 },
    jitter: { amplitude: 0, segmentLength: 24, salt: 0 },
    label: {
        mode: 'bubble',
        rx: 16,
        padX: 10,
        height: 32,
        borderWidth: 2.5,
        shadowOffset: 5,
        haloWidth: 0,
    },
    frame: 'single',
    legendRule: false,
    legendLeaders: null,
    sparkles: {
        count: 50,
        colors: ['#ffffff', '#ffd6f5', '#fff3b0'],
        opacity: 0.8,
        minSize: 3,
        maxSize: 8,
    },
    layers: {
        colorSource: 'palette',
        palette: {
            // Swatch strip + fallback fills: candy solids near the gradient midpoints.
            light: ['#ff9ad5', '#c79bff', '#8fd0ff', '#95e6c3', '#c3aed6', '#ffb3a7'],
            dark: ['#ff9ad5', '#c79bff', '#8fd0ff', '#95e6c3', '#c3aed6', '#ffb3a7'],
        },
    },
    layout: {
        baseUnit: 6,
        padding: 18,
        titleSpace: 48,
        descriptorSpace: 30,
        targetAspect: 1.4,
        heightAnchor: 430,
        minLayerHeight: 52,
        maxLayerHeight: 300,
        legendWidth: 400,
        legendGap: 24,
    },
    chrome: {
        light: {
            '--background': '#ffdff5',
            '--surface': '#fff0fb',
            '--border': '#f2b8e5',
            '--text': '#5b2a72',
            '--text-muted': '#9a6cae',
            '--accent': '#d6187c',
            '--danger': '#e03131',
            '--hover': '#ffe4f6',
            '--font-ui': `${FREDOKA}, ${STACK}`,
        },
        dark: {
            '--background': '#180a24',
            '--surface': '#241033',
            '--border': '#4a2a66',
            '--text': '#f5e6ff',
            '--text-muted': '#b795d1',
            '--accent': '#ff7ac6',
            '--danger': '#ff8787',
            '--hover': '#301646',
            '--font-ui': `${FREDOKA}, ${STACK}`,
        },
    },
};
