import { PALETTE } from '../model';
import type { PyramidStyle } from './types';

const SYSTEM_STACK =
    "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * The original look, extracted verbatim from the pre-style-system render.ts so that switching
 * to 'classic' (and every link made before styles existed) renders exactly as before.
 */
export const classicStyle: PyramidStyle = {
    id: 'classic',
    name: 'Classic',
    typography: {
        fallback: SYSTEM_STACK,
        roles: {
            title: { family: '', weight: 700, size: 20 },
            label: { family: '', weight: 600, size: 14 },
            notes: { family: '', weight: 400, size: 12, lineHeight: 15 },
            descriptor: { family: '', weight: 400, size: 13, lineHeight: 17 },
            attribution: { family: '', weight: 400, size: 10 },
        },
        fonts: [],
    },
    canvas: {
        light: {
            background: '#ffffff',
            separator: '#ffffff',
            notes: '#555555',
            hint: '#9aa5b1',
            chip: '#ffffff',
            chipStroke: '#00000022',
            chipText: '#1c1c1c',
            title: '#1c1c1c',
            ink: '#1c1c1c',
        },
        dark: {
            background: '#1e232b',
            separator: '#1e232b',
            notes: '#a9b3c0',
            hint: '#5f6b7a',
            chip: '#2a313c',
            chipStroke: '#ffffff33',
            chipText: '#e6e9ee',
            title: '#e6e9ee',
            ink: '#e6e9ee',
        },
    },
    fills: {
        mode: 'solid',
        patterns: [{ name: 'none' }],
        patternSpacing: 6,
        patternStroke: 1,
        patternOpacity: 1,
    },
    stroke: { layerOutline: 0, separatorWidth: 2 },
    jitter: { amplitude: 0, segmentLength: 24, salt: 0 },
    label: {
        mode: 'chip',
        rx: 5,
        padX: 7,
        height: 29,
        borderWidth: 1,
        shadowOffset: 0,
        haloWidth: 0,
    },
    frame: 'none',
    legendRule: false,
    legendLeaders: null,
    layers: { colorSource: 'data', palette: { light: PALETTE, dark: PALETTE } },
    layout: {
        baseUnit: 6,
        padding: 12,
        titleSpace: 48,
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
            '--background': '#f5f6f8',
            '--surface': '#ffffff',
            '--border': '#dfe3e8',
            '--text': '#1c1c1c',
            '--text-muted': '#5f6b7a',
            '--accent': '#2a6df4',
            '--danger': '#c0392b',
            '--hover': '#eef1f5',
            '--font-ui': SYSTEM_STACK,
        },
        dark: {
            '--background': '#14171d',
            '--surface': '#1e232b',
            '--border': '#3a4250',
            '--text': '#e6e9ee',
            '--text-muted': '#9aa4b2',
            '--accent': '#5b8cff',
            '--danger': '#ff7b72',
            '--hover': '#2a313c',
            '--font-ui': SYSTEM_STACK,
        },
    },
};
