import type { PyramidStyle } from './types';

const HAND = "'Patrick Hand'";
const MONO = "'IBM Plex Mono'";
const STACK = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

/**
 * Black-and-white engineering drawing, hand-drawn and wall-art grade: wobbled ink lines,
 * hatch patterns instead of fills, a double border frame, lettering-architect handwriting
 * with mono annotations. The pyramid reads as a drawing sheet.
 */
export const draftsmanStyle: PyramidStyle = {
    id: 'draftsman',
    name: 'Draftsman',
    typography: {
        fallback: STACK,
        roles: {
            title: { family: HAND, weight: 400, size: 22 },
            label: { family: HAND, weight: 400, size: 16 },
            notes: { family: MONO, weight: 400, size: 11.5, lineHeight: 15 },
            descriptor: { family: MONO, weight: 400, size: 11.5, lineHeight: 15 },
            attribution: { family: MONO, weight: 400, size: 9.5 },
        },
        fonts: [
            ['Patrick Hand', 400],
            ['IBM Plex Mono', 400],
        ],
    },
    canvas: {
        light: {
            background: '#fbfaf6',
            separator: '#fbfaf6',
            notes: '#3a382f',
            hint: '#a8a49a',
            chip: '#fbfaf6',
            chipStroke: '#1c1c1a',
            chipText: '#1c1c1a',
            title: '#1c1c1a',
            ink: '#1c1c1a',
        },
        dark: {
            background: '#17181a',
            separator: '#17181a',
            notes: '#c9c5b8',
            hint: '#6b675e',
            chip: '#17181a',
            chipStroke: '#f2efe6',
            chipText: '#f2efe6',
            title: '#f2efe6',
            ink: '#f2efe6',
        },
    },
    fills: {
        mode: 'pattern',
        // Colored-pencil hatching over engineering ink: muted, slightly chalky hues like a
        // classic pencil tin. The bare-paper layer stays colorless; users can re-tint any
        // hatch with the toolbar picker (it colors the pattern, never flattens it).
        patterns: [
            { name: 'diag45', color: '#b3455a' },
            { name: 'diag-45', color: '#3f6fb5' },
            { name: 'cross', color: '#7a5fae' },
            { name: 'horizontal', color: '#c07a2e' },
            { name: 'dots', color: '#4f8f5f' },
            { name: 'none' },
        ],
        patternSpacing: 10,
        patternStroke: 2,
        patternOpacity: 0.75,
    },
    stroke: { layerOutline: 1.5, separatorWidth: 1 },
    jitter: { amplitude: 1, segmentLength: 26, salt: 11 },
    label: {
        mode: 'plain-halo',
        rx: 0,
        padX: 0,
        height: 0,
        borderWidth: 0,
        shadowOffset: 0,
        haloWidth: 10,
    },
    frame: 'double',
    legendRule: false,
    // Engineering drawing: thin graphite-gray leader lines (lighter than the ink outlines)
    // from each band to its annotation.
    legendLeaders: { width: 0.9, color: { light: '#8a867c', dark: '#8a857a' } },
    layers: {
        colorSource: 'palette',
        palette: {
            // Selector swatches: the pencil tin (layers themselves are hatched, not filled).
            light: ['#b3455a', '#3f6fb5', '#4f8f5f', '#7a5fae', '#c07a2e', '#4a4a4a'],
            dark: ['#d4607a', '#6c8fd8', '#6fae7f', '#9a80c8', '#d99a52', '#b8b5ac'],
        },
    },
    layout: {
        baseUnit: 6,
        padding: 20,
        titleSpace: 50,
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
            '--background': '#efece3',
            '--surface': '#fbfaf6',
            '--border': '#d5d0c2',
            '--text': '#1c1c1a',
            '--text-muted': '#6b6a64',
            '--accent': '#1c1c1a',
            // The accent is graphite ink — accent-filled surfaces need paper text.
            '--accent-ink': '#fbfaf6',
            '--danger': '#a4161a',
            '--hover': '#e7e2d5',
            '--font-ui': `${MONO}, ${STACK}`,
        },
        dark: {
            '--background': '#101113',
            '--surface': '#17181a',
            '--border': '#3a3a38',
            '--text': '#f2efe6',
            '--text-muted': '#a8a49a',
            '--accent': '#f2efe6',
            // The accent is paper itself — white-on-paper would vanish, so use ink.
            '--accent-ink': '#17181a',
            '--danger': '#e06060',
            '--hover': '#222326',
            '--font-ui': `${MONO}, ${STACK}`,
        },
    },
};
