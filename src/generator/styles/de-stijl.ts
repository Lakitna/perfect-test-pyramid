import type { PyramidStyle } from './types';

const JOST = "'Jost'";
const STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * De Stijl (Rietveld / Mondriaan): flat primary fields separated by heavy black rules,
 * right angles only, geometric Jost lettering, an outer frame and a vertical rule
 * dividing pyramid from legend. The composition is a grid; the pyramid is just in it.
 */
export const deStijlStyle: PyramidStyle = {
    id: 'de-stijl',
    name: 'De Stijl',
    typography: {
        fallback: STACK,
        roles: {
            title: { family: JOST, weight: 500, size: 21 },
            label: { family: JOST, weight: 600, size: 15 },
            notes: { family: JOST, weight: 400, size: 12.5, lineHeight: 16 },
            descriptor: { family: JOST, weight: 400, size: 12.5, lineHeight: 16 },
            attribution: { family: JOST, weight: 400, size: 10 },
        },
        fonts: [
            ['Jost', 400],
            ['Jost', 500],
            ['Jost', 600],
        ],
    },
    canvas: {
        light: {
            background: '#f4f1e8',
            separator: '#111111',
            notes: '#1c1a17',
            hint: '#8d887c',
            chip: '#ffffff',
            chipStroke: '#111111',
            chipText: '#111111',
            title: '#111111',
            ink: '#111111',
        },
        dark: {
            background: '#0b0b0b',
            separator: '#f4f1e8',
            notes: '#d8d4c8',
            hint: '#6b675e',
            chip: '#f4f1e8',
            chipStroke: '#111111',
            chipText: '#0b0b0b',
            title: '#f4f1e8',
            ink: '#111111',
        },
    },
    fills: {
        mode: 'solid',
        patterns: [{ name: 'none' }],
        patternSpacing: 6,
        patternStroke: 1,
        patternOpacity: 1,
    },
    stroke: { layerOutline: 10, separatorWidth: 6 },
    jitter: { amplitude: 0, segmentLength: 24, salt: 0 },
    label: {
        mode: 'plate',
        rx: 0,
        padX: 8,
        height: 28,
        borderWidth: 2,
        shadowOffset: 0,
        haloWidth: 0,
    },
    frame: 'single',
    legendRule: true,
    legendLeaders: null,
    layers: {
        colorSource: 'palette',
        palette: {
            light: ['#dd0100', '#002fa7', '#ffffff', '#e8b100'],
            dark: ['#dd0100', '#3443e4', '#f4f1e8', '#e8b100'],
        },
    },
    layout: {
        baseUnit: 6,
        padding: 24,
        titleSpace: 64,
        descriptorSpace: 30,
        targetAspect: 1.4,
        heightAnchor: 430,
        minLayerHeight: 50,
        maxLayerHeight: 300,
        legendWidth: 400,
        legendGap: 28,
    },
    chrome: {
        light: {
            '--background': '#eae6da',
            '--surface': '#f4f1e8',
            '--border': '#c9c4b5',
            '--text': '#111111',
            '--text-muted': '#55524a',
            '--accent': '#002fa7',
            '--danger': '#dd0100',
            '--hover': '#e0dbcc',
            '--font-ui': `${JOST}, ${STACK}`,
        },
        dark: {
            '--background': '#050505',
            '--surface': '#0b0b0b',
            '--border': '#3a3833',
            '--text': '#f4f1e8',
            '--text-muted': '#9a958a',
            '--accent': '#6c8cff',
            '--danger': '#ff5d5d',
            '--hover': '#1a1a17',
            '--font-ui': `${JOST}, ${STACK}`,
        },
    },
};
